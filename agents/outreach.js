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
  const hasRating = lead.rating && lead.rating !== 'N/A';
  const rating = parseFloat(lead.rating) || 0;
  const reviews = parseInt(lead.reviews) || 0;
  const ratingInfo = hasRating ? `${lead.rating}/5 stars with ${reviews} Google reviews` : 'not yet rated on Google';

  // Rating-aware hook guidance
  let ratingGuidance;
  if (!hasRating) {
    ratingGuidance = `This business has no Google rating yet. Do NOT mention stars or reviews. Instead, hook on something specific to their niche, location, or the fact that they clearly have a physical presence people visit. Frame the gap as: people can't find what they don't know exists.`;
  } else if (rating >= 4.5) {
    ratingGuidance = `Exceptional rating (${lead.rating} stars, ${reviews} reviews). This is genuinely impressive. Use it as the hook, then flip it: all that trust is locked inside Google and goes nowhere. Their best customers are doing the marketing for them, but new people searching online hit a dead end.`;
  } else if (rating >= 4.0) {
    ratingGuidance = `Strong rating (${lead.rating} stars, ${reviews} reviews). Solid but not extraordinary. Don't oversell it with "most businesses would kill for this." Instead, treat it as proof they're doing good work, then flip: the people leaving those reviews can't send friends anywhere except a Google listing.`;
  } else {
    ratingGuidance = `Moderate rating (${lead.rating} stars, ${reviews} reviews). Do NOT hype the rating. Do NOT say "most businesses would kill for this" because 3.8 stars isn't remarkable. Instead, hook on their niche, their location, or how long they've been around. Frame the gap differently: a proper web presence lets them control the narrative instead of letting Google reviews tell their whole story.`;
  }

  // Niche-specific flip examples so Claude doesn't use the same one every time
  const nicheFlips = {
    cafe: "Someone craving a good coffee spot nearby googles you, sees the rating, but can't find a menu, the vibe, or whether you're even open right now. They pick the cafe with the website instead.",
    restaurant: "A friend tells someone to try your food. They search your name. No menu. No photos of the space. No reservations link. They end up at the place down the street that had all of that ready.",
    beauty_salon: "A client tells her friend about you. That friend searches your name. No portfolio. No booking link. No way to see your work. She books with the salon that showed up with photos and an online scheduler.",
    auto_repair: "Someone's car breaks down. A neighbor says 'go to ${lead.name}.' They google you. No website. No services listed. No way to know if you handle their car. So they call the shop that had everything laid out online.",
    yoga_studio: "Someone wants to try yoga. A coworker mentions your studio. They look you up. No class schedule. No pricing. No sense of what walking in feels like. They sign up for the studio that made it easy.",
    gym: "Someone's looking for a new gym. A friend recommends you. They search your name and find... a Google listing. No tour of the space, no membership info, no sense of the culture. They join the gym that showed them everything upfront.",
    barbershop: "A guy asks his buddy where he gets his cut. Buddy says '${lead.name}.' He googles it. No photos of your work. No way to book. He walks into the shop with the Instagram feed and online booking.",
    default: "Someone hears about you. They search your name. And all they find is a Google listing with an address and a phone number. No story, no details, no reason to choose you over the next result. So they don't."
  };
  const nicheKey = Object.keys(nicheFlips).find(k => type.toLowerCase().includes(k)) || 'default';
  const flipExample = nicheFlips[nicheKey];

  return `You are writing a cold outreach email from Leif to the owner of "${lead.name}", a ${type} at ${lead.address}.
Google rating: ${ratingInfo}.
Demo site Leif already built for them (for free, before reaching out): ${previewUrl}

---

YOUR ROLE:
You write cold emails that make local business owners suddenly feel a gap they hadn't noticed. Not by pitching. Not by listing features. By showing them what they're losing right now, today, by not having a website.

PSYCHOLOGY TO APPLY:
- People act on discomfort, not opportunity. Surface the discomfort.
- Reciprocity: Leif already built something for free before asking anything. That changes the dynamic. He gave first.
- Curiosity gap: The subject line should make them NEED to open it. Create an open loop their brain wants to close.
- Prize frame: Leif chose this business specifically. He's not blasting 500 people. This is personal.
- The reader should finish the email feeling like NOT replying is the wrong move.

---

RATING-SPECIFIC GUIDANCE:
${ratingGuidance}

---

NICHE-SPECIFIC FLIP (use this as inspiration, but rewrite it in your own words, do NOT copy it verbatim):
"${flipExample}"

---

EMAIL STRUCTURE (follow this exact order):

1. HOOK (1-2 sentences)
Start with "You" or "Your", never "I" or "Hi" or "Hey". One sharp, specific observation about their business that shows Leif actually looked them up. Must feel personal, not templated.
BAD: "${lead.rating} stars. ${reviews} reviews. That's rare." (this is generic)
GOOD: "Your ${type} has ${reviews} people vouching for it on Google. That's not luck, that's years of showing up."
The hook must feel different every time. Do NOT start with just the star rating and review count as a standalone sentence.

2. THE FLIP (2-3 sentences)
Turn their strength into a specific, tangible loss. Be concrete about what's happening right now. Paint a scene the owner can picture. What does the customer do? Where do they go instead? Make it hurt, but in a way that feels honest, not manipulative.
CRITICAL: The flip must be specific to their type of business (${type}). Do NOT use a generic "all that trust lives on Google" for every business.

3. THE BRIDGE (1 sentence)
One short line connecting the problem to the solution. Then the demo link on its own line:
${previewUrl}

4. THE OFFER LIST
Use arrow bullets (→). One line each. No fluff. These 5 items:
→ The demo site, fully built and ready to go live
→ A ready-to-post Instagram caption written for their ${type}
→ A professional response template for their Google reviews
→ An automated customer follow-up message
→ A full audit of their online presence, socials, and search visibility

5. THE ASK (1-2 sentences)
Low-friction. Interest-based CTA, not a meeting request.
GOOD: "Mind if I walk you through it? Just reply to this email."
GOOD: "If any of this sounds useful, just reply 'interested' and I'll take it from there."
GOOD: "Reply with what's on your plate right now and I'll show you how this fits."
BAD: "Book a call" / "When are you free for 15 minutes?" / "Let's hop on a call"
The ask should feel like replying with one word would be enough.

6. CLOSING LINE (1 sentence)
One sentence that reframes the whole email. Give them credit. Make the next step feel obvious.
CRITICAL: Do NOT use "You've already done the hard part." That's banned. Write something original that is specific to this business and niche. Each email should end differently.
BAD (banned, never use): "You've already done the hard part. You've built something people love. Let's make sure they can actually find it."
GOOD: "The food already speaks for itself. This just makes sure more people hear it."
GOOD: "You don't need more talent. You need more people to see it."

7. SIGN-OFF
"Leif" on one line. "WebForge" on the next. Nothing else. No titles, no phone, no links.

---

SUBJECT LINE RULES:
The subject line is everything. If they don't open it, nothing else matters.
- 5-9 words. Short enough to read on a phone lock screen.
- Must create a curiosity gap or tension. The reader should think "wait, what?" and need to open it.
- Must be specific to THIS business (use their name, niche, review count, or location).
- NEVER describe what the email contains. NEVER pitch in the subject line.
- No emojis. No exclamation marks. No periods at the end. No ALL CAPS.
- BANNED phrases: "quick question", "partnership", "opportunity", "reaching out", "your website", "free website", "I built", "I made", "I noticed", "checking in"

Subject line formulas that get opened:
- Curiosity gap: "${reviews} people left you reviews, then what"
- Implied loss: "your best customers can't find you"
- Pattern interrupt: "${lead.name} without a website in 2026"
- Specific + tension: "${reviews} five-star reviews going nowhere"
- Provocative question: "what happens after someone googles ${lead.name}"

---

HARD RULES (violating any of these = failure):
- NEVER use em dashes (—) anywhere in subject or body. Use commas, periods, or line breaks instead. This is critical.
- NEVER use exclamation marks.
- NEVER use semicolons.
- NEVER start with "Hi", "Hey", "Hello", or any greeting. Start directly with the hook.
- First word of the email must be "You" or "Your".
- NEVER say: "I hope this finds you well", "synergy", "leverage", "solutions", "partnership", "opportunity", "game-changer", "next level", "stand out", "competitive edge"
- NEVER reuse the same closing line across emails. Each must be unique and niche-specific.
- Under 150 words for the body (before the offer list). Total email under 200 words.
- No pricing anywhere.
- Write like a person texting a friend about something they noticed, not like a company writing marketing copy.
- The email should feel slightly imperfect, human, real. Not polished corporate prose.

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
    `Resurface the gap. Remind them what their customers experience when they search for "${lead.name}" and find nothing. Add one new detail or angle they haven't considered. Do NOT reference the previous email directly.`,
    `Share one specific, useful insight about how customers find ${type}s in their area. A stat, a trend, a behavior pattern. Make the gap feel more real and more urgent. Position it as something you noticed, not a sales pitch.`,
    `Last email. Be direct and honest. This is it. Frame it as: "I'll leave this with you." Restate the core loss one more time. Make choosing to ignore it feel like a conscious decision to leave money on the table. End with "Should I close this out?" or "Should I take this down?" (referring to the demo site).`
  ];
  const angle = angles[Math.min(step-1, angles.length-1)];

  const msg = await client.messages.create({
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
- No exclamation marks. No semicolons.
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
