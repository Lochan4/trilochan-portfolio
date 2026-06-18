'use strict';

/* ================================================================
   DOM REFERENCES
================================================================ */

const heroEl          = document.getElementById('hero');
const heroNameEl      = document.getElementById('heroName');
const heroInfoEl      = document.getElementById('heroInfo');
const heroContentEl   = document.getElementById('heroContent');
const heroContentLabel   = document.getElementById('heroContentLabel');
const heroContentHeading = document.getElementById('heroContentHeading');
const heroContentBody    = document.getElementById('heroContentBody');
const stickyContainer = document.getElementById('stickyContainer');

/* ================================================================
   HERO INFO LIST
================================================================ */

let infoGroupEls = [];

function buildHeroInfo() {
  if (!heroInfoEl || typeof infoItems === 'undefined') return;
  infoItems.forEach((item, i) => {
    const group = document.createElement('div');
    group.className = 'hero-info-group';
    group.dataset.index = i;

    const titleEl = document.createElement('div');
    titleEl.className = 'hero-info-title';
    titleEl.textContent = item.title;

    const subEl = document.createElement('div');
    subEl.className = 'hero-info-sub';
    subEl.textContent = item.sub;

    group.appendChild(titleEl);
    group.appendChild(subEl);
    heroInfoEl.appendChild(group);
    infoGroupEls.push(group);
  });
}

/* ================================================================
   STICKY SCROLL

   The sticky-container height = (content.length + 1) * 100vh.
   One extra screen for the landing state (name centered, no card).

   Scroll mapping (relScroll = scrollY - containerTop):
   - 0 → 1vh : name animates center → top-left, card 0 fades in
   - 1vh → 2vh: card 1
   - 2vh → 3vh: card 2
   … etc.

   activeIndex = Math.floor(relScroll / vh), clamped 0 → n-1
   nameProgress = Math.min(1, relScroll / vh) — drives name animation
================================================================ */

let containerTop = 0;
let activeIndex  = -1;
let rafScheduled = false;

function setContainerHeight() {
  if (!stickyContainer) return;
  // +1 for landing, +1 for name-movement screen, +n for each card
  const h = window.innerHeight * (content.length + 2);
  stickyContainer.style.height = h + 'px';
}

function recalcContainerTop() {
  if (!stickyContainer) return;
  containerTop = stickyContainer.getBoundingClientRect().top + window.scrollY;
}

/* Smoothly interpolate name from centered to top-left corner */
function animateName(progress) {
  if (!heroNameEl) return;

  // Clamp progress to 0-1
  const p = Math.max(0, Math.min(1, progress));

  // Start: centered (top 50%, left 50%, translate -50% -50%)
  // End: top-left (top 40px, left 40px, no translate, smaller font)

  const startFontScale = 1;
  const endFontScale   = 0.42; // shrinks to ~40% of original size
  const fontScale      = startFontScale + (endFontScale - startFontScale) * p;

  // We interpolate the visual position using a mix of
  // percentage-based centering and absolute pixel target.
  // At p=0: centered. At p=1: near top-left.
  const topPct  = 50  + (3  - 50)  * p;   // 50% → 3%
  const leftPct = 50  + (3  - 50)  * p;   // 50% → 3%
  const tx      = -50 + (0  - -50) * p;   // -50% → 0%
  const ty      = -50 + (0  - -50) * p;   // -50% → 0%

  heroNameEl.style.top       = topPct + '%';
  heroNameEl.style.left      = leftPct + '%';
  heroNameEl.style.transform = `translate(${tx}%, ${ty}%) scale(${fontScale})`;
  heroNameEl.style.transformOrigin = 'top left';
}

/* Update which info item is lit and which card content shows */
function updateContent(index) {
  infoGroupEls.forEach((g, i) => {
    g.classList.toggle('active', i === index);
  });

  const item = content[index];

  if (index !== activeIndex) {
    heroContentEl.classList.remove('visible');
    setTimeout(() => {
      heroContentLabel.textContent   = item.label;
      heroContentHeading.textContent = item.heading;
      heroContentBody.textContent    = item.body;
      heroContentEl.classList.add('visible');
    }, 120);
    activeIndex = index;
  } else {
    heroContentEl.classList.add('visible');
  }
}

function updateStickyScroll() {
  rafScheduled = false;

  const vh          = window.innerHeight;
  const relScroll   = window.scrollY - containerTop;
  const nameProgress = Math.min(1, Math.max(0, relScroll / vh));

  animateName(nameProgress);

  // Content only appears after name has fully reached top-left
  if (nameProgress < 1) {
    heroContentEl.classList.remove('visible');
    infoGroupEls.forEach(g => g.classList.remove('active'));
    activeIndex = -1;
    return;
  }

  // After name is settled: each subsequent vh shows one card
  const cardScroll = relScroll - vh;
  const cardIndex  = Math.min(
    content.length - 1,
    Math.max(0, Math.floor(cardScroll / vh))
  );
  updateContent(cardIndex);
}

/* ================================================================
   SCROLL LISTENER
================================================================ */

window.addEventListener('scroll', () => {
  if (!rafScheduled) {
    rafScheduled = true;
    requestAnimationFrame(updateStickyScroll);
  }
}, { passive: true });

/* ================================================================
   INITIALIZATION
================================================================ */

function init() {
  buildHeroInfo();
  setContainerHeight();
  recalcContainerTop();
  updateStickyScroll();
}

window.addEventListener('resize', () => {
  setContainerHeight();
  recalcContainerTop();
  updateStickyScroll();
});

window.addEventListener('load', init);
