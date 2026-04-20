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
  initFontPicker();
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('start-date').min = today;
  document.getElementById('end-date').min   = today;
});

document.addEventListener('click', e => {
  if (!e.target.closest('#font-picker')) {
    document.getElementById('font-dropdown')?.classList.remove('open');
    document.getElementById('font-trigger')?.classList.remove('open');
  }
});

const FONTS = [
  // Sans-serif
  'Inter','Roboto','Open Sans','Lato','Montserrat','Poppins','Raleway','Work Sans',
  'DM Sans','Space Grotesk','Syne','Plus Jakarta Sans','Bricolage Grotesque','Urbanist',
  'Nunito','Nunito Sans','Manrope','Outfit','Figtree','Mulish','Cabin','Quicksand',
  'Josefin Sans','Source Sans 3','PT Sans','Barlow','IBM Plex Sans','Kanit',
  // Condensadas / Display
  'Roboto Condensed','Barlow Condensed','Oswald','Exo 2','Bebas Neue','Fjalla One',
  'Archivo Black','Teko','Antonio','Big Shoulders Display','Unbounded','Chakra Petch',
  'Titillium Web','Rajdhani',
  // Serifadas
  'Playfair Display','Merriweather','Lora','EB Garamond','Libre Baskerville',
  'Cormorant Garamond','Crimson Pro','Spectral','Bitter','Cardo',
  'DM Serif Display','Fraunces','Cinzel',
  // Script / Cursiva
  'Dancing Script','Pacifico','Caveat','Lobster','Permanent Marker',
];

let state = {
  photoIds: [],
  logoId: null,
  brief: null,
  sessionId: null,
  images: [],
  fontFamily: 'Inter',
};

let fontPickerReady = false;

function initFontPicker() {
  const list = document.getElementById('font-list');
  if (!list || fontPickerReady) return;
  list.innerHTML = FONTS.map(f =>
    `<div class="font-option${f === state.fontFamily ? ' selected' : ''}" style="font-family:'${f}',sans-serif" data-font="${f}" onclick="selectFont('${f}')">${f}</div>`
  ).join('');
  fontPickerReady = true;
}

function toggleFontDropdown() {
  const dropdown = document.getElementById('font-dropdown');
  const trigger  = document.getElementById('font-trigger');
  const isOpen   = dropdown.classList.contains('open');
  if (isOpen) {
    dropdown.classList.remove('open');
    trigger.classList.remove('open');
  } else {
    initFontPicker();
    dropdown.classList.add('open');
    trigger.classList.add('open');
    setTimeout(() => document.getElementById('font-search')?.focus(), 50);
  }
}

function filterFonts(q) {
  const search = q.toLowerCase();
  document.querySelectorAll('.font-option').forEach(el => {
    el.classList.toggle('hidden', !el.dataset.font.toLowerCase().includes(search));
  });
}

function selectFont(name) {
  state.fontFamily = name;
  document.getElementById('font-search').value = '';
  const triggerName = document.getElementById('font-trigger-name');
  triggerName.textContent = name;
  triggerName.style.fontFamily = `'${name}', sans-serif`;
  document.querySelectorAll('.font-option').forEach(el =>
    el.classList.toggle('selected', el.dataset.font === name)
  );
  document.getElementById('font-dropdown').classList.remove('open');
  document.getElementById('font-trigger').classList.remove('open');
  filterFonts('');
}

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
  const el   = document.getElementById(id);
  const text = document.getElementById(id + '-text');
  if (text) text.textContent = msg;
  else el.textContent = msg;
  el.className = 'status' + (type ? ' ' + type : '') + (msg && !type ? ' loading' : '');
  if (type) el.classList.remove('loading');
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
    body: JSON.stringify({ brief: state.brief, photoIds: state.photoIds, logoId: state.logoId, includeCopy: state.includeCopy, fontFamily: state.fontFamily }),
  });
  const generated = await genRes.json();

  if (generated.error) {
    setStatus('status-analyze', generated.error, 'error');
    document.getElementById('btn-analyze').disabled = false;
    return;
  }

  state.sessionId  = generated.sessionId;
  state.images     = generated.images;
  state.imageData  = {};

  await Promise.all(generated.images.map(async img => {
    const r = await fetch(`${API}${img.url}`);
    const blob = await r.blob();
    const b64 = await new Promise(res => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });
    state.imageData[img.filename] = b64;
  }));

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
    card.innerHTML = `<img src="${API}${img.url}" /><div class="ad-card-label"><span class="var">${img.variationId.toUpperCase()}</span><span class="fmt">${img.format}</span></div>`;
    grid.appendChild(card);
  });

  // Render caption editors (one per unique variation)
  const seen = new Set();
  const variations = state.brief?.variations || [];
  const captionsEl = document.getElementById('captions-section');
  captionsEl.innerHTML = '';

  variations.forEach(v => {
    if (seen.has(v.id)) return;
    seen.add(v.id);
    const caption = v.caption || '';
    const block = document.createElement('div');
    block.className = 'caption-block';
    block.innerHTML = `
      <div class="caption-label">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3.5h9M2 6.5h7M2 9.5h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        Legenda <span class="var-badge">${v.id.toUpperCase()}</span>
      </div>
      <textarea class="caption-textarea" id="caption-${v.id}" maxlength="2200" oninput="updateCharCount('${v.id}',this.value)">${caption}</textarea>
      <div class="caption-char-count" id="caption-count-${v.id}">${caption.length} / 280</div>
    `;
    captionsEl.appendChild(block);
  });
}

function updateCharCount(id, value) {
  const el = document.getElementById(`caption-count-${id}`);
  if (!el) return;
  el.textContent = `${value.length} / 280`;
  el.classList.toggle('over', value.length > 280);
}

async function regenerate() {
  setStatus('status-analyze', 'Regenerando artes...');
  await generateImages();
}

// --- Date inputs ---
function onStartDateChange() {
  const startVal = document.getElementById('start-date').value;
  const endInput = document.getElementById('end-date');
  if (startVal) endInput.min = startVal;
  if (endInput.value && endInput.value < startVal) endInput.value = '';
  updateTotal();
}

function updateTotal() {
  const budget   = parseFloat(document.getElementById('daily-budget').value);
  const startVal = document.getElementById('start-date').value;
  const endVal   = document.getElementById('end-date').value;
  const el       = document.getElementById('total-budget');

  if (!budget || !startVal || !endVal) { el.textContent = '—'; el.classList.remove('has-value'); return; }

  const start = new Date(startVal);
  const end   = new Date(endVal);
  const days  = Math.round((end - start) / 86400000) + 1;
  const total = budget * days;

  el.textContent = `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  el.classList.add('has-value');
  el.title = `${days} dia${days > 1 ? 's' : ''} × R$ ${budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
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
  const pageId         = document.getElementById('page-id').value.trim();
  const destinationUrl = document.getElementById('destination-url').value.trim();
  const network        = document.getElementById('network').value;
  const dailyBudget    = parseFloat(document.getElementById('daily-budget').value);
  const startVal       = document.getElementById('start-date').value;
  const endVal         = document.getElementById('end-date').value;
  const brandName      = document.getElementById('brand-name').value.trim();

  if (!pageId)            return setStatus('status-publish', 'Informe o Page ID.', 'error');
  if (!destinationUrl)    return setStatus('status-publish', 'Informe a URL de destino.', 'error');
  if (!dailyBudget)       return setStatus('status-publish', 'Informe o orçamento diário.', 'error');
  if (!startVal || !endVal) return setStatus('status-publish', 'Selecione as datas de veiculação.', 'error');

  const startDate = new Date(startVal);
  const endDate   = new Date(endVal);

  document.getElementById('btn-publish').disabled = true;
  setStatus('status-publish', 'Publicando campanha no Meta Ads...');

  const captions = {};
  (state.brief?.variations || []).forEach(v => {
    const el = document.getElementById(`caption-${v.id}`);
    captions[v.id] = el ? el.value.trim() : (v.caption || '');
  });

  const res = await fetch(`${API}/api/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: state.sessionId,
      images: state.images,
      imageData: state.imageData,
      brief: state.brief,
      brandName,
      network,
      dailyBudget,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      pageId,
      destinationUrl,
      captions,
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
