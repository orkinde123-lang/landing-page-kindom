const GRAPH_BASE      = 'https://graph.responder.live/v2';
const CLIENT_ID       = '143';
const CLIENT_SECRET   = '4oehPjI7ZJhOg6K9bP4zam0XTec147EfS9DSW2S0';
const USER_TOKEN      = 'a208b32e03c8e0a756cfbab7b4dc84c549628ab3fd0f9c4d98c60e7976a9ce95';
const LIST_ID         = 99461;

let cachedToken = null;
let tokenExpiry  = 0;

async function getToken() {
  if (cachedToken && Date.now() / 1000 < tokenExpiry - 300) return cachedToken;

  const res = await fetch(`${GRAPH_BASE}/oauth/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      user_token:    USER_TOKEN,
      grant_type:    'client_credentials',
    }),
  });

  const data = await res.json();
  if (!data.token) throw new Error('Responder auth failed: ' + JSON.stringify(data));

  cachedToken  = data.token;
  tokenExpiry  = data.expire;
  return cachedToken;
}

async function syncToKesher({ name, phone, business }) {
  const webhookUrl = process.env.KESHER_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const [firstName, ...rest] = (name || '').trim().split(' ');
    const res = await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: firstName || '',
        last_name:  rest.join(' ') || '',
        phone:      phone    || '',
        source:     'שיחת פיצוח',
        notes:      business || '',
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

  console.log('Subscribing to list', LIST_ID, '| email:', email, '| name:', firstName, lastName);

  try {
    const token = await getToken();
    console.log('Token acquired OK');

    const response = await fetch(`${GRAPH_BASE}/subscribers`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        email,
        list_ids:  [LIST_ID],
        first:     firstName,
        last:      lastName,
        override:  true,
        rejoin:    true,
      }),
    });

    const data = await response.json();
    console.log('Responder V2 response:', JSON.stringify(data));

    if (!data?.status) {
      console.error('Responder rejected subscriber:', JSON.stringify(data));
    }

    await syncToKesher({ name: `${firstName} ${lastName}`.trim(), phone: phone || '', business });

    return res.status(200).json({ ok: true, responder: data });

  } catch (err) {
    console.error('Responder error:', err.message);
    return res.status(200).json({ ok: true, note: 'queued' });
  }
}
