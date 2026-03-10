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
  onProgress({ status: 'generating', message: `Generating samples for ${lead.name}...` });

  let samples;
  try {
    samples = await generateFreeSamples(lead);
    onProgress({ status: 'generating', message: `Samples ready. Writing email...` });
  } catch(e) {
    onProgress({ status: 'warn', message: `⚠ Sample generation failed (${e.message}). Email will send without deliverables.` });
    samples = null;
  }

  const copy = (subjectOverride && bodyOverride)
    ? { subject: subjectOverride, body: bodyOverride }
    : await generateEmailCopy(lead, previewUrl, outreachType);

  const { RESEND_API_KEY, RESEND_FROM } = process.env;
  if (!RESEND_API_KEY) throw new Error('Resend API key not configured. Go to Settings.');
  if (!RESEND_FROM) throw new Error('Resend From email not configured. Go to Settings.');

  const { Resend } = require('resend');
  const resend = new Resend(RESEND_API_KEY);

  onProgress({ status: 'sending', message: `Sending to ${emailAddress}...` });

  // Determine URLs for links — use click tracking if available
  const linkUrl = trackingOpts?.clickUrl || previewUrl;
  const type = (lead.type || 'business').replace(/_/g, ' ');
  const followUpEx = getFollowUpExamples(type);

  let samplesHtml = '';
  if (samples) {
    const sectionTitle = isHasWebsite ? 'What We Can Do For Your Business' : 'Your Free Website + What We Can Do';
    const sectionSubtitle = isHasWebsite
      ? 'Here\'s a preview of the kind of work we do for businesses like yours.'
      : 'The demo website below is yours, completely free. Here\'s a preview of the kind of work we do for businesses like yours.';

    // Item numbering: has_website starts at 1 (no demo site card), no_website starts at 2 (demo site is 1)
    const n1 = isHasWebsite ? 1 : 2;
    const n2 = isHasWebsite ? 2 : 3;
    const n3 = isHasWebsite ? 3 : 4;
    const n4 = isHasWebsite ? 4 : 5;

    const demoSiteCard = isHasWebsite ? '' : `
        <tr><td style="padding:20px 0 0" colspan="2">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f7f8;border:1px solid #e5e5e7;border-radius:8px">
            <tr>
              <td style="padding:16px 20px 14px">
                <table cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="background:#111;color:#fff;font-size:10px;font-weight:700;width:22px;height:22px;text-align:center;border-radius:50%;vertical-align:middle;line-height:22px">1</td>
                  <td style="padding-left:10px;font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.06em">Your Free Demo Website</td>
                </tr></table>
              </td>
            </tr>
            <tr><td style="padding:0 20px 16px">
              <a href="${linkUrl}" style="font-size:13px;color:#4f46e5;text-decoration:none;word-break:break-all">${previewUrl}</a>
              <p style="font-size:11px;color:#888;margin:6px 0 0">This is yours to keep, no strings attached.</p>
            </td></tr>
          </table>
        </td></tr>`;

    const auditContent = isHasWebsite
      ? `<strong style="color:#111">Website:</strong> You have a site, that's a solid foundation. The question is what's working behind it.<br><br>
              <strong style="color:#111">Google Reviews:</strong> ${lead.rating !== 'N/A' ? lead.rating + '/5 with ' + lead.reviews + ' reviews. Are you responding to all of them? Each one is a chance to build loyalty.' : 'Building a review presence can dramatically improve trust and local search ranking.'}<br><br>
              <strong style="color:#111">Social Media:</strong> Consistent professional content can significantly increase your organic reach and attract new customers.<br><br>
              <strong style="color:#111">Follow-Up System:</strong> Most local businesses lose repeat customers simply by not following up. An automated message system solves this with zero extra effort.`
      : `<strong style="color:#111">Website:</strong> No website found - your demo shows what is possible within 24 hours.<br><br>
              <strong style="color:#111">Google Reviews:</strong> ${lead.rating !== 'N/A' ? lead.rating + '/5 with ' + lead.reviews + ' reviews - strong social proof that deserves a proper web presence.' : 'Opportunity to build and showcase your reputation online.'}<br><br>
              <strong style="color:#111">Social Media:</strong> Consistent professional content can significantly increase your organic reach and attract new customers.<br><br>
              <strong style="color:#111">Follow-Up System:</strong> Most local businesses lose repeat customers simply by not following up. An automated message system solves this with zero extra effort.`;

    samplesHtml = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px">
        <tr><td style="height:1px;background:#e2e2e2;font-size:0;line-height:0" colspan="2">&nbsp;</td></tr>
        <tr><td style="padding:28px 0 6px" colspan="2">
          <p style="font-size:15px;font-weight:700;color:#111;margin:0;letter-spacing:-.02em">${sectionTitle}</p>
          <p style="font-size:12px;color:#888;margin:4px 0 0">${sectionSubtitle}</p>
        </td></tr>

        ${demoSiteCard}

        <tr><td style="padding:20px 0 4px" colspan="2">
          <p style="font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.1em;margin:0">Sample work we do for businesses like yours</p>
        </td></tr>

        <tr><td style="padding:8px 0 0" colspan="2">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f7f8;border:1px solid #e5e5e7;border-radius:8px">
            <tr>
              <td style="padding:16px 20px 14px">
                <table cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="background:#111;color:#fff;font-size:10px;font-weight:700;width:22px;height:22px;text-align:center;border-radius:50%;vertical-align:middle;line-height:22px">${n1}</td>
                  <td style="padding-left:10px;font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.06em">Instagram Caption</td>
                </tr></table>
              </td>
            </tr>
            <tr><td style="padding:0 20px 16px;font-size:13px;color:#333;line-height:1.7">${samples.instagram_post || ''}</td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:12px 0 0" colspan="2">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f7f8;border:1px solid #e5e5e7;border-radius:8px">
            <tr>
              <td style="padding:16px 20px 14px">
                <table cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="background:#111;color:#fff;font-size:10px;font-weight:700;width:22px;height:22px;text-align:center;border-radius:50%;vertical-align:middle;line-height:22px">${n2}</td>
                  <td style="padding-left:10px;font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.06em">Google Review Response</td>
                </tr></table>
              </td>
            </tr>
            <tr><td style="padding:0 20px 16px;font-size:13px;color:#333;line-height:1.7">${samples.review_response || ''}</td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:12px 0 0" colspan="2">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f7f8;border:1px solid #e5e5e7;border-radius:8px">
            <tr>
              <td style="padding:16px 20px 14px">
                <table cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="background:#111;color:#fff;font-size:10px;font-weight:700;width:22px;height:22px;text-align:center;border-radius:50%;vertical-align:middle;line-height:22px">${n3}</td>
                  <td style="padding-left:10px;font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.06em">Customer Follow-Up via Text, Email, Facebook & Instagram</td>
                </tr></table>
              </td>
            </tr>
            <tr><td style="padding:0 20px 4px;font-size:13px;color:#333;line-height:1.7">${samples.followup_message || ''}</td></tr>
            <tr><td style="padding:4px 20px 16px">
              <p style="font-size:11px;color:#888;margin:0 0 6px;font-weight:600">How this works for a ${type}:</p>
              <p style="font-size:11px;color:#666;margin:0;line-height:1.7;font-style:italic">${followUpEx.scenarios}</p>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:12px 0 0" colspan="2">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f7f8;border:1px solid #e5e5e7;border-radius:8px">
            <tr>
              <td style="padding:16px 20px 14px">
                <table cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="background:#111;color:#fff;font-size:10px;font-weight:700;width:22px;height:22px;text-align:center;border-radius:50%;vertical-align:middle;line-height:22px">${n4}</td>
                  <td style="padding-left:10px;font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.06em">Online Presence Audit</td>
                </tr></table>
              </td>
            </tr>
            <tr><td style="padding:0 20px 16px;font-size:13px;color:#333;line-height:1.7">
              ${auditContent}
            </td></tr>
          </table>
        </td></tr>
      </table>
    `;
  }

  // Replace preview URL in body with click-tracked URL and format email
  let bodyText = copy.body;
  const lines = bodyText.split('\n').filter(l => l.trim());
  let bodyHtml = '';
  let inList = false;
  let listItems = [];

  function flushList() {
    if (!listItems.length) return '';
    let html = '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px">';
    listItems.forEach(item => {
      const match = item.match(/^(\d+)\.\s*(.*)/);
      const num = match ? match[1] : '';
      const text = match ? match[2] : item;
      html += `<tr>
        <td style="width:28px;vertical-align:top;padding:6px 0">
          <div style="width:22px;height:22px;background:#111;color:#fff;font-size:10px;font-weight:700;text-align:center;border-radius:50%;line-height:22px">${num}</div>
        </td>
        <td style="padding:5px 0 5px 10px;font-size:14px;line-height:1.6;color:#333">${text}</td>
      </tr>`;
    });
    html += '</table>';
    listItems = [];
    inList = false;
    return html;
  }

  for (const l of lines) {
    let line = l;
    if (trackingOpts?.clickUrl && previewUrl) {
      const escaped = previewUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      line = line.replace(new RegExp(escaped, 'g'), trackingOpts.clickUrl);
    }

    // Numbered list item
    if (/^\d+\.\s/.test(line)) {
      inList = true;
      listItems.push(line);
      continue;
    }

    // Flush pending list before next paragraph
    if (inList) bodyHtml += flushList();

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

  // Flush any remaining list
  if (inList) bodyHtml += flushList();

  // Tracking pixel HTML
  const pixelHtml = trackingOpts?.pixelHtml || '';

  const data = await sendWithRetry(resend, {
    from: `Leif | WebForge <${RESEND_FROM}>`,
    to: emailAddress,
    subject: copy.subject,
    text: copy.body,
    html: `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5">
      <tr><td align="center" style="padding:32px 16px">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:600px">
          <!-- HEADER -->
          <tr><td style="background:#0a0a14;padding:20px 32px;border-radius:10px 10px 0 0">
            <table cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:.02em;line-height:1;vertical-align:middle">WEB<span style="color:#00e5ff">FORGE</span></td>
              <td style="padding-left:12px;font-size:11px;font-weight:600;color:#666;letter-spacing:.08em;vertical-align:middle;line-height:1">DIGITAL GROWTH</td>
            </tr></table>
          </td></tr>
          <!-- BODY -->
          <tr><td style="background:#ffffff;padding:40px 32px 36px;border-left:1px solid #e5e5e7;border-right:1px solid #e5e5e7">
            ${bodyHtml}
            ${samplesHtml}
          </td></tr>
          <!-- FOOTER -->
          <tr><td style="background:#fafafa;padding:16px 32px;border:1px solid #e5e5e7;border-top:none;border-radius:0 0 10px 10px">
            <p style="font-size:11px;color:#aaa;margin:0;line-height:1.5">WebForge &middot; Digital growth for local businesses. Reply "unsubscribe" to opt out.</p>
          </td></tr>
        </table>
        ${pixelHtml}
      </td></tr>
    </table>`
  });

  const deliverableCount = isHasWebsite ? 4 : 5;
  onProgress({ status: 'sent', message: `Sent to ${emailAddress} with ${deliverableCount} deliverables` });
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
