// api/send-email.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { to, subject, html } = await readJson(req);
    if (!to || !subject || !html) {
      return res.status(400).json({ ok: false, error: 'Missing to/subject/html' });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM || 'Catermatch <onboarding@resend.dev>';
    if (!apiKey) {
      return res.status(500).json({ ok: false, error: 'Missing RESEND_API_KEY' });
    }

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from, to, subject, html })
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ ok: false, error: data?.message || 'Failed to send' });
    }

    return res.status(200).json({ ok: true, id: data?.id });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body; // Vercel Node runtime
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(raw || '{}');
}