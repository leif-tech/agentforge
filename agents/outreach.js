const Anthropic = require('@anthropic-ai/sdk');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// ── DAILY SEND COUNTER (resets every 24 hours) ──────────────────────────
const DATA_ROOT = process.env.DATA_DIR || path.join(__dirname, '..');
const COUNTER_FILE = path.join(DATA_ROOT, 'leads', '.send-counter.json');
const RESEND_DAILY_LIMIT = 100;
const RESET_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

function loadCounter() {
  try {
    const data = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8'));
    const now = Date.now();
    if (data.startedAt && (now - data.startedAt) < RESET_INTERVAL_MS) return data;
    return { startedAt: now, resend: 0, smtp: 0 };
  } catch {
    return { startedAt: Date.now(), resend: 0, smtp: 0 };
  }
}

function saveCounter(counter) {
  try { fs.writeFileSync(COUNTER_FILE, JSON.stringify(counter)); } catch {}
}

function getSendStats() {
  const counter = loadCounter();
  const elapsed = Date.now() - counter.startedAt;
  const remainingMs = Math.max(0, RESET_INTERVAL_MS - elapsed);
  const resetInHours = Math.floor(remainingMs / 3600000);
  const resetInMinutes = Math.floor((remainingMs % 3600000) / 60000);
  return {
    resend: counter.resend,
    smtp: counter.smtp,
    total: counter.resend + counter.smtp,
    resendLimit: RESEND_DAILY_LIMIT,
    resendRemaining: Math.max(0, RESEND_DAILY_LIMIT - counter.resend),
    usingSmtp: counter.resend >= RESEND_DAILY_LIMIT,
    resetsIn: `${resetInHours}h ${resetInMinutes}m`,
    resetsAtMs: counter.startedAt + RESET_INTERVAL_MS
  };
}

function incrementCounter(method) {
  const counter = loadCounter();
  counter[method] = (counter[method] || 0) + 1;
  saveCounter(counter);
  return counter;
}

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

function cleanCopy(obj) {
  if (!obj) return obj;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string') {
      obj[key] = obj[key].replace(/\s*—\s*/g, ', ').replace(/,,/g, ',');
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      cleanCopy(obj[key]);
    }
  }
  return obj;
}

function getFollowUpExamples(type) {
  const t = type.toLowerCase();
  const examples = {
    cafe: {
      short: 'a thank-you text 2 hours after their visit with a "come back this week for 10% off" nudge',
      scenarios: 'After a morning visit: "Thanks for stopping by today. Your usual cortado will be waiting." After a first visit: "Hope you loved it. Mention this text for a free pastry next time."'
    },
    coffee: {
      short: 'a thank-you text 2 hours after their visit with a "come back this week for 10% off" nudge',
      scenarios: 'After a morning visit: "Thanks for stopping by today. Your usual cortado will be waiting." After a first visit: "Hope you loved it. Mention this text for a free pastry next time."'
    },
    restaurant: {
      short: 'a follow-up the next day thanking them for dining in, plus a "book your next table" link',
      scenarios: 'After dinner: "Hope you enjoyed the meal last night. Your table is always here." Before holidays: "Valentine\'s reservations are filling up. Want us to save your usual spot?"'
    },
    'nail': {
      short: 'a rebooking nudge 2-3 weeks after their appointment, plus seasonal design drops',
      scenarios: 'At 2 weeks: "Your nails are probably ready for a refresh. Want to book your usual?" New season: "Fall colors just dropped. Book early for the new designs." Birthday: "Birthday nails on us, 20% off this month."'
    },
    'hair salon': {
      short: 'a rebooking reminder 4 weeks after their cut, plus birthday month specials',
      scenarios: 'After a cut: "Your hair looked amazing walking out. Book your next one before the rush?" At 6 weeks: "It\'s been a minute. Ready for a refresh?" Birthday month: automatic 15% off message.'
    },
    salon: {
      short: 'a rebooking reminder 4 weeks after their appointment, plus birthday month specials',
      scenarios: 'After an appointment: "You looked amazing walking out. Book your next one before the rush?" At 6 weeks: "It\'s been a minute. Ready for a refresh?" Birthday month: automatic 15% off message.'
    },
    hair: {
      short: 'a rebooking reminder 4 weeks after their cut, plus birthday month specials',
      scenarios: 'After a cut: "Your hair looked amazing walking out. Book your next one before the rush?" At 6 weeks: "It\'s been a minute. Ready for a refresh?" Birthday month: automatic 15% off message.'
    },
    auto: {
      short: 'an oil change reminder every 3 months, plus seasonal maintenance nudges',
      scenarios: 'At 3 months: "Your next oil change is coming up. Want to schedule before the weekend rush?" Before winter: "Cold weather is coming. Free tire pressure check if you swing by this week."'
    },
    yoga: {
      short: 'a check-in after their first class, plus weekly class schedule drops',
      scenarios: 'After first class: "How are you feeling after yesterday? Here\'s this week\'s schedule." If they miss a week: "We saved your spot in Thursday\'s flow class."'
    },
    fitness: {
      short: 'a check-in after their first session, plus milestone congratulations',
      scenarios: 'After signup: "How was your first workout? Need help with the equipment?" At 30 days: "One month in. You\'re building something real." If inactive: "Your gym misses you. Come back for a free smoothie."'
    },
    gym: {
      short: 'a check-in after their first workout, plus monthly progress nudges',
      scenarios: 'After first visit: "How was the workout? Any questions about the equipment?" At 2 weeks: "You\'re on a streak. Keep it going." If inactive 10 days: "Your routine is waiting. Free guest pass if you bring a friend."'
    },
    barbershop: {
      short: 'a "time for a fresh cut" reminder every 3-4 weeks',
      scenarios: 'At 3 weeks: "Looking a little shaggy? Your barber has Thursday open." After a cut: "Looking sharp. See you in a few weeks." Holiday: "Book your pre-holiday cut before slots fill up."'
    },
    barber: {
      short: 'a "time for a fresh cut" reminder every 3-4 weeks',
      scenarios: 'At 3 weeks: "Looking a little shaggy? Your barber has Thursday open." After a cut: "Looking sharp. See you in a few weeks." Holiday: "Book your pre-holiday cut before slots fill up."'
    },
    dental: {
      short: '6-month cleaning reminders, post-procedure check-ins, and braces adjustment recalls',
      scenarios: 'After a cleaning: "Great seeing you today. Your next cleaning is in 6 months, we\'ll remind you." After a filling: "How\'s the tooth feeling? Any sensitivity, just call us." Braces: "Your next adjustment is in 4 weeks. We\'ll text you a reminder."'
    },
    dentist: {
      short: '6-month cleaning reminders, post-procedure check-ins, and braces adjustment recalls',
      scenarios: 'After a cleaning: "Great seeing you today. Your next cleaning is in 6 months, we\'ll remind you." After a filling: "How\'s the tooth feeling? Any sensitivity, just call us." Braces: "Your next adjustment is in 4 weeks. We\'ll text you a reminder."'
    },
    vet: {
      short: 'vaccination reminders, annual checkup recalls, and post-visit check-ins',
      scenarios: 'After a visit: "How is [pet name] doing today? Any concerns, we\'re here." At 11 months: "Annual checkup time. [Pet name]\'s vaccines are due next month." Seasonal: "Flea and tick season is here. Need a refill on prevention?"'
    },
    bakery: {
      short: 'birthday cake reminders, holiday pre-order nudges, and "fresh batch" alerts',
      scenarios: 'Before their birthday: "Your birthday is coming up. Want us to save you a cake?" Before holidays: "Thanksgiving pie pre-orders are open. Last year we sold out." Weekly: "Fresh sourdough just came out of the oven."'
    },
    florist: {
      short: 'anniversary and holiday reminders so they never forget flowers again',
      scenarios: 'Before Valentine\'s: "Valentine\'s is next week. Want the same arrangement as last time?" Anniversary reminder: "Your anniversary is in 3 days. We have your usual ready." Mother\'s Day: "Don\'t forget Mom. Order by Friday for guaranteed delivery."'
    },
    flower: {
      short: 'anniversary and holiday reminders so they never forget flowers again',
      scenarios: 'Before Valentine\'s: "Valentine\'s is next week. Want the same arrangement as last time?" Anniversary reminder: "Your anniversary is in 3 days. We have your usual ready." Mother\'s Day: "Don\'t forget Mom. Order by Friday for guaranteed delivery."'
    },
    massage: {
      short: 'a rebooking reminder 3-4 weeks after their session, plus stress-relief tips',
      scenarios: 'After a session: "Hope you\'re feeling loose today. Drink plenty of water." At 4 weeks: "Your body is probably telling you it\'s time again. Same time next week?" Seasonal: "Holiday stress building up? We just opened extra evening slots."'
    },
    spa: {
      short: 'a rebooking reminder 3-4 weeks after their visit, plus seasonal treatment drops',
      scenarios: 'After a visit: "Hope you\'re still floating on that relaxation. Drink plenty of water today." At 4 weeks: "Time for another reset? We have openings this week." Birthday month: "Treat yourself, 20% off any treatment this month."'
    },
    roofer: {
      short: 'seasonal roof inspection reminders and post-storm check-in messages',
      scenarios: 'After a job: "How\'s everything looking up there? Any issues, we\'re a call away." Before storm season: "Big storms forecast this month. Want a free quick inspection?" Annual: "It\'s been a year since your last roof check. Time for a look?"'
    },
    contractor: {
      short: 'project follow-ups, seasonal maintenance reminders, and referral thank-yous',
      scenarios: 'After a project: "How\'s everything holding up? Let us know if anything needs adjusting." Seasonal: "Spring is the best time for that deck project we talked about." Referral: "Thanks for sending the Johnsons our way. Your next project gets priority scheduling."'
    },
    cleaning: {
      short: 'recurring service reminders, seasonal deep-clean nudges, and satisfaction check-ins',
      scenarios: 'After a clean: "Hope everything is sparkling. Anything we missed, just let us know." Monthly: "Your next cleaning is coming up. Same day and time work?" Seasonal: "Spring deep clean slots are filling up. Want us to book yours?"'
    },
    default: {
      short: 'a thank-you message after their visit, plus periodic check-ins to keep them coming back',
      scenarios: 'After a visit: "Thanks for coming in. How was everything?" At 30 days: "It\'s been a month. We\'d love to see you again." Birthday: automatic birthday greeting with a special offer.'
    }
  };
  // Check longer keys first so "nail salon" matches "nail" not "salon", "barbershop" not "barber", etc.
  const sortedKeys = Object.keys(examples).filter(k => k !== 'default').sort((a, b) => b.length - a.length);
  const key = sortedKeys.find(k => t.includes(k)) || 'default';
  return examples[key];
}

function buildEmailPrompt(lead, previewUrl, type) {
  const hasRating = lead.rating && lead.rating !== 'N/A';
  const reviews = parseInt(lead.reviews) || 0;

  return `You generate cold outreach emails for WebForge, a digital growth agency. You will receive business data and must output a single plain-text email. Nothing else, no explanation, no preamble, just the subject line and email body.

CONTEXT:
- Business name: ${lead.name}
- Business type: ${type}
- Address: ${lead.address}
- Rating: ${hasRating ? lead.rating : 'no rating'}
- Number of reviews: ${reviews}
- Demo site URL: ${previewUrl}
- This business has NO website.

INSTRUCTIONS:
Goal: Get a reply by showing them a demo site you already built for them.

- Subject: 2-5 words maximum. Must reference something specific and real about their business — their review count, rating, or a pain point tied to having no website. Should feel like an observation, not a sales pitch. Do not use "Quick question". Do not use "help". Use lowercase except for business name or proper nouns. Examples: "${reviews} reviews, no website", "your customers can't find you", "${lead.name} deserves a site", "${lead.rating} stars but invisible online". Make the owner feel like you specifically noticed something about their business.
- Paragraph 1: acknowledge their review count and rating in one sentence, make it feel like you actually looked them up, not a template
- Paragraph 2: one sentence on the problem, people search their name and find nothing
- Paragraph 3: tell them you built a demo site for them. Do NOT include the URL in the text — just say you built it. A button will be added automatically below your text. Say it's just a starting point, a quick demo to show what's possible, and it can be fully customized to match their brand. It's theirs to keep, completely free.
- Paragraph 4: make it crystal clear that the website and everything is completely free. The only thing you need in return is 5 minutes on a call to customize it for their business. Emphasize "free" — they are getting a real website at no cost. Something like "The site is yours, completely free. All I'd ask is 5 minutes on a call so I can build it around how your business actually runs." Keep it casual and specific. Do NOT say "I'd love to learn what's working" or "figure out if there's anything worth exploring."
- Paragraph 5: end with one short soft question about the call, not about viewing the site (there's already a button for that). Examples: "Sound fair?", "Worth 5 minutes?", "Interested?". Must be under 8 words. Do NOT say "Want to see it?" or "Worth a quick look?" since the demo button is already there. The goal is just to get a reply about the call.
- Sign off: MUST end with Leif on its own line, then WebForge on the next line. This is required, never skip it.
- Max length: 100 words

CRITICAL FORMATTING RULE: Each paragraph above MUST be separated by a blank line in the output. Do not combine multiple points into one paragraph. The email must have clear visual spacing between each thought. The sign-off (Leif and WebForge) must always be present at the end.

RULES:
- Plain text only, no bullet points, bold, headers, or HTML
- No "I hope this email finds you well" or "I came across your business"
- No corporate words, no leverage, synergy, solutions, or optimize
- Do not mention WebForge in the body, only in the sign-off
- Do not list multiple services, one problem, one solution, one ask
- Write like a real person emailing one specific business, not a mass campaign
- Every sentence must earn its place, cut anything that doesn't add value

Return ONLY valid JSON with no extra text:
{"subject":"...","body":"..."}`;
}

function buildWebsiteOutreachPrompt(lead, type) {
  const hasRating = lead.rating && lead.rating !== 'N/A';
  const reviews = parseInt(lead.reviews) || 0;

  return `You generate cold outreach emails for WebForge, a digital growth agency. You will receive business data and must output a single plain-text email. Nothing else, no explanation, no preamble, just the subject line and email body.

CONTEXT:
- Business name: ${lead.name}
- Business type: ${type}
- Address: ${lead.address}
- Rating: ${hasRating ? lead.rating : 'no rating'}
- Number of reviews: ${reviews}
- Industry: ${type}
- City: ${lead.address}
- This business ALREADY HAS a website.

INSTRUCTIONS:
Goal: Get a reply by identifying a problem they recognize and offering one concrete solution.

- Subject: 2-5 words maximum. Must reference something specific and real about their business — their review count, rating, or a specific pain point tied to their industry. Should feel like an observation, not a sales pitch. Do not use "Quick question". Do not use "help". Use lowercase except for business name or proper nouns. Examples: "${reviews} reviews, no follow-up system", "your patients aren't coming back", "${type}s in the area are losing repeats", "${lead.rating} stars, losing regulars". Make the owner feel like you specifically noticed something about their business.
- Paragraph 1: mention you found them while looking at ${type} businesses in their area and say something specific and positive about their reviews or rating. This should read as one natural opening thought.
- Paragraph 2: state the problem in one clean direct sentence. Something like "Most ${type} customers don't come back simply because they never hear from you after that first visit, that's the biggest reason people drift to competitors." Do not use phrases like "Here's what I'm seeing happen though" or any lead-in that softens the point. Just state it directly.
- Paragraph 3: pitch the ONE solution, automated follow-up texts or emails after each appointment, seasonal reminders, check-ins. Describe it simply and plainly.
- Paragraph 4: make it crystal clear that you will set up the automation for them completely free. The only thing you need in return is 5 minutes on a call to customize it for their business. Emphasize the word "free" — they are getting the follow-up system at no cost. Something like "I'll set this up for you, completely free. All I'd need is 5 minutes on a call so I can tailor it to how your business actually runs." Keep it casual and specific. Do NOT say "I'd love to learn what's working" or "figure out if there's anything worth exploring."
- Paragraph 5: end with one short soft question that feels conversational and low stakes. Examples: "Worth a quick chat?", "Sound fair?", "Interested?". Must be under 8 words. The goal is just to get a reply.
- Sign off: MUST end with Leif on its own line, then WebForge on the next line. This is required, never skip it.
- Max length: 110 words

CRITICAL FORMATTING RULE: Each paragraph above MUST be separated by a blank line in the output. Do not combine multiple points into one paragraph. The email must have clear visual spacing between each thought. The sign-off (Leif and WebForge) must always be present at the end.

RULES:
- Plain text only, no bullet points, bold, headers, or HTML
- No "I hope this email finds you well" or "I came across your business"
- No corporate words, no leverage, synergy, solutions, or optimize
- Do not mention WebForge in the body, only in the sign-off
- Do not list multiple services, one problem, one solution, one ask
- Write like a real person emailing one specific business, not a mass campaign
- Every sentence must earn its place, cut anything that doesn't add value
- Do not start with "Hi there" or any generic greeting. Either use the owner's name if available, or skip the greeting entirely and start directly with the first observation about their business.
- Do not use the phrases "lifting a finger", "runs while you sleep", "set it and forget it", or any other cliché. Describe the solution simply and plainly.
- Do not use the phrase "found your company" in the opening line. Instead go straight to the observation about their rating and reviews. For example: "I was researching pool cleaners in Birmingham and your 4.3 rating with 18 reviews caught my attention." Do not add filler phrases like "found your company" or "came across your listing" between the research line and the rating observation.
- When ending the CTA question with "for a [business type]", always use the owner-facing version of the business type, not the worker-facing version. For example: "for a pool cleaning company" not "for a pool cleaner", "for a plumbing company" not "for a plumber", "for a painting company" not "for a painter", "for a cleaning company" not "for a cleaner", "for a landscaping company" not "for a landscaper". The email is addressed to the business owner, so the phrasing should reflect that they run a company, not that they are the laborer.
- When referencing the business type in the opening line, never use the word "businesses" after the industry type. Instead use the natural word for that industry — for example "chiropractor practices" not "chiropractor businesses", "dental offices" not "dental businesses", "landscaping companies" not "landscaping businesses", "restaurants" not "restaurant businesses". If unsure of the natural word, just use the plural of the business type alone — "chiropractors in the area" not "chiropractor businesses in the area."

Return ONLY valid JSON with no extra text:
{"subject":"...","body":"..."}`;
}

async function callAnthropicWithTimeout(client, params, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const msg = await client.messages.create(params, { signal: controller.signal });
    return msg;
  } catch(e) {
    if (e.name === 'AbortError' || e.message?.includes('abort')) {
      throw new Error('Anthropic API timed out after ' + Math.round(timeoutMs/1000) + 's. Try again.');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function sendWithRetry(resend, emailOpts, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { data, error } = await resend.emails.send(emailOpts);
    if (!error) return data;
    // Retry on rate limit (429) with exponential backoff
    if (error.statusCode === 429 && attempt < maxRetries) {
      const wait = (attempt + 1) * 3000;
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    throw new Error(`Resend API error: ${error.message || JSON.stringify(error)}`);
  }
}

function getSmtpTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT) || 587,
    secure: (parseInt(SMTP_PORT) || 587) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

async function sendViaSmtp(emailOpts) {
  const transport = getSmtpTransport();
  if (!transport) throw new Error('SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env');
  const result = await transport.sendMail({
    from: emailOpts.from,
    to: emailOpts.to,
    subject: emailOpts.subject,
    text: emailOpts.text,
    html: emailOpts.html
  });
  return { id: result.messageId, method: 'smtp' };
}

async function generateFreeSamples(lead) {
  const client = getClient();
  const type = (lead.type || 'business').replace(/_/g, ' ');
  const rating = lead.rating !== 'N/A' ? lead.rating + '/5' : '';
  const reviews = lead.reviews && lead.reviews !== 'N/A' ? lead.reviews + ' reviews' : '';

  const msg = await callAnthropicWithTimeout(client, {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{ role: 'user', content:
`Generate 3 polished, professional AI samples for "${lead.name}", a ${type} at ${lead.address}. ${rating ? 'Rating: ' + rating : ''} ${reviews}.

IMPORTANT: NEVER use em dashes (—) anywhere. Use commas or periods instead. Exclamation marks are fine where they feel natural.

NICHE-SPECIFIC FOLLOW-UP CONTEXT for this ${type}:
${getFollowUpExamples(type).scenarios}

Return ONLY valid JSON:
{
  "instagram_post": "Polished ready-to-post Instagram caption. 3-4 sentences, professional and engaging, speaks to their ideal customer, ends with CTA and 5-7 relevant hashtags. Specific to their business type and location.",
  "review_response": "Warm professional response to a 5-star Google review. Thank [Customer Name], reference their experience warmly, invite them back. Personal and genuine, not templated. 2-3 sentences.",
  "followup_message": "A real example of an automated follow-up message specific to a ${type}. Use the niche context above for inspiration. Make it feel like a real text from the business, not a template. Professional but warm. Under 60 words."
}`
    }]
  });

  const result = parseJSON(msg.content[0].text);
  if (!result) throw new Error('Failed to generate samples. Claude returned invalid JSON.');
  return cleanCopy(result);
}

async function generateEmailCopy(lead, previewUrl, outreachType) {
  const client = getClient();
  const type = (lead.type || 'business').replace(/_/g, ' ');
  const prompt = outreachType === 'has_website'
    ? buildWebsiteOutreachPrompt(lead, type)
    : buildEmailPrompt(lead, previewUrl, type);
  const msg = await callAnthropicWithTimeout(client, {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }]
  });
  const result = parseJSON(msg.content[0].text);
  if (!result?.subject || !result?.body) throw new Error('Failed to generate email copy. Claude returned invalid or incomplete JSON. Try again.');
  return cleanCopy(result);
}

async function generateEmailPreview(lead, previewUrl, outreachType) {
  return generateEmailCopy(lead, previewUrl, outreachType);
}

async function sendOutreach(lead, previewUrl, emailAddress, onProgress, subjectOverride, bodyOverride, trackingOpts, outreachType) {
  const isHasWebsite = outreachType === 'has_website';
  const samples = null;

  const copy = (subjectOverride && bodyOverride)
    ? { subject: subjectOverride, body: bodyOverride }
    : await generateEmailCopy(lead, previewUrl, outreachType);

  const { RESEND_API_KEY, RESEND_FROM, SMTP_HOST, SMTP_USER } = process.env;
  const counter = loadCounter();
  const useSmtp = counter.resend >= RESEND_DAILY_LIMIT;

  if (!useSmtp) {
    if (!RESEND_API_KEY) throw new Error('Resend API key not configured. Go to Settings.');
    if (!RESEND_FROM) throw new Error('Resend From email not configured. Go to Settings.');
  } else {
    if (!SMTP_HOST || !SMTP_USER) throw new Error('Resend daily limit reached (100) and SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env');
  }

  const fromEmail = RESEND_FROM || SMTP_USER;
  onProgress({ status: 'sending', message: `Sending to ${emailAddress}${useSmtp ? ' (via SMTP)' : ''}...` });

  // Replace preview URL in body with click-tracked URL and format email
  let bodyText = copy.body;
  const lines = bodyText.split('\n').filter(l => l.trim());
  let bodyHtml = '';

  for (const l of lines) {
    let line = l;
    if (trackingOpts?.clickUrl && previewUrl) {
      const escaped = previewUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      line = line.replace(new RegExp(escaped, 'g'), trackingOpts.clickUrl);
    }

    // URL-only line — render as a button only (only for no-website outreach)
    const trimmedLine = line.trim();
    if (!isHasWebsite && trimmedLine.match(/^https?:\/\/\S+$/) && previewUrl && trimmedLine.includes(previewUrl.split('/')[2])) {
      const href = trackingOpts?.clickUrl || line;
      bodyHtml += `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 24px">
        <tr><td>
          <a href="${href}" style="display:inline-block;padding:14px 28px;background:#111;color:#fff;font-size:14px;font-weight:600;text-decoration:none;border-radius:6px;letter-spacing:.02em">View Your Demo Website &rarr;</a>
        </td></tr>
      </table>`;
      continue;
    }

    // Sign-off: "Leif" or "WebForge" alone
    if (/^(Leif|WebForge)$/i.test(line.trim())) {
      const isName = /^Leif$/i.test(line.trim());
      bodyHtml += `<p style="margin:${isName ? '28px' : '0'} 0 ${isName ? '2px' : '0'};font-size:${isName ? '15px' : '12px'};font-weight:${isName ? '600' : '500'};color:${isName ? '#111' : '#888'};line-height:1.4;${isName ? '' : 'letter-spacing:.04em'}">${line.trim()}</p>`;
      continue;
    }

    // "All I need" / the ask — slightly emphasized
    if (/all i need|5-10 minutes|5 minutes|hop on a quick call|quick call/i.test(line)) {
      bodyHtml += `<p style="margin:24px 0 18px;font-size:15px;line-height:1.75;color:#111;font-weight:500">${line}</p>`;
      continue;
    }

    // Default paragraph
    bodyHtml += `<p style="margin:0 0 18px;font-size:15px;line-height:1.75;color:#333">${line}</p>`;
  }

  // For no-website outreach, always inject a demo site button if one wasn't already rendered
  if (!isHasWebsite && previewUrl && !bodyHtml.includes('View Your Demo Website')) {
    const href = trackingOpts?.clickUrl || previewUrl;
    bodyHtml += `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 24px">
      <tr><td>
        <a href="${href}" style="display:inline-block;padding:14px 28px;background:#111;color:#fff;font-size:14px;font-weight:600;text-decoration:none;border-radius:6px;letter-spacing:.02em">View Your Demo Website &rarr;</a>
      </td></tr>
    </table>`;
  }

  // Tracking pixel HTML
  const pixelHtml = trackingOpts?.pixelHtml || '';

  const emailPayload = {
    from: `Leif | WebForge <${fromEmail}>`,
    to: emailAddress,
    subject: copy.subject,
    text: copy.body,
    html: `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff">
      <tr><td align="left" style="padding:24px 32px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:560px">
          <!-- BODY -->
          <tr><td style="background:#ffffff;padding:0">
            ${bodyHtml}
          </td></tr>
        </table>
        ${pixelHtml}
      </td></tr>
    </table>`
  };

  let data;
  let sendMethod;
  if (useSmtp) {
    data = await sendViaSmtp(emailPayload);
    sendMethod = 'smtp';
  } else {
    const { Resend } = require('resend');
    const resend = new Resend(RESEND_API_KEY);
    data = await sendWithRetry(resend, emailPayload);
    sendMethod = 'resend';
  }
  incrementCounter(sendMethod);

  const stats = getSendStats();
  const methodLabel = sendMethod === 'smtp' ? 'SMTP' : 'Resend';
  onProgress({ status: 'sent', message: `Sent to ${emailAddress} via ${methodLabel} (${stats.total} today, ${stats.resendRemaining} Resend left)` });
  return { subject: copy.subject, body: copy.body, samples, sentTo: emailAddress, sentAt: new Date().toISOString(), resendId: data?.id, sendMethod, outreachType: outreachType || 'no_website' };
}

// ── FOLLOW-UP EMAIL GENERATION ────────────────────────────────────────────
async function generateFollowUpEmail(lead, step, previousSubject) {
  const client = getClient();
  const type = (lead.type || 'business').replace(/_/g, ' ');
  const angles = [
    `Resurface the gap. Remind them what their customers experience when they search for "${lead.name}" and find nothing. Add one new detail or angle they haven't considered. Do NOT reference the previous email directly.`,
    `Share one specific, useful insight about how customers find ${type}s in their area. A stat, a trend, a behavior pattern. Make the gap feel more real and more urgent. Position it as something you noticed, not a sales pitch.`,
    `Last email. Be direct and honest. This is it. Frame it as: "I'll leave this with you." Restate the core loss one more time. Make choosing to ignore it feel like a conscious decision to leave money on the table. End with "Should I close this out?" or "Should I take this down?" (referring to the demo site).`
  ];
  const angle = angles[Math.min(step-1, angles.length-1)];

  const msg = await callAnthropicWithTimeout(client, {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{ role: 'user', content:
`Write follow-up email #${step} from Leif (WebForge) to the owner of "${lead.name}", a ${type}.
${lead.rating !== 'N/A' ? 'Google rating: ' + lead.rating + '/5 with ' + lead.reviews + ' reviews.' : ''}
Previous subject line: "${previousSubject}"

Angle: ${angle}

Rules:
- Under 60 words. Shorter than the original email. This is a bump, not a pitch.
- Start with "You" or "Your", never "I" or a greeting
- Conversational, confident, human
- NEVER use em dashes (—) anywhere. Use commas or periods instead.
- No semicolons. Exclamation marks are OK where they feel natural and add warmth or energy, but never more than 2 in the whole email.
- No corporate language, no buzzwords
- BANNED: "just checking in", "following up", "wanted to reach out", "circling back", "touching base", "bumping this"
- Subject line: 5-8 words, creates curiosity or tension, specific to their business
- Sign off: Leif on one line, WebForge on the next
- The CTA must be interest-based. "Reply interested" or "Should I close this out?" Not "book a call."

Return ONLY valid JSON: {"subject":"...","body":"..."}`
    }]
  });

  const result = parseJSON(msg.content[0].text);
  if (!result?.subject || !result?.body) throw new Error('Failed to generate follow-up.');
  return cleanCopy(result);
}

module.exports = { sendOutreach, generateEmailPreview, generateFreeSamples, generateFollowUpEmail, getSendStats };
