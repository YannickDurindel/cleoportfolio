// Cléo Beaufils · « Méridien » design. The page never scrolls visibly: scroll position drives a
// camera around a dotted globe, the palette, and kinetic typography. Same content.json as the other designs.
import { GLOBE_DOTS, FINE_BOXES, FINE_DOTS } from './globe-dots.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const narrow = matchMedia('(max-width: 52rem)');

let C = null;
let lang = 'fr';

const t = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? (v[lang] ?? v.fr ?? '') : (v ?? '');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tx = (v) => esc(t(v));
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => (k < .5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const RAD = Math.PI / 180;

function pickLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'fr' || q === 'en') return q;
  try { const s = localStorage.getItem('cb-lang'); if (s === 'fr' || s === 'en') return s; } catch { /* storage unavailable */ }
  return (navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

/* ---------------- geo data ---------------- */
function decode(b64) {
  const bin = atob(b64), n = bin.length / 4, out = new Float32Array(n * 5);
  const dv = new DataView(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) dv.setUint8(i, bin.charCodeAt(i));
  for (let i = 0; i < n; i++) {
    const lat = dv.getInt16(i * 4, true) / 100, lon = dv.getInt16(i * 4 + 2, true) / 100;
    const p = lat * RAD, l = lon * RAD;
    out.set([Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l), lat, lon], i * 5);
  }
  return out;
}
const DOTS = decode(GLOBE_DOTS);
const FINE = decode(FINE_DOTS);
// weight of the fine layer at a point: 1 deep inside a fine box, feathered to 0 over the last degrees to its edge
const FEATHER = 5;
const fineW = (lat, lon) => FINE_BOXES.reduce((w, b) => Math.max(w, clamp(Math.min(lon - b[0], b[2] - lon, lat - b[1], b[3] - lat) / FEATHER)), 0);
const weights = (arr) => Float32Array.from({ length: arr.length / 5 }, (_, i) => fineW(arr[i * 5 + 3], arr[i * 5 + 4]));
const COARSE_W = weights(DOTS), FINE_W = weights(FINE);
const vec = (lat, lon) => [Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD), Math.cos(lat * RAD) * Math.cos(lon * RAD)];
const dms = (v, pos, neg) => { const a = Math.abs(v), d = Math.floor(a), m = Math.round((a - d) * 60); return `${d}°${String(m).padStart(2, '0')}′${v >= 0 ? pos : neg}`; };
const km = (a, b) => {
  const [x1, y1, z1] = vec(a.lat, a.lon), [x2, y2, z2] = vec(b.lat, b.lon);
  return Math.round(6371 * Math.acos(clamp(x1 * x2 + y1 * y2 + z1 * z2, -1, 1)) / 10) * 10;
};

/* ---------------- chapters ---------------- */
// camera: [lon, lat, zoom]; frame: [cx, cy, radius scale] in viewport fractions; palette: [bg, glow, accent]
const ROUTE = ['tours', 'pecs', 'reims', 'zhongli'];
const SCENES = [
  { kind: 'intro', cam: [14, 34, 1], frame: [.5, 1.02, 1.55], pal: ['#1b120e', '#4a2214', '#ff7a45'], spin: 1 },
  { kind: 'manifesto', cam: [52, 28, 1], frame: [.74, .52, 1], pal: ['#23110e', '#57241a', '#f2a65a'], spin: 1 },
  { kind: 'place', place: 'tours', cam: [.7, 47.4, 2.7], frame: [.7, .5, 1.05], pal: ['#2a170d', '#64381a', '#f0b25a'] },
  { kind: 'place', place: 'pecs', cam: [18.2, 46.1, 2.7], frame: [.7, .5, 1.05], pal: ['#2b1112', '#66221f', '#ec6a4a'] },
  { kind: 'place', place: 'reims', cam: [4, 49.3, 2.9], frame: [.7, .5, 1.05], pal: ['#260c16', '#5c1d33', '#ecc47e'] },
  { kind: 'place', place: 'zhongli', cam: [121.2, 24.4, 4.4], frame: [.7, .5, 1.05], pal: ['#2c1309', '#7a3212', '#ff8f3d'] },
  { kind: 'files', cam: [119.6, 24.2, 2.2], frame: [.86, .56, 1.1], pal: ['#1f1210', '#46231a', '#f2a65a'] },
  { kind: 'langues', cam: [62, 36, 1.05], frame: [.5, .5, 1.12], pal: ['#2a1018', '#5f2240', '#f4b183'], spin: 1, dim: .4 },
  { kind: 'contact', cam: [75, 28, 1], frame: [.5, 1.04, 1.55], pal: ['#1b120e', '#55250f', '#ff7a45'], spin: 1 },
];
// on narrow screens the globe sits in the upper part, behind the text
const NARROW_FRAME = { intro: [.5, 1.02, 1.25], contact: [.5, 1.02, 1.25] };

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mixHex = (a, b, k) => { const A = hexRgb(a), B = hexRgb(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], k))).join(',')})`; };

// headline whose letters scatter with scroll distance; each glyph gets a seeded random direction
function seeded(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967295; }; }
function kinetic(text, cls = '', tag = 'span') {
  const rnd = seeded(text);
  const words = String(text).split(' ').map((w) => `<span class="kw">${[...w].map((ch, i) => {
    const r = (rnd() - .5) * 3.2, x = (rnd() - .5) * 1.6, rot = (rnd() - .5) * 50;
    return `<span class="kc" style="--r:${r.toFixed(2)};--x:${x.toFixed(2)};--rot:${rot.toFixed(1)};--i:${i}">${esc(ch)}</span>`;
  }).join('')}</span>`).join(' ');
  return `<${tag} class="kin ${cls}" aria-label="${esc(text)}"><span aria-hidden="true">${words}</span></${tag}>`;
}

const entryOf = ([list, i]) => C.parcours[list]?.[i];
const coordOf = (p) => `${dms(p.lat, 'N', 'S')} ${dms(p.lon, 'E', 'W')}`;

function sceneHTML(s, i) {
  const M = C.meridien, n = String(i + 1).padStart(2, '0');
  const arrow = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13 13 3M5 3h8v8"/></svg>';
  if (s.kind === 'intro') {
    return `<div class="panel panel--intro">
      <p class="eyebrow">${tx(M.kicker)}</p>
      <h1 class="giant">${kinetic(C.meta.firstName, 'giant__a')}${kinetic(C.meta.lastName, 'giant__b')}</h1>
      <p class="intro__tag fade">${tx(C.hero.tagline)}</p>
      <p class="hint fade"><span class="hint__line"></span>${tx(M.hint)}</p>
      ${C.hero.photo ? `<figure class="arch fade"><img src="../${esc(C.hero.photo)}" alt="${tx(C.hero.photoAlt)}" width="902" height="1128"></figure>` : ''}
    </div>`;
  }
  if (s.kind === 'manifesto') {
    return `<div class="panel panel--manifesto">
      <p class="eyebrow">${n} · ${tx(M.manifestoKicker)}</p>
      <h2 class="quote">${kinetic(t(C.profil.quote).replace(/^[«“]\s*|\s*[»”]$/g, ''))}</h2>
      <p class="quote__src fade">— ${tx(C.profil.quoteSource)}</p>
      <ol class="pillars fade">${C.profil.pillars.map((p, j) => `<li><span>0${j + 1}</span><h3>${tx(p.k)}</h3><p>${tx(p.v)}</p></li>`).join('')}</ol>
    </div>`;
  }
  if (s.kind === 'place') {
    const P = C.places[s.place], D = M.places[s.place], f = D.file != null ? C.dossiers.items[D.file] : null;
    const items = D.items.map(entryOf).filter(Boolean);
    return `<div class="panel panel--place">
      <p class="eyebrow">${n} · ${esc(coordOf(P))}</p>
      <h2 class="city">${kinetic(t(P.name))}</h2>
      <p class="city__title fade"><em>${tx(D.title)}</em><span>${esc(D.period)}</span></p>
      <ul class="items fade">${items.map((e) => `<li><b>${tx(e.role)}</b><span>${tx(e.org)}${e.period ? ` · ${esc(e.period)}` : ''}</span></li>`).join('')}</ul>
      ${s.place === 'zhongli' ? `<p class="flight fade"><span>${tx(M.flight)}</span><b data-flight>0</b> km</p>` : ''}
      ${f ? (f.url
        ? `<a class="paper fade" href="../${esc(f.url)}" target="_blank" rel="noopener"><span>${tx(f.type)}</span><b>${tx(f.title)}</b>${arrow}</a>`
        : `<p class="paper paper--pending fade"><span>${tx(f.type)} · ${tx(M.pending)}</span><b>${tx(f.title)}</b></p>`) : ''}
    </div>`;
  }
  if (s.kind === 'files') {
    return `<div class="panel panel--files">
      <p class="eyebrow">${n} · ${tx(M.papersKicker)}</p>
      <h2 class="big">${kinetic(t(M.papersTitle))}</h2>
      <ol class="papers fade">${C.dossiers.items.map((f, j) => `<li>${f.url ? `<a href="../${esc(f.url)}" target="_blank" rel="noopener">` : '<div>'}
        <span class="papers__n">${String.fromCharCode(65 + j)}</span>
        <span class="papers__body"><b>${tx(f.title)}</b><span>${tx(f.type)} · ${tx(f.meta)}</span></span>
        <span class="papers__go">${f.url ? `${tx(M.read)} ${arrow}` : tx(M.pending)}</span>
      ${f.url ? '</a>' : '</div>'}</li>`).join('')}</ol>
    </div>`;
  }
  if (s.kind === 'langues') {
    const LV = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    return `<div class="panel panel--langues">
      <p class="eyebrow">${n} · ${tx(M.langTitle)}</p>
      <ul class="tongues">${C.langues.items.map((l) => {
        const idx = l.level === 'native' ? 6 : LV.indexOf(l.level) + 1;
        return `<li><span class="tongue" lang="${esc(l.lang)}">${kinetic(l.native)}</span>
          <span class="tongue__meta fade"><b>${tx(l.name)} · ${l.level === 'native' ? tx(C.ui.native) : esc(l.level)}</b>
          <span class="meter" style="--v:${idx / 6}"></span>${tx(l.note)}</span></li>`;
      }).join('')}</ul>
    </div>`;
  }
  // contact
  const [u, d, tld] = C.contact.emailParts;
  return `<div class="panel panel--contact">
    <p class="eyebrow">${n} · ${tx(C.hero.status)}</p>
    <h2 class="giant giant--contact">${kinetic(t(M.contactTitle))}</h2>
    <p class="contact__lead fade">${tx(C.contact.lead)}</p>
    <div class="contact__row fade">
      <button class="pill pill--solid" type="button" data-email data-u="${esc(u)}" data-d="${esc(d)}" data-tld="${esc(tld)}">${esc(u)} ⟨@⟩ ··· <span>${tx(C.ui.reveal)}</span></button>
      ${C.contact.links.map((l) => `<a class="pill" href="${esc(l.url)}" target="_blank" rel="noopener me">${esc(l.label)} ${arrow}</a>`).join('')}
      <a class="pill" href="../${esc(C.hero.cv.fr)}" download>CV FR</a>
      <a class="pill" href="../${esc(C.hero.cv.en)}" download>CV EN</a>
    </div>
    <p class="contact__foot fade">${tx(C.ui.footer)}</p>
  </div>`;
}

function build() {
  const main = $('[data-chapters]');
  main.innerHTML = SCENES.map((s, i) => `<section class="snap" id="c-${i}" aria-label="${esc(t(C.meridien.labels[i]))}">${sceneHTML(s, i)}</section>`).join('');
  $('[data-rail]').innerHTML = SCENES.map((s, i) => `<a href="#c-${i}" data-go="${i}"><span>${esc(t(C.meridien.labels[i]))}</span></a>`).join('');
  $('[data-rail]').setAttribute('aria-label', lang === 'fr' ? 'Chapitres' : 'Chapters');
  $('.counter__of').textContent = `/ ${String(SCENES.length).padStart(2, '0')}`;
  panels = $$('.panel', main);

  document.documentElement.lang = lang;
  $$('[data-lang] span').forEach((s) => s.classList.toggle('is-on', s.dataset.l === lang));
  $('[data-styles-label]').textContent = t(C.ui.styles);
  const base = { depeche: '../', convention: '../convention/', meridien: './' };
  $$('[data-style-link]').forEach((a) => { const k = a.dataset.styleLink; a.textContent = t(C.ui.styleNames[k]); a.href = `${base[k]}?lang=${lang}`; });
  $('.skip').textContent = lang === 'fr' ? 'Aller au contenu' : 'Skip to content';

  const btn = $('[data-email]');
  btn.addEventListener('click', async () => {
    const addr = `${btn.dataset.u}@${btn.dataset.d}.${btn.dataset.tld}`;
    if (!btn.dataset.shown) { btn.dataset.shown = '1'; btn.innerHTML = `${esc(addr)} <span>${tx(C.ui.copy)}</span>`; return; }
    try { await navigator.clipboard.writeText(addr); btn.querySelector('span').textContent = t(C.ui.copied); } catch { location.href = `mailto:${addr}`; }
  });
  sceneF = -1; // force a full refresh
}

/* ---------------- stage ---------------- */
const canvas = $('[data-globe]');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1, panels = [], sceneF = -1, spin = 0, lastT = performance.now();

function resize() {
  DPR = Math.min(2, devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
  sceneF = -1;
}

function frameOf(s) {
  if (narrow.matches) return NARROW_FRAME[s.kind] || [.5, .3, .95];
  return s.frame;
}

// interpolated camera state for a fractional chapter position
function cameraAt(f) {
  const i = clamp(Math.floor(f), 0, SCENES.length - 1), j = Math.min(i + 1, SCENES.length - 1), k = ease(clamp(f - i));
  const A = SCENES[i], B = SCENES[j], FA = frameOf(A), FB = frameOf(B);
  const hop = Math.min(1, Math.hypot(B.cam[0] - A.cam[0], B.cam[1] - A.cam[1]) / 70);
  const zoom = lerp(A.cam[2], B.cam[2], k) * (1 - .5 * hop * Math.sin(Math.PI * k));
  return {
    lon: lerp(A.cam[0], B.cam[0], k), lat: lerp(A.cam[1], B.cam[1], k), zoom,
    cx: lerp(FA[0], FB[0], k), cy: lerp(FA[1], FB[1], k), rs: lerp(FA[2], FB[2], k),
    pal: [0, 1, 2].map((n) => mixHex(A.pal[n], B.pal[n], k)),
    spinW: lerp(A.spin || 0, B.spin || 0, k), dim: lerp(A.dim ?? 1, B.dim ?? 1, k),
  };
}

function draw(cam) {
  const lon0 = (cam.lon + spin) * RAD, lat0 = cam.lat * RAD;
  const cl = Math.cos(lon0), sl = Math.sin(lon0), cp = Math.cos(lat0), sp = Math.sin(lat0);
  const base = Math.min(H * .4, W * (narrow.matches ? .46 : .3));
  const R = base * cam.rs * cam.zoom * DPR, cx = cam.cx * W * DPR, cy = cam.cy * H * DPR;
  const accent = cam.pal[2];
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // atmosphere
  const g = ctx.createRadialGradient(cx, cy, R * .7, cx, cy, R * 1.35);
  g.addColorStop(0, cam.pal[1]); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = .55 * cam.dim; ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, R * 1.35, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = .35 * cam.dim; ctx.strokeStyle = accent; ctx.lineWidth = DPR;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();

  const project = (x, y, z) => {
    const x1 = x * cl - z * sl, z1 = x * sl + z * cl;
    return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
  };
  const fineA = clamp((cam.zoom - 1.6) / 1);
  const size = (1.15 + .35 * Math.min(cam.zoom, 4)) * DPR;
  // dots are batched into alpha buckets: one fill per bucket instead of one state change per dot
  const BUCKETS = 10;
  const paths = Array.from({ length: BUCKETS }, () => new Path2D());
  const dots = (arr, alphaOf, k = 1) => {
    for (let i = 0; i < arr.length; i += 5) {
      const x = arr[i], y = arr[i + 1], z = arr[i + 2];
      const x1 = x * cl - z * sl, z1 = x * sl + z * cl, z2 = y * sp + z1 * cp;
      if (z2 <= 0) continue;
      const sx = cx + x1 * R, sy = cy - (y * cp - z1 * sp) * R;
      if (sx < -4 || sy < -4 || sx > canvas.width + 4 || sy > canvas.height + 4) continue;
      const a = alphaOf(i) * (.12 + .78 * z2);
      if (a <= .02) continue;
      const s = size * k * (.6 + .4 * z2);
      paths[Math.min(BUCKETS - 1, Math.floor(a * BUCKETS))].rect(sx - s / 2, sy - s / 2, s, s);
    }
  };
  dots(DOTS, (i) => 1 - fineA * COARSE_W[i / 5]);
  if (fineA > 0) dots(FINE, (i) => fineA * FINE_W[i / 5] * .8, Math.min(1, .55 + .5 / cam.zoom));
  ctx.fillStyle = '#f4e9d8';
  paths.forEach((path, b) => { ctx.globalAlpha = ((b + .5) / BUCKETS) * cam.dim; ctx.fill(path); });

  // flight arcs between the four places, drawn as the chapters advance
  const P = C.places, f = sceneF;
  ROUTE.slice(0, -1).forEach((key, k) => {
    const a = P[key], b = P[ROUTE[k + 1]], prog = ease(clamp(f - (2 + k)));
    if (prog <= 0) return;
    const va = vec(a.lat, a.lon), vb = vec(b.lat, b.lon);
    const om = Math.acos(clamp(va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2], -1, 1));
    const lift = .04 + .22 * (om / Math.PI);
    const N = 90;
    ctx.globalAlpha = .95 * cam.dim; ctx.strokeStyle = accent; ctx.lineWidth = 1.6 * DPR; ctx.lineCap = 'round';
    ctx.beginPath();
    let pen = false, head = null;
    for (let s = 0; s <= N * prog; s++) {
      const u = s / N, A = Math.sin((1 - u) * om) / Math.sin(om), B = Math.sin(u * om) / Math.sin(om);
      const h = 1 + lift * Math.sin(Math.PI * u);
      const [x, y, z] = project((A * va[0] + B * vb[0]) * h, (A * va[1] + B * vb[1]) * h, (A * va[2] + B * vb[2]) * h);
      const vis = z > 0 || Math.hypot(x, y) > 1;
      const sx = cx + x * R, sy = cy - y * R;
      if (vis) { if (pen) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); pen = true; head = [sx, sy]; } else pen = false;
    }
    ctx.stroke();
    if (head && prog < 1) { ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(head[0], head[1], 3.2 * DPR, 0, Math.PI * 2); ctx.fill(); }
  });

  // place markers
  ctx.font = `500 ${10.5 * DPR}px "Geist Mono", ui-monospace, monospace`;
  ctx.textBaseline = 'middle';
  ROUTE.forEach((key, k) => {
    const p = P[key], [vx, vy, vz] = vec(p.lat, p.lon), [x, y, z] = project(vx, vy, vz);
    if (z <= .05) return;
    const sx = cx + x * R, sy = cy - y * R;
    const on = clamp(1 - Math.abs(f - (2 + k)) * 1.4);
    const reached = clamp(f - (1.5 + k) * 1);
    const a = Math.max(.35, reached) * z * cam.dim;
    ctx.globalAlpha = a; ctx.fillStyle = accent;
    ctx.beginPath(); ctx.arc(sx, sy, (3 + 2 * on) * DPR, 0, Math.PI * 2); ctx.fill();
    if (on > .01 && !reduceMotion.matches) {
      const ph = (performance.now() / 1600) % 1;
      ctx.globalAlpha = on * (1 - ph) * .8; ctx.strokeStyle = accent; ctx.lineWidth = 1.2 * DPR;
      ctx.beginPath(); ctx.arc(sx, sy, (5 + 22 * ph) * DPR, 0, Math.PI * 2); ctx.stroke();
    }
    if (cam.zoom > 1.6 || on > .3) {
      ctx.globalAlpha = Math.max(.45, on) * z * cam.dim; ctx.fillStyle = '#f4e9d8';
      ctx.fillText(t(p.name).toUpperCase(), sx + 12 * DPR, sy);
    }
  });
  ctx.globalAlpha = 1;
}

let flightShown = -1;
function update(now) {
  const dt = Math.min(64, now - lastT); lastT = now;
  const f = clamp(scrollY / Math.max(1, innerHeight), 0, SCENES.length - 1);
  const cam = cameraAt(f);
  if (!reduceMotion.matches) spin += dt * .004 * cam.spinW;
  // when the camera arrives somewhere specific, let the idle spin unwind smoothly
  if (cam.spinW < .02) spin = ((((spin + 180) % 360) + 360) % 360 - 180) * .9;

  if (f !== sceneF) {
    sceneF = f;
    const root = document.documentElement.style;
    root.setProperty('--bg', cam.pal[0]); root.setProperty('--glow', cam.pal[1]); root.setProperty('--accent', cam.pal[2]);
    panels.forEach((p, i) => {
      const d = clamp(i - f, -1.2, 1.2), ad = Math.abs(d);
      p.style.setProperty('--d', d.toFixed(4)); p.style.setProperty('--ad', ad.toFixed(4));
      const vis = ad < .98;
      if (p.dataset.vis !== String(vis)) { p.dataset.vis = String(vis); p.style.visibility = vis ? 'visible' : 'hidden'; }
      p.classList.toggle('is-active', ad < .35);
    });
    const cur = Math.round(f);
    $('[data-count]').textContent = String(cur + 1).padStart(2, '0');
    $('[data-count-name]').textContent = t(C.meridien.labels[cur]);
    $$('[data-go]').forEach((a, i) => a.toggleAttribute('aria-current', i === cur));
    $('[data-readout]').textContent = `LAT ${dms(cam.lat, 'N', 'S')}   LON ${dms(((cam.lon + spin + 540) % 360) - 180, 'E', 'W')}   ×${cam.zoom.toFixed(2)}`;
    // kilometre counter for the long flight
    const fl = $('[data-flight]');
    if (fl) {
      const kmTotal = km(C.places.reims, C.places.zhongli), v = Math.round(kmTotal * ease(clamp(f - 4)) / 10) * 10;
      if (v !== flightShown) { flightShown = v; fl.textContent = new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-GB').format(v); }
    }
  }
  draw(cam);
  requestAnimationFrame(update);
}

/* ---------------- boot ---------------- */
async function boot() {
  try {
    C = await (await fetch('../content.json?v=20261030g')).json();
  } catch (e) {
    console.error('content.json could not be loaded', e);
    return;
  }
  lang = pickLang();
  if (!reduceMotion.matches) document.documentElement.classList.add('motion');
  resize();
  build();
  addEventListener('resize', resize);
  narrow.addEventListener('change', resize);

  // close the styles menu on an outside click
  document.addEventListener('click', (e) => { $$('details.styles[open]').forEach((d) => { if (!d.contains(e.target)) d.open = false; }); });
  $('[data-lang]').addEventListener('click', () => {
    lang = lang === 'fr' ? 'en' : 'fr';
    try { localStorage.setItem('cb-lang', lang); } catch { /* ignore */ }
    const u = new URL(location.href); u.searchParams.set('lang', lang); history.replaceState(null, '', u);
    build();
  });
  // rail and in-page links: jump to a chapter (the snap does the rest)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#c-"]'); if (!a) return;
    e.preventDefault();
    const i = +a.getAttribute('href').slice(3);
    scrollTo({ top: i * innerHeight, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  });
  requestAnimationFrame(update);
}

boot();
