const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function toBase64(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(__dirname, '..', filePath);
  return fs.readFileSync(abs).toString('base64');
}

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

function photoContent(photoIds) {
  return photoIds.map(id => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: MIME[path.extname(id).toLowerCase()] || 'image/jpeg',
      data: toBase64(path.join(__dirname, '../uploads', id)),
    },
  }));
}

async function analyzeAndGenerateBrief({ photoIds, brandName, segments, instagramUrl, adLibraryAds }) {
  const images = photoContent(photoIds);

  const adExamples = adLibraryAds.length > 0
    ? `\n\nAnúncios em destaque na Biblioteca de Anúncios do Facebook para os segmentos ${segments.join(', ')}:\n${adLibraryAds.map((a, i) => `${i + 1}. Body: "${a.ad_creative_bodies?.[0] ?? ''}" | CTA: "${a.call_to_action_types?.[0] ?? ''}" | Título: "${a.ad_creative_link_titles?.[0] ?? ''}"`).join('\n')}`
    : '';

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        ...images,
        {
          type: 'text',
          text: `Você é um especialista em mídia paga e criação de anúncios para Instagram e Facebook.

Analise as fotos acima para a marca "${brandName}" (segmentos: ${segments.join(', ')}, Instagram: ${instagramUrl}).${adExamples}

Retorne EXATAMENTE este JSON (sem markdown, sem explicações):
{
  "palette": { "primary": "#hex", "text": "#hex", "overlay": "0,0,0", "overlayOpacity": "0.4" },
  "variations": [
    {
      "id": "v1",
      "photoIndex": 0,
      "headline": "...",
      "copy": "...",
      "align": "bottom",
      "logoVisible": true
    },
    {
      "id": "v2",
      "photoIndex": 1,
      "headline": "...",
      "copy": "...",
      "align": "bottom",
      "logoVisible": false
    }
  ]
}

Regras:
- photoIndex: índice da melhor foto para cada variação (0-based, máximo ${photoIds.length - 1})
- align: "top", "center" ou "bottom" dependendo do espaço livre na foto
- headline: máximo 6 palavras, impactante
- copy: máximo 12 palavras, complementa a headline
- Se não houver foto suficiente para 2 variações diferentes, repita o índice 0
- overlayOpacity entre 0.2 e 0.6 dependendo do contraste necessário`,
        },
      ],
    }],
  });

  const text = response.content[0].text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
  return JSON.parse(text);
}

module.exports = { analyzeAndGenerateBrief };
