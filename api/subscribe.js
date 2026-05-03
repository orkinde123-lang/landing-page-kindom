import { createHash, randomUUID } from 'node:crypto';

const BASE_URL = 'https://api.responder.co.il/main';
const LIST_ID  = 99461; // שיחת ייעוץ

function buildAuthHeader() {
  const cKey    = process.env.RESPONDER_C_KEY;
  const cSecret = process.env.RESPONDER_C_SECRET;
  const uKey    = process.env.RESPONDER_U_KEY;
  const uSecret = process.env.RESPONDER_U_SECRET;

  const nonce     = randomUUID().replace(/-/g, '');
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const cHash = createHash('md5').update(cSecret + nonce).digest('hex');
  const uHash = createHash('md5').update(uSecret + nonce).digest('hex');

  return [
    `c_key=${encodeURIComponent(cKey)}`,
    `c_secret=${encodeURIComponent(cHash)}`,
    `u_key=${encodeURIComponent(uKey)}`,
    `u_secret=${encodeURIComponent(uHash)}`,
    `nonce=${encodeURIComponent(nonce)}`,
    `timestamp=${encodeURIComponent(timestamp)}`,
  ].join(',');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, phone, business } = req.body || {};

  const nameParts = (name || '').trim().split(' ');
  const firstName = nameParts[0] || '';
  const lastName  = nameParts.slice(1).join(' ') || '';
  const digits    = (phone || '').replace(/\D/g, '');
  const email     = digits
    ? `${digits}@form.orkinde.co.il`
    : `lead${Date.now()}@form.orkinde.co.il`;

  const subscriber = {
    NAME:     `${firstName} ${lastName}`.trim(),
    EMAIL:    email,
    PHONE:    phone || '',
    BUSINESS: business || '',
    SOURCE:   'שיחת פיצוח',
  };

  try {
    const params = new URLSearchParams();
    params.append('subscribers', JSON.stringify([subscriber]));

    const response = await fetch(`${BASE_URL}/lists/${LIST_ID}/subscribers`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization:  buildAuthHeader(),
      },
      body: params.toString(),
    });

    let data;
    try { data = await response.json(); } catch { data = {}; }

    return res.status(200).json({ ok: true, data });

  } catch (err) {
    console.error('Rav-Messer error:', err.message);
    return res.status(200).json({ ok: true, note: 'queued' });
  }
}
