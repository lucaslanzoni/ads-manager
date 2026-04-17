const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function luminance(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0,2),16)/255;
  const g = parseInt(h.slice(2,4),16)/255;
  const b = parseInt(h.slice(4,6),16)/255;
  return 0.2126*r + 0.7152*g + 0.0722*b;
}

// Com overlay escuro, o fundo efetivo fica mais escuro — texto branco quase sempre correto.
// Sem overlay ou fundo claro, usa preto para garantir contraste.
function contrastColor(primaryHex, overlayOpacity) {
  const lum = luminance(primaryHex || '#000000');
  const opacity = parseFloat(overlayOpacity || 0);
  const effectiveLum = lum * (1 - opacity);
  return effectiveLum > 0.35 ? '#0a0a0c' : '#ffffff';
}

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

async function analyzeAndGenerateBrief({ photoIds, brandName, segments, instagramUrl, adLibraryAds, includeCopy = true, briefing = '' }) {
  const images = photoContent(photoIds);

  const briefingContext = briefing ? `\n\nBriefing da campanha fornecido pelo cliente:\n"${briefing}"` : '';
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

Analise as fotos acima para a marca "${brandName}" (segmentos: ${segments.join(', ')}, Instagram: ${instagramUrl}).${briefingContext}${adExamples}

${includeCopy ? '' : 'IMPORTANTE: NÃO inclua headline nem copy nas variações — as peças serão somente foto. Deixe headline e copy como strings vazias.\n\n'}Para cada foto, analise ONDE está o sujeito principal (produto, pessoa, objeto) e identifique a ÁREA LIVRE — região sem elementos visuais importantes onde o texto pode aparecer sem sobrepor nada.

Retorne EXATAMENTE este JSON (sem markdown, sem explicações):
{
  "audience": {
    "ageMin": 18,
    "ageMax": 45,
    "genders": ["all"],
    "interests": ["interesse 1", "interesse 2", "interesse 3"],
    "summary": "Texto descritivo em português explicando o público sugerido e o raciocínio por trás da segmentação."
  },
  "palette": { "primary": "#hex", "text": "#hex", "overlay": "0,0,0", "overlayOpacity": "0.4" },
  "variations": [
    {
      "id": "v1",
      "photoIndex": 0,
      "headline": "...",
      "copy": "...",
      "caption": "...",
      "align": "bottom",
      "logoVisible": true
    },
    {
      "id": "v2",
      "photoIndex": 1,
      "headline": "...",
      "copy": "...",
      "caption": "...",
      "align": "bottom",
      "logoVisible": false
    }
  ]
}

Regras CRÍTICAS de posicionamento:
- align: escolha onde há ÁREA LIVRE na foto (sem sujeito, sem elemento visual importante)
  - "top" → sujeito principal está na metade inferior da foto
  - "bottom" → sujeito principal está na metade superior da foto
  - "center" → sujeito principal está nas laterais ou nos cantos
- NUNCA escolha "bottom" se o sujeito ou produto estiver na parte inferior
- NUNCA escolha "top" se o sujeito estiver na parte superior
- logoVisible: false se não houver área limpa suficiente para o logo sem sobrepor o sujeito
- photoIndex: índice da melhor foto para cada variação (0-based, máximo ${photoIds.length - 1})
- headline: máximo 6 palavras, impactante
- copy: máximo 12 palavras, complementa a headline
- caption: legenda do post no feed, máximo 280 caracteres, tom adequado ao segmento, inclua hashtags relevantes e emojis se adequado
- Se não houver fotos suficientes para 2 variações diferentes, repita o índice 0
- overlayOpacity entre 0.2 e 0.6 dependendo do contraste necessário`,
        },
      ],
    }],
  });

  const text   = response.content[0].text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
  const parsed = JSON.parse(text);

  // garante contraste mínimo entre texto e fundo
  parsed.palette.text = contrastColor(parsed.palette.primary, parsed.palette.overlayOpacity);

  return { brief: { palette: parsed.palette, variations: parsed.variations }, audience: parsed.audience };
}

module.exports = { analyzeAndGenerateBrief };
