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
  return obj;
}

function buildEmailPrompt(lead, previewUrl, type) {
  const hasRating = lead.rating && lead.rating !== 'N/A';
  const ratingInfo = hasRating ? `${lead.rating}/5 stars with ${lead.reviews} Google reviews` : 'not yet rated on Google';

  return `You are writing a cold outreach email from Leif to the owner of "${lead.name}", a ${type} at ${lead.address}.
Google rating: ${ratingInfo}.
Demo site Leif already built for them: ${previewUrl}

---

YOUR JOB:
Write cold outreach emails that make business owners suddenly realize they need a website — not by pitching features, but by surfacing a pain or gap they haven't thought about yet.

CORE PHILOSOPHY:
- Lead with THEIR situation, not your services.
- The goal is to create an "oh yeah, I do need this" moment.
- People don't act on opportunity. They act on discomfort. Make them feel the gap.
- Compliment what they've built, then flip it into a problem. Their strength becomes the reason they're losing something.

---

EMAIL STRUCTURE (follow this exact order):

1. HOOK — One sharp observation about their business. Specific. Flattering but with an edge. Use their actual rating/review count/niche.
   Example: "${hasRating ? lead.rating + ' stars. ' + lead.reviews + ' reviews. That\'s rare — most ' + type + 's would kill for that.' : 'You\'ve built something real. A ' + type + ' that people actually talk about.'}"

2. THE FLIP — Immediately turn that strength into a gap or loss. This is the "but here's what's slipping through" moment. Make them feel what they're losing by not having a website.
   Example: "But right now, all that trust lives on Google. Someone hears about you, goes to look you up, and there's nowhere to land. So they move on."

3. THE SOLUTION — Introduce the demo site Leif built for them. Keep it short. Include the clickable link: ${previewUrl}
   One line explaining what it does for them, not how it works.
   Example: "I built you something to fix that: ${previewUrl}"

4. THE OFFER LIST — Use arrow bullets (→), not numbered lists. Keep each item to one line. No fluff. Include these 5:
   → The demo site, fully built out and ready to go live (free)
   → A ready-to-post Instagram caption written for their ${type}
   → A professional response template for their Google reviews
   → An automated customer follow-up message
   → A full audit of their online presence — socials, search visibility, the works

5. THE ASK — Small, low-friction. A quick call or just reply to this email. Frame it as "just tell me your biggest headache right now." Make it feel effortless. Do NOT specify a time length like "5-10 minutes."

6. CLOSING LINE — One sentence that reframes everything. Give them credit for what they've built, then make the website feel like the obvious next step — not a sale.
   Example: "You've already done the hard part. You've built something people love. Let's make sure they can actually find it."

7. SIGN-OFF — "Leif" on one line, then "WebForge" on the next line. No titles. No phone numbers. Nothing else.

---

SUBJECT LINE RULES:
- Must be specific to this business (use their review count, star rating, niche, or name).
- Must create tension or imply a gap — not describe what the email contains.
- Target length: 6-10 words.
- No emojis. No exclamation marks.
- Never use generic phrases like "quick question", "partnership opportunity", "I wanted to reach out", or "just checking in".
- Formula: [Something they have] + [what they're missing because of it]
  Example: "${hasRating ? lead.reviews + ' people loved you. Most never found you.' : lead.name + ' has fans. They just can\'t find you.'}"

---

TONE RULES:
- Conversational, confident, never salesy.
- Short paragraphs. One idea per paragraph.
- Use em dashes (—) for natural pauses. Avoid semicolons.
- Use short punchy sentences to land a point. "So they move on." — like that.
- NEVER say: "I hope this finds you well", "I wanted to reach out", "synergy", "leverage", "solutions", or any agency jargon.
- NEVER use exclamation marks.
- Write like a person, not a company.

---

Under 200 words for the main body. No pricing anywhere. The email must feel like one human who noticed something and did something about it — not a pitch from a company.

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
    'Check in — did they see the demo? Reference the gap you surfaced in the first email. Remind them what they are losing, not what you are offering.',
    'Value add — share one specific insight about their niche. Something they might not know about how customers find businesses like theirs. Make the gap feel more real.',
    'Last touch — be direct. This is the last email. Restate the core tension one more time. Make ignoring it feel like a conscious choice to leave money on the table.'
  ];
  const angle = angles[Math.min(step-1, angles.length-1)];

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{ role: 'user', content:
`Write a follow-up email #${step} from Leif (WebForge) to the owner of "${lead.name}", a ${type}.
${lead.rating !== 'N/A' ? 'Google rating: ' + lead.rating + '/5 with ' + lead.reviews + ' reviews.' : ''}
This is follow-up ${step} of 3. Previous subject was: "${previousSubject}"

Angle for this follow-up: ${angle}

Rules:
- Very short (under 80 words)
- Same tone as the original: conversational, confident, never salesy
- Lead with their situation, not your services
- Use em dashes (—) for natural pauses
- Short punchy sentences to land a point
- No corporate language, no exclamation marks
- NEVER say: "just checking in", "following up", "I wanted to reach out", "circling back"
- Subject line: 6-10 words, specific to their business, creates tension
- Sign off: Leif on one line, WebForge on the next

Return ONLY valid JSON: {"subject":"...","body":"..."}`
    }]
  });

  const result = parseJSON(msg.content[0].text);
  if (!result?.subject || !result?.body) throw new Error('Failed to generate follow-up.');
  return cleanCopy(result);
}

module.exports = { sendOutreach, generateEmailPreview, generateFreeSamples, generateFollowUpEmail };
