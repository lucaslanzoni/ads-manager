const express = require('express');
const { publishCampaign } = require('../services/metaAds');

const router = express.Router();

router.post('/', async (req, res) => {
  const { sessionId, images, brief, brandName, network, dailyBudget, startDate, endDate, pageId, destinationUrl, captions = {} } = req.body;

  if (!sessionId || !images || !brief || !brandName || !network || !dailyBudget || !startDate || !endDate || !pageId || !destinationUrl) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
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
