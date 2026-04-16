const Anthropic = require('@anthropic-ai/sdk');
const { renderOutreachHtml, renderSamples, stripUrls } = require('./email-template');

function getClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === 'your_anthropic_key_here') throw new Error('Anthropic API key not set.');
  return new Anthropic({ apiKey: key });
}

function parseJSON(text) {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) try { return JSON.parse(m[0]); } catch {}
  return null;
}

function buildEmailPrompt(lead, previewUrl, type, outreachType) {
  const hasWebsite = outreachType === 'has_website' || (!outreachType && lead.website);
  const angleLine = hasWebsite
    ? `They already have a website. You are NOT building them a new one and there is NO demo site to show. Your angle is a free redesign of the site they already have: it can be faster, cleaner, more modern, and you would add a few features (a chatbot that handles after-hours questions, a better contact flow, anything else that makes the site convert more of its traffic). All of this is free, and the owner keeps their existing domain and content. Describe the redesign as notes you made looking at their current site, to be walked through on the call. Do not use the word "demo" and do not suggest there is anything to click in this email.`
    : `They do not have a website yet. Your angle is building from scratch: you noticed they are missing an online presence despite strong reviews, and you went ahead and built them a real demo site so they can see what showing up online could look like.`;

  const demoRuleLine = hasWebsite
    ? `CRITICAL: There is NO demo site and NO button in this email. Do not promise anything to click, do not say "take a look below", do not include any URL or phrase like "here:" or "live at:". Refer naturally to notes you put together for their current site and offer to walk through them on the call.`
    : `CRITICAL: Do NOT include any URL, link, or phrase like "here:" or "live at:" in the body. The recipient will see a prominent "View Your Demo Site" button immediately below your message that takes them to the demo. Refer to the demo naturally in the body ("I built you a demo", "the demo below", "the link below") but never paste a URL.`;

  return `Write a cold outreach email from Leif to the owner of "${lead.name}", a ${type} at ${lead.address}.
Google rating: ${lead.rating !== 'N/A' ? lead.rating + '/5 with ' + lead.reviews + ' reviews' : 'not yet rated'}.

${angleLine}

Leif is the founder of Forge AI. He runs the company. He personally found this business, looked at what they have today, and is reaching out as the person behind it, not a company blasting mass emails, not an employee.

${demoRuleLine}

What Leif is handing over, completely free (adapt item 1 to the angle):
1. ${hasWebsite ? 'A redesign of their current website (faster, cleaner, modern look) with added features like a chatbot for after-hours questions and a better contact flow, while they keep their existing domain and content' : 'The live demo website (already built, revealed via the button)'}
2. A ready-to-post Instagram caption written for their business
3. A professional Google review response template
4. A customer follow-up message for after visits
5. A full online presence audit, website, socials, reviews, local visibility

What Forge AI does beyond this free offer:
- Custom websites built and maintained with AI
- Automated customer follow-up and retention systems (text and email sequences that bring past customers back at the right moments, seasonal check-ins, touch-ups, referral nudges). This is our strongest add-on for service businesses and appears as a soft callout below the free deliverables in the email.
- Automated social media content and scheduling across all platforms
- AI-powered Google review management and reputation building
- Local SEO and Google Business Profile optimization
- AI chatbots for websites to capture and convert leads 24/7
- Targeted ad campaign management
- Full business automation, letting owners focus on running the business
Hint at this scale once in the body ("we also handle X, Y, Z if you ever want to scale"), do not list everything. Never mention pricing, never imply cost, never use words like "paid", "upgrade", "package", "tier", or "monthly". The soft callout below the body carries the idea visually, keep the body conversational.

Email structure:
1. Opening, something genuinely specific about this business. Their rating, reviews, or something real about them. Make it feel like Leif actually looked them up. Warm, human, not corporate.
2. Leif introduces himself as the founder of Forge AI. Natural phrasing like "I'm Leif, I run Forge AI" or "I started Forge AI". One short sentence on what Forge AI does with AI for local businesses.
3. ${hasWebsite ? 'Describe what you noticed about their current website and the specific improvements you would make (faster load, cleaner modern look, added chatbot, better contact flow). Make it clear the redesign is free, they keep their domain, and you would walk through the detailed notes on the call. Do NOT mention a demo or anything to click.' : 'Tell them the demo exists (without pasting the URL). Be clear: this demo is a starting point. The real site will be built around their actual style, colors, feel, and photos, and can look completely different.'}
4. List the 5 free things clearly so the value feels undeniable.
5. The exchange: everything is free, all Leif asks in return is one quick 5-minute call. Fair trade, no-brainer.
6. One line hinting that Forge AI can handle more if they ever want to scale.
7. Sign off simply: Leif.

Rules:
- Sound like a real founder who genuinely did the work before asking for anything
- Leif is the founder of Forge AI, never "I work with Forge AI" or "I'm part of Forge AI"
- Confident and generous tone, not desperate, not salesy, not begging
- The ask (5-minute call) must feel laughably small compared to the value
- The reader should finish the email thinking "why would I say no to this"
- Short paragraphs, punchy, easy to read on a phone
- Under 200 words for the main body
- No pricing anywhere
- No corporate language or buzzwords
- Absolutely no URLs, link text, or "here:" phrases anywhere in the body
- Subject line: short (under 9 words), sounds like a real person texting not a marketer emailing, creates a "wait, what?" reaction. Examples: "I built something for you", "took a look at your place", "made this for [Business Name]", "had an idea about [Business Name]". Never use exclamation marks, never sound like a newsletter, never use words like "partnership", "opportunity", "grow", or "free"
- Sign off: just "Leif" on its own line

Return ONLY valid JSON with no extra text:
{"subject":"...","body":"..."}`;
}

async function generateFreeSamples(lead) {
  const client = getClient();
  const type = (lead.type || 'business').replace(/_/g, ' ');
  const rating = lead.rating !== 'N/A' ? lead.rating + '/5' : '';
  const reviews = lead.reviews && lead.reviews !== 'N/A' ? lead.reviews + ' reviews' : '';

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{ role: 'user', content:
`Generate 3 polished, professional AI samples for "${lead.name}", a ${type} at ${lead.address}. ${rating ? 'Rating: ' + rating : ''} ${reviews}.

Return ONLY valid JSON:
{
  "instagram_post": "Polished ready-to-post Instagram caption. 3-4 sentences, professional and engaging, speaks to their ideal customer, ends with CTA and 5-7 relevant hashtags. Specific to their business type and location.",
  "review_response": "Warm professional response to a 5-star Google review. Thank [Customer Name], reference their experience warmly, invite them back. Personal and genuine, not templated. 2-3 sentences.",
  "followup_message": "Professional friendly follow-up message via SMS or email sent 2 days after a visit. Checks their experience, offers help, gently encourages next booking. Under 60 words."
}`
    }]
  });

  const result = parseJSON(msg.content[0].text);
  if (!result) throw new Error('Failed to generate samples.');
  return result;
}

async function generateEmailCopy(lead, previewUrl, outreachType) {
  const client = getClient();
  const type = (lead.type || 'business').replace(/_/g, ' ');
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    messages: [{ role: 'user', content: buildEmailPrompt(lead, previewUrl, type, outreachType) }]
  });
  const result = parseJSON(msg.content[0].text);
  if (!result?.subject || !result?.body) throw new Error('Failed to generate email. Try again.');
  // Safety net: if Claude ignored the no-URL rule, strip any URLs it slipped in.
  result.body = stripUrls(result.body);
  return result;
}

async function generateEmailPreview(lead, previewUrl, outreachType) {
  return generateEmailCopy(lead, previewUrl, outreachType);
}

// A preview URL is only safe to send if it actually points at a demo site,
// not the app base / login page / localhost. Without this guard, leads
// whose builder never ran get an email whose CTA button opens the login page.
function hasValidDemoUrl(url) {
  const s = url && String(url).trim();
  if (!s) return false;
  if (/localhost|127\.0\.0\.1|ngrok/i.test(s)) return false;
  if (s.includes('.pages.dev')) return true;
  if (/\/sites\/[^/?#]+/.test(s)) return true;
  try {
    const u = new URL(s);
    if (!u.hostname) return false;
    if (!u.pathname || u.pathname === '/') return false;
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch { return false; }
}

class NoDemoError extends Error {
  constructor(msg) { super(msg); this.code = 'NO_DEMO'; }
}

async function sendOutreach(lead, previewUrl, emailAddress, onProgress, subjectOverride, bodyOverride, trackingOpts, outreachType) {
  const hasWebsite = outreachType === 'has_website' || (!outreachType && !!lead.website);
  // For no-website leads we need a real demo URL, otherwise the CTA button
  // would open the login page. Has-website leads don't get a demo button at
  // all (the pitch is "I'll redesign your current site"), so skip the guard.
  if (!hasWebsite && !hasValidDemoUrl(previewUrl)) {
    throw new NoDemoError(`No demo site built for ${lead.name}. Run the Builder first so the email has a real demo to link to.`);
  }
  onProgress({ status: 'generating', message: `Generating samples for ${lead.name}...` });

  let samples;
  try {
    samples = await generateFreeSamples(lead);
    onProgress({ status: 'generating', message: `Samples ready. Writing email...` });
  } catch(e) {
    onProgress({ status: 'generating', message: `Skipping samples, writing email...` });
    samples = null;
  }

  const copy = (subjectOverride && bodyOverride)
    ? { subject: subjectOverride, body: stripUrls(bodyOverride) }
    : await generateEmailCopy(lead, previewUrl, outreachType);

  const { RESEND_API_KEY, RESEND_FROM } = process.env;
  if (!RESEND_API_KEY) throw new Error('Resend API key not configured. Go to Settings.');
  if (!RESEND_FROM) throw new Error('Resend From email not configured. Go to Settings.');

  const { Resend } = require('resend');
  const resend = new Resend(RESEND_API_KEY);

  onProgress({ status: 'sending', message: `Sending to ${emailAddress}...` });

  // Has-website leads get no CTA button (the pitch is "I'll redesign your
  // current site", no demo to click). No-website leads get the demo button.
  const ctaUrl = hasWebsite ? null : (trackingOpts?.clickUrl || previewUrl);
  const pixelHtml = trackingOpts?.pixelHtml || '';

  const auditLine = lead.rating !== 'N/A'
    ? `Website: ${hasWebsite ? 'Current site has room to be faster, cleaner, and built to convert more of your traffic.' : 'No site found, your demo shows what can be live within 24 hours.'} Google reviews: ${lead.rating}/5 with ${lead.reviews} reviews, strong social proof that deserves a proper web presence. Follow-up: most local businesses lose repeat customers simply by not following up, automation solves that.`
    : `A short audit of your current online presence, walked through with you on the call.`;

  const samplesHtml = samples
    ? renderSamples({ samples, demoUrl: ctaUrl || previewUrl, auditLine })
    : '';

  const checklist = hasWebsite
    ? [
        'A redesign of your current site, faster, cleaner, and modern, with added features like a chatbot and improved contact flow',
        'A ready-to-post Instagram caption for your business',
        'A professional Google review response template',
        'A customer follow-up message template',
        'A full online presence audit'
      ]
    : [
        'Your live demo website, already built',
        'A ready-to-post Instagram caption for your business',
        'A professional Google review response template',
        'A customer follow-up message template',
        'A full online presence audit'
      ];

  const html = renderOutreachHtml({
    bodyText: copy.body,
    ctaUrl,
    ctaLabel: 'View Your Demo Site',
    checklist,
    premiumAddOn: {
      title: 'One more thing worth mentioning',
      body: "We also set up automated follow-up systems for local businesses, text and email sequences that bring past customers back at the right moments, seasonal check-ins, touch-ups, referral nudges. For a business like yours with strong reviews and repeat-work potential, it's where we see the biggest long-term ROI for owners. Happy to walk you through how it works on the call if you're curious."
    },
    closingLine: 'All I ask in return is a 5-minute call so I can walk you through it. No pitch, no pressure.',
    samplesHtml,
    pixelHtml
  });

  await resend.emails.send({
    from: `Leif | Forge AI <${RESEND_FROM}>`,
    to: emailAddress,
    replyTo: RESEND_FROM,
    subject: copy.subject,
    text: copy.body,
    html
  });

  onProgress({ status: 'sent', message: `Sent to ${emailAddress} with 5 free deliverables` });
  return { subject: copy.subject, body: copy.body, samples, sentTo: emailAddress, sentAt: new Date().toISOString() };
}

// ── FOLLOW-UP EMAIL GENERATION ────────────────────────────────────────────
async function generateFollowUpEmail(lead, step, previousSubject) {
  const client = getClient();
  const type = (lead.type || 'business').replace(/_/g, ' ');
  const angles = [
    'Check in - did they see the demo? Short, casual, reference the original email.',
    'Value add - share a quick tip or insight relevant to their business type. Position as helpful, not salesy.',
    'Last touch - final follow-up. Be direct but not pushy. Mention this is the last email unless they want to chat.'
  ];
  const angle = angles[Math.min(step-1, angles.length-1)];

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{ role: 'user', content:
`Write a follow-up email #${step} from Leif (Forge AI) to the owner of "${lead.name}", a ${type}.
This is follow-up ${step} of 3. Previous subject was: "${previousSubject}"

Angle for this follow-up: ${angle}

Rules:
- Very short (under 80 words)
- Casual, human, like a real person checking in
- Reference the original email/demo
- No corporate language
- Subject line: short, casual, different from the original
- Sign off: Leif

Return ONLY valid JSON: {"subject":"...","body":"..."}`
    }]
  });

  const result = parseJSON(msg.content[0].text);
  if (!result?.subject || !result?.body) throw new Error('Failed to generate follow-up.');
  return result;
}

// ── DM SCRIPT GENERATION ──────────────────────────────────────────────────
async function generateDMScript(lead, platform) {
  const client = getClient();
  const type = (lead.type || 'business').replace(/_/g, ' ');
  const platformName = platform === 'facebook' ? 'Facebook Messenger' : 'Instagram DM';

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{ role: 'user', content:
`Generate 3 different ${platformName} scripts from Leif (Forge AI) to the owner of "${lead.name}", a ${type} at ${lead.address}.
Rating: ${lead.rating !== 'N/A' ? lead.rating + '/5 with ' + lead.reviews + ' reviews' : 'N/A'}.

Each script should be:
- Very casual and conversational (DM style, not email style)
- Under 60 words each
- Reference something specific about their business
- Mention that Leif built them a free demo website
- End with a soft call to action (link to demo or quick call)
- Sound like a real person, not a marketer
- Different angle for each (compliment, value-first, curiosity)

Return ONLY valid JSON:
{"scripts": [
  {"label": "Approach name", "text": "The DM script..."},
  {"label": "Approach name", "text": "The DM script..."},
  {"label": "Approach name", "text": "The DM script..."}
]}`
    }]
  });

  const result = parseJSON(msg.content[0].text);
  if (!result?.scripts) throw new Error('Failed to generate DM scripts.');
  return result.scripts;
}

// ── A/B SUBJECT LINE GENERATION ───────────────────────────────────────────
async function generateABSubjects(lead, previewUrl) {
  const client = getClient();
  const type = (lead.type || 'business').replace(/_/g, ' ');

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{ role: 'user', content:
`Generate 2 very different email subject line variations for a cold outreach email from Leif (Forge AI) to "${lead.name}", a ${type}.

Variation A: More direct/specific - reference something about their business
Variation B: More curiosity-driven - create intrigue

Rules: Under 9 words each, no exclamation marks, sound like a real person, not a marketer.

Return ONLY valid JSON: {"subjectA":"...","subjectB":"..."}`
    }]
  });

  const result = parseJSON(msg.content[0].text);
  if (!result?.subjectA || !result?.subjectB) throw new Error('Failed to generate A/B subjects.');
  return result;
}

module.exports = { sendOutreach, generateEmailPreview, generateFreeSamples, generateFollowUpEmail, generateDMScript, generateABSubjects, hasValidDemoUrl, NoDemoError };
