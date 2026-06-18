'use strict';

/* ================================================================
   DOM REFERENCES
================================================================ */

const heroEl   = document.getElementById('hero');
const heroName = document.getElementById('heroName');
const heroInfo = document.getElementById('heroInfo');

/* ================================================================
   HERO INFO LIST
   Builds the two-line (title + subtitle) info groups on the right.
================================================================ */

let infoGroupEls = []; // one per infoItem

function buildHeroInfo() {
  if (!heroInfo || typeof infoItems === 'undefined') return;
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
    heroInfo.appendChild(group);
    infoGroupEls.push(group);
  });
}

/* ================================================================
   UTILITIES
================================================================ */

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

/* ================================================================
   INITIALIZATION
================================================================ */

function init() {
  buildHeroInfo();
}

window.addEventListener('load', init);
