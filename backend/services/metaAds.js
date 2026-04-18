const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN      = process.env.META_ACCESS_TOKEN;
const AD_ACCOUNT = process.env.META_AD_ACCOUNT_ID;

function post(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(options, res => {
      let out = '';
      res.on('data', c => out += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(out);
          if (parsed.error) {
            console.error('Meta API error:', JSON.stringify(parsed.error));
            reject(new Error(parsed.error.message));
          } else resolve(parsed);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function uploadImage(imagePath) {
  const abs = path.resolve(imagePath);
  const imageData = fs.readFileSync(abs).toString('base64');

  const result = await post(
    `https://graph.facebook.com/v19.0/${AD_ACCOUNT}/adimages`,
    { bytes: imageData, access_token: TOKEN }
  );

  const hash = Object.values(result.images)[0].hash;
  return hash;
}

async function createCampaign({ name, objective = 'OUTCOME_AWARENESS' }) {
  const result = await post(
    `https://graph.facebook.com/v19.0/${AD_ACCOUNT}/campaigns`,
    {
      name,
      objective,
      status: 'PAUSED',
      special_ad_categories: [],
      access_token: TOKEN,
    }
  );
  return result.id;
}

async function createAdSet({ campaignId, name, budget, startTime, endTime, network }) {
  const placements = {
    instagram: { publisher_platforms: ['instagram'], instagram_positions: ['stream','story'] },
    facebook:  { publisher_platforms: ['facebook'],  facebook_positions: ['feed','story'] },
    both:      { publisher_platforms: ['instagram','facebook'], instagram_positions: ['stream','story'], facebook_positions: ['feed','story'] },
  };

  const result = await post(
    `https://graph.facebook.com/v19.0/${AD_ACCOUNT}/adsets`,
    {
      name,
      campaign_id: campaignId,
      daily_budget: Math.round(budget * 100),
      start_time: startTime,
      end_time: endTime,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'REACH',
      status: 'PAUSED',
      is_adset_budget_sharing_enabled: false,
      targeting: { geo_locations: { countries: ['BR'] } },
      access_token: TOKEN,
      ...(placements[network] || placements.both),
    }
  );
  return result.id;
}

async function createAdCreative({ name, imageHash, headline, body, pageId }) {
  const result = await post(
    `https://graph.facebook.com/v19.0/${AD_ACCOUNT}/adcreatives`,
    {
      name,
      object_story_spec: {
        page_id: pageId,
        link_data: {
          image_hash: imageHash,
          message: body,
          name: headline,
          call_to_action: { type: 'LEARN_MORE' },
        },
      },
      access_token: TOKEN,
    }
  );
  return result.id;
}

async function createAd({ adSetId, creativeId, name }) {
  const result = await post(
    `https://graph.facebook.com/v19.0/${AD_ACCOUNT}/ads`,
    {
      name,
      adset_id: adSetId,
      creative: JSON.stringify({ creative_id: creativeId }),
      status: 'PAUSED',
      access_token: TOKEN,
    }
  );
  return result.id;
}

async function publishCampaign({ sessionId, images, brief, brandName, network, dailyBudget, startDate, endDate, pageId, captions = {} }) {
  const campaignId = await createCampaign({ name: `${brandName} — ${new Date().toLocaleDateString('pt-BR')}` });
  const adSetId    = await createAdSet({ campaignId, name: `${brandName} AdSet`, budget: dailyBudget, startTime: startDate, endTime: endDate, network });

  const ads = [];

  for (const variation of brief.variations) {
    const feedImage = images.find(i => i.variationId === variation.id && i.format === 'feed');
    if (!feedImage) continue;

    const caption    = captions[variation.id] || variation.caption || variation.copy || '';
    const imagePath  = path.join(__dirname, '../output', sessionId, feedImage.filename);
    const imageHash  = await uploadImage(imagePath);
    const creativeId = await createAdCreative({ name: `${brandName} ${variation.id}`, imageHash, headline: variation.headline, body: caption, pageId });
    const adId       = await createAd({ adSetId, creativeId, name: `${brandName} ${variation.id} Ad` });

    ads.push({ variationId: variation.id, adId });
  }

  return { campaignId, adSetId, ads };
}

module.exports = { publishCampaign };
