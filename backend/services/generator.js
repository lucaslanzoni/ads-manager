const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const FORMATS = {
  feed:    { width: 1080, height: 1080,  headlineSize: 96  },
  stories: { width: 1080, height: 1920,  headlineSize: 112 },
};

function toFileUrl(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) throw new Error(`Arquivo não encontrado: ${abs}`);
  return `file://${abs}`;
}

function renderTemplate(html, vars) {
  return html
    .replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
    .replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, inner) =>
      vars[key] ? inner : ''
    );
}

async function generateVariations({ sessionId, variations, photoIds, logoId, palette, fontFamily = 'Inter' }) {
  const outputBase = path.join(__dirname, '../output', sessionId);
  fs.mkdirSync(outputBase, { recursive: true });

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const results = [];

  for (const variation of variations) {
    const photoPath = path.join(__dirname, '../uploads', photoIds[variation.photoIndex] || photoIds[0]);
    const logoPath  = logoId ? path.join(__dirname, '../uploads', logoId) : null;

    for (const [fmt, { width, height, headlineSize }] of Object.entries(FORMATS)) {
      const templatePath = path.join(__dirname, '../templates', `${fmt}.html`);
      const templateHtml = fs.readFileSync(templatePath, 'utf8');

      const overlayGradient = `linear-gradient(to top, rgba(${palette.overlay},${palette.overlayOpacity}) 0%, rgba(${palette.overlay},0) 60%)`;

      const fontSlug = fontFamily.replace(/ /g, '+');
      const fontLink = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${fontSlug}:wght@700&display=swap">`;

      const html = renderTemplate(templateHtml, {
        photo:           toFileUrl(photoPath),
        logo:            logoPath && variation.logoVisible ? toFileUrl(logoPath) : '',
        headline:        variation.headline,
        copy:            variation.copy,
        textColor:       palette.text,
        overlayGradient,
        overlay:         'true',
        headlineSize,
        contentAlign:    { top: 'flex-start', center: 'center', bottom: 'flex-end' }[variation.align] || 'flex-end',
        fontFamily:      `'${fontFamily}', sans-serif`,
        fontLink,
      });

      const tmpHtml = path.join(outputBase, `_tmp_${variation.id}_${fmt}.html`);
      fs.writeFileSync(tmpHtml, html);

      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      await page.goto(`file://${tmpHtml}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.evaluate(() =>
        Promise.all([
          ...Array.from(document.images).map(img =>
            img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
          ),
          document.fonts.ready,
        ])
      );
      fs.unlinkSync(tmpHtml);

      const filename = `${variation.id}_${fmt}.png`;
      const outPath  = path.join(outputBase, filename);
      await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width, height } });

      results.push({ variationId: variation.id, format: fmt, filename, url: `/output/${sessionId}/${filename}` });
    }
  }

  await browser.close();
  return results;
}

module.exports = { generateVariations };
