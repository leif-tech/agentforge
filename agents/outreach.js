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

3. THE BRIDGE (pivot sentence)
This is the single sentence that transitions from the problem to the offer. It carries the most weight in the email. If it's vague, the reader loses momentum right before the offer lands.

PIVOT SENTENCE RULES:
- Must close the loop on the exact problem described in The Flip above. Reference the specific loss or scenario you just painted.
- Echo a specific word or phrase already used in the email (creates cohesion).
- One sentence, punchy, no longer than 15 words.
- NEVER use vague verbs like "prove it", "show it", "fix that", "change this" without a specific object. The reader should never have to guess what "it" refers to.
- BAD: "We built you a demo website to prove it." (prove WHAT? vague antecedent)
- GOOD: "We built you a demo website so people searching your name actually have somewhere to land."
- GOOD: "We built you a demo site. Now that couple checking menus tonight can see yours."

After the pivot sentence, drop the demo URL on its own line: ${previewUrl}
Then clarify: this is just a demo, it can be changed and customized however they want, and we will build their real website for free.

4. THE OFFER LIST
- First, frame the demo website as the free offer:
  "The demo website above is yours, for free. We'll turn it into your real site, customized however you want, at no cost."

- Then transition to additional services with a line like:
  "We also offer these, and many more:"

1. An automated customer follow-up system via text message or social media, this one runs while you sleep
2. A ready-to-post Instagram caption written for your ${type}
3. A professional response template for your Google reviews
4. A full audit of your online presence, socials, and search visibility

IMPORTANT: The website is free. The additional services (items 1-4) are paid services we offer. Do not frame them as free. Let the list speak for itself.
Item 1 (the follow-up system) is the anchor. It must feel like the most valuable thing on the list.

5. THE ASK
- Exact framing: "All I need in return is 5-10 minutes."
- One option only: hop on a quick call. The call is so we can learn what they want on the website and have a quick chat about their business.
- Do NOT offer "or just reply to this email" as an alternative. Keep it to the call only.
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
- Use the business's actual review count as an anchor. It makes the email feel researched, not mass-blasted.
- Imply a problem or gap without being clickbait-y or alarmist.
- Under 60 characters so it reads fully in email preview panes.
- Create curiosity OR mild tension, ideally both.
- Prefer concrete contrast over vague statements (e.g., "reviews vs. no website" not "missing out").
- Winning formula (tested): [Review count]. [Consequence they're experiencing].
  Example: "${reviews} reviews. Still losing clicks to competitors."
- Must be specific to THIS business. Use their review count (${reviews}), name (${lead.name}), or niche (${type}).
- No emojis. No exclamation marks. No ALL CAPS. No spam trigger words.
- BANNED phrases: "quick question", "partnership", "opportunity", "reaching out", "your website", "free website", "I built", "I made", "I noticed", "checking in"

Generate 3 subject line options internally, ranked by curiosity score:
- Safe: lowest risk, still curiosity-driven
- Punchy: stronger tension, concrete contrast
- Bold: most provocative, highest open potential
Then pick the BEST one (Punchy or Bold preferred) and use it as the subject in your JSON output.

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

function buildWebsiteOutreachPrompt(lead, type) {
  const hasRating = lead.rating && lead.rating !== 'N/A';
  const rating = parseFloat(lead.rating) || 0;
  const reviews = parseInt(lead.reviews) || 0;

  let ratingGuidance;
  if (!hasRating) {
    ratingGuidance = `No rating: do not mention stars. Hook on their niche or location presence.`;
  } else if (rating >= 4.5) {
    ratingGuidance = `4.5 and above (${lead.rating} stars, ${reviews} reviews): use the rating as the hook. Flip it ("all that trust is sitting there but nothing is working behind the scenes to bring people back").`;
  } else if (rating >= 4.0) {
    ratingGuidance = `4.0 to 4.5 (${lead.rating} stars, ${reviews} reviews): solid reputation but don't oversell it. Flip on "you've got the online storefront but nothing running behind it".`;
  } else {
    ratingGuidance = `Below 4.0 (${lead.rating} stars, ${reviews} reviews): skip rating entirely. Hook on niche, longevity, or what they actually do well.`;
  }

  const nicheFlips = {
    cafe: `Someone visited last week, loved it, left a review. That's where it ends. No follow-up text, no "come back" message. They forget and try somewhere new.`,
    coffee: `Someone visited last week, loved it, left a review. That's where it ends. No follow-up text, no "come back" message. They forget and try somewhere new.`,
    restaurant: `A couple had a great dinner. Left 5 stars. Never heard from the restaurant again. Two weeks later they're trying somewhere else.`,
    salon: `A client loved their cut. Told a friend. But there's no follow-up booking reminder, no content keeping the salon top of mind. The friend books elsewhere.`,
    hair: `A client loved their cut. Told a friend. But there's no follow-up booking reminder, no content keeping the salon top of mind. The friend books elsewhere.`,
    auto: `A customer got great service. Left a review. No follow-up, no reminder for their next oil change. They see an ad for a chain and go there instead.`,
    yoga: `A new member loved their first class. But there's no check-in message after, no content keeping them engaged. They drift to another studio.`,
    fitness: `A new member loved their first class. But there's no check-in message after, no content keeping them engaged. They drift to another studio.`,
    gym: `A guy signs up for a week trial. Great experience. No follow-up text, no engagement. He quietly doesn't come back.`,
    barbershop: `A regular comes in every 3 weeks. But there's no system reminding him, no content keeping the shop in his feed. One day he just tries somewhere closer.`,
    barber: `A regular comes in every 3 weeks. But there's no system reminding him, no content keeping the shop in his feed. One day he just tries somewhere closer.`,
    roofer: `A homeowner got a great roof job. Told a neighbor. But there's no system capturing that referral, no follow-up. The neighbor Googles and picks someone else.`,
    contractor: `A homeowner got a great roof job. Told a neighbor. But there's no system capturing that referral, no follow-up. The neighbor Googles and picks someone else.`,
    nail: `A client posts their nails on Instagram but tags no one. The salon has no content strategy, no follow-up. That free marketing just evaporates.`,
    bakery: `Someone orders a birthday cake. Loves it. No follow-up for next year, no content keeping them engaged. They try a new bakery next time.`,
    florist: `A guy orders flowers for Valentine's. Great experience. No follow-up for Mother's Day, no reminder. He orders from whoever shows up first online.`,
    flower: `A guy orders flowers for Valentine's. Great experience. No follow-up for Mother's Day, no reminder. He orders from whoever shows up first online.`,
    massage: `A client books a session, feels amazing. No follow-up, no rebooking nudge. Life gets busy and they don't come back for months.`,
    spa: `A client books a session, feels amazing. No follow-up, no rebooking nudge. Life gets busy and they don't come back for months.`,
    dentist: `A patient finishes their cleaning. No follow-up text, no reminder for 6 months. They procrastinate and eventually switch to whoever is convenient.`,
    vet: `A pet owner had a great visit. No follow-up check-in, no vaccination reminder. They end up at a different vet next time.`,
    cleaning: `A homeowner loved the deep clean. No follow-up, no recurring schedule offer. They forget the name and Google someone else next time.`,
    default: `A customer has a great experience. Leaves a review. Never hears from the business again. Slowly forgets about them and moves on to whatever shows up next.`
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
- This business ALREADY HAS a website. Do NOT offer to build them a website. Do NOT mention a demo site.

PSYCHOLOGY DIRECTIVES:
- Surface discomfort. People act on loss, not opportunity.
- Reciprocity: Leif is offering a free audit and sample content. He's giving first.
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
- Acknowledge they have a website. The gap is what's BEHIND the website: no follow-up system, no content engine, no review management.
- Keep it to 1-2 sentences max.

2. THE FLIP
- Turn their strength into a tangible loss. Show them what is slipping through the cracks right now.
- The problem isn't their website. The problem is what happens AFTER someone visits, buys, or leaves a review. Nothing. No follow-up, no re-engagement, no system.
- Use the niche-specific scenario above to make it concrete and real.
- 2-3 sentences max.

3. THE BRIDGE (pivot sentence)
This is the single sentence that transitions from the problem to the offer.

PIVOT SENTENCE RULES:
- Must close the loop on the exact problem described in The Flip above.
- Echo a specific word or phrase already used in the email.
- One sentence, punchy, no longer than 15 words.
- NEVER use vague verbs like "prove it", "show it", "fix that", "change this" without a specific object.
- BAD: "We can help with that." (vague)
- GOOD: "We build the systems that turn one-time customers into regulars."
- GOOD: "That follow-up message they never got? We automate that."

4. THE OFFER LIST
- Frame it as what WebForge does for businesses like theirs:
  "Here's what we do for ${type}s like yours:"

1. An automated customer follow-up system via text message or social media, this one runs while you sleep
2. A ready-to-post Instagram caption written for your ${type}
3. A professional response template for your Google reviews
4. A full audit of your online presence, socials, and search visibility

IMPORTANT: These are paid services we offer. Do not frame them as free. Let the list speak for itself.
Item 1 (the follow-up system) is the anchor. It must feel like the most valuable thing on the list.

5. THE ASK
- Exact framing: "All I need in return is 5-10 minutes."
- One option only: hop on a quick call. The call is so we can learn about their business and what systems they're missing.
- Do NOT offer "or just reply to this email" as an alternative. Keep it to the call only.
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
- Use the business's actual review count as an anchor if available.
- Imply a problem or gap in their SYSTEMS (not their website). The gap is automation, follow-up, content, not having a site.
- Under 60 characters.
- Create curiosity OR mild tension, ideally both.
- Prefer concrete contrast over vague statements.
- Winning formula: [Review count]. [Consequence they're experiencing with systems].
  Example: "${reviews} reviews. Zero follow-up system."
- Must be specific to THIS business.
- No emojis. No exclamation marks. No ALL CAPS. No spam trigger words.
- BANNED phrases: "quick question", "partnership", "opportunity", "reaching out", "your website", "free website", "I built", "I made", "I noticed", "checking in"

Generate 3 subject line options internally, ranked by curiosity score:
- Safe: lowest risk, still curiosity-driven
- Punchy: stronger tension, concrete contrast
- Bold: most provocative, highest open potential
Then pick the BEST one (Punchy or Bold preferred) and use it as the subject in your JSON output.

HARD RULES:
- No em dashes anywhere in subject or body. Use commas, periods, or line breaks instead.
- No exclamation marks. No semicolons.
- Never start with "Hi", "Hey", "Hello", or any greeting. Start directly with the hook.
- First word of the email must be "You" or "Your".
- NEVER mention building a website, a demo site, or offering a free website. This business already has one.
- BANNED words: "synergy", "leverage", "solutions", "partnership", "opportunity", "game-changer", "next level", "stand out", "competitive edge"
- Each closing line must be unique and niche-specific. Never reuse across emails.
- Under 150 words for the body (before the offer list). Total email under 200 words.
- No pricing anywhere.
- Must feel like a human wrote it, slightly imperfect, not polished AI copy.

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

IMPORTANT: NEVER use em dashes (—) anywhere. Use commas or periods instead. No exclamation marks.

Return ONLY valid JSON:
{
  "instagram_post": "Polished ready-to-post Instagram caption. 3-4 sentences, professional and engaging, speaks to their ideal customer, ends with CTA and 5-7 relevant hashtags. Specific to their business type and location.",
  "review_response": "Warm professional response to a 5-star Google review. Thank [Customer Name], reference their experience warmly, invite them back. Personal and genuine, not templated. 2-3 sentences.",
  "followup_message": "Professional friendly follow-up message via SMS or email sent 2 days after a visit. Checks their experience, offers help, gently encourages next booking. Under 60 words."
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

    // URL-only line — render as a styled button/link
    const trimmedLine = line.trim();
    if (trimmedLine.match(/^https?:\/\/\S+$/) && previewUrl && trimmedLine.includes(previewUrl.split('/')[2])) {
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

    // "This demo is yours" / free website line — highlight
    if (/demo.*yours|for free|no cost|your real site/i.test(line)) {
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
