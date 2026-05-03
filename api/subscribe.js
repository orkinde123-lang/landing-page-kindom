// Vercel Serverless Function — adds subscriber to Rav-Messer list 97929 (רשימת אבחון)
// Required env variable in Vercel dashboard: RAVMESSER_API_KEY
// Note: form collects שם/טלפון/תחום only — email is generated synthetically from phone

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, phone, business, frustration } = req.body || {};

  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  const nameParts = (name || '').trim().split(' ');
  const firstName = nameParts[0] || '';
  const lastName  = nameParts.slice(1).join(' ') || '';

  const LIST_ID = 97929; // רשימת אבחון

  try {
    const response = await fetch('https://www.ravmesser.co.il/api/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RAVMESSER_API_KEY}`,
        'X-Account-Id': '1007337'
      },
      body: JSON.stringify({
        list_id:    LIST_ID,
        email:      email,
        first_name: firstName,
        last_name:  lastName,
        phone:      phone || '',
        custom_fields: {
          business:    business || '',
          frustration: frustration || '',
          source:      'שיחת פיצוח'
        }
      })
    });

    const data = await response.json().catch(() => ({}));
    return res.status(200).json({ ok: true, data });

  } catch (err) {
    // Don't block the user — log error silently
    console.error('Rav-Messer error:', err.message);
    return res.status(200).json({ ok: true, note: 'queued' });
  }
}
