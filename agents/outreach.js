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
    }
  }
  return obj;
}

function buildEmailPrompt(lead, previewUrl, type) {
  return `Write a cold outreach email from Leif to the owner of "${lead.name}", a ${type} at ${lead.address}.
Google rating: ${lead.rating !== 'N/A' ? lead.rating + '/5 with ' + lead.reviews + ' reviews' : 'not yet rated'}.

Leif is the founder of WebForge. He runs the company. He personally found this business, built them something real, and is reaching out as the person behind it — not a company blasting mass emails, not an employee.

What Leif already built for them (for free):
- A fully custom demo website, live right now at: ${previewUrl}

What Leif is handing over completely free:
1. The live demo website (already built): ${previewUrl} — and Leif will make it their real, live website for free too. The demo is just the starting point, but they get to keep a fully finished site at no cost.
2. A ready-to-post Instagram caption written for their business
3. A professional Google review response template
4. A customer follow-up message for after visits
5. A full online presence audit — website, socials, reviews, local visibility
All of this is theirs to keep. All Leif is asking for in return is a quick 5-10 minute call, that is it.

What WebForge does with AI (beyond this free offer):
- Custom websites built and maintained with AI
- Automated social media content and scheduling across all platforms
- AI-powered Google review management and reputation building
- Automated customer follow-up and retention systems
- Local SEO and Google Business Profile optimization
- AI chatbots for websites to capture and convert leads 24/7
- Targeted ad campaign management
- Full business automation — letting owners focus on running the business
The point is to make them feel like there is a serious, capable team behind this — not just a freelancer. But do not pitch everything. Just give them a real sense of scale.

Email structure:
1. Opening — something genuinely specific about this business. Their rating, reviews, or something real about them. Make it feel like Leif actually looked them up. Warm, human, not corporate.
2. Leif introduces himself as the founder of WebForge — not "I work with WebForge" or "I'm part of WebForge". He started it. Use natural phrasing like "I'm Leif — I started WebForge" or "I run WebForge". Then one sentence on what WebForge does with AI for local businesses. Personal, not a company pitch.
3. Tell them about the demo site — include the actual URL ${previewUrl} so they can click it. Be clear: this is just a demo to show what is possible. The real site they get will be fully built around what they actually want — their style, colors, feel, everything. It can look completely different. The demo is just a taste.
4. List the 5 free things clearly so the value feels undeniable. Make it very clear that the website is theirs, Leif will make it live for them for free. After listing the 5 items, reinforce that all they need to do is hop on a quick 5-10 minute call, that is it.
5. The exchange — honest and direct: everything is free including making their website live. All Leif asks in return is a quick 5-10 minute call just to hear what they are currently struggling with in their business. That is it. Or if they prefer, they can just reply to this email and share what challenges they are facing. Either way works. Make this feel effortless.
6. One line about everything else WebForge can handle with AI if they want to scale — make it feel like there is a lot more available.
7. Sign off as Leif, WebForge — personal, confident, not corporate.

The goal of this email is to make saying NO feel stupid. The offer must be so obviously one-sided in their favor that ignoring it would feel like leaving real money and real value on the table for no reason. The ask is tiny, just 5-10 minutes or even just a reply email, and the value being handed over is massive and already done. That contrast must land hard.

Rules:
- Sound like a real founder who genuinely did the work before asking for anything
- Leif must introduce himself as the person who runs/founded WebForge — never as someone who works there
- The tone is confident and generous — not desperate, not salesy, not begging
- Make the value feel undeniable — a real website is already live, real deliverables are ready, and it costs them nothing
- The ask (5-10 minute call or just replying to the email) must feel laughably small compared to what they are getting
- The reader should finish the email thinking "why would I say no to this"
- Create a subtle sense that this offer will not sit around forever — Leif is busy, this is a specific offer for them
- The demo URL must be visible and clickable in the body
- Make it clear the demo is just the starting point — the real site will be built exactly around what they want
- Short paragraphs, punchy, easy to read on a phone
- Under 220 words for the main body
- No pricing anywhere
- No corporate language or buzzwords
- Subject line: short (under 9 words), sounds like a real person texting not a marketer emailing, creates a "wait, what?" reaction — ideally references something they built or did for this specific business. Examples of the right tone: "I built something for you", "took a look at your place", "made this for [Business Name]", "had an idea about [Business Name]". Never use exclamation marks, never sound like a newsletter, never use words like "partnership", "opportunity", "grow", or "free"
- Sign off: Leif, WebForge
- NEVER use em dashes (—) anywhere in the subject or body. Use commas instead where an em dash would go. This is critical.

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

async function generateEmailCopy(lead, previewUrl) {
  const client = getClient();
  const type = (lead.type || 'business').replace(/_/g, ' ');
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    messages: [{ role: 'user', content: buildEmailPrompt(lead, previewUrl, type) }]
  });
  const result = parseJSON(msg.content[0].text);
  if (!result?.subject || !result?.body) throw new Error('Failed to generate email. Try again.');
  return cleanCopy(result);
}

async function generateEmailPreview(lead, previewUrl) {
  return generateEmailCopy(lead, previewUrl);
}

async function sendOutreach(lead, previewUrl, emailAddress, onProgress, subjectOverride, bodyOverride, trackingOpts) {
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
    ? { subject: subjectOverride, body: bodyOverride }
    : await generateEmailCopy(lead, previewUrl);

  const { RESEND_API_KEY, RESEND_FROM } = process.env;
  if (!RESEND_API_KEY) throw new Error('Resend API key not configured. Go to Settings.');
  if (!RESEND_FROM) throw new Error('Resend From email not configured. Go to Settings.');

  const { Resend } = require('resend');
  const resend = new Resend(RESEND_API_KEY);

  onProgress({ status: 'sending', message: `Sending to ${emailAddress}...` });

  // Determine URLs for links — use click tracking if available
  const linkUrl = trackingOpts?.clickUrl || previewUrl;

  let samplesHtml = '';
  if (samples) {
    samplesHtml = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px">
        <tr><td style="height:1px;background:#e2e2e2;font-size:0;line-height:0" colspan="2">&nbsp;</td></tr>
        <tr><td style="padding:28px 0 6px" colspan="2">
          <p style="font-size:15px;font-weight:700;color:#111;margin:0;letter-spacing:-.02em">Your 5 Free Deliverables</p>
          <p style="font-size:12px;color:#888;margin:4px 0 0">Ready to use, no editing needed.</p>
        </td></tr>

        <tr><td style="padding:20px 0 0" colspan="2">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f7f8;border:1px solid #e5e5e7;border-radius:8px">
            <tr>
              <td style="padding:16px 20px 14px">
                <table cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="background:#111;color:#fff;font-size:10px;font-weight:700;width:22px;height:22px;text-align:center;border-radius:50%;vertical-align:middle;line-height:22px">1</td>
                  <td style="padding-left:10px;font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.06em">Custom Demo Website</td>
                </tr></table>
              </td>
            </tr>
            <tr><td style="padding:0 20px 16px">
              <a href="${linkUrl}" style="font-size:13px;color:#4f46e5;text-decoration:none;word-break:break-all">${previewUrl}</a>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:12px 0 0" colspan="2">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f7f8;border:1px solid #e5e5e7;border-radius:8px">
            <tr>
              <td style="padding:16px 20px 14px">
                <table cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="background:#111;color:#fff;font-size:10px;font-weight:700;width:22px;height:22px;text-align:center;border-radius:50%;vertical-align:middle;line-height:22px">2</td>
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
                  <td style="background:#111;color:#fff;font-size:10px;font-weight:700;width:22px;height:22px;text-align:center;border-radius:50%;vertical-align:middle;line-height:22px">3</td>
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
                  <td style="background:#111;color:#fff;font-size:10px;font-weight:700;width:22px;height:22px;text-align:center;border-radius:50%;vertical-align:middle;line-height:22px">4</td>
                  <td style="padding-left:10px;font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.06em">Customer Follow-Up Message</td>
                </tr></table>
              </td>
            </tr>
            <tr><td style="padding:0 20px 16px;font-size:13px;color:#333;line-height:1.7">${samples.followup_message || ''}</td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:12px 0 0" colspan="2">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f7f8;border:1px solid #e5e5e7;border-radius:8px">
            <tr>
              <td style="padding:16px 20px 14px">
                <table cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="background:#111;color:#fff;font-size:10px;font-weight:700;width:22px;height:22px;text-align:center;border-radius:50%;vertical-align:middle;line-height:22px">5</td>
                  <td style="padding-left:10px;font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.06em">Online Presence Audit</td>
                </tr></table>
              </td>
            </tr>
            <tr><td style="padding:0 20px 16px;font-size:13px;color:#333;line-height:1.7">
              <strong style="color:#111">Website:</strong> No website found - your demo shows what is possible within 24 hours.<br><br>
              <strong style="color:#111">Google Reviews:</strong> ${lead.rating !== 'N/A' ? lead.rating + '/5 with ' + lead.reviews + ' reviews - strong social proof that deserves a proper web presence.' : 'Opportunity to build and showcase your reputation online.'}<br><br>
              <strong style="color:#111">Social Media:</strong> Consistent professional content can significantly increase your organic reach and attract new customers.<br><br>
              <strong style="color:#111">Follow-Up System:</strong> Most local businesses lose repeat customers simply by not following up. An automated message system solves this with zero extra effort.
            </td></tr>
          </table>
        </td></tr>
      </table>
    `;
  }

  // Replace preview URL in body with click-tracked URL
  let bodyText = copy.body;
  let bodyHtml = bodyText.split('\n').filter(l => l.trim()).map(l => {
    let line = l;
    if (trackingOpts?.clickUrl && previewUrl) {
      const escaped = previewUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      line = line.replace(new RegExp(escaped, 'g'), trackingOpts.clickUrl);
    }
    return `<p style="margin:0 0 18px;font-size:15px;line-height:1.75;color:#222">${line}</p>`;
  }).join('');

  // Tracking pixel HTML
  const pixelHtml = trackingOpts?.pixelHtml || '';

  await resend.emails.send({
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

  onProgress({ status: 'sent', message: `Sent to ${emailAddress} with 5 free deliverables` });
  return { subject: copy.subject, body: copy.body, samples, sentTo: emailAddress, sentAt: new Date().toISOString() };
}

// ── FOLLOW-UP EMAIL GENERATION ────────────────────────────────────────────
async function generateFollowUpEmail(lead, step, previousSubject) {
  const client = getClient();
  const type = (lead.type || 'business').replace(/_/g, ' ');
  const angles = [
    'Check in — did they see the demo? Short, casual, reference the original email.',
    'Value add — share a quick tip or insight relevant to their business type. Position as helpful, not salesy.',
    'Last touch — final follow-up. Be direct but not pushy. Mention this is the last email unless they want to chat.'
  ];
  const angle = angles[Math.min(step-1, angles.length-1)];

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{ role: 'user', content:
`Write a follow-up email #${step} from Leif (WebForge) to the owner of "${lead.name}", a ${type}.
This is follow-up ${step} of 3. Previous subject was: "${previousSubject}"

Angle for this follow-up: ${angle}

Rules:
- Very short (under 80 words)
- Casual, human, like a real person checking in
- Reference the original email/demo
- No corporate language
- Subject line: short, casual, different from the original
- Sign off: Leif
- NEVER use em dashes (—) anywhere. Use commas instead where an em dash would go. This is critical.

Return ONLY valid JSON: {"subject":"...","body":"..."}`
    }]
  });

  const result = parseJSON(msg.content[0].text);
  if (!result?.subject || !result?.body) throw new Error('Failed to generate follow-up.');
  return cleanCopy(result);
}

module.exports = { sendOutreach, generateEmailPreview, generateFreeSamples, generateFollowUpEmail };
