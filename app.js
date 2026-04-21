// Static-site viewer for GeoPrivacy clue segmentations.
// No build tools. Just fetch index.json, then per-sample data.json.

const state = {
  samples: [],
  current: null,
  currentPath: null,
  activeClueId: null,
  stickyClue: null,
  showAll: false,
  overlayAlpha: 0.7,
};

const el = {
  thumbStrip:     document.getElementById('thumbStrip'),
  sampleCount:    document.getElementById('sampleCount'),
  stage:          document.getElementById('stage'),
  stageImage:     document.getElementById('stageImage'),
  stageOverlay:   document.getElementById('stageOverlay'),
  imgCaption:     document.getElementById('imgCaption'),
  reasoningText:  document.getElementById('reasoningText'),
  metaRow:        document.getElementById('metaRow'),
  clueList:       document.getElementById('clueList'),
  opacityRange:   document.getElementById('opacityRange'),
  opacityValue:   document.getElementById('opacityValue'),
  showAllToggle:  document.getElementById('showAllToggle'),
  buildDate:      document.getElementById('buildDate'),
};

el.buildDate.textContent = new Date().toISOString().slice(0, 10);

// ---------- bootstrap ----------
fetch('index.json')
  .then(r => r.json())
  .then(idx => {
    state.samples = idx.samples || [];
    el.sampleCount.textContent = `${state.samples.length} total`;
    renderStrip();
    if (state.samples.length) loadSample(state.samples[0]);
  })
  .catch(() => {
    el.reasoningText.textContent =
      'Failed to load index.json — serve this folder via a local HTTP server or GitHub Pages (not file://).';
  });

function renderStrip() {
  el.thumbStrip.innerHTML = '';
  state.samples.forEach((s, i) => {
    const node = document.createElement('div');
    node.className = 'thumb';
    node.dataset.id = s.id;
    node.innerHTML = `
      <div class="thumb-num">${String(i + 1).padStart(2, '0')}</div>
      <img src="${s.thumbnail}" alt="" loading="lazy">
    `;
    node.addEventListener('click', () => loadSample(s));
    el.thumbStrip.appendChild(node);
  });
}

function markActiveThumb(id) {
  el.thumbStrip.querySelectorAll('.thumb').forEach(n => {
    n.classList.toggle('active', n.dataset.id === id);
  });
}

// ---------- sample load ----------
function loadSample(sampleMeta) {
  markActiveThumb(sampleMeta.id);
  state.currentPath = sampleMeta.path;
  state.activeClueId = null;
  state.stickyClue = null;

  fetch(`${sampleMeta.path}/data.json`)
    .then(r => r.json())
    .then(data => {
      state.current = data;
      renderSample(data, sampleMeta);
    });
}

function renderSample(data, meta) {
  el.stageImage.onload = () => positionOverlay();
  el.stageImage.src = `${meta.path}/${data.image}`;
  el.stageImage.alt = data.image_id;

  el.imgCaption.textContent = `${data.image_id}  ·  ${data.width} × ${data.height}`;
  el.reasoningText.textContent = data.reasoning || '(no reasoning available)';

  // Meta row
  const rows = [];
  const loc = data.location_estimate;
  if (loc) {
    rows.push(
      `<div class="meta-item"><strong>Predicted</strong>${escapeHtml(loc.region || '—')} (${fmtLatLon(loc.latitude, loc.longitude)})</div>`
    );
    if (loc.confidence)
      rows.push(`<div class="meta-item"><strong>Confidence</strong>${escapeHtml(loc.confidence)}</div>`);
  }
  const gt = data.ground_truth;
  if (gt && gt.lat !== undefined && gt.lat !== null) {
    rows.push(`<div class="meta-item"><strong>Ground Truth</strong>${fmtLatLon(gt.lat, gt.lon)}</div>`);
  }
  rows.push(`<div class="meta-item"><strong>Clues</strong>${data.clues.length}</div>`);
  el.metaRow.innerHTML = rows.join('');

  // Clue list
  el.clueList.innerHTML = '';
  data.clues.forEach(c => {
    const li = document.createElement('li');
    li.className = 'clue';
    li.dataset.id = c.id;
    const levelTag = c.level && c.level !== 'unknown'
      ? `<span class="tag level-${c.level}">${c.level}</span>` : '';
    const conceptTag = c.target_concept
      ? `<span class="tag">${escapeHtml(c.target_concept)}</span>` : '';
    li.innerHTML = `
      <span class="clue-swatch" style="background:${c.color}"></span>
      <div class="clue-body">
        <p class="clue-title">${escapeHtml(c.object_description || '(unnamed clue)')}</p>
        ${c.geolocation_element ? `<p class="clue-sub">${escapeHtml(c.geolocation_element)}</p>` : ''}
        <div class="clue-tags">${levelTag}${conceptTag}</div>
      </div>
    `;
    li.addEventListener('mouseenter', () => setActiveClue(c.id));
    li.addEventListener('mouseleave', () => {
      if (!state.stickyClue) setActiveClue(null);
    });
    li.addEventListener('click', () => {
      state.stickyClue = state.stickyClue === c.id ? null : c.id;
      setActiveClue(state.stickyClue || c.id);
    });
    el.clueList.appendChild(li);
  });

  setActiveClue(null);
}

// ---------- overlay rendering ----------
function positionOverlay() {
  const img = el.stageImage;
  const stage = el.stage;
  const sRect = stage.getBoundingClientRect();
  const iRect = img.getBoundingClientRect();
  el.stageOverlay.style.left = `${iRect.left - sRect.left}px`;
  el.stageOverlay.style.top = `${iRect.top - sRect.top}px`;
  el.stageOverlay.style.width = `${iRect.width}px`;
  el.stageOverlay.style.height = `${iRect.height}px`;
  updateOverlayLayers();
}
window.addEventListener('resize', () => {
  if (state.current) positionOverlay();
});

function setActiveClue(clueId) {
  state.activeClueId = clueId;
  el.clueList.querySelectorAll('.clue').forEach(li => {
    li.classList.toggle('active', li.dataset.id === clueId);
  });
  updateOverlayLayers();
}

function updateOverlayLayers() {
  if (!state.current) return;
  const clues = state.current.clues;
  const path = state.currentPath;
  let visible;
  if (state.showAll) visible = clues;
  else if (state.activeClueId) visible = clues.filter(c => c.id === state.activeClueId);
  else visible = [];

  // Always clear child layers and shorthand masks first
  el.stageOverlay.innerHTML = '';
  el.stageOverlay.style.background = 'transparent';
  el.stageOverlay.style.webkitMaskImage = 'none';
  el.stageOverlay.style.maskImage = 'none';

  if (!visible.length) {
    el.stageOverlay.classList.remove('on');
    return;
  }

  el.stageOverlay.classList.add('on');
  el.stageOverlay.style.setProperty('--overlay-alpha', state.overlayAlpha);

  // Render each visible clue as its own absolutely-positioned child layer so
  // every layer can carry its own mask-image. CSS mask chains aren't universally
  // supported; stacked child divs are the most reliable approach.
  visible.forEach(c => {
    const layer = document.createElement('div');
    layer.style.position = 'absolute';
    layer.style.inset = '0';
    layer.style.background = c.color;
    layer.style.opacity = String(state.overlayAlpha);
    layer.style.mixBlendMode = 'multiply';
    const url = `url("${path}/${c.mask}")`;
    layer.style.webkitMaskImage = url;
    layer.style.maskImage = url;
    layer.style.webkitMaskSize = '100% 100%';
    layer.style.maskSize = '100% 100%';
    layer.style.webkitMaskRepeat = 'no-repeat';
    layer.style.maskRepeat = 'no-repeat';
    el.stageOverlay.appendChild(layer);
  });
}

// ---------- controls ----------
el.opacityRange.addEventListener('input', (e) => {
  state.overlayAlpha = Number(e.target.value) / 100;
  el.opacityValue.textContent = `${e.target.value}%`;
  updateOverlayLayers();
});
el.showAllToggle.addEventListener('change', (e) => {
  state.showAll = e.target.checked;
  updateOverlayLayers();
});

// ---------- helpers ----------
function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
function fmtLatLon(lat, lon) {
  if (lat === undefined || lon === undefined || lat === null) return '—';
  return `${Number(lat).toFixed(3)}, ${Number(lon).toFixed(3)}`;
}
