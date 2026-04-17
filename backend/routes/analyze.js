const express = require('express');
const { searchAds } = require('../services/adLibrary');
const { analyzeAndGenerateBrief } = require('../services/claude');

const router = express.Router();

router.post('/', async (req, res) => {
  const { photoIds, logoId, brandName, segments, instagramUrl, includeCopy = true, briefing = '' } = req.body;

  if (!photoIds?.length || !brandName || !segments?.length) {
    return res.status(400).json({ error: 'photoIds, brandName e segments são obrigatórios' });
  }

  try {
    const adLibraryAds = await searchAds(segments);
    const { brief, audience } = await analyzeAndGenerateBrief({
      photoIds,
      brandName,
      segments,
      instagramUrl: instagramUrl || '',
      adLibraryAds,
      includeCopy,
      briefing,
    });

    res.json({ brief, audience, adLibraryAds });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
