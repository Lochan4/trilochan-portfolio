'use strict';

/* ================================================================
   DOM REFERENCES
================================================================ */

const heroEl     = document.getElementById('hero');
const heroCanvas = document.getElementById('heroCanvas');
const heroInfo   = document.getElementById('heroInfo');
const cardsTrack = document.getElementById('cardsTrack');
const cardsScene = document.getElementById('cardsScene');
const cardsRail  = document.getElementById('cardsRail');

/* ================================================================
   HERO: WebGL Wave Beam

   Simplified shader — no procedural texture. Just a white sine-bell
   glow band sweeping left→right on black. The name letters and info
   list characters are revealed by JS-driven color inversion synced
   to the same wave position.
================================================================ */

let gl, ditherProgram;
let uWave, uScroll;
let ditherRafId;
let ditherT     = 0;
let scrollBlend = 0;

const VS = `
  attribute vec2 a_pos;
  varying   vec2 v_uv;
  void main(){
    v_uv        = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }`;

const FS = `
  precision mediump float;
  varying vec2  v_uv;
  uniform float u_wave;
  uniform float u_scroll;

  void main(){
    float ww   = 0.28;
    float rp   = v_uv.y * 0.06;
    float d    = (v_uv.x + rp) - (u_wave - ww);
    float beam = (d >= 0.0 && d <= ww) ? sin((d/ww)*3.14159) : 0.0;

    float fade = max(0.0, 1.0 - u_scroll * 2.5);
    float glow = beam * 0.18 * fade;

    gl_FragColor = vec4(glow, glow, glow, 1.0);
  }`;

function initDitherShader() {
  const w   = heroEl.offsetWidth;
  const h   = heroEl.offsetHeight;
  const dpr = window.devicePixelRatio || 1;

  heroCanvas.width        = w * dpr;
  heroCanvas.height       = h * dpr;
  heroCanvas.style.width  = w + 'px';
  heroCanvas.style.height = h + 'px';

  gl = heroCanvas.getContext('webgl') ||
       heroCanvas.getContext('experimental-webgl');
  if (!gl) return;

  function makeShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }

  ditherProgram = gl.createProgram();
  gl.attachShader(ditherProgram, makeShader(gl.VERTEX_SHADER,   VS));
  gl.attachShader(ditherProgram, makeShader(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(ditherProgram);
  gl.useProgram(ditherProgram);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

  const loc = gl.getAttribLocation(ditherProgram, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  uWave   = gl.getUniformLocation(ditherProgram, 'u_wave');
  uScroll = gl.getUniformLocation(ditherProgram, 'u_scroll');
}

/* ================================================================
   HERO LETTERS: wave-synced color inversion
   White (#fff) letters turn black as the wave crest passes over them.
================================================================ */

let heroLetterEls = [];
let letterNormX   = [];

function cacheLetterPositions() {
  const W = window.innerWidth;
  letterNormX = heroLetterEls.map(el => {
    const r = el.getBoundingClientRect();
    return (r.left + r.width * 0.5) / W;
  });
}

/* ================================================================
   HERO INFO LIST: wave-synced color inversion
   Each character gets the same white→black inversion as the name.
   Uses both normX and normY so the wave diagonal matches the shader.
================================================================ */

let infoCharEls = [];
let infoCharPos = []; // { normX, normY }

function buildHeroInfo() {
  if (!heroInfo || typeof infoItems === 'undefined') return;
  infoItems.forEach(item => {
    const line = document.createElement('div');
    line.className = 'hero-info-item';
    [...item].forEach(char => {
      const span = document.createElement('span');
      span.textContent = char;
      line.appendChild(span);
      infoCharEls.push(span);
    });
    heroInfo.appendChild(line);
  });
}

function cacheInfoCharPositions() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  infoCharPos = infoCharEls.map(el => {
    const r = el.getBoundingClientRect();
    return {
      normX: (r.left + r.width * 0.5) / W,
      normY: (r.top  + r.height * 0.5) / H,
    };
  });
}

/* ================================================================
   RENDER LOOP
   All effects share one rAF loop: wave beam (WebGL),
   name letter inversion (DOM), info list inversion (DOM).
================================================================ */

function ditherRender() {
  ditherRafId = requestAnimationFrame(ditherRender);
  if (!gl) return;
  ditherT++;

  const WAVE_W  = 0.28;
  const wavePos = (ditherT * 0.005) % (1 + WAVE_W);

  // --- Wave beam (GPU) ---
  gl.viewport(0, 0, heroCanvas.width, heroCanvas.height);
  gl.uniform1f(uWave,   wavePos);
  gl.uniform1f(uScroll, scrollBlend);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // --- Name letter inversion ---
  if (heroLetterEls.length) {
    const rp = 0.03; // y ≈ 0.5, so rp = 0.5 * 0.06
    heroLetterEls.forEach((el, i) => {
      const d    = (letterNormX[i] + rp) - (wavePos - WAVE_W);
      const lift = (d >= 0.0 && d <= WAVE_W) ? Math.sin((d / WAVE_W) * Math.PI) : 0.0;
      const v    = Math.round(255 * (1.0 - lift));
      el.style.color = `rgb(${v},${v},${v})`;
    });
  }

  // --- Info list letter inversion ---
  if (infoCharPos.length) {
    infoCharEls.forEach((el, i) => {
      const { normX, normY } = infoCharPos[i];
      const rp   = normY * 0.06;
      const d    = (normX + rp) - (wavePos - WAVE_W);
      const lift = (d >= 0.0 && d <= WAVE_W) ? Math.sin((d / WAVE_W) * Math.PI) : 0.0;
      const v    = Math.round(255 * (1.0 - lift));
      el.style.color = `rgb(${v},${v},${v})`;
    });
  }
}

/* ================================================================
   HORIZONTAL CARDS SECTION

   Vertical scroll within .cards-track maps to horizontal translation
   of .cards-rail. Per-card rotateY() adds perspective depth based on
   each card's offset from the viewport center.
================================================================ */

let cardEls       = [];
let cardsTrackTop = 0;
const PAD_SCREENS = 0.4;

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function buildCards() {
  const totalStr = String(content.length).padStart(2, '0');
  content.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    if (item.url) card.dataset.url = item.url;

    card.innerHTML = `
      <div class="card-face">
        <span class="card-label">${escHtml(item.label)}</span>
        <div class="card-body">
          <h2 class="card-heading">${escHtml(item.heading)}</h2>
          <p class="card-text">${escHtml(item.body)}</p>
        </div>
        <span class="card-num">${String(i + 1).padStart(2, '0')} / ${totalStr}</span>
      </div>
    `;

    card.addEventListener('click', () => {
      const url = card.dataset.url;
      if (!url) return;
      setTimeout(() => window.open(url, '_blank', 'noopener,noreferrer'), 180);
    });

    cardsRail.appendChild(card);
    cardEls.push(card);
  });
}

function setRailCenterPadding() {
  if (window.innerWidth <= 768 || !cardEls.length) return;
  const cardW = cardEls[0].offsetWidth;
  const pad   = Math.max(0, (window.innerWidth - cardW) / 2);
  cardsRail.style.paddingLeft  = pad + 'px';
  cardsRail.style.paddingRight = pad + 'px';
}

function setCardsTrackHeight() {
  if (window.innerWidth <= 768) {
    cardsTrack.style.height = 'auto';
    return;
  }
  const railW    = cardsRail.scrollWidth;
  const overflow = Math.max(0, railW - window.innerWidth);
  const totalH   = overflow + window.innerHeight * (1 + PAD_SCREENS * 2);
  cardsTrack.style.height = totalH + 'px';
}

function recalcCardsTrackTop() {
  cardsTrackTop = cardsTrack.getBoundingClientRect().top + window.scrollY;
}

let cardsRafScheduled = false;

function updateCards() {
  cardsRafScheduled = false;
  if (window.innerWidth <= 768) return;

  const relScroll  = window.scrollY - cardsTrackTop;
  const railW      = cardsRail.scrollWidth;
  const maxTx      = Math.max(0, railW - window.innerWidth);
  const trackH     = parseFloat(cardsTrack.style.height) || 0;
  const scrollable = trackH - window.innerHeight;

  const padPx    = window.innerHeight * PAD_SCREENS;
  const inner    = scrollable - padPx * 2;
  const raw      = inner > 0 ? (relScroll - padPx) / inner : 0;
  const progress = Math.max(0, Math.min(raw, 1));
  const tx       = -(progress * maxTx);

  cardsRail.style.transform = `translateX(${tx.toFixed(1)}px)`;

  const vwCenter = window.innerWidth * 0.5;
  cardEls.forEach(card => {
    const rect   = card.getBoundingClientRect();
    const center = rect.left + rect.width * 0.5;
    const offset = center - vwCenter;
    const rotY   = (offset / window.innerWidth) * 22;
    const scale  = 1 - Math.min(Math.abs(offset) / (window.innerWidth * 2), 0.1);
    card.style.transform =
      `perspective(1100px) rotateY(${rotY.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
  });
}

/* ================================================================
   SCROLL LISTENER
================================================================ */

let lastScrollY    = window.scrollY;
const MIN_DELTA_PX = 6;

window.addEventListener('scroll', () => {
  const delta = Math.abs(window.scrollY - lastScrollY);
  lastScrollY = window.scrollY;

  scrollBlend = Math.min(1, window.scrollY / window.innerHeight);

  if (delta >= MIN_DELTA_PX && !cardsRafScheduled) {
    cardsRafScheduled = true;
    requestAnimationFrame(updateCards);
  }
}, { passive: true });

/* ================================================================
   INITIALIZATION
================================================================ */

function init() {
  // Hero name letters
  heroLetterEls = Array.from(document.querySelectorAll('.hero-name .hl'));
  cacheLetterPositions();

  // WebGL wave beam
  initDitherShader();
  ditherRender();

  // Hero info list
  buildHeroInfo();
  requestAnimationFrame(cacheInfoCharPositions);

  // Horizontal scroll cards
  buildCards();
  requestAnimationFrame(() => {
    setRailCenterPadding();
    setCardsTrackHeight();
    recalcCardsTrackTop();
    updateCards();
  });
}

window.addEventListener('resize', () => {
  cacheLetterPositions();
  cacheInfoCharPositions();
  setRailCenterPadding();
  setCardsTrackHeight();
  recalcCardsTrackTop();
  updateCards();

  cancelAnimationFrame(ditherRafId);
  initDitherShader();
  ditherRender();
});

window.addEventListener('load', init);
