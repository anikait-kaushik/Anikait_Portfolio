// Vercel serverless function: POST /api/contact
// Emails each contact-form message to Anikait's Gmail inbox through Gmail SMTP.
//
// Needs two Environment Variables in Vercel (Project → Settings → Environment Variables):
//   GMAIL_USER          anikaitkaushiksep@gmail.com
//   GMAIL_APP_PASSWORD  16-character Google App Password (not the normal Gmail password)
// Optional:
//   CONTACT_TO          inbox that receives messages (defaults to GMAIL_USER)

const nodemailer = require('nodemailer');

const LIMITS = { name: 120, email: 200, subject: 160, role: 80, message: 5000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Light, per-instance rate limit: 5 messages per IP per 10 minutes.
const hits = new Map();
function limited(ip) {
  const now = Date.now(), win = 10 * 60 * 1000;
  const list = (hits.get(ip) || []).filter((t) => now - t < win);
  list.push(now);
  hits.set(ip, list);
  return list.length > 5;
}

const clean = (v, max) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, max);
const oneLine = (v) => v.replace(/[\n\t]+/g, ' ');
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }

  // Honeypot: bots fill the hidden field. Pretend success so they move on.
  if (body._gotcha) return res.status(200).json({ success: true });

  const name = oneLine(clean(body.name, LIMITS.name));
  const email = oneLine(clean(body.email, LIMITS.email));
  const role = oneLine(clean(body.role, LIMITS.role));
  const subject = oneLine(clean(body.subject, LIMITS.subject)) || `Portfolio enquiry from ${name}`;
  const message = clean(body.message, LIMITS.message);

  if (!name || !message) return res.status(400).json({ success: false, error: 'Please fill in your name, email and message.' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) return res.status(429).json({ success: false, error: 'Too many messages. Please try again in a few minutes.' });

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    console.error('contact: GMAIL_USER / GMAIL_APP_PASSWORD are not set');
    return res.status(503).json({ success: false, error: 'The contact form is not set up yet. Please email me directly.', notConfigured: true });
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user, pass: pass.replace(/\s+/g, '') },
  });

  const text = `${message}\n\n— ${name} <${email}>${role ? `\nReaching out as: ${role}` : ''}\n\nSent from the portfolio contact form. Reply to this email to answer ${name} directly.`;
  const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.55;color:#0f172a">
  <p style="margin:0 0 12px;color:#2563eb;font-weight:600">New message from your portfolio</p>
  <table style="border-collapse:collapse;margin-bottom:16px">
    <tr><td style="padding:2px 12px 2px 0;color:#64748b">Name</td><td>${esc(name)}</td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#64748b">Email</td><td><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>
    ${role ? `<tr><td style="padding:2px 12px 2px 0;color:#64748b">Reaching out as</td><td>${esc(role)}</td></tr>` : ''}
    <tr><td style="padding:2px 12px 2px 0;color:#64748b">Subject</td><td>${esc(subject)}</td></tr>
  </table>
  <div style="white-space:pre-wrap;border-left:3px solid #2563eb;padding:4px 0 4px 14px">${esc(message)}</div>
  <p style="margin-top:20px;color:#64748b;font-size:13px">Hit Reply to answer ${esc(name)} directly.</p>
</div>`;

  try {
    await transporter.sendMail({
      from: { name: `${name} via Portfolio`, address: user },
      to: process.env.CONTACT_TO || user,
      replyTo: { name, address: email },
      subject: `Portfolio: ${subject}`,
      text, html,
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('contact: send failed', err && err.message);
    return res.status(502).json({ success: false, error: 'Could not send right now. Please email me directly.' });
  }
};
