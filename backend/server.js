import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";

import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
import pdfParse from "pdf-parse";

dotenv.config();

const key = process.env.GEMINI_API_KEY;

console.log("Gemini key loaded:", Boolean(key));
console.log("Gemini key length:", key?.trim().length);

const app = express();
const PORT = process.env.PORT || 5000;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")) {
      cb(null, true);
    } else {
      cb(new Error("Please upload a PDF file."));
    }
  }
});


const allowedOrigins = [
  "http://localhost:5173",
  "https://documind-ai-hdmt.onrender.com"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "2mb" }));

// Prototype-only in-memory sessions. Restarting the server clears uploaded documents.
const documents = new Map();

function chunkText(text, maxChars = 14000) {
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const chunks = [];
  let current = "";
  for (const paragraph of paragraphs.length ? paragraphs : [text]) {
    if (paragraph.length > maxChars) {
      if (current) chunks.push(current), current = "";
      for (let i = 0; i < paragraph.length; i += maxChars) chunks.push(paragraph.slice(i, i + maxChars));
      continue;
    }
    if ((current + "\n\n" + paragraph).length > maxChars && current) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = current ? current + "\n\n" + paragraph : paragraph;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function configuredModels() {
  const primary = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const fallback = (process.env.GEMINI_FALLBACK_MODELS || "gemini-3.5-flash-lite,gemini-3.6-flash")
    .split(",").map(x => x.trim()).filter(Boolean);
  return [...new Set([primary, ...fallback])];
}

async function askGemini(prompt, options = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  let lastError;
  for (const model of configuredModels()) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
        const generationConfig = { maxOutputTokens: options.maxOutputTokens || 3000 };
        if (options.responseMimeType) generationConfig.responseMimeType = options.responseMimeType;

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig
          }),
          signal: AbortSignal.timeout(90000)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message = data?.error?.message || `AI provider returned HTTP ${response.status}`;
          const err = new Error(`${model}: ${message}`);
          err.status = response.status;
          throw err;
        }
        const candidate = data?.candidates?.[0];

        const text = candidate?.content?.parts
          ?.map(part => part.text || "")
          .join("")
          .trim();

        if (!text) {
          const finishReason = candidate?.finishReason || "unknown";
          const blockReason = data?.promptFeedback?.blockReason || "none";

          throw new Error(
            `${model}: Empty response. ` +
            `Finish reason: ${finishReason}. ` +
            `Prompt block reason: ${blockReason}.`
          );
        }

        return text;
      } catch (err) {
        lastError = err;
        const transient = [408, 429, 500, 502, 503, 504].includes(err.status) ||
          /high demand|temporar|overload|resource exhausted/i.test(err.message || "") ||
          ["TimeoutError", "AbortError", "TypeError"].includes(err.name);
        if (!transient) break;
        if (attempt < 2) {
          const delay = Math.min(1000 * (2 ** attempt) + Math.floor(Math.random() * 400), 6000);
          console.warn(`Gemini ${model} temporarily failed; retrying in ${delay}ms.`);
          await wait(delay);
        }
      }
    }
    console.warn(`Gemini model ${model} failed; trying the next configured model.`);
  }
  throw new Error(
    `All configured Gemini models failed. Last error: ${lastError?.message || "Unknown error"}. ` +
    "Check model availability and your Google AI Studio quota."
  );
}

function requireDocument(req, res) {
  const doc = documents.get(req.params.id);
  if (!doc) {
    res.status(404).json({ error: "This PDF session was not found. Please upload the PDF again." });
    return null;
  }
  return doc;
}

function demoSummary(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  const sentences = clean.match(/[^.!?]+[.!?]?/g) || [clean];
  const chosen = sentences.slice(0, Math.min(5, sentences.length)).map(s => s.trim()).filter(Boolean);
  return `Demo-mode summary (not AI-generated):\n\n${chosen.join(" ")}\n\nKey idea: Review the source text above and configure GEMINI_API_KEY in backend/.env to generate a real AI summary.`;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, aiEnabled: Boolean(process.env.GEMINI_API_KEY), model: MODEL });
});

app.post("/api/upload", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Choose a PDF file first." });
    const parsed = await pdfParse(req.file.buffer);
    const text = (parsed.text || "").replace(/\u0000/g, "").trim();
    if (text.length < 20) {
      return res.status(422).json({
        error: "Very little selectable text was found. This may be a scanned/image-only PDF; OCR support is not included in this prototype."
      });
    }
    const id = randomUUID();
    const doc = {
      id,
      name: req.file.originalname,
      text,
      pages: parsed.numpages || null,
      uploadedAt: new Date().toISOString()
    };
    documents.set(id, doc);
    res.json({
      id, name: doc.name, pages: doc.pages,
      characters: text.length,
      preview: text.slice(0, 1800),
      text,
      aiEnabled: Boolean(process.env.GEMINI_API_KEY)
    });
  } catch (error) {
    res.status(400).json({ error: error.message || "Could not read this PDF." });
  }
});

app.post("/api/documents/:id/summarize-selection", async (req, res) => {
  const doc = requireDocument(req, res);
  if (!doc) return;
  const selectedText = String(req.body?.text || "").trim();
  if (selectedText.length < 10) return res.status(400).json({ error: "Select a little more text first (at least 10 characters)." });
  try {
    const prompt = `Summarize only the selected passage from a student's PDF. Preserve the original meaning, use clear student-friendly language, and do not introduce facts not present in the passage. Return: 1) a concise summary, 2) up to 3 key points if useful.\n\nSELECTED PASSAGE:\n${selectedText}`;
    const result = await askGemini(prompt);
    res.json({
      mode: result ? "ai" : "demo",
      summary: result || demoSummary(selectedText)
    });
  } catch (error) {
    res.status(502).json({ error: `AI request failed: ${error.message}` });
  }
});


app.post("/api/documents/:id/summarize", async (req, res) => {
  const doc = requireDocument(req, res);
  if (!doc) return;

  try {
    const chunks = chunkText(doc.text);

    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        mode: "demo",
        chunks: chunks.length,
        summary: demoSummary(doc.text),
      });
    }

    // If the whole PDF fits in one chunk, summarize it normally.
    if (chunks.length === 1) {
      try {
        const result = await askGemini(
          `Create a helpful study summary of the PDF text below.
Include a short overview, main concepts, key definitions, and
important takeaways. Do not invent facts. Use headings and
concise bullets.

PDF TEXT:
${chunks[0]}`
        );

        return res.json({
          mode: result ? "ai" : "demo",
          summary: result || demoSummary(doc.text),
          chunks: 1,
          skippedChunks: [],
        });
      } catch (error) {
        if (
          /PROHIBITED_CONTENT|Finish reason: SAFETY/i.test(
            error.message || ""
          )
        ) {
          return res.status(422).json({
            error:
              "Gemini's safety filter blocked the full-PDF summary " +
              "for this book. Paragraph summaries may still work. " +
              "The app has not bypassed the filter.",
          });
        }

        throw error;
      }
    }

    const partials = [];
    const skippedChunks = [];

    // Summarize each section independently.
    for (let i = 0; i < chunks.length; i++) {
      try {
        const part = await askGemini(
          `Summarize section ${i + 1} of ${chunks.length} of a
student's PDF. Capture important facts, definitions, arguments,
and examples. Do not invent details. Keep it concise.

SECTION:
${chunks[i]}`
        );

        partials.push({
          section: i + 1,
          summary: part,
        });
      } catch (error) {
        if (
          /PROHIBITED_CONTENT|Finish reason: SAFETY/i.test(
            error.message || ""
          )
        ) {
          skippedChunks.push(i + 1);
          console.warn(
            `Section ${i + 1} was blocked by Gemini's safety filter.`
          );
          continue;
        }

        throw error;
      }
    }

    if (partials.length === 0) {
      return res.status(422).json({
        error:
          "Gemini's safety filter blocked all sections of this book. " +
          "The whole-PDF AI summary could not be generated.",
      });
    }

    const sectionText = partials
      .map(
        (item) =>
          `SECTION ${item.section} SUMMARY:\n${item.summary}`
      )
      .join("\n\n---\n\n");

    let finalSummary;

    try {
      finalSummary = await askGemini(
        `Combine the section summaries below into one coherent
study guide. Remove repetition. Include an overview, topic-wise
key points, definitions, and final takeaways. Do not add
unsupported facts.

${skippedChunks.length
  ? `Some sections were omitted because Gemini's safety filter blocked them: ${skippedChunks.join(", ")}. Do not claim that the summary covers those sections.`
  : ""}

SECTION SUMMARIES:
${sectionText}`
      );
    } catch (error) {
      if (
        !/PROHIBITED_CONTENT|Finish reason: SAFETY/i.test(
          error.message || ""
        )
      ) {
        throw error;
      }

      // Keep the summaries already generated instead of failing
      // the entire request if the final combining step is blocked.
      finalSummary =
        "Summary of the sections that could be processed:\n\n" +
        partials
          .map(
            (item) =>
              `Section ${item.section}\n${item.summary}`
          )
          .join("\n\n");
    }

    if (skippedChunks.length > 0) {
      finalSummary +=
        "\n\nNote: Sections " +
        skippedChunks.join(", ") +
        " were omitted because Gemini's safety filter blocked them. " +
        "This is a partial summary, not a complete summary of the book.";
    }

    return res.json({
      mode: "ai",
      summary: finalSummary,
      chunks: chunks.length,
      skippedChunks,
    });
  } catch (error) {
    console.error("Whole-PDF summary failed:", error.message);

    return res.status(502).json({
      error: `AI request failed: ${error.message}`,
    });
  }
});


app.post("/api/documents/:id/quiz", async (req, res) => {
  const doc = requireDocument(req, res);
  if (!doc) return;
  try {
    const source = doc.text.length > 18000 ? chunkText(doc.text).slice(0, 4).join("\n\n") : doc.text;
    const prompt = `Create exactly 10 useful study questions based only on the PDF text. Mix conceptual questions and multiple-choice questions. Return valid JSON only, in this shape: {"questions":[{"type":"mcq","question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A. ...","explanation":"..."},{"type":"short","question":"...","answer":"...","explanation":"..."}]}. Include answers and short explanations. Do not use markdown fences. Do not invent material not supported by the PDF.\n\nPDF TEXT:\n${source}`;
    const result = await askGemini(prompt, { maxOutputTokens: 4000, responseMimeType: "application/json" });
    if (!result) {
      const snippets = (doc.text.match(/[^.!?]+[.!?]?/g) || []).map(s => s.trim()).filter(s => s.length > 35).slice(0, 10);
      const questions = Array.from({ length: 10 }, (_, i) => ({
        type: "short",
        question: `Demo question ${i + 1}: Explain this point from your PDF in your own words: "${(snippets[i] || snippets[i % Math.max(snippets.length, 1)] || doc.text.slice(0, 100)).slice(0, 180)}"`,
        answer: "Demo mode does not generate a verified answer. Configure GEMINI_API_KEY for AI-generated questions and answers.",
        explanation: "This is a placeholder question based on extracted text, not an AI-generated assessment."
      }));
      return res.json({ mode: "demo", questions });
    }
    let parsed;
    try {
      const cleaned = result.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(502).json({ error: "The AI response was not valid quiz JSON. Please try again." });
    }
    res.json({ mode: "ai", questions: (parsed.questions || []).slice(0, 10) });
  } catch (error) {
    res.status(502).json({ error: `AI request failed: ${error.message}` });
  }
});

app.post("/api/documents/:id/ask", async (req, res) => {
  const doc = requireDocument(req, res);
  if (!doc) return;
  const question = String(req.body?.question || "").trim();
  if (!question) return res.status(400).json({ error: "Enter a question first." });
  try {
    const relevantText = doc.text.length > 24000
      ? chunkText(doc.text, 12000).slice(0, 5).join("\n\n")
      : doc.text;
    const result = await askGemini(`You are a patient study assistant. Answer the student's question using the PDF context below. Explain in simple language, use examples when helpful, and clearly say when the PDF does not contain enough information. Do not pretend unsupported facts are in the document.\n\nPDF CONTEXT:\n${relevantText}\n\nSTUDENT QUESTION:\n${question}`);
    res.json({
      mode: result ? "ai" : "demo",
      answer: result || `Demo mode: I received your question: "${question}". Add GEMINI_API_KEY to backend/.env to get a real answer grounded in your PDF.`
    });
  } catch (error) {
    res.status(502).json({ error: `AI request failed: ${error.message}` });
  }
});


app.post("/api/documents/:id/classify", async (req, res) => {
  const doc = requireDocument(req, res);
  if (!doc) return;

  try {
    // Send extracted PDF text to the Python ML service.
    const response = await fetch(
      "http://127.0.0.1:8001/predict",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: doc.text.slice(0, 100000)
        }),
        signal: AbortSignal.timeout(15000)
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return res.status(502).json({
        error: result.detail || "ML prediction failed."
      });
    }

    return res.json({
      documentId: doc.id,
      documentName: doc.name,
      predictedSubject: result.predicted_subject,
      model: result.model
    });
  } catch (error) {
    console.error("ML classification failed:", error.message);

    return res.status(502).json({
      error:
        "Could not connect to the Python ML service. " +
        "Make sure it is running on port 8001."
    });
  }
});


app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "PDF is too large. The current upload limit is 25 MB." });
  }
  res.status(400).json({ error: error.message || "Something went wrong." });
});

app.listen(PORT, () => {
  console.log(`DocuMind backend listening at http://localhost:${PORT}`);
  console.log(`AI mode: ${process.env.GEMINI_API_KEY ? `enabled (${MODEL})` : "demo (no GEMINI_API_KEY set)"}`);
});
