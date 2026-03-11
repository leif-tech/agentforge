const Anthropic = require('@anthropic-ai/sdk');

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

- Subject: reference their business name and make it feel personal
- Line 1: acknowledge their review count and rating in one sentence, make it feel like you actually looked them up, not a template
- Line 2: one sentence on the problem, people search their name and find nothing
- Line 3: tell them you built a demo site, include ${previewUrl} as plain text
- Line 4: say it's theirs to keep, no strings
- CTA: soft, "just reply if you want to talk", do NOT ask for a call
- Sign off: Leif, WebForge
- Max length: 80 words

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

- Subject: "Quick question about ${lead.name}" or a curiosity-driven line about their specific situation
- Line 1: mention you found them while looking at ${type} businesses in their area, sounds like genuine research
- Line 2: say something specific and positive about their reviews or rating
- Line 3: name the ONE problem, customers don't return because there's no follow-up after the first visit
- Line 4: pitch the ONE solution, automated follow-up texts/emails after each job, seasonal reminders, runs itself
- CTA: soft yes/no question, "Would it be useful if I showed you what this looks like for a ${type}?"
- Sign off: Leif, WebForge
- Max length: 100 words

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

  const { RESEND_API_KEY, RESEND_FROM } = process.env;
  if (!RESEND_API_KEY) throw new Error('Resend API key not configured. Go to Settings.');
  if (!RESEND_FROM) throw new Error('Resend From email not configured. Go to Settings.');

  const { Resend } = require('resend');
  const resend = new Resend(RESEND_API_KEY);

  onProgress({ status: 'sending', message: `Sending to ${emailAddress}...` });

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

    // URL-only line — render as a styled button/link (only for no-website outreach)
    const trimmedLine = line.trim();
    if (!isHasWebsite && trimmedLine.match(/^https?:\/\/\S+$/) && previewUrl && trimmedLine.includes(previewUrl.split('/')[2])) {
      const href = trackingOpts?.clickUrl || line;
      bodyHtml += `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px">
        <tr><td>
          <a href="${href}" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;font-size:13px;font-weight:600;text-decoration:none;border-radius:6px;letter-spacing:.02em">View Your Demo Website &rarr;</a>
        </td></tr>
        <tr><td style="padding:6px 0 0">
          <a href="${href}" style="font-size:11px;color:#888;text-decoration:none;word-break:break-all">${line}</a>
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

    // "We also offer" or transition lines — subtle label style
    if (/we also offer|and many more/i.test(line)) {
      bodyHtml += `<p style="margin:24px 0 12px;font-size:12px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.06em">${line}</p>`;
      continue;
    }

    // "This demo is yours" / free website line — highlight (only for no-website outreach)
    if (!isHasWebsite && /demo.*yours|for free|no cost|your real site/i.test(line)) {
      bodyHtml += `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px">
        <tr><td style="padding:14px 18px;background:#f0fdf4;border-left:3px solid #22c55e;border-radius:0 6px 6px 0">
          <p style="margin:0;font-size:14px;line-height:1.7;color:#166534">${line}</p>
        </td></tr>
      </table>`;
      continue;
    }

    // "All I need" / the ask — slightly emphasized
    if (/all i need|5-10 minutes|hop on a quick call/i.test(line)) {
      bodyHtml += `<p style="margin:24px 0 18px;font-size:15px;line-height:1.75;color:#111;font-weight:500">${line}</p>`;
      continue;
    }

    // Default paragraph
    bodyHtml += `<p style="margin:0 0 18px;font-size:15px;line-height:1.75;color:#333">${line}</p>`;
  }

  // Tracking pixel HTML
  const pixelHtml = trackingOpts?.pixelHtml || '';

  const data = await sendWithRetry(resend, {
    from: `Leif | WebForge <${RESEND_FROM}>`,
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
  });

  onProgress({ status: 'sent', message: `Sent to ${emailAddress}` });
  return { subject: copy.subject, body: copy.body, samples, sentTo: emailAddress, sentAt: new Date().toISOString(), resendId: data?.id, outreachType: outreachType || 'no_website' };
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

module.exports = { sendOutreach, generateEmailPreview, generateFreeSamples, generateFollowUpEmail };
