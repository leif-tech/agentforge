const axios = require('axios');
const https = require('https');
const http = require('http');
const puppeteer = require('puppeteer');
const { findSocialMedia } = require('./socialfinder');
const HUNTER = 'https://api.hunter.io/v2';

// Shared browser instance (reused across calls)
let browserInstance = null;
let fbLoggedIn = false;

async function getBrowser() {
  if (browserInstance && browserInstance.connected) return browserInstance;
  browserInstance = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    timeout: 20000
  });
  fbLoggedIn = false;
  return browserInstance;
}

// Log into Facebook once, reuse session across scrapes
async function ensureFbLogin(browser, onProgress) {
  if (fbLoggedIn) return true;
  const email = process.env.FB_EMAIL;
  const pass = process.env.FB_PASSWORD;
  if (!email || !pass) return false;

  onProgress && onProgress({ status:'searching', message:`📘 Logging into Facebook...` });
  let page;
  try {
    page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto('https://www.facebook.com/login', { waitUntil: 'networkidle2', timeout: 20000 });
    await page.type('#email', email, { delay: 50 });
    await page.type('#pass', pass, { delay: 50 });
    await page.click('[name="login"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });

    // Check if login succeeded
    const url = page.url();
    if (url.includes('checkpoint') || url.includes('login')) {
      onProgress && onProgress({ status:'error', message:`⚠ Facebook login blocked — check your account for security prompts` });
      await page.close();
      return false;
    }

    fbLoggedIn = true;
    onProgress && onProgress({ status:'found', message:`✅ Facebook login successful` });
    await page.close();
    return true;
  } catch(e) {
    if (page) await page.close().catch(() => {});
    onProgress && onProgress({ status:'error', message:`⚠ Facebook login failed: ${e.message}` });
    return false;
  }
}

// Email extraction from text/HTML
function extractEmails(text) {
  const matches = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
  const blacklist = ['facebook.com','fb.com','sentry.io','example.com','wixpress.com','googleapis.com',
    'w3.org','schema.org','fbcdn.net','instagram.com','yelp.com','google.com','twitter.com',
    'pinterest.com','youtube.com','linkedin.com','tiktok.com','meta.com'];
  return [...new Set(matches)].filter(e => {
    const domain = e.split('@')[1].toLowerCase();
    return !blacklist.some(b => domain.includes(b)) && e.length < 60;
  });
}

// Fetch a URL and return raw HTML (for websites — no JS needed)
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

// Step 1: Scrape Facebook page with Puppeteer (logged in)
async function findEmailFromFacebook(lead, onProgress) {
  const fbUrl = lead.socials?.facebook?.url;
  if (!fbUrl) return null;

  const browser = await getBrowser();
  const loggedIn = await ensureFbLogin(browser, onProgress);
  if (!loggedIn) {
    onProgress && onProgress({ status:'error', message:`⚠ Skipping Facebook — no login credentials. Add them in Settings.` });
    return null;
  }

  onProgress && onProgress({ status:'searching', message:`📘 Scraping Facebook: ${fbUrl}` });
  let page;
  try {
    page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    // Go to the About page for contact info
    const aboutUrl = fbUrl.replace(/\/$/, '') + '/about';
    await page.goto(aboutUrl, { waitUntil: 'networkidle2', timeout: 25000 });
    await new Promise(r => setTimeout(r, 3000));

    const text = await page.evaluate(() => document.body.innerText);
    let emails = extractEmails(text);

    // Also check main page if about didn't have it
    if (!emails.length) {
      onProgress && onProgress({ status:'searching', message:`📘 Checking main page...` });
      await page.goto(fbUrl, { waitUntil: 'networkidle2', timeout: 25000 });
      await new Promise(r => setTimeout(r, 3000));
      const mainText = await page.evaluate(() => document.body.innerText);
      emails = extractEmails(mainText);
    }

    await page.close();

    if (emails.length) {
      onProgress && onProgress({ status:'found', message:`✅ Found on Facebook: ${emails[0]}` });
      return { email: emails[0], confidence: 80, source: 'facebook' };
    }
    onProgress && onProgress({ status:'not_found', message:`No email on Facebook page` });
  } catch(e) {
    if (page) await page.close().catch(() => {});
    onProgress && onProgress({ status:'error', message:`⚠ Facebook scrape failed: ${e.message}` });
  }
  return null;
}

// Step 2: Scrape business website (plain HTTP — no browser needed)
async function findEmailFromWebsite(lead, onProgress) {
  const website = lead.socials?.website || lead.website || null;
  if (!website) return null;

  onProgress && onProgress({ status:'searching', message:`🌐 Scanning website: ${website}` });
  try {
    const html = await fetchPage(website);
    let emails = extractEmails(html);

    // Also try /contact page
    if (!emails.length) {
      try {
        const contactUrl = new URL('/contact', website).href;
        onProgress && onProgress({ status:'searching', message:`🌐 Checking ${contactUrl}` });
        const contactHtml = await fetchPage(contactUrl);
        emails = extractEmails(contactHtml);
      } catch {}
    }

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

// Hunter.io lookup (separate — only called on demand)
async function hunterSearch(lead, onProgress) {
  const key = process.env.HUNTER_API_KEY;
  if (!key) {
    onProgress && onProgress({ status:'error', message:`❌ Hunter.io API key not set in Settings` });
    return null;
  }

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
        await new Promise(r => setTimeout(r, 5000));
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
  onProgress && onProgress({ status:'not_found', message:`❌ No email found via Hunter.io` });
  return null;
}

// Main findEmail — Facebook + website only (no Hunter)
async function findEmail(lead, onProgress) {
  onProgress && onProgress({ status:'searching', message:`🔎 Finding email for ${lead.name}...` });

  // Auto-find socials if not already done
  if (!lead.socials || !lead.socials.searchedAt) {
    onProgress && onProgress({ status:'searching', message:`📱 Finding social profiles first...` });
    try {
      lead.socials = await findSocialMedia(lead, onProgress);
    } catch(e) {
      onProgress && onProgress({ status:'error', message:`⚠ Social search failed: ${e.message}` });
    }
  }

  // Step 1: Try Facebook page (Puppeteer)
  const fb = await findEmailFromFacebook(lead, onProgress);
  if (fb) return fb;

  // Step 2: Try business website
  const web = await findEmailFromWebsite(lead, onProgress);
  if (web) return web;

  onProgress && onProgress({ status:'not_found', message:`❌ No email found for ${lead.name}` });
  return null;
}

async function checkCredits() {
  const key = process.env.HUNTER_API_KEY;
  if (!key) return null;
  try {
    const res = await axios.get(`${HUNTER}/account`, { params: { api_key: key }, timeout: 5000 });
    const r = res.data.data?.requests;
    return { used: r?.searches?.used || 0, available: r?.searches?.available || 0 };
  } catch { return null; }
}

module.exports = { findEmail, hunterSearch, checkCredits };
