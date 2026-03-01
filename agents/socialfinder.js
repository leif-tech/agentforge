const https = require('https');

function getPlacesKey() {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error('Google Places API key not set.');
  return key;
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Invalid JSON response')); }
      });
    }).on('error', reject);
  });
}

// Search Google Places for social media links
async function findViaplaces(lead) {
  const key = getPlacesKey();
  const query = encodeURIComponent(`${lead.name} ${lead.address}`);
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=place_id,name&key=${key}`;
  
  const searchRes = await httpsGet(url);
  if (!searchRes.candidates?.length) return null;
  
  const placeId = searchRes.candidates[0].place_id;
  const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,website,url&key=${key}`;
  const detailRes = await httpsGet(detailUrl);
  
  return detailRes.result || null;
}

// Search Google Custom Search for social media profiles
async function findViaWebSearch(lead, onProgress) {
  const key = getPlacesKey();
  const businessName = lead.name;
  const city = lead.address ? lead.address.split(',').slice(-3, -1).join(',').trim() : '';
  
  const socials = { instagram: null, facebook: null, twitter: null, tiktok: null };
  const platforms = [
    { name: 'Instagram', domain: 'instagram.com', key: 'instagram' },
    { name: 'Facebook', domain: 'facebook.com', key: 'facebook' },
    { name: 'TikTok', domain: 'tiktok.com', key: 'tiktok' },
  ];

  for (const platform of platforms) {
    onProgress({ status: 'searching', message: `🔍 Searching ${platform.name} for ${businessName}...` });
    try {
      const query = encodeURIComponent(`site:${platform.domain} "${businessName}" ${city}`);
      const searchUrl = `https://www.googleapis.com/customsearch/v1?q=${query}&key=${key}&cx=017576662512468239146:omuauf10dwe&num=3`;
      const res = await httpsGet(searchUrl);
      
      if (res.items?.length) {
        const item = res.items[0];
        const link = item.link;
        if (link && link.includes(platform.domain)) {
          socials[platform.key] = { url: link, title: item.title || businessName };
          onProgress({ status: 'found', message: `✅ Found ${platform.name}: ${link}` });
        }
      } else {
        onProgress({ status: 'not_found', message: `❌ No ${platform.name} found for ${businessName}` });
      }
    } catch(e) {
      onProgress({ status: 'error', message: `⚠ ${platform.name} search failed: ${e.message}` });
    }
    await new Promise(r => setTimeout(r, 300));
  }

  return socials;
}

// Main function - try Places first, then web search
async function findSocialMedia(lead, onProgress) {
  onProgress({ status: 'start', message: `🚀 Starting social media search for ${lead.name}...` });

  // Step 1: Try Google Places for website/social links
  onProgress({ status: 'searching', message: `📍 Checking Google Places for social links...` });
  let placeData = null;
  try {
    placeData = await findViaplaces(lead);
    if (placeData?.website) {
      onProgress({ status: 'found', message: `🌐 Found website on Places: ${placeData.website}` });
    }
  } catch(e) {
    onProgress({ status: 'searching', message: `⚠ Places lookup failed, falling back to web search...` });
  }

  // Step 2: Web search for each platform
  const socials = await findViaWebSearch(lead, onProgress);

  // Build result
  const found = Object.values(socials).filter(v => v !== null).length;
  const result = {
    instagram: socials.instagram,
    facebook: socials.facebook,
    tiktok: socials.tiktok,
    website: placeData?.website || null,
    foundCount: found,
    searchedAt: new Date().toISOString()
  };

  onProgress({ 
    status: 'done', 
    message: `🏁 Done — found ${found} social profile${found !== 1 ? 's' : ''} for ${lead.name}` 
  });

  return result;
}

module.exports = { findSocialMedia };
