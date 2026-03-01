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

  const prompt = `You are a world-class web designer. Build a complete, impressive demo website to SELL to a local business owner who currently has no website.

Business: "${lead.name}"
Type: ${type}
Address: ${lead.address}
Phone: ${lead.phone !== 'N/A' ? lead.phone : 'contact us'}
Google Rating: ${lead.rating !== 'N/A' ? lead.rating+'/5 ('+lead.reviews+' reviews)' : 'not yet rated'}

REQUIREMENTS:
1. Single HTML file — all CSS in <style>, all JS in <script>
2. Two Google Fonts via CDN that match the business vibe
3. Sticky navigation bar with smooth scroll links
4. Hero section: big headline + subtext + CTA button
5. About section: 2-3 paragraphs of compelling real copy (no Lorem ipsum)
6. Services/Menu: 6 real items with realistic prices
7. Testimonials: 3 convincing fake reviews with names and star ratings
8. Contact section: phone, address, and a Google Maps link
9. Footer: business name, © 2025
10. Floating "Book Now" button (bottom-right, always visible)
11. Fade-in animations via IntersectionObserver
12. Mobile responsive with CSS Grid/Flexbox
13. SEO meta tags: title, description, og:title, og:description
14. Professional color palette that fits the business type
15. Must look like a $2,000+ agency website

CRITICAL: Output ONLY raw HTML. Start with <!DOCTYPE html>. End with </html>. Zero markdown. Zero explanation.`;

  let html = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      onProgress({ status:'building', message:`🤖 Calling Claude Haiku (attempt ${attempt}/2)... this takes 20-40 seconds` });
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8000,
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
