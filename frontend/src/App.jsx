import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles, Upload, FileText, BookOpen, MessageCircle, Brain, ListChecks,
  WandSparkles, Copy, Check, LoaderCircle, ChevronDown, ArrowUpRight,
  GraduationCap, PanelRightClose, PanelRightOpen, RotateCcw, ShieldCheck
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed. Check that the backend is running.");
  return data;
}

function App() {
  const [document, setDocument] = useState(null);
  const [selectedText, setSelectedText] = useState("");
  const [busy, setBusy] = useState("");
  const [activeTab, setActiveTab] = useState("summary");
  const [result, setResult] = useState(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [mlResult, setMlResult] = useState(null);
  const fileInput = useRef(null);
  const readerRef = useRef(null);

  useEffect(() => {
    apiRequest("/api/health").then(data => setAiEnabled(data.aiEnabled)).catch(() => { });
  }, []);

  const wordCount = useMemo(() => document?.text?.trim().split(/\s+/).filter(Boolean).length || 0, [document]);

  function updateSelection() {
    const selection = window.getSelection()?.toString().trim() || "";
    if (selection && readerRef.current?.contains(window.getSelection()?.anchorNode)) {
      setSelectedText(selection);
    }
  }

  async function uploadFile(file) {
    if (!file) return;
    setError(""); setResult(null); setMessages([]); setSelectedText("");
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      return;
    }
    setBusy("upload");
    try {
      const form = new FormData();
      form.append("pdf", file);
      const data = await apiRequest("/api/upload", { method: "POST", body: form });
      setDocument(data);
      setAiEnabled(data.aiEnabled);
      setActiveTab("summary");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  async function runAction(action, body = {}) {
    if (!document?.id) {
      setError("Upload a PDF first to use the AI tools.");
      return;
    }
    setError(""); setBusy(action); setActiveTab(action === "quiz" ? "quiz" : action === "ask" ? "chat" : "summary");
    try {
      const data = await apiRequest(`/api/documents/${document.id}/${action === "selection" ? "summarize-selection" : action === "summary" ? "summarize" : action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (action === "ask") {
        setMessages(prev => [...prev, { role: "user", text: body.question }, { role: "assistant", text: data.answer, mode: data.mode }]);
        setQuestion("");
      } else {
        setResult({ ...data, type: action });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }


  async function classifyDocument() {
    if (!document?.id) {
      setError("Please upload a PDF first.");
      return;
    }

    setError("");
    setMlResult(null);
    setBusy("classify");

    try {
      const data = await apiRequest(
        `/api/documents/${document.id}/classify`,
        { method: "POST" }
      );

      setMlResult(data);
    } catch (e) {
      setError(e.message || "Could not classify this document.");
    } finally {
      setBusy("");
    }
  }


  async function copyResult() {
    const text = result?.summary || (result?.questions || []).map((q, i) => `${i + 1}. ${q.question}\nAnswer: ${q.answer || ""}`).join("\n\n");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true); setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Clipboard access was blocked by your browser.");
    }
  }

  function resetDocument() {
    setDocument(null); setResult(null); setSelectedText(""); setMessages([]); setError("");
    if (fileInput.current) fileInput.current.value = "";
  }

  const isBusy = Boolean(busy);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={e => e.preventDefault()}>
          <span className="brand-mark"><BookOpen size={21} /></span>
          <span>docu<span className="brand-accent">mind</span></span>
          <span className="brand-pill">AI READER</span>
        </a>
        <div className="topbar-right">
          <span className={`connection-dot ${aiEnabled ? "live" : ""}`} />
          <span className="connection-label">{aiEnabled ? "AI connected" : "Preview mode"}</span>
          <div className="avatar">S</div>
        </div>
      </header>

      <main className="main-wrap">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><Sparkles size={14} /> YOUR PERSONAL STUDY COMPANION</div>
            <h1>Read less passively.<br /><span>Understand more.</span></h1>
            <p>Turn any PDF into a study session. Summarize concepts, test your knowledge, and ask questions right from your reading material.</p>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit orbit-one" /><div className="orbit orbit-two" />
            <div className="art-page"><div className="art-page-head" /><div className="art-line wide" /><div className="art-line" /><div className="art-line short" /><div className="art-highlight" /><div className="art-line wide" /><div className="art-line" /></div>
            <div className="art-spark"><Sparkles size={22} /></div>
            <div className="art-chip"><Brain size={16} /> AI insights</div>
          </div>
        </section>

        {!document ? (
          <section className="upload-card">
            <div className="upload-icon"><Upload size={25} /></div>
            <h2>Bring your PDF to life</h2>
            <p>Upload a textbook, lecture notes, research paper, or any study PDF.</p>
            <button className="primary-btn upload-btn" onClick={() => fileInput.current?.click()} disabled={isBusy}>
              {busy === "upload" ? <LoaderCircle className="spin" size={18} /> : <Upload size={17} />}
              {busy === "upload" ? "Reading your PDF..." : "Choose a PDF"}
            </button>
            <input ref={fileInput} type="file" accept="application/pdf,.pdf" hidden onChange={e => uploadFile(e.target.files?.[0])} />
            <div className="upload-foot"><ShieldCheck size={14} /> Prototype upload limit: 25 MB <span>·</span> Text-based PDFs work best</div>
            <div className="feature-strip">
              <div><WandSparkles size={17} /><span>Instant summaries</span></div>
              <div><ListChecks size={17} /><span>Practice questions</span></div>
              <div><MessageCircle size={17} /><span>Ask your PDF</span></div>
            </div>
          </section>
        ) : (
          <section className="workspace">
            <div className="document-bar">
              <div className="doc-ident">
                <div className="pdf-icon"><FileText size={21} /></div>
                <div className="doc-meta">
                  <strong title={document.name}>{document.name}</strong>
                  <span>{document.pages ? `${document.pages} pages` : "PDF document"} <span className="meta-dot">·</span> {wordCount.toLocaleString()} words</span>
                </div>
              </div>
              <div className="doc-actions">
                <span className="ready-tag"><span /> Ready to study</span>

                <button
                  className="secondary-btn"
                  disabled={isBusy}
                  onClick={classifyDocument}
                >
                  {busy === "classify" ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <Brain size={16} />
                  )}
                  {busy === "classify" ? "Classifying..." : "Classify Document"}
                </button>

                <button className="icon-btn" title="Upload another PDF" onClick={resetDocument}><RotateCcw size={16} /></button>
              </div>
            </div>


            {mlResult && (
              <section className="result-card">
                <div className="result-heading">
                  <div className="result-title-icon">
                    <Brain size={19} />
                  </div>

                  <div>
                    <span className="section-kicker">
                      MACHINE LEARNING
                    </span>
                    <h2>Document Classification</h2>
                  </div>
                </div>

                <div className="result-text">
                  <p>
                    <strong>Document:</strong>{" "}
                    {mlResult.documentName}
                  </p>

                  <h3>{mlResult.predictedSubject}</h3>

                  <p>
                    Predicted by your trained{" "}
                    {mlResult.model}.
                  </p>
                </div>
              </section>
            )}

            <div className="workspace-grid">
              <section className="reader-card">
                <div className="section-heading">
                  <div><span className="section-kicker">YOUR DOCUMENT</span><h2>Reading space</h2></div>
                  <span className="selection-hint"><span className="selection-dot" /> Select text to summarize</span>
                </div>
                <div className="reader-content" ref={readerRef} onMouseUp={updateSelection} onTouchEnd={updateSelection}>
                  {document.text}
                </div>
                <div className="selection-box">
                  <div className="selection-info">
                    <span className="selection-symbol"><WandSparkles size={16} /></span>
                    <div><strong>{selectedText ? "Text selected" : "Want a quick summary?"}</strong><span>{selectedText ? `${selectedText.length} characters selected` : "Highlight any passage in the document first."}</span></div>
                  </div>
                  <button className="secondary-btn" disabled={!selectedText || isBusy} onClick={() => runAction("selection", { text: selectedText })}>
                    {busy === "selection" ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}
                    Summarize selection
                  </button>
                </div>
              </section>

              <aside className="assistant-card">
                <div className="assistant-heading">
                  <div className="assistant-avatar"><Sparkles size={18} /></div>
                  <div><h2>Study assistant</h2><p>Let's make this stick.</p></div>
                  <span className="online-dot" />
                </div>
                <div className="tool-buttons">
                  <button className={`tool-button ${activeTab === "summary" ? "active" : ""}`} onClick={() => { setActiveTab("summary"); if (result?.type !== "summary" && result?.type !== "selection") setResult(null); }}>
                    <span className="tool-icon lilac"><WandSparkles size={17} /></span><span><strong>Summarize PDF</strong><small>Get the big picture</small></span><ArrowUpRight size={16} className="tool-arrow" />
                  </button>
                  <button className={`tool-button ${activeTab === "quiz" ? "active" : ""}`} onClick={() => setActiveTab("quiz")}>
                    <span className="tool-icon peach"><GraduationCap size={18} /></span><span><strong>Practice questions</strong><small>Generate 10 questions</small></span><ArrowUpRight size={16} className="tool-arrow" />
                  </button>
                  <button className={`tool-button ${activeTab === "chat" ? "active" : ""}`} onClick={() => setActiveTab("chat")}>
                    <span className="tool-icon mint"><MessageCircle size={17} /></span><span><strong>Ask your PDF</strong><small>Clear up a doubt</small></span><ArrowUpRight size={16} className="tool-arrow" />
                  </button>
                </div>

                <div className="assistant-content">
                  {activeTab === "summary" && (
                    <div className="action-panel">
                      <div className="panel-title"><span className="panel-icon"><FileText size={17} /></span><div><strong>Full document summary</strong><p>Organized notes, without the overwhelm.</p></div></div>
                      <ul className="benefit-list"><li><Check size={14} /> Main ideas and concepts</li><li><Check size={14} /> Important definitions</li><li><Check size={14} /> Key takeaways for revision</li></ul>
                      <button className="primary-btn full-btn" disabled={isBusy} onClick={() => runAction("summary")}>
                        {busy === "summary" ? <LoaderCircle size={17} className="spin" /> : <Sparkles size={17} />}
                        {busy === "summary" ? "Summarizing PDF..." : "Summarize entire PDF"}
                      </button>
                    </div>
                  )}
                  {activeTab === "quiz" && (
                    <div className="action-panel">
                      <div className="panel-title"><span className="panel-icon peach"><GraduationCap size={18} /></span><div><strong>Test your understanding</strong><p>Build a mini quiz from this PDF.</p></div></div>
                      <div className="quiz-preview"><span>10</span><div><strong>Practice questions</strong><small>Mix of concepts and MCQs, with answers</small></div></div>
                      <button className="primary-btn full-btn" disabled={isBusy} onClick={() => runAction("quiz")}>
                        {busy === "quiz" ? <LoaderCircle size={17} className="spin" /> : <ListChecks size={17} />}
                        {busy === "quiz" ? "Creating questions..." : "Generate 10 questions"}
                      </button>
                    </div>
                  )}
                  {activeTab === "chat" && (
                    <div className="chat-panel">
                      <div className="chat-intro"><span className="chat-orb"><MessageCircle size={17} /></span><div><strong>Ask anything about this PDF</strong><p>Try “Explain this chapter simply” or “What is the main difference between X and Y?”</p></div></div>
                      <div className="chat-messages">
                        {messages.length === 0 ? (
                          <div className="empty-chat">
                            Your questions and answers will appear here.
                          </div>
                        ) : (
                          messages.map((m, i) => (
                            <div key={i} className={`chat-bubble ${m.role}`}>
                              {m.role === "assistant" ? (
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {m.text}
                                </ReactMarkdown>
                              ) : (
                                m.text
                              )}
                              {m.mode === "demo" && <small>Demo response</small>}
                            </div>
                          ))
                        )}
                      </div>
                      <form className="ask-form" onSubmit={e => { e.preventDefault(); if (question.trim()) runAction("ask", { question: question.trim() }); }}>
                        <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask a question..." aria-label="Ask a question" />
                        <button type="submit" disabled={isBusy || !question.trim()} aria-label="Send question">{busy === "ask" ? <LoaderCircle size={17} className="spin" /> : <ArrowUpRight size={18} />}</button>
                      </form>
                    </div>
                  )}
                </div>
              </aside>
            </div>

            {result && (
              <section className="result-card">
                <div className="result-heading">
                  <div className="result-title-icon"><Sparkles size={19} /></div>
                  <div><span className="section-kicker">{result.mode === "ai" ? "AI-GENERATED" : "DEMO PREVIEW"}</span><h2>{result.type === "quiz" ? "Your practice questions" : result.type === "selection" ? "Selected text summary" : "Your PDF summary"}</h2></div>
                  <button className="secondary-btn copy-btn" onClick={copyResult}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy"}</button>
                </div>
                {result.mode !== "ai" && <div className="demo-note">Preview mode: add a Gemini API key to enable real AI-generated results.</div>}
                {result.summary && (
                  <div className="result-text markdown-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {result.summary}
                    </ReactMarkdown>
                  </div>
                )}
                {result.questions && <div className="questions-list">{result.questions.map((q, i) => <article className="question-item" key={i}><span className="question-number">{String(i + 1).padStart(2, "0")}</span><div className="question-body"><strong>{q.question}</strong>{q.options && <ul className="options-list">{q.options.map((o, j) => <li key={j}>{o}</li>)}</ul>}<details><summary>Show answer & explanation <ChevronDown size={14} /></summary><p><strong>Answer:</strong> {q.answer}</p>{q.explanation && <p><strong>Why:</strong> {q.explanation}</p>}</details></div></article>)}</div>}
              </section>
            )}
          </section>
        )}

        {error && <div className="error-toast" role="alert"><span>!</span><p>{error}</p><button onClick={() => setError("")}>Dismiss</button></div>}

        <footer className="footer"><span>documind <span>·</span> built for curious minds</span><span><span>·</span> </span></footer>
      </main>
    </div>
  );
}

export default App;
