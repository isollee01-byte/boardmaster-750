const TO = 'isollee01@gmail.com';
const ALLOWED_ORIGINS = new Set([
  'https://boardmaster-750.vercel.app',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
]);

function clean(value, max) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
}

function message(value) {
  return String(value ?? '').replace(/\r/g, '').trim().slice(0, 3000);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) return res.status(403).json({ ok: false });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const name = clean(body.name, 100);
  const phone = clean(body.phone, 30);
  const type = clean(body.type, 40);
  const email = clean(body.email, 254);
  const quantity = clean(body.quantity, 80);
  const delivery = clean(body.delivery, 150);
  const text = message(body.message);
  const agreed = body.consent === 'on' || body.consent === true || body.consent === 'true';
  if (!agreed || !name || !text || !/^[+\d\s().-]{7,30}$/.test(phone) || phone.replace(/\D/g, '').length < 7) {
    return res.status(400).json({ ok: false });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(500).json({ ok: false });

  const payload = {
    from: process.env.RESEND_FROM || 'Board Master <onboarding@resend.dev>',
    to: [process.env.INQUIRY_TO || TO],
    subject: `[보드마스터 750] ${type || '문의'} · ${name}`.slice(0, 180),
    text: [
      '보드마스터 750 상담 문의',
      `문의 유형: ${type || '-'}`,
      `이름/회사명: ${name}`,
      `연락처: ${phone}`,
      `이메일: ${email || '-'}`,
      `예상 수량: ${quantity || '-'}`,
      `납품 지역/일정: ${delivery || '-'}`,
      '',
      text,
    ].join('\n'),
  };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) payload.reply_to = email;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) return res.status(502).json({ ok: false });
  return res.status(200).json({ ok: true });
}
