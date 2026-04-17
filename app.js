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
    card.innerHTML = `<img src="${API}${img.url}" /><div class="ad-card-label"><span class="var">${img.variationId.toUpperCase()}</span><span class="fmt">${img.format}</span></div>`;
    grid.appendChild(card);
  });
}

async function regenerate() {
  setStatus('status-analyze', 'Regenerando artes...');
  await generateImages();
}

// --- Datepicker ---
const calState = {
  start: { date: null, viewing: new Date() },
  end:   { date: null, viewing: new Date() },
};

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DAYS   = ['D','S','T','Q','Q','S','S'];

function renderCalendar(which) {
  const cal     = document.getElementById(`${which}-calendar`);
  const s       = calState[which];
  const viewing = s.viewing;
  const today   = new Date(); today.setHours(0,0,0,0);

  const y = viewing.getFullYear();
  const m = viewing.getMonth();
  const first = new Date(y, m, 1).getDay();
  const days  = new Date(y, m + 1, 0).getDate();

  let html = `
    <div class="cal-header">
      <button class="cal-nav" onclick="shiftMonth('${which}',-1)">‹</button>
      <span>${MONTHS[m]} ${y}</span>
      <button class="cal-nav" onclick="shiftMonth('${which}',1)">›</button>
    </div>
    <div class="cal-grid">
      ${DAYS.map(d => `<div class="cal-day-name">${d}</div>`).join('')}
  `;

  for (let i = 0; i < first; i++) {
    const d = new Date(y, m, -(first - i - 1));
    html += `<div class="cal-day other-month">${d.getDate()}</div>`;
  }

  for (let d = 1; d <= days; d++) {
    const date = new Date(y, m, d);
    const isToday    = date.getTime() === today.getTime();
    const isSelected = s.date && date.getTime() === s.date.getTime();
    const isPast     = which === 'start' && date < today;
    const isBeforeStart = which === 'end' && calState.start.date && date < calState.start.date;
    const disabled   = isPast || isBeforeStart;
    const cls = ['cal-day', isToday && 'today', isSelected && 'selected', disabled && 'disabled'].filter(Boolean).join(' ');
    html += `<div class="${cls}" onclick="selectDate('${which}',${y},${m},${d})">${d}</div>`;
  }

  html += '</div>';
  cal.innerHTML = html;
}

function shiftMonth(which, delta) {
  const s = calState[which];
  s.viewing = new Date(s.viewing.getFullYear(), s.viewing.getMonth() + delta, 1);
  renderCalendar(which);
}

function selectDate(which, y, m, d) {
  const date = new Date(y, m, d);
  calState[which].date = date;

  const label = document.getElementById(`${which}-date-label`);
  label.textContent = date.toLocaleDateString('pt-BR');
  label.classList.remove('placeholder');

  closeCalendars();
  updateTotal();
}

function toggleCalendar(which) {
  const cal    = document.getElementById(`${which}-calendar`);
  const input  = document.getElementById(`${which}-date-input`);
  const isOpen = cal.classList.contains('open');
  closeCalendars();
  if (!isOpen) {
    renderCalendar(which);
    cal.classList.add('open');
    input.classList.add('open');
  }
}

function updateTotal() {
  const budget = parseFloat(document.getElementById('daily-budget').value);
  const start  = calState.start.date;
  const end    = calState.end.date;
  const el     = document.getElementById('total-budget');

  if (!budget || !start || !end) { el.textContent = '—'; el.classList.remove('has-value'); return; }

  const days  = Math.round((end - start) / 86400000) + 1;
  const total = budget * days;

  el.textContent = `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  el.classList.add('has-value');
  el.title = `${days} dia${days > 1 ? 's' : ''} × R$ ${budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function closeCalendars() {
  ['start','end'].forEach(w => {
    document.getElementById(`${w}-calendar`)?.classList.remove('open');
    document.getElementById(`${w}-date-input`)?.classList.remove('open');
  });
}

document.addEventListener('click', e => {
  if (!e.target.closest('.datepicker-wrap')) closeCalendars();
});

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
  const startDate   = calState.start.date;
  const endDate     = calState.end.date;
  const brandName   = document.getElementById('brand-name').value.trim();

  if (!pageId)      return setStatus('status-publish', 'Informe o Page ID.', 'error');
  if (!dailyBudget) return setStatus('status-publish', 'Informe o orçamento diário.', 'error');
  if (!startDate || !endDate) return setStatus('status-publish', 'Selecione as datas de veiculação.', 'error');

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
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
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
