# 📚 DocuMind AI – AI-Powered PDF Summarizer

**Turn lengthy PDFs into meaningful insights with AI.**

DocuMind AI is an AI-powered PDF study assistant designed to make reading, understanding, and learning from lengthy documents easier and faster. It allows users to upload PDF documents, generate concise summaries, create quizzes, and ask questions directly from the uploaded content.

Built using React, Node.js, Express, and Google Gemini AI, DocuMind AI transforms traditional document reading into an interactive learning experience.

## 🚀 Live Demo

**Try DocuMind AI here:** [Open Live Application](https://documind-ai-hdmt.onrender.com)

*Note: The application may take a little time to load if the server is inactive.*

## ✨ Key Features

- **PDF Upload & Text Extraction:** Upload text-based PDF documents and extract their content for AI-powered processing.
- **Text Selection Summarization:** Select a specific paragraph or portion of text and generate a concise summary.
- **Full PDF Summarization:** Generate summaries of entire PDF documents, with automatic chunking to handle lengthy documents efficiently.
- **AI Quiz Generation:** Generate a 10-question quiz based on the uploaded document to test your understanding.
- **Ask Your PDF:** Ask questions about the uploaded document and receive AI-generated answers based on its content.
- **AI-Powered Processing:** Leverage Google Gemini AI for intelligent document analysis and content understanding.

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| React.js | Frontend development |
| Vite | Frontend build tool |
| Node.js | Backend runtime |
| Express.js | Backend framework and API handling |
| pdf-parse | PDF text extraction |
| Google Gemini API | AI-powered summarization, quiz generation, and question answering |
| JavaScript | Application logic |

## ⚙️ How It Works

1. **Upload PDF:** Users upload a text-based PDF document.
2. **Extract Content:** The backend extracts selectable text using `pdf-parse`.
3. **Process Document:** The extracted content is prepared for the requested AI operation.
4. **AI Analysis:** Google Gemini processes the content according to the selected functionality.
5. **Display Results:** Users receive summaries, quizzes, or answers to their questions.

**Special handling for lengthy documents:** Full PDF summarization uses a chunking approach to divide large documents into smaller sections before processing.

## 📸 Application Preview

<img width="1792" height="817" alt="image" src="https://github.com/user-attachments/assets/1d568bf7-75f3-42c4-b1d9-296db3a7b923" />
<img width="1355" height="896" alt="image" src="https://github.com/user-attachments/assets/c9824458-0e3b-41ea-a800-bb42de75f271" />


<!-- Example:
![DocuMind AI Dashboard](screenshots/dashboard.png)
![PDF Summary](screenshots/summary.png)
![AI Quiz](screenshots/quiz.png)
-->

## 🎯 Use Cases

- Students preparing for examinations.
- Summarizing lengthy academic notes and textbooks.
- Understanding research papers and technical documentation.
- Generating practice questions from study materials.
- Quickly finding information within lengthy PDF documents.

## 🔮 Future Enhancements

- OCR support for scanned PDF documents.
- Downloadable PDF summaries.
- Customizable summary length and formats.
- AI-generated flashcards for better learning.
- Support for additional document formats.

## 👩‍💻 Author

**Shreya**  
B.Tech – Computer Science & Engineering

Interested in building practical applications using AI, software development, and modern web technologies.

---

⭐ If you find this project useful, consider giving the repository a star!

**Built with ❤️ to make learning smarter and more efficient.**
