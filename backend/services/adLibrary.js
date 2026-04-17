const https = require('https');

const TOKEN = process.env.META_ACCESS_TOKEN;

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function searchAds(segments) {
  const keyword = segments[0];
  const url = `https://graph.facebook.com/v19.0/ads_archive?access_token=${TOKEN}&ad_reached_countries=["BR"]&ad_type=ALL&search_terms=${encodeURIComponent(keyword)}&fields=ad_creative_bodies,ad_creative_link_titles,call_to_action_types,page_name&limit=10`;

  try {
    const result = await get(url);
    return result.data || [];
  } catch {
    return [];
  }
}

module.exports = { searchAds };
