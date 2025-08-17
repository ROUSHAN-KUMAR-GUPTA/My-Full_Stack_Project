import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 4000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' })); // transcripts can be long
app.use(cookieParser());

// --- Summarization (Groq API or fallback) ---
async function summarizeWithGroq(transcript, prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const body = {
    model: process.env.GROQ_MODEL || "llama-3.1-70b-versatile",
    temperature: 0.3,
    messages: [
      { role: "system", content: "You are an assistant that summarizes meeting transcripts clearly and concisely." },
      { role: "user", content: `Instruction: ${prompt}\n\nTranscript:\n${transcript}` }
    ]
  };

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    console.error("Groq API error:", await res.text());
    return null;
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

function fallbackSummary(transcript, prompt) {
  const lines = transcript.split(/\n+/).slice(0, 5);
  return `Prompt: ${prompt}\n\nSummary:\n- ${lines.join("\n- ")}`;
}

app.post("/api/summarize", async (req, res) => {
  const { transcript, prompt } = req.body || {};
  if (!transcript) return res.status(400).json({ message: "Transcript required" });

  let summary = await summarizeWithGroq(transcript, prompt);
  if (!summary) summary = fallbackSummary(transcript, prompt);

  res.json({ summary });
});

// --- Email Sharing (Nodemailer) ---
function makeTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: false,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
  });
}

app.post("/api/share", async (req, res) => {
  const { recipients, subject, content } = req.body || {};
  const emails = (recipients || "").split(",").map(e => e.trim()).filter(Boolean);

  if (!emails.length) return res.status(400).json({ message: "Recipients required" });

  const transport = makeTransport();
  if (!transport) return res.status(500).json({ message: "SMTP not configured" });

  await transport.sendMail({
    from: process.env.FROM_EMAIL || "no-reply@example.com",
    to: emails.join(","),
    subject: subject || "Meeting Summary",
    html: `<pre>${content}</pre>`
  });

  res.json({ ok: true });
});

// Serve static frontend
app.use(express.static(path.join(__dirname, "frontend")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
