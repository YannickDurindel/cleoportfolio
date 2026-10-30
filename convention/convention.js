// Cléo Beaufils · « Convention » design. Same content.json as the dispatch design, rendered as a treaty.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

let C = null;
let lang = 'fr';

const t = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? (v[lang] ?? v.fr ?? '') : (v ?? '');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tx = (v) => esc(t(v));

function pickLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'fr' || q === 'en') return q;
  try { const s = localStorage.getItem('cb-lang'); if (s === 'fr' || s === 'en') return s; } catch { /* storage unavailable */ }
  return (navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const titleWord = () => (lang === 'fr' ? 'Titre' : 'Part');
const articleLabel = (n) => (lang === 'fr' ? (n === 1 ? 'Article premier' : `Article ${n}`) : `Article ${n}`);
const today = () => new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Taipei' }).format(new Date());

/* ---------------- pieces ---------------- */
// one entry of parcours as a numbered paragraph: "Role, Org (period). Text"
const entry = (e) => {
  const period = e.period ? ` <span class="per">(${esc(e.period.trim().replace(/\s*–\s*$/, lang === 'fr' ? ' – en cours' : ' – ongoing'))})</span>` : '';
  return `<li><p><strong>${tx(e.role)}</strong>, ${tx(e.org)}${period}.${t(e.text) ? ` ${tx(e.text)}` : ''}</p></li>`;
};

function render() {
  const V = C.convention;
  let art = 0, tit = 0;
  const toc = [];
  const title = (key) => {
    tit += 1;
    toc.push({ id: `titre-${tit}`, label: `${titleWord()} ${ROMAN[tit - 1]}`, name: t(V.titles[key]) });
    return `<h2 class="tit" id="titre-${tit}"><span>${titleWord()} ${ROMAN[tit - 1]}</span>${tx(V.titles[key])}</h2>`;
  };
  const article = (key, body) => {
    art += 1;
    return `<section class="art" id="art-${art}" aria-labelledby="art-${art}-h">
      <h3 id="art-${art}-h"><span class="art__n">${articleLabel(art)}</span><span class="art__name">${tx(V.articles[key])}</span></h3>
      ${body}
    </section>`;
  };

  const preamble = `<section class="pre" aria-labelledby="pre-h">
      <h2 class="tit tit--pre" id="pre-h">${tx(V.preambleTitle)}</h2>
      <p class="pre__parties">${tx(V.parties)}</p>
      ${V.preamble.map((p) => { const [w, ...r] = t(p).split(' '); return `<p class="pre__c"><em>${esc(w)}</em> ${esc(r.join(' '))}</p>`; }).join('')}
      <p class="pre__agreed">${tx(V.agreed)}</p>
    </section>`;
  toc.push({ id: 'pre-h', label: '', name: t(V.preambleTitle) });

  const photo = C.hero.photo ? `<figure class="annex">
      <img src="../${esc(C.hero.photo)}" alt="${tx(C.hero.photoAlt)}" width="902" height="1128">
      <figcaption>${tx(V.photoCaption)}</figcaption>
    </figure>` : '';

  const files = C.dossiers.items.map((f) => `<li><p>
      <em class="doc">${tx(f.title)}</em>. ${tx(f.type)} · ${tx(f.meta)}.
      ${tx(f.excerpt)}</p><p class="links">
      ${f.url ? `<a class="pdf" href="../${esc(f.url)}" target="_blank" rel="noopener">${tx(V.readPdf)}</a>` : `<span class="pending">${tx(V.pending)}</span>`}
    </p></li>`).join('');

  const stays = `<div class="tbl"><table>
      <thead><tr><th scope="col">${tx(V.tablePlace)}</th><th scope="col">${tx(V.tablePeriod)}</th><th scope="col">${tx(V.tableObject)}</th></tr></thead>
      <tbody>${C.terrain.stays.map((s) => { const p = C.places[s.place] || {}; return `<tr><th scope="row">${tx(p.label || p.name)}</th><td class="num">${esc(s.dates)}</td><td>${tx(s.what)}</td></tr>`; }).join('')}</tbody>
    </table></div>`;

  const langs = `<ol class="paras">${C.langues.items.map((l) => `<li><p><strong>${tx(l.name)}</strong>${l.native !== t(l.name) ? ` <span lang="${esc(l.lang)}" class="native">${esc(l.native)}</span>` : ''} : ${l.level === 'native' ? tx(C.ui.native).toLowerCase() : `${tx(V.level).toLowerCase()} ${esc(l.level)}`}. ${tx(l.note)}.</p></li>`).join('')}</ol>`;

  const [u, d, tld] = C.contact.emailParts;
  const contact = `<ol class="paras">
      <li><p>${tx(V.contact)}</p></li>
      <li><p class="contact">
        <span class="email" data-email>${esc(u)} ⟨@⟩ ···</span>
        <button type="button" class="btn" data-email-btn>${tx(C.ui.reveal)}</button>
        ${C.contact.links.map((l) => `<a class="btn btn--ghost" href="${esc(l.url)}" target="_blank" rel="noopener me">${esc(l.label)} ↗</a>`).join('')}
      </p></li>
    </ol>`;

  const cv = `<ol class="paras"><li><p>${tx(V.depositaire)}
      </p><p class="links"><a class="pdf" href="../${esc(C.hero.cv.fr)}" download>CV · français</a>
      <a class="pdf" href="../${esc(C.hero.cv.en)}" download>CV · English</a></p></li></ol>`;

  const body = [
    preamble,
    title('identite'),
    article('identite', `${photo}<ol class="paras"><li><p>${tx(V.identite)}</p></li><li><p>${tx(V.identite2)}</p></li></ol>`),
    article('domaines', `<p class="lead">${lang === 'fr' ? 'La soussignée exerce ses compétences dans les domaines suivants :' : 'The undersigned exercises her competences in the following fields:'}</p>
      <ol class="alpha">${C.profil.pillars.map((p) => `<li><p><strong>${tx(p.k)}</strong> : ${tx(p.v)}</p></li>`).join('')}</ol>`),
    title('formation'),
    article('formation', `<ol class="paras">${C.parcours.education.map(entry).join('')}</ol>`),
    article('experience', `<ol class="paras">${C.parcours.experience.map(entry).join('')}</ol>`),
    article('engagements', `<ol class="paras">${(C.parcours.engagements || []).map(entry).join('')}</ol>`),
    title('travaux'),
    article('travaux', `<ol class="paras">${files}</ol>`),
    title('terrain'),
    article('terrain', stays),
    title('langues'),
    article('langues', langs),
    title('final'),
    article('vigueur', `<ol class="paras"><li><p>${tx(V.vigueur)}</p></li></ol>`),
    article('contact', contact),
    article('depositaire', cv),
    `<section class="sign" aria-label="${tx(V.inWitness)}">
      <p>${tx(V.inWitness)}</p>
      <p>${tx(V.doneAt)} ${esc(today())}.</p>
      <div class="sign__block">
        <p class="sign__for">${tx(V.signatory)}</p>
        <p class="sign__sig" aria-hidden="true">Cléo Beaufils</p>
        <p class="sign__name">Cléo Beaufils</p>
      </div>
    </section>`,
  ].join('');

  $('[data-text]').innerHTML = body;
  // the preamble goes first in the contents
  toc.unshift(toc.splice(toc.findIndex((x) => x.id === 'pre-h'), 1)[0]);
  $('[data-toc]').innerHTML = toc.map((x) => `<li><a href="#${x.id}">${x.label ? `<span>${esc(x.label)}</span>` : ''}${esc(x.name)}</a></li>`).join('');

  // static bits
  document.documentElement.lang = lang;
  document.title = `${t(V.kind)} · Cléo Beaufils`;
  $$('[data-ref]').forEach((n) => { n.textContent = t(V.docRef); });
  $('[data-kind]').textContent = t(V.kind);
  $('[data-sub]').textContent = t(V.subtitle);
  $('[data-date]').textContent = `Zhongli, ${today()}`;
  $('[data-contents]').textContent = t(V.contents);
  $('[data-footer]').textContent = t(V.footer);
  $('[data-authentic]').textContent = `${t(V.authentic)} :`;
  $$('.bar__opt').forEach((o) => o.classList.toggle('is-on', o.dataset.l === lang));
  const sw = $('[data-switch]');
  sw.textContent = `⇄ ${t(V.switchStyle)}`;
  sw.href = `../?lang=${lang}`;

  emailWiring(u, d, tld);
  spy();
}

let emailShown = false;
function emailWiring(u, d, tld) {
  const btn = $('[data-email-btn]'), box = $('[data-email]');
  const addr = [u, '@', d, '.', tld].join('');
  const show = () => { box.innerHTML = `<a href="mailto:${esc(addr)}">${esc(addr)}</a>`; btn.textContent = t(C.ui.copy); };
  if (emailShown) show();
  btn.onclick = async () => {
    if (!emailShown) { emailShown = true; show(); $('a', box).focus(); return; }
    try { await navigator.clipboard.writeText(addr); btn.textContent = t(C.ui.copied); setTimeout(() => { btn.textContent = t(C.ui.copy); }, 1800); } catch { /* clipboard denied */ }
  };
}

// highlight the current title in the contents
let io;
function spy() {
  io?.disconnect();
  const links = $$('.toc a');
  io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    links.forEach((a) => a.toggleAttribute('aria-current', a.getAttribute('href') === `#${e.target.id}`));
  }), { rootMargin: '-20% 0px -70% 0px' });
  $$('.tit[id]').forEach((h) => io.observe(h));
}

async function boot() {
  try {
    C = await (await fetch('../content.json?v=20261030f')).json();
  } catch (e) {
    console.error('content.json could not be loaded', e);
    return;
  }
  lang = pickLang();
  render();
  $('[data-lang]').addEventListener('click', () => {
    lang = lang === 'fr' ? 'en' : 'fr';
    try { localStorage.setItem('cb-lang', lang); } catch { /* ignore */ }
    const u = new URL(location.href); u.searchParams.set('lang', lang); history.replaceState(null, '', u);
    render();
  });
}

boot();
