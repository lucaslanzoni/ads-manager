const API = 'https://ads-manager-6ijz.onrender.com';

function toggleSegment(el) {
  const cb = el.querySelector('input[type="checkbox"]');
  cb.checked = !cb.checked;
  el.classList.toggle('selected', cb.checked);
}

function toggleCopy(el) {
  const cb = el.querySelector('input[type="checkbox"]');
  cb.checked = !cb.checked;
  el.classList.toggle('selected', cb.checked);
  el.querySelector('span').textContent = cb.checked
    ? 'Incluir headline e copy nas artes'
    : 'Somente foto — sem texto na peça';
}

// inicia o toggle de copy como selecionado (checked por padrão)
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('include-copy-toggle').classList.add('selected');
});

let state = {
  photoIds: [],
  logoId: null,
  brief: null,
  sessionId: null,
  images: [],
};

// Preview de fotos
document.getElementById('photos-input').addEventListener('change', e => {
  const grid = document.getElementById('photos-preview');
  grid.innerHTML = '';
  Array.from(e.target.files).forEach(file => {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    grid.appendChild(img);
  });
});

document.getElementById('logo-input').addEventListener('change', e => {
  const preview = document.getElementById('logo-preview');
  preview.innerHTML = '';
  if (e.target.files[0]) {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(e.target.files[0]);
    img.style.cssText = 'height:60px;margin-top:8px;';
    preview.appendChild(img);
  }
});

function setStatus(id, msg, type = '') {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = 'status ' + type;
}

async function startAnalysis() {
  const brandName    = document.getElementById('brand-name').value.trim();
  const segments     = Array.from(document.querySelectorAll('#segments input:checked')).map(o => o.value);
  const instagramUrl = document.getElementById('instagram-url').value.trim();
  const photosInput  = document.getElementById('photos-input');
  const logoInput    = document.getElementById('logo-input');

  if (!brandName)          return setStatus('status-analyze', 'Informe o nome da marca.', 'error');
  if (!segments.length)    return setStatus('status-analyze', 'Selecione ao menos um segmento.', 'error');
  if (!photosInput.files.length) return setStatus('status-analyze', 'Selecione ao menos uma foto.', 'error');

  document.getElementById('btn-analyze').disabled = true;
  setStatus('status-analyze', 'Enviando arquivos...');

  const formData = new FormData();
  Array.from(photosInput.files).forEach(f => formData.append('photos', f));
  if (logoInput.files[0]) formData.append('logo', logoInput.files[0]);

  const uploadRes = await fetch(`${API}/api/upload`, { method: 'POST', body: formData });
  const uploaded  = await uploadRes.json();

  state.photoIds    = uploaded.photos.map(p => p.id);
  state.logoId      = uploaded.logo?.id || null;
  state.includeCopy = document.getElementById('include-copy').checked;

  const briefing = document.getElementById('briefing').value.trim();

  setStatus('status-analyze', 'Analisando fotos e biblioteca de anúncios...');

  const analyzeRes = await fetch(`${API}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photoIds: state.photoIds, logoId: state.logoId, brandName, segments, instagramUrl, includeCopy: state.includeCopy, briefing }),
  });
  const analyzed = await analyzeRes.json();

  if (analyzed.error) {
    setStatus('status-analyze', analyzed.error, 'error');
    document.getElementById('btn-analyze').disabled = false;
    return;
  }

  state.brief    = analyzed.brief;
  state.audience = analyzed.audience || null;
  setStatus('status-analyze', 'Gerando artes...');

  await generateImages();
}

async function generateImages() {
  const genRes = await fetch(`${API}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brief: state.brief, photoIds: state.photoIds, logoId: state.logoId, includeCopy: state.includeCopy }),
  });
  const generated = await genRes.json();

  if (generated.error) {
    setStatus('status-analyze', generated.error, 'error');
    document.getElementById('btn-analyze').disabled = false;
    return;
  }

  state.sessionId = generated.sessionId;
  state.images    = generated.images;

  renderPreviews(generated.images);
  document.getElementById('step-previews').style.display = 'block';
  document.getElementById('btn-analyze').disabled = false;
  setStatus('status-analyze', '', 'success');
  document.getElementById('step-previews').scrollIntoView({ behavior: 'smooth' });
}

function renderPreviews(images) {
  const grid = document.getElementById('ads-grid');
  grid.innerHTML = '';
  images.forEach(img => {
    const card = document.createElement('div');
    card.className = 'ad-card';
    card.innerHTML = `<img src="${API}${img.url}" /><div class="label">${img.variationId.toUpperCase()} · ${img.format}</div>`;
    grid.appendChild(card);
  });
}

async function regenerate() {
  setStatus('status-analyze', 'Regenerando artes...');
  await generateImages();
}

function showPublish() {
  if (state.audience) {
    const box = document.getElementById('audience-suggestion');
    box.textContent = state.audience.summary;
    document.getElementById('audience-suggestion-field').style.display = 'block';
  }
  document.getElementById('step-publish').style.display = 'block';
  document.getElementById('step-publish').scrollIntoView({ behavior: 'smooth' });
}

async function publishAds() {
  const pageId      = document.getElementById('page-id').value.trim();
  const network     = document.getElementById('network').value;
  const dailyBudget = parseFloat(document.getElementById('daily-budget').value);
  const startDate   = document.getElementById('start-date').value;
  const endDate     = document.getElementById('end-date').value;
  const brandName   = document.getElementById('brand-name').value.trim();

  if (!pageId)      return setStatus('status-publish', 'Informe o Page ID.', 'error');
  if (!dailyBudget) return setStatus('status-publish', 'Informe o orçamento diário.', 'error');
  if (!startDate || !endDate) return setStatus('status-publish', 'Informe as datas de veiculação.', 'error');

  document.getElementById('btn-publish').disabled = true;
  setStatus('status-publish', 'Publicando campanha no Meta Ads...');

  const res = await fetch(`${API}/api/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: state.sessionId,
      images: state.images,
      brief: state.brief,
      brandName,
      network,
      dailyBudget,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      pageId,
    }),
  });

  const result = await res.json();

  if (result.error) {
    setStatus('status-publish', result.error, 'error');
    document.getElementById('btn-publish').disabled = false;
    return;
  }

  setStatus('status-publish', `Campanha criada com sucesso! ID: ${result.campaignId}`, 'success');
}
