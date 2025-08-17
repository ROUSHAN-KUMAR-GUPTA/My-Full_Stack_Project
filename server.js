import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 4000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' })); // transcripts can be large text
app.use(cookieParser());

/**
 * LLM Summarization via Groq (preferred) or fallback summary
 */
async function summarizeWithGroq(transcript, prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null; // signal to use fallback

  const body = {
    model: process.env.GROQ_MODEL || 'llama-3.1-70b-versatile',
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content:
          'You are an expert assistant that summarizes meeting transcripts. Output must be clean, structured, and directly usable. Keep it concise, well formatted, and faithful to the text.'
      },
      {
        role: 'user',
        content: `Instruction: ${prompt}\n\nTranscript:\n${transcript}`
      }
    ]
  };

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Groq API error: ${res.status} ${t}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  return content || '';
}

function simpleFallbackSummary(transcript, prompt) {
  // Very naive fallback: extract key sentences + simple bullets
  const lines = transcript.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const first = lines.slice(0, 10); // take first ~10 lines
  const bullets = first
    .map(l => `• ${l.replace(/\s+/g, ' ').slice(0, 180)}`)
    .join('\n');
  return `# Summary (Fallback)\nPrompt: ${prompt}\n\n${bullets}\n\n_Note: Set GROQ_API_KEY to get high‑quality AI summaries._`;
}

app.post('/api/summarize', async (req, res) => {
  try {
    const { transcript, prompt } = req.body || {};
    if (!transcript || !transcript.trim()) {
      return res.status(400).json({ message: 'Transcript is required' });
    }
    const instruction = prompt?.trim() || 'Summarize the transcript into clear bullet points with action items and decisions.';

    let summary = null;
    try {
      summary = await summarizeWithGroq(transcript, instruction);
    } catch (err) {
      console.error('Groq error:', err.message);
    }
    if (!summary) {
      summary = simpleFallbackSummary(transcript, instruction);
    }

    res.json({ summary });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to summarize' });
  }
});

/**
 * Email Share via Nodemailer
 */
import nodemailer from 'nodemailer';

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

app.post('/api/share', async (req, res) => {
  try {
    const { recipients, subject, content } = req.body || {};
    const emails = (recipients || '')
      .split(',')
      .map(e => e.trim())
      .filter(Boolean);

    if (!emails.length) {
      return res.status(400).json({ message: 'At least one recipient email is required' });
    }
    const mailSubject = subject?.trim() || 'Shared Meeting Summary';
    const html = `<pre style="font-family:inherit; white-space:pre-wrap;">${content || ''}</pre>`;

    const transport = makeTransport();
    if (!transport) {
      return res.status(500).json({ message: 'Email not configured. Set SMTP_* env vars.' });
    }

    const info = await transport.sendMail({
      from: process.env.FROM_EMAIL || 'no-reply@example.com',
      to: emails.join(','),
      subject: mailSubject,
      html
    });

    res.json({ ok: true, messageId: info.messageId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to send email' });
  }
});

// Serve static frontend (single-file UI)
app.use(express.static(path.join(__dirname, 'frontend')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
