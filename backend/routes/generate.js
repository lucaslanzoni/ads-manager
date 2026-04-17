const express = require('express');
const crypto  = require('crypto');
const { generateVariations } = require('../services/generator');

const router = express.Router();

router.post('/', async (req, res) => {
  const { brief, photoIds, logoId, fontFamily } = req.body;

  if (!brief || !photoIds?.length) {
    return res.status(400).json({ error: 'brief e photoIds são obrigatórios' });
  }

  try {
    const sessionId = crypto.randomUUID();
    const images = await generateVariations({
      sessionId,
      variations: brief.variations,
      photoIds,
      logoId: logoId || null,
      palette: brief.palette,
      fontFamily: fontFamily || 'Inter',
    });

    res.json({ sessionId, images });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
