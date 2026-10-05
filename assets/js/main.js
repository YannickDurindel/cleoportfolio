// Cléo Beaufils · portfolio. Vanilla JS, no tracker, no dependency.
// All copy comes from content.json; this file only renders it.
import { MAP_DOTS, MAP_DOTS_SEA } from './map-dots.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const SVGNS = 'http://www.w3.org/2000/svg';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(pointer: fine)');
const narrow = matchMedia('(max-width: 47.99rem)');

let C = null;          // content
let lang = 'fr';

/* ---------------- i18n helpers ---------------- */
const t = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? (v[lang] ?? v.fr ?? '') : (v ?? '');
const get = (path) => path.split('.').reduce((o, k) => o?.[k], C);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tx = (v) => esc(t(v));

function pickLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'fr' || q === 'en') return q;
  try { const s = localStorage.getItem('cb-lang'); if (s === 'fr' || s === 'en') return s; } catch { /* storage unavailable */ }
  return (navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

/* ---------------- geo ---------------- */
// Same equirectangular window as map-dots.js: lon -12..132, lat 58..-14 -> 1000 x 500
const K = 1000 / 144;
const proj = (lon, lat) => [(lon + 12) * K, (58 - lat) * K];
const km = (a, b) => {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) / 10) * 10;
};
const dms = (v, pos, neg) => {
  const a = Math.abs(v), d = Math.floor(a), m = Math.round((a - d) * 60);
  return `${d}°${String(m).padStart(2, '0')}′${v >= 0 ? pos : neg}`;
};
const coord = (p) => `${dms(p.lat, 'N', 'S')} ${dms(p.lon, 'E', 'W')}`;
const nf = () => new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-GB');

function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}

function graticule(svg, { labels = true } = {}) {
  const g = el('g', { 'aria-hidden': 'true' }, svg);
  for (let lon = 0; lon <= 130; lon += 15) {
    const [x] = proj(lon, 0);
    el('line', { x1: x, y1: 0, x2: x, y2: 500, class: 'map__grat' }, g);
    if (labels && lon % 30 === 0) el('text', { x: x + 3, y: 495, class: 'map__gratlabel' }, g).textContent = `${lon}°E`;
  }
  for (let lat = -10; lat <= 55; lat += 15) {
    const [, y] = proj(0, lat);
    el('line', { x1: 0, y1: y, x2: 1000, y2: y, class: 'map__grat' }, g);
  }
  const [, eq] = proj(0, 0);
  el('line', { x1: 0, y1: eq, x2: 1000, y2: eq, class: 'map__grat map__grat--eq' }, g);
  if (labels) el('text', { x: 4, y: eq - 4, class: 'map__gratlabel' }, g).textContent = 'ÉQUATEUR · 0°';
  const [, tc] = proj(0, 23.44);
  el('line', { x1: 0, y1: tc, x2: 1000, y2: tc, class: 'map__grat map__grat--eq' }, g);
  if (labels) el('text', { x: 4, y: tc - 4, class: 'map__gratlabel' }, g).textContent = lang === 'fr' ? 'TROPIQUE DU CANCER' : 'TROPIC OF CANCER';
  return g;
}

function arcPath(a, b, bend = .32) {
  const [x1, y1] = a, [x2, y2] = b;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  // control point offset perpendicular, always bowing "north"
  let nx = -dy / len, ny = dx / len;
  if (ny > 0) { nx = -nx; ny = -ny; }
  return `M${x1.toFixed(1)} ${y1.toFixed(1)}Q${(mx + nx * len * bend).toFixed(1)} ${(my + ny * len * bend).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

// label placement for the hero map (dx, anchor)
const LABEL = {
  paris: [12, 'start', -4], hanoi: [12, 'start', -6], bangkok: [-12, 'end', -2], phnompenh: [12, 'start', 6],
  kualalumpur: [-12, 'end', 4], singapore: [12, 'start', 8], jakarta: [12, 'start', 8], manila: [12, 'start', -2],
};

/* ---------------- hero map ---------------- */
let heroMapIO;
function drawHeroMap() {
  const svg = $('[data-hero-map]');
  svg.innerHTML = '';
  svg.setAttribute('aria-label', t(C.ui.heroMap));
  const fig = svg.closest('.map');
  const P = C.places, origin = P.paris;
  const o = proj(origin.lon, origin.lat);
  const small = narrow.matches;
  svg.setAttribute('viewBox', small ? '600 165 400 310' : '0 30 1000 450');

  graticule(svg, { labels: !small });
  el('path', { d: MAP_DOTS, class: 'map__dots', 'aria-hidden': 'true' }, svg);

  const arcs = el('g', { 'aria-hidden': 'true' }, svg);
  const nodes = el('g', {}, svg);
  const motion = !reduceMotion.matches;

  C.heroRoutes.forEach((key, i) => {
    const p = P[key]; if (!p) return;
    const xy = proj(p.lon, p.lat);
    const d = arcPath(o, xy, .14 + (i % 3) * .035);
    el('path', { d, class: 'map__arc map__arc--glow', pathLength: 1, style: `--i:${i}` }, arcs);
    el('path', { d, class: 'map__arc', pathLength: 1, id: `arc-${key}`, style: `--i:${i}` }, arcs);
    if (motion) {
      const dot = el('circle', { r: 2.2, class: 'map__traveller', opacity: 0 }, arcs);
      const dur = 5 + i * .6;
      const begin = 2.2 + i * .35;
      const mo = el('animateMotion', { dur: `${dur}s`, begin: `${begin}s`, repeatCount: 2, rotate: 'auto' }, dot);
      el('mpath', { href: `#arc-${key}` }, mo);
      el('animate', { attributeName: 'opacity', values: '0;1;1;0', keyTimes: '0;.1;.85;1', dur: `${dur}s`, begin: `${begin}s`, repeatCount: 2 }, dot);
    }
    const [dx, anchor, dy] = LABEL[key] || [12, 'start', 0];
    const g = el('g', { class: 'map__node', style: `--i:${i}` }, nodes);
    el('circle', { cx: xy[0], cy: xy[1], r: 3.2, class: 'map__city' }, g);
    const lab = el('text', { x: xy[0] + dx, y: xy[1] + dy, 'text-anchor': anchor, class: 'map__label' }, g);
    lab.textContent = t(p.name);
    if (!small) {
      const sub = el('text', { x: xy[0] + dx, y: xy[1] + dy + 11, 'text-anchor': anchor, class: 'map__sub' }, g);
      sub.textContent = `${nf().format(km(origin, p))} KM`;
    }
  });

  const g = el('g', { class: 'map__node map__node--origin' }, nodes);
  if (small) {
    // Paris lies off-frame on narrow screens: arcs fly in from the west
    const tx = el('text', { x: 612, y: 190, class: 'map__offscreen' }, g);
    tx.textContent = `← ${t(origin.name)}`;
  } else {
    el('circle', { cx: o[0], cy: o[1], r: 4, class: 'map__city map__city--origin' }, g);
    if (motion) el('circle', { cx: o[0], cy: o[1], r: 4, class: 'map__ring' }, g);
    el('text', { x: o[0] + 12, y: o[1] - 4, class: 'map__label' }, g).textContent = t(origin.name);
    el('text', { x: o[0] + 12, y: o[1] + 8, class: 'map__sub' }, g).textContent = coord(origin);
  }

  if (!motion) { fig.classList.add('is-drawn'); return; }
  // draw when visible (immediately on load since it is in the first viewport on desktop)
  // SVG clock starts at 0 when the map enters the viewport; paused while off-screen
  svg.pauseAnimations?.();
  svg.setCurrentTime?.(0);
  heroMapIO?.disconnect();
  heroMapIO = new IntersectionObserver((es) => {
    const vis = es.some((e) => e.isIntersecting);
    if (vis) fig.classList.add('is-drawn');
    if (vis) svg.unpauseAnimations?.(); else svg.pauseAnimations?.();
  }, { threshold: .15 });
  heroMapIO.observe(fig);
}

/* ---------------- field map + stamps ---------------- */
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }

/** Stylised passport stamp. shape: circle | rect | oval */
function stamp({ top = '', center = '', bottom = '', shape = 'circle', color = 'var(--red)', id = 's', size = 160 }) {
  const c = size / 2;
  if (shape === 'rect') {
    return `<svg class="stamp" viewBox="0 0 200 120" aria-hidden="true" focusable="false"><g filter="url(#ink)" fill="none" stroke="${color}" color="${color}">
      <rect x="4" y="4" width="192" height="112" rx="10" stroke-width="3.2"/>
      <rect x="11" y="11" width="178" height="98" rx="6" stroke-width="1"/>
      <line x1="22" y1="40" x2="178" y2="40" stroke-width="1"/><line x1="22" y1="86" x2="178" y2="86" stroke-width="1"/>
      <text x="100" y="31" text-anchor="middle" font-size="12" fill="currentColor" stroke="none">${esc(top)}</text>
      <text x="100" y="72" text-anchor="middle" font-size="26" class="stamp__big" fill="currentColor" stroke="none">${esc(center)}</text>
      <text x="100" y="102" text-anchor="middle" font-size="10" fill="currentColor" stroke="none">${esc(bottom)}</text>
    </g></svg>`;
  }
  const ry = shape === 'oval' ? 0.72 : 1;
  return `<svg class="stamp" viewBox="0 0 ${size} ${size}" aria-hidden="true" focusable="false"><defs>
      <path id="${id}-t" d="M${c - 54},${c} A54,${54 * ry} 0 0 1 ${c + 54},${c}"/>
      <path id="${id}-b" d="M${c - 62},${c} A62,${62 * ry} 0 0 0 ${c + 62},${c}"/>
    </defs><g filter="url(#ink)" fill="none" stroke="${color}" color="${color}">
      <ellipse cx="${c}" cy="${c}" rx="76" ry="${76 * ry}" stroke-width="3.4"/>
      <ellipse cx="${c}" cy="${c}" rx="68" ry="${68 * ry}" stroke-width="1"/>
      <ellipse cx="${c}" cy="${c}" rx="40" ry="${40 * ry}" stroke-width="1" stroke-dasharray="2 3"/>
      <text font-size="11.5" fill="currentColor" stroke="none"><textPath href="#${id}-t" startOffset="50%" text-anchor="middle">${esc(top)}</textPath></text>
      <text font-size="10" fill="currentColor" stroke="none"><textPath href="#${id}-b" startOffset="50%" text-anchor="middle">${esc(bottom)}</textPath></text>
      <text x="${c}" y="${c + 7}" text-anchor="middle" font-size="20" class="stamp__big" fill="currentColor" stroke="none">${esc(center)}</text>
      <path d="M${c - 70} ${c - 3}h12M${c + 58} ${c - 3}h12" stroke-width="1"/>
    </g></svg>`;
}

function drawField() {
  const svg = $('[data-field-map]');
  svg.innerHTML = '';
  svg.setAttribute('aria-label', t(C.ui.fieldMap));
  graticule(svg, { labels: false });
  el('path', { d: MAP_DOTS_SEA, class: 'map__dots', 'aria-hidden': 'true' }, svg);
  const stays = C.terrain.stays.filter((s) => C.places[s.place]);
  // itinerary in chronological order
  const pts = stays.map((s) => proj(C.places[s.place].lon, C.places[s.place].lat));
  pts.slice(1).forEach((p, i) => el('path', { d: arcPath(pts[i], p, .25), class: 'map__arc', 'aria-hidden': 'true' }, svg));
  stays.forEach((s, i) => {
    const p = C.places[s.place], [x, y] = pts[i];
    const g = el('g', { class: 'pin', 'data-pin': i }, svg);
    el('circle', { cx: x, cy: y, r: 11, class: 'pin__halo' }, g);
    el('circle', { cx: x, cy: y, r: 6, class: 'pin__dot' }, g);
    el('text', { x, y: y + 1.8, 'text-anchor': 'middle', class: 'pin__n' }, g).textContent = String(i + 1).padStart(2, '0');
    const left = x > 800 ? false : x < 790;
    el('text', { x: x + (left ? -15 : 15), y: y + 3.5, 'text-anchor': left ? 'end' : 'start', class: 'pin__label' }, g).textContent = t(p.name);
  });

  const colors = ['var(--red)', 'var(--ink)', 'var(--brass-ink)', 'var(--red)', 'var(--ink)'];
  const shapes = ['circle', 'rect', 'oval', 'circle', 'rect'];
  $('[data-stays]').innerHTML = stays.map((s, i) => {
    const p = C.places[s.place];
    const rot = Math.round((hash(s.place + s.dates) - .5) * 22);
    return `<li class="stay" data-stay="${i}" data-reveal style="--d:${i * .08}s">
      <button class="stay__btn" type="button" aria-describedby="stay-${i}">
        <span class="stay__stamp" style="transform:rotate(${rot}deg)">${stamp({
          id: `st${i}`, shape: shapes[i % shapes.length], color: colors[i % colors.length],
          top: `${t(p.name)} · ${String(i + 1).padStart(2, '0')}`, center: t(p.name).length > 9 ? s.dates.slice(-7) : t(p.name),
          bottom: `${t(C.ui.entry)} · ${s.dates}`,
        })}</span>
        <span class="mono">${esc(t(p.name))} · ${esc(s.dates)}</span>
      </button>
      <p class="stay__what" id="stay-${i}">${tx(s.what)}</p>
    </li>`;
  }).join('');

  const pins = $$('.pin', svg);
  const setOn = (i, on) => {
    pins[i]?.classList.toggle('is-on', on);
    $(`[data-stay="${i}"]`)?.classList.toggle('is-on', on);
  };
  $$('[data-stay]').forEach((li) => {
    const i = +li.dataset.stay;
    const b = $('button', li);
    ['mouseenter', 'focus'].forEach((ev) => b.addEventListener(ev, () => setOn(i, true)));
    ['mouseleave', 'blur'].forEach((ev) => b.addEventListener(ev, () => setOn(i, false)));
  });
  pins.forEach((p, i) => {
    p.addEventListener('mouseenter', () => setOn(i, true));
    p.addEventListener('mouseleave', () => setOn(i, false));
  });
}

/* ---------------- clocks ---------------- */
let clockTimer;
function tzOffset(tz, d) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(d);
  const v = Object.fromEntries(parts.map((p) => [p.type, +p.value]));
  return Math.round((Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute) - Math.floor(d.getTime() / 60000) * 60000) / 60000);
}
function buildClocks() {
  const ul = $('[data-clocks]');
  $('[data-clocks-label]').setAttribute('aria-label', t(C.ui.clocksLabel));
  ul.innerHTML = C.clocks.filter((k) => C.places[k]).map((k) => `
    <li class="clock" data-tz="${C.places[k].tz}">
      <svg class="clock__dial" viewBox="0 0 40 40" aria-hidden="true">
        <circle class="face" cx="20" cy="20" r="18.5"/>
        ${[0, 90, 180, 270].map((a) => `<line class="tick" x1="20" y1="3.5" x2="20" y2="6" transform="rotate(${a} 20 20)"/>`).join('')}
        <line class="h" x1="20" y1="20" x2="20" y2="11"/><line class="m" x1="20" y1="21" x2="20" y2="6.5"/><line class="s" x1="20" y1="23" x2="20" y2="5"/>
        <circle cx="20" cy="20" r="1.3" fill="currentColor" stroke="none"/>
      </svg>
      <span class="clock__city">${tx(C.places[k].name)}</span>
      <span class="clock__time"><time></time><small></small></span>
    </li>`).join('');
  clearInterval(clockTimer);
  tickClocks();
  // align to the second
  setTimeout(() => { tickClocks(); clockTimer = setInterval(tickClocks, 1000); }, 1000 - (Date.now() % 1000));
}
function tickClocks() {
  const now = new Date();
  $$('[data-tz]').forEach((li) => {
    const tz = li.dataset.tz;
    const off = tzOffset(tz, now);
    const local = new Date(now.getTime() + off * 60000);
    const h = local.getUTCHours(), m = local.getUTCMinutes(), s = local.getUTCSeconds();
    const pad = (n) => String(n).padStart(2, '0');
    const time = $('time', li);
    time.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
    time.dateTime = `${pad(h)}:${pad(m)}`;
    const oh = Math.abs(off) / 60;
    $('small', li).textContent = `UTC${off >= 0 ? '+' : '−'}${Number.isInteger(oh) ? oh : `${Math.floor(oh)}:${String(Math.abs(off) % 60).padStart(2, '0')}`}`;
    const dial = $('.clock__dial', li);
    dial.classList.toggle('is-night', h < 6 || h >= 19);
    $('.h', dial).setAttribute('transform', `rotate(${(h % 12) * 30 + m * .5} 20 20)`);
    $('.m', dial).setAttribute('transform', `rotate(${m * 6 + s * .1} 20 20)`);
    $('.s', dial).setAttribute('transform', `rotate(${s * 6} 20 20)`);
  });
  const dl = $('[data-dateline]');
  if (dl) {
    const f = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    dl.textContent = `${t(C.places.paris.name)}, ${f.format(now)}`;
  }
}

/* ---------------- greeting rotator ---------------- */
let helloTimer, helloIdx = 0, helloCycles = 0, helloManual = false;
function buildHello() {
  const btn = $('[data-hello]'), track = $('.hello__track', btn);
  const G = C.greetings;
  track.innerHTML = G.map((g) => `<span class="hello__item" lang="${g.lang}">${esc(g.text)}</span>`).join('');
  btn.setAttribute('aria-label', t(C.ui.helloBtn));
  helloIdx = Math.max(0, G.findIndex((g) => g.lang === lang));
  showHello(false);
  clearInterval(helloTimer);
  if (!reduceMotion.matches && !helloManual) {
    helloTimer = setInterval(() => {
      helloIdx = (helloIdx + 1) % G.length;
      if (G[helloIdx].lang === lang && ++helloCycles >= 2) clearInterval(helloTimer); // rest after two tours
      showHello(true);
    }, 2400);
  }
}
function showHello(anim) {
  const btn = $('[data-hello]'), track = $('.hello__track', btn), items = $$('.hello__item', track);
  const it = items[helloIdx]; if (!it) return;
  // measure width of the current word
  const w = it.scrollWidth || it.getBoundingClientRect().width;
  btn.style.width = `${Math.ceil(w) + 2}px`;
  track.style.transition = anim && !reduceMotion.matches ? 'transform .8s cubic-bezier(.7,0,.2,1)' : 'none';
  track.style.transform = `translateY(${-it.offsetTop}px)`;
  $('[data-hello-lang]').textContent = C.greetings[helloIdx].label;
}

/* ---------------- sections ---------------- */
function sectionHeads() {
  $$('.shead').forEach((h) => {
    const key = h.dataset.key, sec = C[key];
    const words = t(sec.title).split(' ');
    h.innerHTML = `
      <div class="shead__bar mono">
        <span class="shead__no">${tx(C.ui.dossierLabel)}${h.dataset.n}</span>
        <span class="shead__fill" aria-hidden="true"></span>
        <span>${tx(C.ui.ref)} ${esc(sec.ref)}</span>
        <span aria-hidden="true">${esc(h.dataset.coords)}</span>
      </div>
      <div class="shead__row">
        <span class="shead__n" aria-hidden="true">${h.dataset.n}</span>
        <h2 id="h-${key}"><span class="shead__clip">${words.map((w, i) => `<span class="w" style="--wi:${i}">${esc(w)}</span>`).join(' ')}</span></h2>
      </div>`;
  });
}

function profil() {
  $('[data-profil-body]').innerHTML = C.profil.body.map((p) => `<p data-reveal>${tx(p)}</p>`).join('');
  $('[data-pillars]').innerHTML = C.profil.pillars.map((p, i) => `<li data-reveal style="--d:${i * .1}s"><div><h3>${tx(p.k)}</h3><p>${tx(p.v)}</p></div></li>`).join('');
}

function parcours() {
  $$('[data-tl]').forEach((ol) => {
    ol.innerHTML = C.parcours[ol.dataset.tl].map((e) => `
      <li class="tl__item" data-reveal>
        <p class="tl__period">${esc(e.period)}</p>
        <h4 class="tl__role">${tx(e.role)}</h4>
        <p class="tl__org">${tx(e.org)}</p>
        <p class="tl__text">${tx(e.text)}</p>
      </li>`).join('');
  });
}

function dossiers() {
  const arrow = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h11m0 0-4-4m4 4-4 4"/></svg>';
  $('[data-files]').innerHTML = C.dossiers.items.map((f, i) => {
    const no = `${C.dossiers.ref.split('/').pop()}-${String.fromCharCode(65 + i)}`;
    return `<li class="file" data-reveal style="--d:${(i % 2) * .12}s">
      <a class="file__card" href="${esc(f.url || '#')}" data-tag="${esc(f.tag)}" data-cursor="read"${/^https?:/.test(f.url) ? ' target="_blank" rel="noopener"' : ''}>
        <span class="file__top mono"><span class="file__type">${tx(f.type)}</span><span>N°${no}</span></span>
        <h3 class="file__title">${tx(f.title)}</h3>
        <p class="file__excerpt">${tx(f.excerpt)}</p>
        <span class="file__foot mono"><span>${tx(f.meta)}</span><span class="file__read">${tx(C.ui.read)} ${arrow}</span></span>
        <span class="file__classified">${stamp({ shape: 'rect', color: 'var(--red)', top: 'CB · 2026', center: t(C.ui.released).split(' ')[0], bottom: t(C.ui.released).split(' ').slice(1).join(' ') })}</span>
      </a>
    </li>`;
  }).join('');
  $$('.file__card[href="#"]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault()));
}

function langues() {
  const L = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  $('[data-langs]').innerHTML = C.langues.items.map((l, i) => {
    const idx = L.indexOf(l.level);
    const scale = l.level === 'native'
      ? `<span class="cefr__native">${tx(C.ui.native)}</span>`
      : L.map((lv, j) => `<span class="cefr__lv${j <= idx ? ' is-reached' : ''}${j === idx ? ' is-level' : ''}"${j === idx ? ' aria-current="true"' : ''}>${lv}</span>`).join('');
    const label = l.level === 'native' ? t(C.ui.native) : `${t(C.ui.cefr)} : ${l.level}`;
    return `<li class="lng" data-reveal style="--d:${i * .06}s">
      <p class="lng__native" lang="${esc(l.lang)}">${esc(l.native)}</p>
      <div class="lng__meta"><span class="lng__name">${tx(l.name)}</span><span class="lng__note">${tx(l.note)}</span></div>
      <div class="cefr" role="img" aria-label="${esc(label)}">${scale}</div>
    </li>`;
  }).join('');
}

let emailShown = false;
function contact() {
  $('[data-telegram-head]').textContent = t(C.contact.telegramHead);
  const [u, d, tld] = C.contact.emailParts;
  const txt = $('[data-email-text]'), btn = $('[data-email-btn]');
  const render = () => {
    if (!emailShown) {
      txt.textContent = `${u} ⟨@⟩ ··· `;
      btn.textContent = t(C.ui.reveal);
    } else {
      const addr = [u, '@', d, '.', tld].join('');
      txt.innerHTML = `<a href="mailto:${esc(addr)}">${esc(addr)}</a>`;
      btn.textContent = t(C.ui.copy);
    }
  };
  render();
  btn.onclick = async () => {
    if (!emailShown) { emailShown = true; render(); $('a', txt)?.focus(); return; }
    try { await navigator.clipboard.writeText([u, '@', d, '.', tld].join('')); btn.textContent = t(C.ui.copied); setTimeout(render, 1800); } catch { /* clipboard denied */ }
  };
  const ext = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 9 9 3M4 3h5v5"/></svg>';
  $('[data-links]').innerHTML = C.contact.links.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener me">${esc(l.label)} ${ext}</a></li>`).join('');
}

function heroBits() {
  const cv = $('[data-cv]');
  cv.href = t(C.hero.cv);
  cv.setAttribute('download', '');
  const frame = $('[data-portrait]');
  if (C.hero.photo) {
    frame.innerHTML = `<img src="${esc(C.hero.photo)}" alt="${tx(C.hero.photoAlt)}" width="960" height="1200" fetchpriority="high">`;
  } else {
    frame.innerHTML = `<svg class="portrait__ph" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${tx(C.hero.photoAlt)} · ${tx(C.ui.photoPlaceholder)}">
      <defs>
        <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="8" stroke="rgba(244,239,230,.07)" stroke-width="1"/></pattern>
        <radialGradient id="glow" cx="50%" cy="38%" r="60%"><stop offset="0" stop-color="#22324a"/><stop offset="1" stop-color="#0e1a2b"/></radialGradient>
      </defs>
      <rect width="400" height="500" fill="url(#glow)"/><rect width="400" height="500" fill="url(#hatch)"/>
      <ellipse cx="200" cy="200" rx="70" ry="86" fill="none" stroke="rgba(212,180,124,.35)" stroke-dasharray="3 5"/>
      <path d="M70 500c10-110 70-160 130-160s120 50 130 160" fill="none" stroke="rgba(212,180,124,.35)" stroke-dasharray="3 5"/>
      <g stroke="#d4b47c" stroke-width="1.2" fill="none"><path d="M24 44V24h20M376 44V24h-20M24 456v20h20M376 456v20h-20"/></g>
      <text x="200" y="420" text-anchor="middle" fill="#f4efe6" font-family="Fraunces, Georgia, serif" font-style="italic" font-size="30" font-weight="300">${tx(C.ui.photoPlaceholder)}</text>
      <text x="200" y="446" text-anchor="middle" fill="#d4b47c" font-family="IBM Plex Mono, monospace" font-size="10" letter-spacing="2">[PLACEHOLDER] · 4:5 · 1200×1500</text>
    </svg>`;
  }
  const d = new Date();
  const day = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Europe/Paris' }).format(d).replaceAll('/', '·');
  $('[data-hero-stamp]').innerHTML = stamp({ id: 'hs', top: t(C.ui.stampTop), center: day, bottom: t(C.ui.stampBottom), color: 'var(--red)' });
}

function menu() {
  const list = $('.menu__list');
  list.innerHTML = $$('.nav a').map((a) => `<li><a href="${a.getAttribute('href')}"><span class="mono">${$('.nav__n', a).textContent}</span>${esc(a.querySelector('[data-t]').textContent)}</a></li>`).join('');
  const btn = $('.menu-btn');
  btn.setAttribute('aria-label', t(btn.getAttribute('aria-expanded') === 'true' ? C.ui.close : C.ui.menu));
}

function setupMenu() {
  const btn = $('.menu-btn'), m = $('#menu');
  const close = (focus = true) => {
    btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', t(C.ui.menu));
    m.classList.remove('is-open'); m.hidden = true; document.body.style.overflow = '';
    if (focus) btn.focus();
  };
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    if (!open) return close();
    btn.setAttribute('aria-expanded', 'true'); btn.setAttribute('aria-label', t(C.ui.close));
    m.hidden = false; requestAnimationFrame(() => m.classList.add('is-open'));
    document.body.style.overflow = 'hidden';
    $('a', m)?.focus();
  });
  m.addEventListener('click', (e) => { if (e.target.closest('a')) close(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !m.hidden) close(); });
}

/* ---------------- render ---------------- */
function applyStatic() {
  $$('[data-t]').forEach((n) => { const v = get(n.dataset.t); if (v != null) n.textContent = t(v); });
  document.documentElement.lang = lang;
  document.title = t(C.meta.title);
  $('meta[name="description"]').setAttribute('content', t(C.meta.description));
  const tog = $('[data-lang-toggle]');
  tog.setAttribute('lang', lang === 'fr' ? 'en' : 'fr');
  $$('.lang__opt', tog).forEach((o) => o.classList.toggle('is-on', o.dataset.l === lang));
  // name lines in the hero (kept in HTML for first paint, refreshed from content)
  const lines = $$('.hero__name .line__in');
  lines[0].textContent = C.meta.firstName;
  lines[1].textContent = C.meta.lastName;
}

function render() {
  applyStatic();
  heroBits();
  buildHello();
  buildClocks();
  drawHeroMap();
  sectionHeads();
  profil();
  parcours();
  dossiers();
  drawField();
  langues();
  contact();
  menu();
  observeReveals();
}

/* ---------------- motion ---------------- */
let revealIO;
function observeReveals() {
  if (!document.documentElement.classList.contains('motion')) return;
  revealIO?.disconnect();
  revealIO = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); revealIO.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
  $$('[data-reveal], .shead, .tl__item').forEach((n) => { if (!n.classList.contains('is-in')) revealIO.observe(n); });
}

function setupScroll() {
  const bar = $('.progress span');
  const name = $('.hero__name');
  const sections = $$('main section[id]');
  const navLinks = $$('.nav a');
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = scrollY, H = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${H > 0 ? y / H : 0})`;
    if (reduceMotion.matches) return;
    if (y < innerHeight * 1.2) name.style.transform = `translate3d(0, ${y * .12}px, 0)`;
    $$('[data-parallax]').forEach((n) => {
      const r = n.getBoundingClientRect();
      if (r.bottom < -100 || r.top > innerHeight + 100) return;
      n.style.transform = `translate3d(0, ${(r.top - innerHeight / 2) * -(+n.dataset.parallax)}px, 0)`;
    });
    $$('.tl').forEach((tl) => {
      const r = tl.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight * .75 - r.top) / r.height));
      tl.style.setProperty('--tl', p.toFixed(3));
    });
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update);
  update();

  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    navLinks.forEach((a) => a.setAttribute('aria-current', a.getAttribute('href') === `#${e.target.id}` ? 'true' : 'false'));
  }), { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => io.observe(s));
}

function setupCursor() {
  if (!finePointer.matches || reduceMotion.matches) return;
  document.documentElement.classList.add('has-cursor');
  const c = $('.cursor'), label = $('.cursor__label', c);
  let x = -100, y = -100, cx = x, cy = y, raf;
  const loop = () => {
    cx += (x - cx) * .2; cy += (y - cy) * .2;
    c.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    raf = Math.abs(x - cx) + Math.abs(y - cy) > .1 ? requestAnimationFrame(loop) : null;
  };
  addEventListener('pointermove', (e) => {
    x = e.clientX; y = e.clientY; c.classList.add('is-visible');
    if (!raf) raf = requestAnimationFrame(loop);
    const tgt = e.target.closest?.('a, button, [data-pin]');
    const read = tgt?.dataset.cursor === 'read';
    c.classList.toggle('is-read', !!read);
    c.classList.toggle('is-link', !!tgt && !read);
    label.textContent = read ? t(C.ui.readCursor) : '';
  }, { passive: true });
  document.addEventListener('pointerleave', () => c.classList.remove('is-visible'));
}

/* ---------------- boot ---------------- */
async function boot() {
  if (!reduceMotion.matches) document.documentElement.classList.add('motion');
  try {
    C = await (await fetch('content.json')).json();
  } catch (e) {
    console.error('content.json could not be loaded', e);
    return;
  }
  lang = pickLang();
  render();
  setupMenu();
  setupScroll();
  setupCursor();

  $('[data-lang-toggle]').addEventListener('click', () => {
    lang = lang === 'fr' ? 'en' : 'fr';
    try { localStorage.setItem('cb-lang', lang); } catch { /* ignore */ }
    const u = new URL(location.href); u.searchParams.set('lang', lang); history.replaceState(null, '', u);
    render();
  });

  $('[data-hello]').addEventListener('click', () => {
    helloManual = true; clearInterval(helloTimer);
    helloIdx = (helloIdx + 1) % C.greetings.length; showHello(true);
  });

  let lastNarrow = narrow.matches;
  narrow.addEventListener('change', () => { if (narrow.matches !== lastNarrow) { lastNarrow = narrow.matches; drawHeroMap(); } });
  document.fonts?.ready.then(() => showHello(false));
}

boot();
