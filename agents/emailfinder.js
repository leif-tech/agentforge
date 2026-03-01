const axios = require('axios');
const HUNTER = 'https://api.hunter.io/v2';

async function findEmail(lead, onProgress) {
  const key = process.env.HUNTER_API_KEY;
  if (!key) throw new Error('Hunter.io API key not set in Settings.');
  onProgress && onProgress({ status:'searching', message:`Searching email for ${lead.name}...` });
  try {
    const res = await axios.get(`${HUNTER}/email-finder`, {
      params: { company: lead.name, api_key: key },
      timeout: 8000
    });
    if (res.data.data?.email) {
      const { email, score } = res.data.data;
      onProgress && onProgress({ status:'found', message:`✅ Found: ${email} (${score}% confidence)` });
      return { email, confidence: score };
    }
  } catch(e) {
    if (e.response?.status === 429) {
      onProgress && onProgress({ status:'limit', message:`⚠ Hunter rate limit — waiting 3s...` });
      await new Promise(r=>setTimeout(r,3000));
    }
  }
  onProgress && onProgress({ status:'not_found', message:`No email found for ${lead.name}` });
  return null;
}

async function checkCredits() {
  const key = process.env.HUNTER_API_KEY;
  if (!key) return null;
  try {
    const res = await axios.get(`${HUNTER}/account`, { params: { api_key: key }, timeout: 5000 });
    const r = res.data.data?.requests;
    return { used: r?.searches?.used||0, available: r?.searches?.available||0 };
  } catch { return null; }
}

module.exports = { findEmail, checkCredits };
