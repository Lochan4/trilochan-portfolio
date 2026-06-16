'use strict';

/* ================================================================
   DOM REFERENCES
================================================================ */

const heroEl      = document.getElementById('hero');
const heroCanvas  = document.getElementById('heroCanvas');
const heroBgCards = document.getElementById('heroBgCards');
const heroScroll  = document.getElementById('heroScroll');
const cardsTrack  = document.getElementById('cardsTrack');
const cardsScene  = document.getElementById('cardsScene');
const cardsRail   = document.getElementById('cardsRail');

/* ================================================================
   HERO: WebGL Wave Beam

   Simplified shader — no procedural texture. Just a white sine-bell
   glow band sweeping left→right on black. The background "content"
   is revealed by JS-driven opacity on the .hero-bg-card elements,
   not by the shader itself.
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

/* Wave beam only — no noise texture.
   Cards are HTML elements; the shader just provides the glow light. */
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

    /* Fade beam out as user scrolls hero out of view */
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
   HERO BG CARDS: wave-reveal
   Cards start near-invisible (opacity 0.03).
   As the wave beam sweeps over each card, its opacity climbs to ~0.73,
   then falls back. Effect fades completely as user scrolls away.
================================================================ */

let bgCardEls    = [];
let bgCardRanges = [];

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function buildHeroBgCards() {
  // Only use first 4 items to keep the rhombus layout intact (nth-child 1–4)
  content.slice(0, 4).forEach(item => {
    const card = document.createElement('div');
    card.className = 'hero-bg-card';
    card.innerHTML = `
      <span class="hero-bg-card-label">${escHtml(item.label)}</span>
      <span class="hero-bg-card-heading">${escHtml(item.heading)}</span>
    `;
    heroBgCards.appendChild(card);
    bgCardEls.push(card);
  });
}

function cacheBgCardRanges() {
  const W = window.innerWidth;
  bgCardRanges = bgCardEls.map(el => {
    const r = el.getBoundingClientRect();
    return { left: r.left / W, right: r.right / W };
  });
}

/* ================================================================
   RENDER LOOP
   All three effects share one rAF loop: wave beam (WebGL),
   letter inversion (DOM color), card reveal (DOM opacity).
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

  // --- Letter inversion (CPU, same wave formula) ---
  // rp = 0.5 * 0.06 = 0.03 (letters sit at y ≈ 0.5 of viewport)
  if (heroLetterEls.length) {
    const rp = 0.03;
    heroLetterEls.forEach((el, i) => {
      const d    = (letterNormX[i] + rp) - (wavePos - WAVE_W);
      const lift = (d >= 0.0 && d <= WAVE_W) ? Math.sin((d / WAVE_W) * Math.PI) : 0.0;
      const v    = Math.round(255 * (1.0 - lift));
      el.style.color = `rgb(${v},${v},${v})`;
    });
  }

  // --- Card reveal (opacity driven by wave overlap) ---
  if (bgCardRanges.length) {
    const beamLeft  = wavePos - WAVE_W;
    const beamRight = wavePos;
    // Fade all cards out as user scrolls the hero away
    const heroFade  = Math.max(0, 1 - scrollBlend * 4);

    bgCardEls.forEach((el, i) => {
      const { left, right } = bgCardRanges[i];
      const cardW    = right - left;
      const overlap  = Math.max(0, Math.min(beamRight, right) - Math.max(beamLeft, left));
      const norm     = cardW > 0 ? overlap / cardW : 0;
      // sin-smooth for soft edge fade (not a hard cut)
      const smoothed = Math.sin(norm * Math.PI * 0.5);
      el.style.opacity = ((0.08 + smoothed * 0.77) * heroFade).toFixed(3);
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
const PAD_SCREENS = 0.4; // breathing room at start + end

function buildCards() {
  const totalStr = String(content.length).padStart(2, '0');
  content.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    if (item.url) card.dataset.url = item.url;

    // Content sits inside .card-face so the press scale animation
    // doesn't conflict with the JS-controlled 3D transform on .card
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

    // Click: let :active press animation play, then open URL
    card.addEventListener('click', () => {
      const url = card.dataset.url;
      if (!url) return;
      setTimeout(() => window.open(url, '_blank', 'noopener,noreferrer'), 180);
    });

    cardsRail.appendChild(card);
    cardEls.push(card);
  });
}

/* Set rail padding so card 1 naturally sits at viewport center (tx=0).
   Same padding on both sides so the last card also lands at center
   when the rail is fully scrolled. No measurement hackery needed. */
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
  // Total travel = distance to scroll the full rail through the viewport
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

  // Map scroll to 0→1 with breathing room at each end
  const padPx    = window.innerHeight * PAD_SCREENS;
  const inner    = scrollable - padPx * 2;
  const raw      = inner > 0 ? (relScroll - padPx) / inner : 0;
  const progress = Math.max(0, Math.min(raw, 1));
  // Translate left as progress increases. At 0: card 1 centered. At 1: last card centered.
  const tx       = -(progress * maxTx);

  cardsRail.style.transform = `translateX(${tx.toFixed(1)}px)`;

  // Per-card 3D tilt: cards angle toward viewer based on their
  // horizontal distance from the viewport center
  const vwCenter = window.innerWidth * 0.5;
  cardEls.forEach(card => {
    const rect   = card.getBoundingClientRect();
    const center = rect.left + rect.width * 0.5;
    const offset = center - vwCenter;
    const rotY   = (offset / window.innerWidth) * 22;  // ±22° max
    const scale  = 1 - Math.min(Math.abs(offset) / (window.innerWidth * 2), 0.1);
    card.style.transform =
      `perspective(1100px) rotateY(${rotY.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
  });
}

/* ================================================================
   SCROLL LISTENER
================================================================ */

let lastScrollY    = window.scrollY;
const MIN_DELTA_PX = 6; // ignore trackpad resting micro-movements

window.addEventListener('scroll', () => {
  const delta = Math.abs(window.scrollY - lastScrollY);
  lastScrollY = window.scrollY;

  scrollBlend = Math.min(1, window.scrollY / window.innerHeight);

  if (heroScroll) {
    heroScroll.style.opacity = Math.max(0, 1 - window.scrollY / (window.innerHeight * 0.2));
  }

  if (delta >= MIN_DELTA_PX && !cardsRafScheduled) {
    cardsRafScheduled = true;
    requestAnimationFrame(updateCards);
  }
}, { passive: true });

/* ================================================================
   INITIALIZATION
================================================================ */

function init() {
  // Hero letters
  heroLetterEls = Array.from(document.querySelectorAll('.hero-name .hl'));
  cacheLetterPositions();

  // WebGL wave beam
  initDitherShader();
  ditherRender();

  // Hero bg cards
  buildHeroBgCards();
  requestAnimationFrame(cacheBgCardRanges);

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
  cacheBgCardRanges();
  setRailCenterPadding();
  setCardsTrackHeight();
  recalcCardsTrackTop();
  updateCards();

  cancelAnimationFrame(ditherRafId);
  initDitherShader();
  ditherRender();
});

window.addEventListener('load', init);
