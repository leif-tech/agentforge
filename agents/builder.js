const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

function getClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === 'your_anthropic_key_here') {
    throw new Error('Anthropic API key not set! Go to Settings and add your key from console.anthropic.com');
  }
  return new Anthropic({ apiKey: key });
}

function isComplete(html) {
  // Accept if we have doctype and either closing tag or it's big enough (Haiku sometimes truncates)
  const hasDoctype = html.includes('<!DOCTYPE') || html.includes('<!doctype');
  const hasClose = html.includes('</html>');
  const isLarge = html.length > 15000;
  // If no closing tag, try to fix it
  if (hasDoctype && isLarge && !hasClose) {
    html = html + '\n</body>\n</html>';
    return true;
  }
  return hasDoctype && hasClose && html.length > 3000;
}

async function buildDemoSite(lead, onProgress) {
  onProgress({ status:'building', message:`🔑 Checking API key...` });

  let client;
  try {
    client = getClient();
  } catch(e) {
    onProgress({ status:'error', message:`❌ ${e.message}` });
    throw e;
  }

  onProgress({ status:'building', message:`✍️  Writing prompt for ${lead.name}...` });
  const type = (lead.type||'business').replace(/_/g,' ');

  const imgSeed = lead.name.replace(/[^a-z0-9]/gi,'-').toLowerCase().substring(0,20);
  const prompt = `You are a world-class web designer. Build a complete, stunning demo website for a local business owner.

Business: "${lead.name}"
Type: ${type}
Address: ${lead.address}
Phone: ${lead.phone !== 'N/A' ? lead.phone : 'Call us'}
Google Rating: ${lead.rating !== 'N/A' ? lead.rating+'/5 ('+lead.reviews+' reviews)' : 'not yet rated'}

IMAGES — use these exact Picsum URLs (they always work, no broken images):
- Hero background: https://picsum.photos/seed/${imgSeed}/1600/900
- About section photo: https://picsum.photos/seed/${imgSeed}2/800/600
- Gallery/feature image 1: https://picsum.photos/seed/${imgSeed}3/600/400
- Gallery/feature image 2: https://picsum.photos/seed/${imgSeed}4/600/400
- Gallery/feature image 3: https://picsum.photos/seed/${imgSeed}5/600/400

SECTIONS (build all of these in order):
1. <head> — Google Fonts CDN (2 fonts matching the business), SEO meta tags, all CSS in <style>
2. Sticky nav — logo left, links right (Home, About, Services, Gallery, Reviews, Contact)
3. Hero — full-screen background image with a DARK SEMI-TRANSPARENT OVERLAY (rgba 0,0,0,0.5) so white text is always visible. Large headline, subheadline, two CTA buttons.
4. About — split layout: left side has the about image, right side has 3 paragraphs of real compelling copy about this specific business
5. Services — 6 cards in a grid, each with an icon (use emoji), service name, short description, realistic price
6. Gallery — 3 images in a horizontal row with rounded corners and hover zoom effect
7. Testimonials — 3 review cards with star ratings (★★★★★), customer name, and 2-3 sentences of genuine-sounding review text
8. Contact — address, phone, hours, and a "Get Directions" button linking to Google Maps
9. Footer — business name, tagline, © 2025, social media icon links
10. Floating "Book Now" / "Call Now" button fixed bottom-right, always visible

CSS RULES:
- Never use white text on white or light backgrounds — always ensure contrast
- Hero text must be white (there is a dark overlay on the image)
- Use CSS custom properties (--primary, --accent, --dark, --light) for the color palette
- Smooth scroll behavior on <html>
- Fade-in animation on sections using IntersectionObserver
- Fully mobile responsive using CSS Grid and Flexbox
- Cards have subtle box-shadow and hover lift effect

CRITICAL: Output ONLY the raw HTML. Start with <!DOCTYPE html>. End with </html>. No markdown, no explanation, no code fences.`;

  let html = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      onProgress({ status:'building', message:`🤖 Calling Claude Sonnet (attempt ${attempt}/2)... this takes 30-60 seconds` });
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 12000,
        messages: [{ role:'user', content: prompt }]
      });
      onProgress({ status:'building', message:`📥 Response received — validating HTML...` });
      html = msg.content[0].text.trim().replace(/^```html?\n?/i,'').replace(/\n?```$/,'').trim();
      // Auto-fix missing closing tags
      if (html.includes('<!DOCTYPE') && !html.includes('</html>') && html.length > 10000) {
        onProgress({ status:'building', message:'🔧 Auto-fixing incomplete HTML...' });
        if (!html.includes('</body>')) html += '\n</body>';
        html += '\n</html>';
      }
      const size = Math.round(html.length/1024);
      onProgress({ status:'building', message:`📏 Got ${size}KB of HTML — checking completeness...` });
      if (isComplete(html)) {
        onProgress({ status:'building', message:`✅ HTML looks complete! Saving file...` });
        break;
      }
      onProgress({ status:'retry', message:`⚠️  HTML incomplete (${size}KB) — retrying...` });
    } catch(e) {
      onProgress({ status:'error', message:`❌ API error (attempt ${attempt}): ${e.message}` });
      if (attempt === 2) throw e;
      const wait = e.message.includes('429') ? 60000 : 3000;
      onProgress({ status:'building', message:`⏳ ${wait >= 60000 ? 'Rate limited — waiting 60s before retry...' : 'Waiting 3s before retry...'}`});
      await new Promise(r=>setTimeout(r,wait));
    }
  }

  if (!isComplete(html)) {
    const err = 'Generated HTML was incomplete. Check your Anthropic API key and try again.';
    onProgress({ status:'error', message:`❌ ${err}` });
    throw new Error(err);
  }

  const sitesDir = path.join(__dirname,'..','sites');
  fs.mkdirSync(sitesDir, { recursive: true });
  const safe = lead.name.replace(/[^a-z0-9]/gi,'-').toLowerCase().substring(0,40);
  const filename = `${safe}-${Date.now()}.html`;
  fs.writeFileSync(path.join(sitesDir, filename), html);

  const size = Math.round(html.length/1024);
  onProgress({ status:'done', message:`🎉 Site saved! ${size}KB — ${filename}`, filename });
  return { html, filename };
}

module.exports = { buildDemoSite };
