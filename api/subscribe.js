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

async function syncToKesher({ name, phone, business }) {
  const webhookUrl = process.env.KESHER_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const [firstName, ...rest] = (name || '').trim().split(' ');
    const lastName = rest.join(' ');

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: firstName || '',
        last_name:  lastName  || '',
        phone:      phone     || '',
        source:     'שיחת פיצוח',
        notes:      business  || '',
      }),
    });
    console.log('KESHER sync:', res.status);
  } catch (err) {
    console.error('KESHER sync error:', err.message);
  }
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
    NAME:   `${firstName} ${lastName}`.trim(),
    EMAIL:  email,
    PHONE:  phone || '',
    DAY:    0,
    SEND_0: 1,
    NOTIFY: 0,
  };

  console.log('Adding subscriber to list', LIST_ID, '| email:', email, '| name:', subscriber.NAME);

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

    const rawText = await response.text();
    console.log('Responder HTTP:', response.status, '| body:', rawText);

    let data = {};
    try { data = JSON.parse(rawText); } catch { data = { raw: rawText }; }

    if (!data?.status) {
      console.error('Responder rejected subscriber. status:', response.status, 'data:', JSON.stringify(data));
    }

    await syncToKesher({ name: subscriber.NAME, phone: phone || '', business });

    return res.status(200).json({ ok: true, responder: data, httpStatus: response.status });

  } catch (err) {
    console.error('Responder fetch error:', err.message);
    return res.status(200).json({ ok: true, note: 'queued' });
  }
}
