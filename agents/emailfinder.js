const axios = require('axios');
const https = require('https');
const http = require('http');
const HUNTER = 'https://api.hunter.io/v2';

// Fetch a URL and return raw HTML (follows redirects, timeout 10s)
function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), 10000);
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        clearTimeout(timer);
        return fetchPage(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => { data += chunk; if (data.length > 500000) { res.destroy(); clearTimeout(timer); resolve(data); } });
      res.on('end', () => { clearTimeout(timer); resolve(data); });
    }).on('error', e => { clearTimeout(timer); reject(e); });
  });
}

// Extract email addresses from HTML
function extractEmails(html) {
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const matches = html.match(emailRegex) || [];
  // Filter out junk emails
  const blacklist = ['facebook.com','fb.com','sentry.io','example.com','wixpress.com','googleapis.com','w3.org','schema.org','fbcdn.net','instagram.com'];
  return [...new Set(matches)].filter(e => {
    const domain = e.split('@')[1].toLowerCase();
    return !blacklist.some(b => domain.includes(b));
  });
}

// Try to find email from a Facebook page
async function findEmailFromFacebook(lead, onProgress) {
  const fbUrl = lead.socials?.facebook?.url;
  if (!fbUrl) return null;

  onProgress && onProgress({ status:'searching', message:`📘 Checking Facebook page: ${fbUrl}` });
  try {
    const html = await fetchPage(fbUrl);
    const emails = extractEmails(html);
    if (emails.length) {
      onProgress && onProgress({ status:'found', message:`✅ Found on Facebook: ${emails[0]}` });
      return { email: emails[0], confidence: 80, source: 'facebook' };
    }
    onProgress && onProgress({ status:'not_found', message:`No email on Facebook page` });
  } catch(e) {
    onProgress && onProgress({ status:'error', message:`⚠ Could not fetch Facebook page: ${e.message}` });
  }
  return null;
}

// Try to find email from the business website
async function findEmailFromWebsite(lead, onProgress) {
  const website = lead.socials?.website || lead.website || null;
  if (!website) return null;

  onProgress && onProgress({ status:'searching', message:`🌐 Scanning website: ${website}` });
  try {
    const html = await fetchPage(website);
    const emails = extractEmails(html);
    if (emails.length) {
      onProgress && onProgress({ status:'found', message:`✅ Found on website: ${emails[0]}` });
      return { email: emails[0], confidence: 85, source: 'website' };
    }
    onProgress && onProgress({ status:'not_found', message:`No email on website` });
  } catch(e) {
    onProgress && onProgress({ status:'error', message:`⚠ Could not fetch website: ${e.message}` });
  }
  return null;
}

// Hunter.io lookup
async function findEmailFromHunter(lead, onProgress) {
  const key = process.env.HUNTER_API_KEY;
  if (!key) return null;

  onProgress && onProgress({ status:'searching', message:`🔍 Searching Hunter.io for ${lead.name}...` });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await axios.get(`${HUNTER}/email-finder`, {
        params: { company: lead.name, api_key: key },
        timeout: 8000
      });
      if (res.data.data?.email) {
        const { email, score } = res.data.data;
        onProgress && onProgress({ status:'found', message:`✅ Hunter.io: ${email} (${score}%)` });
        return { email, confidence: score, source: 'hunter' };
      }
      break;
    } catch(e) {
      if (e.response?.status === 429 && attempt === 0) {
        onProgress && onProgress({ status:'limit', message:`⚠ Hunter rate limit — waiting 5s...` });
        await new Promise(r=>setTimeout(r,5000));
        continue;
      }
      if (e.response?.status === 401) {
        onProgress && onProgress({ status:'error', message:`❌ Hunter API key invalid` });
        break;
      }
      onProgress && onProgress({ status:'error', message:`⚠ Hunter failed: ${e.message}` });
      break;
    }
  }
  return null;
}

async function findEmail(lead, onProgress) {
  onProgress && onProgress({ status:'searching', message:`🔎 Finding email for ${lead.name}...` });

  // Step 1: Try Facebook page first (most emails come from here)
  const fb = await findEmailFromFacebook(lead, onProgress);
  if (fb) return fb;

  // Step 2: Try business website
  const web = await findEmailFromWebsite(lead, onProgress);
  if (web) return web;

  // Step 3: Fall back to Hunter.io
  const hunter = await findEmailFromHunter(lead, onProgress);
  if (hunter) return hunter;

  onProgress && onProgress({ status:'not_found', message:`❌ No email found for ${lead.name}` });
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
