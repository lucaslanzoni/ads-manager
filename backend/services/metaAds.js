const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN      = process.env.META_ACCESS_TOKEN;
const AD_ACCOUNT = process.env.META_AD_ACCOUNT_ID;

function post(url, body) {
  return new Promise((resolve, reject) => {
    const { access_token, ...rest } = body;
    const urlObj = new URL(url);
    urlObj.searchParams.set('access_token', access_token);
    const data = JSON.stringify(rest);
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
            const msg = parsed.error.error_user_msg || parsed.error.error_user_title || parsed.error.message;
            reject(new Error(msg));
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
    `https://graph.facebook.com/v21.0/${AD_ACCOUNT}/adimages`,
    { bytes: imageData, access_token: TOKEN }
  );

  const hash = Object.values(result.images)[0].hash;
  return hash;
}

async function createCampaign({ name, objective = 'OUTCOME_AWARENESS', dailyBudget }) {
  const result = await post(
    `https://graph.facebook.com/v21.0/${AD_ACCOUNT}/campaigns`,
    {
      name,
      objective,
      status: 'PAUSED',
      special_ad_categories: [],
      daily_budget: Math.round(dailyBudget * 100),
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      access_token: TOKEN,
    }
  );
  return result.id;
}

async function createAdSet({ campaignId, name, startTime, endTime, network }) {
  const placements = {
    instagram: { publisher_platforms: ['instagram'], instagram_positions: ['stream','story'] },
    facebook:  { publisher_platforms: ['facebook'],  facebook_positions: ['feed','story'] },
    both:      { publisher_platforms: ['instagram','facebook'], instagram_positions: ['stream','story'], facebook_positions: ['feed','story'] },
  };

  const result = await post(
    `https://graph.facebook.com/v21.0/${AD_ACCOUNT}/adsets`,
    {
      name,
      campaign_id: campaignId,
      start_time: startTime,
      end_time: endTime,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'REACH',
      status: 'PAUSED',
      is_adset_budget_sharing_enabled: true,
      targeting: { geo_locations: { countries: ['BR'] } },
      access_token: TOKEN,
      ...(placements[network] || placements.both),
    }
  );
  return result.id;
}

async function createAdCreative({ name, imageHash, headline, body, pageId, destinationUrl }) {
  const result = await post(
    `https://graph.facebook.com/v21.0/${AD_ACCOUNT}/adcreatives`,
    {
      name,
      object_story_spec: {
        page_id: pageId,
        link_data: {
          image_hash: imageHash,
          link: destinationUrl,
          message: body,
          name: headline,
          call_to_action: { type: 'LEARN_MORE', value: { link: destinationUrl } },
        },
      },
      access_token: TOKEN,
    }
  );
  return result.id;
}

async function createAd({ adSetId, creativeId, name }) {
  const result = await post(
    `https://graph.facebook.com/v21.0/${AD_ACCOUNT}/ads`,
    {
      name,
      adset_id: adSetId,
      creative: { creative_id: creativeId },
      status: 'PAUSED',
      access_token: TOKEN,
    }
  );
  return result.id;
}

async function publishCampaign({ sessionId, images, brief, brandName, network, dailyBudget, startDate, endDate, pageId, destinationUrl, captions = {} }) {
  const campaignId = await createCampaign({ name: `${brandName} — ${new Date().toLocaleDateString('pt-BR')}`, dailyBudget });
  const adSetId    = await createAdSet({ campaignId, name: `${brandName} AdSet`, startTime: startDate, endTime: endDate, network });

  const ads = [];

  for (const variation of brief.variations) {
    const feedImage = images.find(i => i.variationId === variation.id && i.format === 'feed');
    if (!feedImage) continue;

    const caption    = captions[variation.id] || variation.caption || variation.copy || '';
    const imagePath  = path.join(__dirname, '../output', sessionId, feedImage.filename);
    const imageHash  = await uploadImage(imagePath);
    const creativeId = await createAdCreative({ name: `${brandName} ${variation.id}`, imageHash, headline: variation.headline, body: caption, pageId, destinationUrl });
    const adId       = await createAd({ adSetId, creativeId, name: `${brandName} ${variation.id} Ad` });

    ads.push({ variationId: variation.id, adId });
  }

  return { campaignId, adSetId, ads };
}

module.exports = { publishCampaign };
