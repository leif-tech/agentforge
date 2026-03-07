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

  // Rating-aware hook guidance
  let ratingGuidance;
  if (!hasRating) {
    ratingGuidance = `No rating: do not mention stars. Hook on their niche or location presence.`;
  } else if (rating >= 4.5) {
    ratingGuidance = `4.5 and above (${lead.rating} stars, ${reviews} reviews): use the rating as the hook. Flip it ("all that trust is locked inside Google with nowhere to go").`;
  } else if (rating >= 4.0) {
    ratingGuidance = `4.0 to 4.5 (${lead.rating} stars, ${reviews} reviews): solid reputation but don't oversell it. Flip on "no place to send people who hear about you".`;
  } else {
    ratingGuidance = `Below 4.0 (${lead.rating} stars, ${reviews} reviews): skip rating entirely. Hook on niche, longevity, or what they actually do well.`;
  }

  // Niche-specific flip examples
  const nicheFlips = {
    cafe: `Someone hears about their cortado from a friend, searches the name, finds no website, clicks the competitor down the street instead.`,
    coffee: `Someone hears about their cortado from a friend, searches the name, finds no website, clicks the competitor down the street instead.`,
    restaurant: `A couple is choosing where to eat tonight. No menu online, no photos. They pick somewhere else.`,
    salon: `A woman asks her friend where she got her cut. She searches the name. Nothing comes up that looks real. She books somewhere else.`,
    hair: `A woman asks her friend where she got her cut. She searches the name. Nothing comes up that looks real. She books somewhere else.`,
    auto: `Someone's car is making a noise. They search the shop name. No site. Looks closed or sketchy. They go to a chain.`,
    yoga: `Someone just moved to the area. They search for yoga nearby. The listing has no class schedule, no vibe. They try the next one.`,
    fitness: `Someone just moved to the area. They search for fitness nearby. The listing has no class schedule, no vibe. They try the next one.`,
    gym: `A guy is ready to sign up. He searches, finds no site, can't see pricing or equipment. He signs up at the gym that had a website.`,
    barbershop: `A dad wants a reliable spot for his son. He searches, finds just an address. No photos, no booking. He goes somewhere that looked more legit.`,
    barber: `A dad wants a reliable spot for his son. He searches, finds just an address. No photos, no booking. He goes somewhere that looked more legit.`,
    roofer: `A homeowner needs a quote. They found the name through a neighbor. No website. Looks unverified. They call someone else.`,
    contractor: `A homeowner needs a quote. They found the name through a neighbor. No website. Looks unverified. They call someone else.`,
    nail: `Someone wants to check the vibe before booking. No photos, no site. They book somewhere they could actually see first.`,
    bakery: `Someone heard about the sourdough. They search the name. Just a map pin. No photos, no story. They scroll to the next result.`,
    florist: `A guy needs flowers for an anniversary. No site, no gallery of arrangements. He orders from someone with photos.`,
    flower: `A guy needs flowers for an anniversary. No site, no gallery of arrangements. He orders from someone with photos.`,
    massage: `A woman wants to treat herself. She searches, finds only a phone number. Feels unsure. Books somewhere with a real site.`,
    spa: `A woman wants to treat herself. She searches, finds only a phone number. Feels unsure. Books somewhere with a real site.`,
    dentist: `A family just moved in. They search for a dentist. No website, no info about the team. They pick the one that looked established.`,
    vet: `A new pet owner is nervous. They search local vets. One has a site with the doctor's photo and approach. They call that one.`,
    cleaning: `A homeowner wants to hire cleaners. They found the name through a neighbor. No site, no proof of work. They Google someone else.`,
    default: `Someone hears about them. They search the name. Just a Google listing with an address and a phone number. No story, no details. They pick the next result.`
  };
  const nicheKey = Object.keys(nicheFlips).find(k => type.toLowerCase().includes(k)) || 'default';
  const flipExample = nicheFlips[nicheKey];

  return `You are writing a cold outreach email on behalf of Leif from WebForge.

CONTEXT:
- Business name: ${lead.name}
- Business type: ${type}
- Address: ${lead.address}
- Rating: ${hasRating ? lead.rating : 'no rating'}
- Number of reviews: ${reviews}
- Demo site URL: ${previewUrl}

PSYCHOLOGY DIRECTIVES:
- Surface discomfort. People act on loss, not opportunity.
- Reciprocity: Leif already built them a free demo site. He gave first.
- Curiosity gap in the subject line. Make them need to open it.
- Prize frame: this email feels personal and hand-written, not a blast.

RATING-AWARE HOOK GUIDANCE:
${ratingGuidance}

NICHE-SPECIFIC FLIP EXAMPLE (use as inspiration, rewrite in your own words):
"${flipExample}"

EMAIL STRUCTURE - follow this exactly, in this order:

1. HOOK
- First line only. Start with "You" or "Your". Never start with "Hi" or any greeting.
- Make one specific, true observation about their business (use rating, reviews, niche, or location).
- Keep it to 1-2 sentences max.

2. THE FLIP
- Turn their strength into a tangible loss. Show them what is slipping through the cracks right now.
- Use the niche-specific scenario above to make it concrete and real.
- 2-3 sentences max.

3. THE BRIDGE
- One short line acknowledging what they have built, then drop the demo URL.
- Format: "[One line observation]. ${previewUrl}"

4. THE OFFER LIST
- Intro line: "Here's what's yours to keep, no charge:"
- Then list all 5 items exactly as follows:

1. The live demo website above, fully built out and ready to go live (I'll make it your real site for free)
2. A ready-to-post Instagram caption written for your ${type}
3. A professional response template for your Google reviews
4. An automated customer follow-up system via text message or social media, this one runs while you sleep
5. A full audit of your online presence, socials, and search visibility

IMPORTANT: Only item 1 is truly free. Items 2-5 are services we can provide. Do not frame them as free. Let the list speak for itself.
Item 4 is the anchor. It must feel like the most valuable thing on the list.

5. THE ASK
- Exact framing: "All I need in return is 5-10 minutes."
- Give two options: hop on a quick call, or just reply to this email.
- Low pressure. No urgency theater. One door, left open.
- 2 sentences max.

6. CLOSING LINE
- One original line. Niche-specific. Must feel human.
- BANNED phrase: "You've already done the hard part"
- Do not summarize. Do not repeat anything already said. Just land it.

7. SIGN-OFF
Leif
WebForge

SUBJECT LINE RULES:
- 5-9 words. Short enough to read on a phone lock screen.
- Must create a curiosity gap or tension. Make them think "wait, what?"
- Must be specific to THIS business (use their name, niche, review count, or location).
- NEVER describe what the email contains. NEVER pitch in the subject line.
- No emojis. No exclamation marks. No periods at the end. No ALL CAPS.
- BANNED phrases: "quick question", "partnership", "opportunity", "reaching out", "your website", "free website", "I built", "I made", "I noticed", "checking in"

HARD RULES:
- No em dashes anywhere in subject or body. Use commas, periods, or line breaks instead.
- No exclamation marks. No semicolons.
- Never start with "Hi", "Hey", "Hello", or any greeting. Start directly with the hook.
- First word of the email must be "You" or "Your".
- BANNED words: "synergy", "leverage", "solutions", "partnership", "opportunity", "game-changer", "next level", "stand out", "competitive edge"
- Each closing line must be unique and niche-specific. Never reuse across emails.
- Under 150 words for the body (before the offer list). Total email under 200 words.
- No pricing anywhere.
- Must feel like a human wrote it, slightly imperfect, not polished AI copy.

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
                  <td style="padding-left:10px;font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.06em">Customer Follow-Up via Text or Social</td>
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
