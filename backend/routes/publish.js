const express = require('express');
const { publishCampaign } = require('../services/metaAds');

const router = express.Router();

router.post('/', async (req, res) => {
  const { sessionId, images, brief, brandName, network, dailyBudget, startDate, endDate, pageId, destinationUrl, captions = {} } = req.body;

  const missing = { sessionId, images, brief, brandName, network, dailyBudget, startDate, endDate, pageId, destinationUrl };
  const missingKeys = Object.entries(missing).filter(([, v]) => !v).map(([k]) => k);
  if (missingKeys.length) {
    console.error('Campos faltando:', missingKeys);
    return res.status(400).json({ error: `Campos obrigatórios faltando: ${missingKeys.join(', ')}` });
  }

  try {
    const result = await publishCampaign({ sessionId, images, brief, brandName, network, dailyBudget, startDate, endDate, pageId, destinationUrl, captions });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
