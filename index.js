const path = require('path');
const fs = require('fs');
// Load .env from leads dir (persisted volume) first, then fallback to local
const leadsEnv = path.join(__dirname, 'leads', '.env');
const localEnv = path.join(__dirname, '.env');
require('dotenv').config({ path: fs.existsSync(leadsEnv) ? leadsEnv : localEnv });
const express = require('express');
const cors = require('cors');
const session = require('express-session');

const { runScout }              = require('./agents/scout');
const { buildDemoSite }         = require('./agents/builder');
const { deployDemoSite: cfDeploy, isConfigured: cfConfigured } = require('./agents/cloudflare');
const { sendOutreach, generateEmailPreview } = require('./agents/outreach');
const { handleReply }           = require('./agents/closer');
const { findEmail, checkCredits } = require('./agents/emailfinder');

const app = express();
const PORT = process.env.PORT || 3000;
const getBase = () => process.env.PUBLIC_URL || `http://localhost:${PORT}`;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'agentforge-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 days
}));

// ── AUTH ──────────────────────────────────────────────────────────────────
const LOGIN_USER = process.env.LOGIN_USER || 'leif';
const LOGIN_PASS = process.env.LOGIN_PASS || 'webforge2026';

app.get('/login', (req, res) => {
  if (req.session.auth) return res.redirect('/');
  res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AgentForge — Login</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#060810;color:#f0f4ff;font-family:'Syne',sans-serif;height:100vh;display:flex;align-items:center;justify-content:center}
body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(0,229,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,255,.03) 1px,transparent 1px);background-size:40px 40px;pointer-events:none}
.card{background:#0b0f1a;border:1px solid #1e2a45;border-radius:16px;padding:48px 40px;width:100%;max-width:400px;position:relative}
.logo{font-size:22px;font-weight:800;letter-spacing:.03em;margin-bottom:32px;text-align:center}
.logo span{color:#00e5ff}
label{display:block;font-size:11px;color:#4a5d80;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
input{width:100%;background:#060810;border:1px solid #1e2a45;border-radius:8px;padding:12px 14px;color:#f0f4ff;font-size:14px;outline:none;margin-bottom:20px;font-family:inherit}
input:focus{border-color:#00e5ff}
button{width:100%;background:#00e5ff;color:#060810;border:none;border-radius:8px;padding:13px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;letter-spacing:.04em}
button:hover{background:#00b8cc}
.err{color:#ff4d6d;font-size:13px;margin-bottom:16px;text-align:center}
</style>
</head>
<body>
<div class="card">
  <div class="logo">AGENT<span>FORGE</span></div>
  ${req.query.err ? '<div class="err">Invalid username or password.</div>' : ''}
  <form method="POST" action="/login">
    <label>Username</label>
    <input type="text" name="username" autofocus autocomplete="username">
    <label>Password</label>
    <input type="password" name="password" autocomplete="current-password">
    <button type="submit">Sign In →</button>
  </form>
</div>
</body>
</html>`);
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === LOGIN_USER && password === LOGIN_PASS) {
    req.session.auth = true;
    return res.redirect('/');
  }
  res.redirect('/login?err=1');
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

function requireAuth(req, res, next) {
  if (req.session.auth) return next();
  res.redirect('/login');
}

// Protect all routes except /login and /logout
app.use((req, res, next) => {
  if (req.path === '/login' || req.path === '/logout') return next();
  if (req.session.auth) return next();
  res.redirect('/login');
});
app.use(express.static(path.join(__dirname,'public'), {
  setHeaders: (res, p) => {
    if (p.endsWith('.html')) {
      res.setHeader('Cache-Control','no-cache, no-store, must-revalidate');
      res.setHeader('Pragma','no-cache');
    }
  }
}));
const SITES_DIR = path.join(__dirname,'sites');
fs.mkdirSync(SITES_DIR,{recursive:true});
app.use('/sites', express.static(SITES_DIR));

// ── DATA ──────────────────────────────────────────────────────────────────
const DATA = path.join(__dirname,'leads');
fs.mkdirSync(DATA,{recursive:true});
const LF = path.join(DATA,'leads.json');
const OF = path.join(DATA,'outreach.json');
const RF = path.join(DATA,'replies.json');
const load = f => { try { return fs.existsSync(f)?JSON.parse(fs.readFileSync(f)):[] } catch { return [] } };
const save = (f,d) => fs.writeFileSync(f,JSON.stringify(d,null,2));
let leads = load(LF), outreach = load(OF), replies = load(RF);

// Migrate any stale ngrok previewUrls to local paths
let migrated = false;
leads = leads.map(l => {
  if (l.previewUrl && l.previewUrl.includes('ngrok') && l.siteFile) {
    migrated = true;
    return { ...l, previewUrl: `http://localhost:${PORT}/sites/${l.siteFile}` };
  }
  return l;
});
if (migrated) save(LF, leads);

// ── SSE ───────────────────────────────────────────────────────────────────
const sessions = {};
app.get('/api/stream/:id', (req,res) => {
  res.setHeader('Content-Type','text/event-stream');
  res.setHeader('Cache-Control','no-cache');
  res.setHeader('Connection','keep-alive');
  res.flushHeaders();
  const send = d => res.write(`data: ${JSON.stringify(d)}\n\n`);
  sessions[req.params.id] = send;
  send({ type:'connected' });
  req.on('close', () => delete sessions[req.params.id]);
});
const emit = (sid,d) => { if(sid&&sessions[sid]) sessions[sid](d) };

// ── SCOUT ─────────────────────────────────────────────────────────────────
app.post('/api/scout/run', async (req,res) => {
  const { location, businessTypes, businessType, maxLeads, sessionId } = req.body;
  if (!location) return res.status(400).json({ error:'Location required' });
  res.json({ status:'started' });
  try {
    await runScout({ location, businessTypes, businessType, maxLeads:parseInt(maxLeads)||20 }, p => {
      emit(sessionId, { type:'scout', ...p });
      if (p.lead) {
        if (!leads.find(l=>l.name===p.lead.name&&l.address===p.lead.address)) {
          leads.push(p.lead); save(LF,leads);
        }
      }
    });
    emit(sessionId, { type:'scout_done', total: leads.length });
  } catch(e) { emit(sessionId, { type:'error', agent:'scout', message:e.message }); }
});

// ── EMAIL FINDER ──────────────────────────────────────────────────────────
app.post('/api/emailfinder/find', async (req,res) => {
  const { leadIndex, sessionId } = req.body;
  const lead = leads[leadIndex];
  if (!lead) return res.status(404).json({ error:'Lead not found' });
  res.json({ status:'started' });
  try {
    emit(sessionId, { type:'emailfinder', status:'searching', message:`🔍 Searching email for ${lead.name}...` });
    const result = await findEmail(lead, p => emit(sessionId,{ type:'emailfinder',...p }));
    if (result) {
      leads[leadIndex].foundEmail=result.email;
      leads[leadIndex].emailConfidence=result.confidence;
      save(LF,leads);
      emit(sessionId, { type:'emailfinder', status:'found', message:`✅ Found: ${result.email} (${result.confidence}% confidence)` });
    } else {
      emit(sessionId, { type:'emailfinder', status:'not_found', message:`❌ No email found for ${lead.name}` });
    }
    emit(sessionId, { type:'emailfinder_done', leadIndex, email:result?.email||null, confidence:result?.confidence||null });
  } catch(e) { emit(sessionId, { type:'error', agent:'emailfinder', message:e.message }); }
});

app.post('/api/emailfinder/find-batch', async (req,res) => {
  const { leadIndices, sessionId } = req.body;
  if (!leadIndices?.length) return res.status(400).json({ error:'No leads' });
  res.json({ status:'started' });
  let found = 0;
  emit(sessionId, { type:'emailfinder', status:'start', message:`🚀 Starting batch search for ${leadIndices.length} leads...` });
  for (let i = 0; i < leadIndices.length; i++) {
    const idx = leadIndices[i];
    const lead = leads[idx];
    if (!lead) continue;
    try {
      emit(sessionId, { type:'emailfinder', status:'searching', message:`[${i+1}/${leadIndices.length}] Searching: ${lead.name}` });
      const result = await findEmail(lead, p => emit(sessionId,{ type:'emailfinder',...p }));
      if (result) {
        leads[idx].foundEmail=result.email;
        leads[idx].emailConfidence=result.confidence;
        found++;
        save(LF,leads);
        emit(sessionId, { type:'emailfinder', status:'found', message:`✅ [${i+1}/${leadIndices.length}] ${lead.name} → ${result.email}` });
      } else {
        emit(sessionId, { type:'emailfinder', status:'not_found', message:`❌ [${i+1}/${leadIndices.length}] No email for ${lead.name}` });
      }
      emit(sessionId, { type:'emailfinder_done', leadIndex:idx, email:result?.email||null });
    } catch(e) {
      emit(sessionId, { type:'emailfinder', status:'error', message:`⚠ ${lead.name}: ${e.message}` });
    }
    await new Promise(r=>setTimeout(r,600));
  }
  emit(sessionId, { type:'emailfinder_batch_done', found, total:leadIndices.length });
  emit(sessionId, { type:'emailfinder', status:'complete', message:`🏁 Done — ${found}/${leadIndices.length} emails found` });
});

app.get('/api/emailfinder/credits', async (req,res) => {
  try { res.json({ credits: await checkCredits() }); }
  catch(e) { res.status(500).json({ error:e.message }); }
});

// ── BUILDER ───────────────────────────────────────────────────────────────
app.post('/api/builder/build', async (req,res) => {
  const { leadIndex, sessionId } = req.body;
  const lead = leads[leadIndex];
  if (!lead) return res.status(404).json({ error:'Lead not found' });
  res.json({ status:'started' });
  emit(sessionId, { type:'builder', status:'start', message:`🚀 Starting build for ${lead.name}...` });
  try {
    const { filename, html } = await buildDemoSite(lead, p => emit(sessionId,{ type:'builder',...p }));
    let previewUrl = `${getBase()}/sites/${filename}`;
    if (cfConfigured()) {
      try {
        previewUrl = await cfDeploy(lead.name, html, p => emit(sessionId,{ type:'builder',...p }));
      } catch(cfErr) {
        emit(sessionId, { type:'builder', status:'warn', message:`⚠️  Cloudflare deploy failed: ${cfErr.message} — using local URL` });
      }
    }
    leads[leadIndex] = { ...leads[leadIndex], siteFile:filename, previewUrl, status:'Site Built' };
    save(LF,leads);
    emit(sessionId, { type:'builder', status:'done', message:`✅ ${lead.name} — site live! ${previewUrl}` });
    emit(sessionId, { type:'builder_done', leadIndex, filename, previewUrl });
  } catch(e) {
    emit(sessionId, { type:'builder', status:'error', message:`❌ Failed: ${e.message}` });
    emit(sessionId, { type:'error', agent:'builder', message:e.message });
  }
});

app.post('/api/builder/build-batch', async (req,res) => {
  const { leadIndices, sessionId } = req.body;
  if (!leadIndices?.length) return res.status(400).json({ error:'No leads' });
  res.json({ status:'started' });
  emit(sessionId, { type:'builder', status:'start', message:`🚀 Building ${leadIndices.length} site(s)...` });
  let built = 0;
  for (let i = 0; i < leadIndices.length; i++) {
    const idx = leadIndices[i];
    const lead = leads[idx];
    if (!lead) continue;
    emit(sessionId, { type:'builder', status:'building', message:`[${i+1}/${leadIndices.length}] Building: ${lead.name}...` });
    try {
      const { filename, html } = await buildDemoSite(lead, p => emit(sessionId,{ type:'builder',...p }));
      let previewUrl = `${getBase()}/sites/${filename}`;
      if (cfConfigured()) {
        try {
          previewUrl = await cfDeploy(lead.name, html, p => emit(sessionId,{ type:'builder',...p }));
        } catch(cfErr) {
          emit(sessionId, { type:'builder', status:'warn', message:`⚠️  Cloudflare deploy failed: ${cfErr.message} — using local URL` });
        }
      }
      leads[idx] = { ...leads[idx], siteFile:filename, previewUrl, status:'Site Built' };
      save(LF,leads);
      built++;
      emit(sessionId, { type:'builder', status:'done', message:`✅ [${built}/${leadIndices.length}] ${lead.name} live!` });
      emit(sessionId, { type:'builder_done', leadIndex:idx, filename, previewUrl });
    } catch(e) {
      emit(sessionId, { type:'builder', status:'error', message:`❌ ${lead.name}: ${e.message}` });
    }
    await new Promise(r=>setTimeout(r,800));
  }
  emit(sessionId, { type:'builder_batch_done', built, total:leadIndices.length });
  emit(sessionId, { type:'builder', status:'complete', message:`🏁 Done — ${built}/${leadIndices.length} sites built` });
});

// ── OUTREACH ──────────────────────────────────────────────────────────────
app.post('/api/outreach/preview', async (req,res) => {
  const { leadIndex } = req.body;
  const lead = leads[leadIndex];
  if (!lead) return res.status(404).json({ error:'Lead not found' });
  try {
    const copy = await generateEmailPreview(lead, lead.previewUrl||getBase());
    res.json({ ok:true, copy });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.post('/api/outreach/send', async (req,res) => {
  const { leadIndex, emailAddress, sessionId, subject, body } = req.body;
  const lead = leads[leadIndex];
  if (!lead) return res.status(404).json({ error:'Lead not found' });
  if (!emailAddress) return res.status(400).json({ error:'Email required' });
  if (outreach.find(o=>o.leadIndex===leadIndex&&o.sentTo===emailAddress))
    return res.status(400).json({ error:'Already sent to this address for this lead.' });
  res.json({ status:'started' });
  emit(sessionId, { type:'outreach', status:'start', message:`📧 Preparing email for ${lead.name}...` });
  try {
    const result = await sendOutreach(lead, lead.previewUrl||getBase(), emailAddress, p => emit(sessionId,{ type:'outreach',...p }), subject, body);
    outreach.push({ leadIndex, lead:lead.name, ...result });
    save(OF,outreach);
    leads[leadIndex].status='Outreach Sent';
    leads[leadIndex].outreachEmail=emailAddress;
    leads[leadIndex].outreachSentAt=result.sentAt;
    save(LF,leads);
    emit(sessionId, { type:'outreach', status:'sent', message:`✅ Email sent to ${emailAddress}!` });
    emit(sessionId, { type:'outreach_done', leadIndex, result });
  } catch(e) {
    emit(sessionId, { type:'outreach', status:'error', message:`❌ Failed: ${e.message}` });
    emit(sessionId, { type:'error', agent:'outreach', message:e.message });
  }
});

// ── CLOSER ────────────────────────────────────────────────────────────────
app.post('/api/closer/handle', async (req,res) => {
  const { leadIndex, replyText, sessionId } = req.body;
  const lead = leads[leadIndex];
  if (!lead) return res.status(404).json({ error:'Lead not found' });
  res.json({ status:'started' });
  emit(sessionId, { type:'closer', status:'start', message:`🧠 Analyzing reply from ${lead.name}...` });
  const orig = outreach.find(o=>o.leadIndex===leadIndex) || { subject:'Your free demo website' };
  try {
    const response = await handleReply(lead, orig, replyText, p => emit(sessionId,{ type:'closer',...p }));
    replies.push({ leadIndex, lead:lead.name, replyText, response, at:new Date().toISOString() });
    save(RF,replies);
    leads[leadIndex].status=response.sentiment==='positive'?'Hot Lead 🔥':'Replied';
    leads[leadIndex].lastReply=replyText;
    save(LF,leads);
    emit(sessionId, { type:'closer', status:'done', message:`✅ Response ready — ${response.objectionType} (${response.sentiment})` });
    emit(sessionId, { type:'closer_done', leadIndex, response });
  } catch(e) {
    emit(sessionId, { type:'closer', status:'error', message:`❌ Failed: ${e.message}` });
    emit(sessionId, { type:'error', agent:'closer', message:e.message });
  }
});

// ── LEADS ─────────────────────────────────────────────────────────────────
app.get('/api/leads', (req,res) => res.json({ leads, total:leads.length }));
app.delete('/api/leads/:i', (req,res) => {
  const i=parseInt(req.params.i);
  if(i>=0&&i<leads.length){leads.splice(i,1);save(LF,leads);}
  res.json({ok:true});
});
app.delete('/api/leads', (req,res) => { leads=[];save(LF,leads);res.json({ok:true}); });
app.get('/api/leads/export/csv', (req,res) => {
  const h=['name','address','phone','rating','reviews','type','location','status','foundEmail','emailConfidence','previewUrl','outreachEmail','found_at'];
  const rows=leads.map(l=>h.map(k=>`"${(l[k]||'').toString().replace(/"/g,'""')}"`).join(','));
  res.setHeader('Content-Type','text/csv');
  res.setHeader('Content-Disposition','attachment; filename="agentforge-leads.csv"');
  res.send([h.join(','),...rows].join('\n'));
});

// ── SETTINGS ─────────────────────────────────────────────────────────────
app.get('/api/settings', (req,res) => res.json({
  hasAnthropicKey: !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY!=='your_anthropic_key_here'),
  hasGoogleKey: !!process.env.GOOGLE_PLACES_API_KEY,
  hasSmtp: !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM),
  hasHunter: !!process.env.HUNTER_API_KEY,
  hasCloudflare: !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN),
  resendFrom: process.env.RESEND_FROM||'',
}));

app.post('/api/settings', (req,res) => {
  const { anthropicKey, resendApiKey, resendFrom, hunterKey, cloudflareAccountId, cloudflareApiToken } = req.body;
  const ep = fs.existsSync(path.join(__dirname,'leads')) ? path.join(__dirname,'leads','.env') : path.join(__dirname,'.env');
  let env = fs.existsSync(ep)?fs.readFileSync(ep,'utf8'):'';
  const set = (k,v) => {
    if (!v) return;
    env = env.match(new RegExp(`^${k}=`,'m')) ? env.replace(new RegExp(`^${k}=.*`,'m'),`${k}=${v}`) : env+`\n${k}=${v}`;
    process.env[k]=v;
  };
  set('ANTHROPIC_API_KEY',anthropicKey);
  set('RESEND_API_KEY',resendApiKey);
  set('RESEND_FROM',resendFrom);
  set('HUNTER_API_KEY',hunterKey);
  set('CLOUDFLARE_ACCOUNT_ID',cloudflareAccountId);
  set('CLOUDFLARE_API_TOKEN',cloudflareApiToken);
  fs.writeFileSync(ep,env.trim());
  res.json({ok:true});
});

// ── ANALYTICS ─────────────────────────────────────────────────────────────
app.get('/api/analytics', (req,res) => {
  const total=leads.length,withEmail=leads.filter(l=>l.foundEmail).length,
        withSite=leads.filter(l=>l.siteFile).length,contacted=leads.filter(l=>l.outreachEmail).length,
        hot=leads.filter(l=>l.status==='Hot Lead 🔥').length;
  res.json({ total,withEmail,withSite,contacted,replied:replies.length,hotLeads:hot,
    convRate:contacted>0?((hot/contacted)*100).toFixed(1):0 });
});

app.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════╗`);
  console.log(`  ║   AgentForge → localhost:${PORT}   ║`);
  console.log(`  ╚══════════════════════════════════╝\n`);
  console.log(`  Google Places : ${process.env.GOOGLE_PLACES_API_KEY?'✓ Ready':'✗ Missing'}`);
  console.log(`  Anthropic     : ${process.env.ANTHROPIC_API_KEY&&process.env.ANTHROPIC_API_KEY!=='your_anthropic_key_here'?'✓ Ready':'✗ Add in Settings'}`);
  console.log(`  Hunter.io     : ${process.env.HUNTER_API_KEY?'✓ Ready':'✗ Add in Settings'}`);
  console.log(`  SMTP Email    : ${process.env.SMTP_HOST?'✓ Ready':'✗ Add in Settings'}`);
  console.log(`  Cloudflare    : ${process.env.CLOUDFLARE_ACCOUNT_ID&&process.env.CLOUDFLARE_API_TOKEN?'✓ Ready — sites deploy to pages.dev':'✗ Add in Settings (required for permanent URLs)'}\n`);
});

// ── SOCIAL FINDER ─────────────────────────────────────────────────────────
const { findSocialMedia } = require('./agents/socialfinder');

app.post('/api/social/find', async (req, res) => {
  const { leadIndex, sessionId } = req.body;
  const lead = leads[leadIndex];
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (!lead.siteFile) return res.status(400).json({ error: 'Build a demo site first before finding social media.' });
  res.json({ status: 'started' });
  try {
    const result = await findSocialMedia(lead, p => emit(sessionId, { type: 'social', ...p }));
    leads[leadIndex].socials = result;
    save(LF, leads);
    emit(sessionId, { type: 'social_done', leadIndex, result });
  } catch(e) {
    emit(sessionId, { type: 'error', agent: 'social', message: e.message });
  }
});

app.post('/api/social/find-batch', async (req, res) => {
  const { leadIndices, sessionId } = req.body;
  if (!leadIndices?.length) return res.status(400).json({ error: 'No leads selected' });
  res.json({ status: 'started' });
  emit(sessionId, { type: 'social', status: 'start', message: `🚀 Searching social media for ${leadIndices.length} leads...` });
  let found = 0;
  for (let i = 0; i < leadIndices.length; i++) {
    const idx = leadIndices[i];
    const lead = leads[idx];
    if (!lead || !lead.siteFile) {
      emit(sessionId, { type: 'social', status: 'skip', message: `⏭ Skipping ${lead?.name || idx} — no site built yet` });
      continue;
    }
    try {
      emit(sessionId, { type: 'social', status: 'searching', message: `[${i+1}/${leadIndices.length}] Searching: ${lead.name}` });
      const result = await findSocialMedia(lead, p => emit(sessionId, { type: 'social', ...p }));
      leads[idx].socials = result;
      save(LF, leads);
      if (result.foundCount > 0) found++;
      emit(sessionId, { type: 'social_done', leadIndex: idx, result });
    } catch(e) {
      emit(sessionId, { type: 'social', status: 'error', message: `❌ ${lead.name}: ${e.message}` });
    }
    await new Promise(r => setTimeout(r, 500));
  }
  emit(sessionId, { type: 'social_batch_done', found, total: leadIndices.length });
  emit(sessionId, { type: 'social', status: 'complete', message: `🏁 Done — ${found}/${leadIndices.length} leads have social profiles` });
});
