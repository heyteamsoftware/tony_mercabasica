/* MercaBásica 2026 · CIFP Tony Gallardo — interacción sin dependencias */
(() => {
  'use strict';

  const d = document;
  const root = d.documentElement;
  root.classList.add('js');

  const $ = (s, c = d) => c.querySelector(s);
  const $$ = (s, c = d) => [...c.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const NS = 'http://www.w3.org/2000/svg';
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => mqReduce.matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* sin almacenamiento */ } },
  };
  // aleatorio con semilla: el "pulso" del dibujo a mano es estable entre recargas
  const rng = (seed) => { let s = (seed >>> 0) || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
  const f1 = (n) => Math.round(n * 10) / 10;

  /* ------------------------------------------------------------------
     Toldos: rayas con un leve temblor de pincel y faldón festoneado
     ------------------------------------------------------------------ */
  let gradId = 0;
  function drawAwning(el) {
    const w = Math.round(el.clientWidth), h = Math.round(el.clientHeight);
    if (!w || !h) return;
    const A = el.dataset.a, B = el.dataset.b, seg = +el.dataset.seg || 64;
    const n = Math.max(4, Math.round(w / seg));
    const s = w / n, r = s / 2;
    const tabH = Math.min(h * 0.44, r + Math.min(h * 0.24, 40));
    const top = h - tabH;
    const R = rng((+el.dataset.seed || 1) * 97 + n);
    const j = (k) => (R() - 0.5) * k;
    const id = `aw${++gradId}`;
    let svg = `<svg xmlns="${NS}" viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false">`;
    svg += `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0A1430" stop-opacity=".26"/><stop offset=".7" stop-color="#0A1430" stop-opacity="0"/></linearGradient></defs>`;
    svg += `<rect width="${w}" height="${f1(top + 2)}" fill="${B}"/>`;
    for (let i = 0; i < n; i += 2) {
      const x0 = i * s, x1 = x0 + s;
      svg += `<path d="M${f1(x0 + j(3))} 0Q${f1(x0 + j(7))} ${f1(top / 2)} ${f1(x0 + j(2))} ${f1(top + 2)}L${f1(x1 + j(2))} ${f1(top + 2)}Q${f1(x1 + j(7))} ${f1(top / 2)} ${f1(x1 + j(3))} 0Z" fill="${A}"/>`;
    }
    svg += `<rect width="${w}" height="${f1(top + 2)}" fill="url(#${id})"/>`;
    for (let i = 0; i < n; i++) {
      const x0 = f1(i * s), x1 = f1(i * s + s), y = f1(h - r - 1.5);
      const isA = i % 2 === 0;
      svg += `<g class="tab" style="--i:${i}"><path d="M${x0} ${f1(top)}H${x1}V${y}A${f1(r)} ${f1(r)} 0 0 1 ${x0} ${y}Z" fill="${isA ? A : B}" ${isA ? '' : `stroke="${A}" stroke-width="1.6"`}/></g>`;
    }
    svg += `<rect y="${f1(top - 1)}" width="${w}" height="2" fill="#0A1430" opacity=".1"/>`;
    el.innerHTML = svg + '</svg>';
  }

  /* Banderines */
  function drawBunting(el) {
    const w = Math.round(el.clientWidth), h = Math.round(el.clientHeight);
    if (!w || !h) return;
    const colors = ['#CC544C', '#FBE36F', '#0B74C4', '#2F6A4F', '#C94B6D', '#D99A2B', '#FFFDF6'];
    const R = rng(42);
    const y0 = 6, sag = h * 0.32;
    const P = (t) => [w * t, (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (y0 + sag * 2) + t * t * y0];
    const n = Math.max(7, Math.round(w / 64));
    const fw = Math.min(46, (w / n) * 0.78), fh = fw * 1.18;
    let svg = `<svg xmlns="${NS}" viewBox="0 0 ${w} ${h}" aria-hidden="true">`;
    svg += `<path d="M0 ${y0}Q${w / 2} ${y0 + sag * 2} ${w} ${y0}" fill="none" stroke="#0A2150" stroke-opacity=".55" stroke-width="1.5"/>`;
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const [x, y] = P(t);
      const [xa, ya] = P(t - 0.01), [xb, yb] = P(t + 0.01);
      const ang = Math.atan2(yb - ya, xb - xa) * 180 / Math.PI;
      const c = colors[k % colors.length];
      const jx = (R() - 0.5) * 4;
      svg += `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(ang)})"><g class="flag" style="--i:${k}"><path d="M${f1(-fw / 2)} 0L${f1(fw / 2)} 0L${f1(jx)} ${f1(fh + (R() - .5) * 6)}Z" fill="${c}" ${c === '#FFFDF6' ? 'stroke="#CC544C" stroke-width="1.4"' : ''}/></g></g>`;
    }
    el.innerHTML = svg + '</svg>';
  }

  /* Guirnalda de bombillas del encendido */
  function drawGarland(el) {
    const w = Math.round(el.clientWidth), h = Math.round(el.clientHeight);
    if (!w || !h) return;
    const colors = ['#FFD27A', '#FF6B5B', '#7FD3A0', '#6FB6FF', '#FF9EC0', '#FFE9A8'];
    const strands = [
      { y0: h * 0.05, y1: h * 0.16, sag: h * 0.5 },
      { y0: h * 0.34, y1: h * 0.22, sag: h * 0.44 },
    ];
    const gap = w < 600 ? 44 : 62;
    let svg = `<svg xmlns="${NS}" viewBox="0 0 ${w} ${h}" aria-hidden="true">`;
    const bulbs = [];
    strands.forEach((st, si) => {
      const x0 = -30, x1 = w + 30, cx = w / 2, cy = (st.y0 + st.y1) / 2 + st.sag;
      const P = (t) => [(1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) * (1 - t) * st.y0 + 2 * (1 - t) * t * cy + t * t * st.y1];
      svg += `<path class="wire" d="M${x0} ${f1(st.y0)}Q${cx} ${f1(cy)} ${x1} ${f1(st.y1)}"/>`;
      const n = Math.round(w / gap);
      for (let k = 0; k < n; k++) {
        const [x, y] = P((k + 0.5 + si * 0.5) / (n + 0.5));
        bulbs.push({ x, y, c: colors[(k + si * 3) % colors.length] });
      }
    });
    bulbs.sort((a, b) => a.x - b.x).forEach((b, k) => {
      const { x, y } = b;
      svg += `<g style="--c:${b.c};--k:${k}">`
        + `<circle class="bulb__glow" cx="${f1(x)}" cy="${f1(y + 20)}" r="17" filter="url(#glow)"/>`
        + `<rect class="bulb__cap" x="${f1(x - 4)}" y="${f1(y)}" width="8" height="8" rx="1.5"/>`
        + `<path class="bulb__glass" d="M${f1(x - 6)} ${f1(y + 7)}C${f1(x - 10)} ${f1(y + 18)} ${f1(x - 5)} ${f1(y + 29)} ${f1(x)} ${f1(y + 31)}C${f1(x + 5)} ${f1(y + 29)} ${f1(x + 10)} ${f1(y + 18)} ${f1(x + 6)} ${f1(y + 7)}Z"/>`
        + `<ellipse class="bulb__shine" cx="${f1(x - 2.6)}" cy="${f1(y + 15)}" rx="1.5" ry="4"/>`
        + `</g>`;
    });
    el.innerHTML = svg + '</svg>';
  }

  // Redibujo con ResizeObserver (solo si cambia el ancho)
  const drawers = [
    ['[data-awning]', drawAwning],
    ['[data-bunting]', drawBunting],
  ];
  const ro = 'ResizeObserver' in window ? new ResizeObserver((entries) => {
    entries.forEach((e) => {
      const el = e.target, w = Math.round(e.contentRect.width);
      if (el._w === w) return;
      el._w = w;
      el._draw(el);
    });
  }) : null;
  drawers.forEach(([sel, fn]) => $$(sel).forEach((el) => {
    el._draw = fn;
    fn(el);
    el._w = Math.round(el.clientWidth);
    if (ro) ro.observe(el);
  }));

  /* Óvalo festoneado de Panateca (como en el cartel) */
  const oval = $('[data-scallop]');
  if (oval) {
    const cx = 200, cy = 250, rx = 168, ry = 218, bumps = 26, amp = 15;
    let dOut = '';
    for (let k = 0; k <= 720; k++) {
      const t = (k / 720) * Math.PI * 2;
      const b = amp * Math.abs(Math.sin((bumps * t) / 2));
      dOut += `${k ? 'L' : 'M'}${f1(cx + (rx + b) * Math.cos(t))} ${f1(cy + (ry + b) * Math.sin(t))}`;
    }
    oval.innerHTML = `<path d="${dOut}Z" fill="#F5E6E3" stroke="#CC544C" stroke-width="3.2" stroke-linejoin="round"/>`
      + `<ellipse cx="${cx}" cy="${cy}" rx="${rx - 10}" ry="${ry - 10}" fill="none" stroke="#CC544C" stroke-width="2"/>`;
  }

  /* ------------------------------------------------------------------
     Display de siete segmentos (contador y máquina de turnos)
     ------------------------------------------------------------------ */
  const hseg = (y, x1, x2, t) => { const q = t / 2; return `${x1},${y} ${x1 + q},${y - q} ${x2 - q},${y - q} ${x2},${y} ${x2 - q},${y + q} ${x1 + q},${y + q}`; };
  const vseg = (x, y1, y2, t) => { const q = t / 2; return `${x},${y1} ${x + q},${y1 + q} ${x + q},${y2 - q} ${x},${y2} ${x - q},${y2 - q} ${x - q},${y1 + q}`; };
  const T = 10.5;
  const SEGS = {
    a: hseg(7, 11, 49, T), g: hseg(50, 11, 49, T), d: hseg(93, 11, 49, T),
    f: vseg(7, 11, 47, T), b: vseg(53, 11, 47, T), e: vseg(7, 53, 89, T), c: vseg(53, 53, 89, T),
  };
  const MAP = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' };
  const digitSVG = (ch) => {
    const on = MAP[ch] ?? '';
    return `<svg viewBox="0 0 62 100" aria-hidden="true"><g transform="skewX(-7) translate(7 0)">${Object.entries(SEGS).map(([k, p]) => `<polygon class="${on.includes(k) ? 'on' : 'off'}" points="${p}"/>`).join('')}</g></svg>`;
  };
  const setSeg = (el, str) => { if (!el || el._v === str) return; el._v = str; el.innerHTML = [...str].map(digitSVG).join(''); };
  const pad = (n) => String(n).padStart(2, '0');

  /* Cuenta atrás: 11/12/2026 09:00 en Canarias (UTC+0 en diciembre) */
  const START = Date.UTC(2026, 11, 11, 9, 0);
  const END = Date.UTC(2026, 11, 11, 13, 30);
  const cd = $('[data-countdown]');
  if (cd) {
    const num = $('[data-days]', cd), unit = $('[data-days-unit]', cd), label = $('[data-countdown-label]', cd);
    const paint = () => {
      const now = Date.now();
      // días de calendario que faltan (en hora canaria, UTC+0)
      const days = Math.round((Date.UTC(2026, 11, 11) - Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate())) / 864e5);
      if (now >= END) { label.textContent = 'Gracias'; num.textContent = '♥'; unit.textContent = 'hasta la próxima'; }
      else if (days <= 0) { label.textContent = '¡Es hoy!'; num.textContent = '11'; unit.textContent = 'de diciembre'; }
      else { label.textContent = 'Faltan'; num.textContent = days; unit.textContent = days === 1 ? 'día' : 'días'; }
    };
    paint();
    setInterval(paint, 60000);
  }

  /* ------------------------------------------------------------------
     Revelados con IntersectionObserver
     ------------------------------------------------------------------ */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
  $$('[data-reveal]').forEach((el) => io.observe(el));

  /* ------------------------------------------------------------------
     Recorrido: mapa jugable con pasaporte de sellos
     ------------------------------------------------------------------ */
  const rutaSec = $('[data-ruta]');
  if (rutaSec) initRuta(rutaSec);

  function initRuta(sec) {
    const game = $('[data-ruta-game]', sec), mapEl = $('[data-ruta-map]', sec), world = $('[data-ruta-world]', sec);
    const W = 1600, H = 1100;
    const KEY = 'mb26-ruta', KEYX = 'mb26-ruta-x';

    // Calles del plano: nodos y tramos (coordenadas del dibujo, 1600 × 1100)
    const N = {
      pan: [435, 285], n1: [435, 330], det: [250, 330], c1: [110, 330], rec: [110, 560], c2: [110, 960],
      sup: [175, 960], hor: [330, 960], her: [640, 960], hall: [800, 960], j3: [1000, 960], cre: [1115, 960],
      ima: [1385, 960], c3: [1530, 960], plz: [1530, 620], ale: [1530, 210], car: [640, 330], j2: [1000, 330],
      son: [1000, 445], ave: [1000, 210],
    };
    const E = [['pan', 'n1'], ['n1', 'det'], ['det', 'c1'], ['c1', 'rec'], ['rec', 'c2'], ['c2', 'sup'], ['sup', 'hor'],
      ['hor', 'her'], ['her', 'hall'], ['hall', 'j3'], ['j3', 'cre'], ['cre', 'ima'], ['ima', 'c3'], ['c3', 'plz'],
      ['plz', 'ale'], ['n1', 'car'], ['car', 'her'], ['car', 'j2'], ['j2', 'son'], ['son', 'j3'], ['j2', 'ave'], ['ave', 'ale']];
    const NODE = { hall: 'hall', herrero: 'her', horno: 'hor', superpoderes: 'sup', recuerdos: 'rec', detalles: 'det', panateca: 'pan',
      carpintero: 'car', sonrisas: 'son', aventura: 'ave', alegria: 'ale', imaginacion: 'ima', creativo: 'cre', plaza: 'plz' };
    const BONUS = [
      { id: 'cambio', at: [215, 770] }, { id: 'cambio', at: [560, 470] }, { id: 'cambio', at: [1100, 770] },
      { id: 'ventorrillo', at: [840, 300] }, { id: 'ventorrillo', at: [1145, 312] }, { id: 'ventorrillo', at: [1445, 312] },
      { id: 'radio', at: [748, 842] }, { id: 'tonyband', at: [1345, 1040] },
    ];

    // Textos: salen de la lista del HTML
    const stops = $$('[data-ruta-list] > li', sec).map((li) => ({
      id: li.dataset.id, kind: li.dataset.kind, n: li.dataset.n || '', zone: li.dataset.zone,
      name: $('h3', li).textContent.trim(), text: $('p', li).textContent.trim(), link: $('a', li), node: NODE[li.dataset.id],
    }));
    const bonusInfo = {};
    $$('[data-ruta-bonus] > li', sec).forEach((li) => { bonusInfo[li.dataset.id] = { name: $('h3', li).textContent.trim(), text: $('p', li).textContent.trim() }; });
    if (stops.length < 2 || stops.some((s) => !N[s.node])) return;
    const TOTAL = stops.length;

    /* --- Grafo y camino más corto --- */
    const adj = {};
    const dist2 = (a, b) => Math.hypot(N[a][0] - N[b][0], N[a][1] - N[b][1]);
    E.forEach(([a, b]) => { (adj[a] ||= []).push(b); (adj[b] ||= []).push(a); });
    function path(from, to) {
      const dist = { [from]: 0 }, prev = {}, todo = new Set(Object.keys(N));
      while (todo.size) {
        let u = null;
        todo.forEach((k) => { if (dist[k] !== undefined && (u === null || dist[k] < dist[u])) u = k; });
        if (u === null || u === to) break;
        todo.delete(u);
        (adj[u] || []).forEach((v) => { const nd = dist[u] + dist2(u, v); if (dist[v] === undefined || nd < dist[v]) { dist[v] = nd; prev[v] = u; } });
      }
      const out = [to];
      while (out[0] !== from && prev[out[0]]) out.unshift(prev[out[0]]);
      return out.map((k) => N[k]);
    }

    /* --- Dibujo del plano --- */
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const lines = (arr, cx, cy, size, lh, cls) => {
      const y0 = cy - ((arr.length - 1) * lh) / 2;
      return arr.map((t, k) => `<text class="${cls}" x="${cx}" y="${f1(y0 + k * lh)}" font-size="${size}" text-anchor="middle" dominant-baseline="central">${esc(t)}</text>`).join('');
    };
    function awning(x, y, w, h, A, B, n) {
      const s = w / n, r = s / 2, top = h - r;
      let o = `<rect x="${x}" y="${y}" width="${w}" height="${top}" fill="${B}"/>`;
      for (let k = 0; k < n; k += 2) o += `<rect x="${f1(x + k * s)}" y="${y}" width="${f1(s)}" height="${top}" fill="${A}"/>`;
      for (let k = 0; k < n; k++) {
        const x0 = x + k * s;
        o += `<path d="M${f1(x0)} ${f1(y + top - 1)}h${f1(s)}v1a${f1(r)} ${f1(r)} 0 0 1 ${f1(-s)} 0z" fill="${k % 2 ? B : A}"${k % 2 ? ` stroke="${A}" stroke-width="2"` : ''}/>`;
      }
      return o + `<rect x="${x}" y="${y}" width="${w}" height="7" fill="#0A1430" opacity=".14"/>`;
    }
    function stall(cx, top, w, h, A, B, label, opt = {}) {
      const x = cx - w / 2, aw = h * 0.34, cnt = h * 0.3, body = top + aw;
      let o = `<g class="rt-stall">`;
      o += `<rect x="${x + 8}" y="${top + 10}" width="${w}" height="${h}" rx="6" fill="#0A1430" opacity=".1"/>`;
      o += `<rect x="${x + 10}" y="${body - 4}" width="9" height="${h - aw - cnt + 8}" fill="#8A5A33"/><rect x="${x + w - 19}" y="${body - 4}" width="9" height="${h - aw - cnt + 8}" fill="#8A5A33"/>`;
      if (label) {
        o += `<rect x="${x + 22}" y="${body + 6}" width="${w - 44}" height="${h - aw - cnt - 14}" rx="4" fill="#FFFBF3" stroke="#0A2150" stroke-width="2"/>`;
        o += lines(label, cx, body + (h - aw - cnt) / 2, opt.fs || 17, (opt.fs || 17) * 1.08, 'rt-lab');
      }
      o += `<rect x="${x - 4}" y="${top + h - cnt}" width="${w + 8}" height="12" rx="3" fill="#A86A3A"/>`;
      o += `<rect x="${x}" y="${top + h - cnt + 10}" width="${w}" height="${cnt - 10}" fill="#D4935A"/>`;
      for (let k = 1; k < 6; k++) o += `<rect x="${f1(x + (w * k) / 6)}" y="${top + h - cnt + 10}" width="2.5" height="${cnt - 10}" fill="#A86A3A" opacity=".55"/>`;
      o += awning(x - 10, top, w + 20, aw, A, B, opt.n || 9);
      return o + '</g>';
    }
    function box(x, y, w, h, label, fs = 22) {
      return `<g class="rt-box"><rect x="${x + 7}" y="${y + 7}" width="${w}" height="${h}" rx="18" fill="#0A1430" opacity=".14"/>`
        + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#FFFBF3" stroke="#2B1A4F" stroke-width="4"/>`
        + lines(label, x + w / 2, y + h / 2, fs, fs * 1.12, 'rt-lab') + '</g>';
    }
    const tree = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})" class="rt-tree"><ellipse cx="0" cy="62" rx="30" ry="7" fill="#0A1430" opacity=".12"/><rect x="-6" y="44" width="12" height="18" fill="#8A5A33"/><path d="M0-40 32 8H16L38 48H-38L-16 8H-32Z" fill="#2F6A4F"/><path d="M0-52l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill="#FBE36F"/><circle cx="-12" cy="14" r="4" fill="#CC544C"/><circle cx="14" cy="30" r="4" fill="#FBE36F"/><circle cx="4" cy="-8" r="3.5" fill="#FFFDF6"/><circle cx="-20" cy="38" r="3.5" fill="#FFFDF6"/></g>`;

    let roadD = '';
    E.forEach(([a, b]) => { roadD += `M${N[a][0]} ${N[a][1]}L${N[b][0]} ${N[b][1]}`; });

    let svg = `<svg class="ruta__svg" viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false"><defs>`
      + `<pattern id="rt-stripes" width="130" height="260" patternUnits="userSpaceOnUse"><rect width="130" height="260" fill="#FCECB4"/><path d="M26 0C36 43 36 87 26 130C16 173 16 217 26 260L78 260C67 217 67 173 78 130C89 87 89 43 78 0Z" fill="#FFFDF6" opacity=".8"/></pattern>`
      + `</defs><rect width="${W}" height="${H}" fill="url(#rt-stripes)"/>`;
    // calles
    svg += `<path d="${roadD}" fill="none" stroke="#0A1430" stroke-opacity=".16" stroke-width="44" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 6)"/>`;
    svg += `<path d="${roadD}" fill="none" stroke="#7E2434" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>`;
    svg += `<path d="${roadD}" fill="none" stroke="#9A3344" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>`;
    svg += `<path d="${roadD}" fill="none" stroke="#F8DFA6" stroke-width="3" stroke-dasharray="14 16" opacity=".75"/>`;
    svg += `<path class="ruta__trail" data-ruta-trail d="" />`;
    // zonas
    svg += `<text class="rt-zone" x="390" y="660" text-anchor="middle">El Gran</text><text class="rt-zone" x="390" y="722" text-anchor="middle">Mercado</text><text class="rt-zone-s" x="390" y="770" text-anchor="middle">Zona Patio I</text>`;
    svg += `<text class="rt-zone" x="1300" y="790" text-anchor="middle">La Plaza</text><text class="rt-zone-s" x="1300" y="832" text-anchor="middle">Zona Patio II</text>`;
    svg += `<text class="rt-porche" x="1295" y="282" text-anchor="middle">Porche</text>`;
    // árboles
    svg += tree(70, 170, 1.05) + tree(510, 860, .8) + tree(1062, 640, .8) + tree(1565, 780, .75) + tree(470, 1030, .7) + tree(60, 650, .75);
    // edificio central (ATECA) con la rotulación del cartel
    svg += `<g class="rt-ateca"><rect x="692" y="388" width="276" height="520" rx="14" fill="#0A1430" opacity=".12" transform="translate(7 8)"/>`
      + `<rect x="692" y="388" width="276" height="520" rx="14" fill="#FFFDF6" stroke="#2B1A4F" stroke-width="4"/>`
      + `<rect x="692" y="388" width="276" height="44" rx="14" fill="#CC544C"/><rect x="692" y="414" width="276" height="18" fill="#CC544C"/>`
      + `<text class="rt-ateca__t" x="830" y="418" text-anchor="middle">ATECA</text>`
      + `<image href="assets/img/wordmark.webp" x="712" y="470" width="236" height="75"/>`
      + `<image href="assets/img/year.webp" x="770" y="552" width="120" height="46"/>`
      + `<image href="assets/img/date.webp" x="735" y="612" width="190" height="38"/>`
      + `<image href="assets/img/logo-cifp.webp" x="785" y="672" width="90" height="88"/>`
      + `<rect x="712" y="800" width="236" height="84" rx="12" fill="#FBF6EC" stroke="#2B1A4F" stroke-width="2.5"/>`
      + `<text class="rt-radio" x="862" y="836" text-anchor="middle">Radio Atlante</text><text class="rt-radio-s" x="862" y="864" text-anchor="middle">CIFP TONY GALLARDO</text></g>`;
    // casitas del Gran Mercado
    svg += stall(250, 150, 156, 168, '#E8892F', '#FFF6E0', ['Mil detalles', 'IFC+21'], { fs: 16 });
    svg += stall(435, 92, 172, 190, '#E89AAE', '#FFFBF3', [], { n: 9 })
      + `<image href="assets/img/logo-panateca.webp" x="383" y="166" width="104" height="87"/>`;
    svg += stall(640, 150, 156, 168, '#8A3B2A', '#FFF1DF', ['Carpintero'], { fs: 17 });
    svg += stall(330, 790, 156, 160, '#6E9A3E', '#FFF6E0', ['Horno']);
    svg += stall(640, 790, 156, 160, '#2F4A72', '#E4ECF6', ['Herrero']);
    // talleres
    svg += box(140, 505, 190, 104, ['Taller de los', 'recuerdos'], 21);
    svg += box(16, 984, 250, 104, ['Taller de los', 'superpoderes', 'Espacio NEAE'], 19);
    svg += box(1035, 398, 228, 96, ['Taller de las', 'sonrisas'], 22);
    svg += box(730, 52, 420, 100, ['Taller de la aventura', 'y diversión'], 24);
    svg += box(1350, 40, 240, 120, ['Taller de la', 'alegría y el juego'], 21);
    svg += box(1035, 846, 160, 86, ['Taller', 'creativo'], 21);
    svg += box(1285, 846, 196, 86, ['Taller', 'imaginación'], 21);
    // escenario
    svg += `<g class="rt-stage"><rect x="1112" y="525" width="380" height="200" rx="20" fill="#0A1430" opacity=".14" transform="translate(8 8)"/>`
      + `<rect x="1112" y="525" width="380" height="200" rx="20" fill="#FFFBF3" stroke="#2B1A4F" stroke-width="4"/>`
      + awning(1124, 537, 356, 46, '#CC544C', '#FFFBF3', 14)
      + `<text class="rt-stage__t" x="1302" y="640" text-anchor="middle">La plaza</text><text class="rt-stage__s" x="1302" y="694" text-anchor="middle">ESCENARIO</text></g>`;
    // hall
    svg += `<g><rect x="597" y="1000" width="406" height="86" rx="18" fill="#0A1430" opacity=".14" transform="translate(7 6)"/><rect x="597" y="1000" width="406" height="86" rx="18" fill="#FFFBF3" stroke="#2B1A4F" stroke-width="4"/>`
      + `<text class="rt-hall" x="800" y="1054" text-anchor="middle">Hall del Centro</text></g>`;
    // ventorrillos
    [[840, 218], [1145, 232], [1445, 232]].forEach(([x, y]) => {
      svg += stall(x, y, 88, 78, '#CC544C', '#FFFBF3', [], { n: 6 });
    });
    svg += `<text class="rt-vent" x="840" y="320" text-anchor="middle">VENTORRILLO</text>`;
    // TonyBand
    svg += `<text class="rt-band__t" x="1485" y="1052" text-anchor="middle">La TonyBand</text>`;
    svg += '</svg>';

    /* --- Iconos de las chapas --- */
    const ICON = {
      salida: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11 12 4l9 7v9h-6v-6H9v6H3z" fill="currentColor"/></svg>',
      especial: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-8-5.2-8-11a4.6 4.6 0 0 1 8-3.1A4.6 4.6 0 0 1 20 10c0 5.8-8 11-8 11z" fill="currentColor"/></svg>',
      cambio: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 7.4A5.6 5.6 0 0 0 7 10h7M7 14h7M15.5 16.6A5.6 5.6 0 0 1 7 14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
      ventorrillo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5c-1 1.5 1 2 0 3.5M12 3.5c-1 1.5 1 2 0 3.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      radio: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2.4" fill="currentColor"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
      tonyband: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6l11-2v12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="2.7" fill="currentColor"/><circle cx="17.5" cy="16" r="2.7" fill="currentColor"/></svg>',
    };
    const badge = (s) => (s.kind === 'casita' || s.kind === 'taller' ? `<span>${s.n}</span>` : ICON[s.kind]);
    const kindLabel = (s) => (s.kind === 'casita' ? `Casita ${s.n}` : s.kind === 'taller' ? `Taller ${s.n}` : s.kind === 'salida' ? 'Salida' : 'Taller especial');
    const at = (x, y) => `left:${f1(x / 16)}%;top:${f1(y / 11)}%`;

    let html = svg;
    stops.forEach((s, i) => {
      const [x, y] = N[s.node];
      html += `<button type="button" class="rpin rpin--${s.kind}" style="${at(x, y)}" data-i="${i}" aria-label="${esc(kindLabel(s))}: ${esc(s.name)}">${badge(s)}<i class="rpin__ok" aria-hidden="true"></i></button>`;
    });
    BONUS.forEach((b) => {
      const info = bonusInfo[b.id];
      if (info) html += `<button type="button" class="rpin rpin--extra" style="${at(b.at[0], b.at[1])}" data-x="${b.id}" aria-label="Extra: ${esc(info.name)}">${ICON[b.id]}</button>`;
    });
    html += `<div class="ruta__walker" data-ruta-walker aria-hidden="true"><span class="ruta__me"><svg viewBox="0 0 24 24"><path d="M6 8h12l-1 12H7z" fill="#CC544C"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8" fill="none" stroke="#0A2150" stroke-width="2" stroke-linecap="round"/><path d="M9.5 13.5c.8 1.2 4.2 1.2 5 0" fill="none" stroke="#FFFBF3" stroke-width="1.8" stroke-linecap="round"/></svg></span></div>`;
    world.innerHTML = html;

    const walker = $('[data-ruta-walker]', world), trailEl = $('[data-ruta-trail]', world);
    const pins = $$('.rpin[data-i]', world);
    const card = $('[data-ruta-card]', sec), kicker = $('[data-ruta-kicker]', sec), nameEl = $('[data-ruta-name]', sec),
      textEl = $('[data-ruta-text]', sec), moreEl = $('[data-ruta-more]', sec), stepEl = $('[data-ruta-step]', sec),
      prevBtn = $('[data-ruta-prev]', sec), nextBtn = $('[data-ruta-next]', sec), zoomBtn = $('[data-ruta-zoom]', sec),
      stampsEl = $('[data-ruta-stamps]', sec), countEl = $('[data-ruta-count]', sec), extrasEl = $('[data-ruta-extras]', sec);

    stampsEl.innerHTML = stops.map((s, i) => `<li><button type="button" class="stamp stamp--${s.kind}" data-i="${i}" aria-label="${esc(s.name)}"><span class="stamp__in">${badge(s)}</span></button></li>`).join('');
    const stampBtns = $$('.stamp', stampsEl);

    /* --- Estado --- */
    const parse = (k) => { try { return JSON.parse(store.get(k) || '[]'); } catch { return []; } };
    const ids = new Set(stops.map((s) => s.id));
    let done = new Set(parse(KEY).filter((id) => ids.has(id)));
    const found = new Set(parse(KEYX).filter((id) => bonusInfo[id]));
    let cur = -1, atNode = 'hall', pos = [...N.hall], walking = null, trail = '', mode = 'all', userAll = false, action = 'start';
    let finished = done.size === TOTAL;

    const save = () => { store.set(KEY, JSON.stringify([...done])); store.set(KEYX, JSON.stringify([...found])); };
    const firstMissing = () => stops.findIndex((s) => !done.has(s.id));

    function paintStamps(fresh) {
      stampBtns.forEach((b, i) => {
        const s = stops[i], on = done.has(s.id);
        b.classList.toggle('is-on', on);
        b.classList.toggle('is-cur', i === cur);
        b.setAttribute('aria-label', `${s.name}: ${on ? 'sellado' : 'sin sellar'}`);
        if (on && !b.style.getPropertyValue('--r')) b.style.setProperty('--r', `${Math.round((rng(i * 31 + 7)() - 0.5) * 30)}deg`);
      });
      if (fresh !== undefined) { const b = stampBtns[fresh]; b.classList.remove('is-new'); void b.offsetWidth; b.classList.add('is-new'); }
      pins.forEach((p, i) => { p.classList.toggle('is-done', done.has(stops[i].id)); p.classList.toggle('is-cur', i === cur); if (i === cur) p.setAttribute('aria-current', 'location'); else p.removeAttribute('aria-current'); });
      countEl.textContent = `${done.size} de ${TOTAL} sellos`;
      extrasEl.textContent = `Extras encontrados: ${found.size} de ${Object.keys(bonusInfo).length}`;
    }

    function setCard(k, n, t, more) {
      kicker.textContent = k; nameEl.textContent = n; textEl.textContent = t;
      moreEl.replaceChildren(); moreEl.hidden = !more;
      if (more) moreEl.append(more);
      card.classList.remove('is-flip'); void card.offsetWidth; card.classList.add('is-flip');
    }
    function paintNav() {
      prevBtn.disabled = cur <= 0;
      stepEl.textContent = `${Math.max(0, cur + 1)} / ${TOTAL}`;
      let label;
      if (finished && (cur === -1 || cur === TOTAL - 1)) { action = 'again'; label = 'Otra vuelta'; }
      else if (cur === -1) { action = 'start'; label = done.size ? 'Seguir' : 'Empezar'; }
      else if (cur === TOTAL - 1) { action = 'missing'; label = 'Ir al sello que falta'; }
      else { action = 'next'; label = 'Siguiente'; }
      nextBtn.innerHTML = `${label} <span aria-hidden="true">${action === 'again' ? '↺' : '→'}</span>`;
    }
    function showStop(i) {
      const s = stops[i];
      let more = null;
      if (s.link) { more = s.link.cloneNode(true); more.className = 'ruta__link'; more.textContent = `${s.link.textContent} ↓`; }
      const left = stops.filter((x) => x.id !== s.id && !done.has(x.id)).length;
      if (i === TOTAL - 1 && left) {
        more = d.createTextNode(`Te ${left === 1 ? 'falta 1 sello' : `faltan ${left} sellos`} para completar el pasaporte.`);
      }
      setCard(`${kindLabel(s)} · ${s.zone}`, s.name, s.text, more);
    }
    function showIntro() {
      if (finished) setCard('Pasaporte completo', '¡Catorce de catorce!', 'Ya has recorrido MercaBásica de punta a punta. Ahora solo falta hacerlo en persona el 11 de diciembre.');
      else if (done.size) setCard('Pasaporte MercaBásica', `Llevas ${done.size} de ${TOTAL} sellos`, '¿Seguimos? Te llevamos a la primera parada que te falta.');
    }
    function finale() {
      setCard('Pasaporte completo', '¡Catorce de catorce!', 'Has recorrido MercaBásica de punta a punta: casitas, talleres y escenario. Ahora solo falta hacerlo en persona el 11 de diciembre.');
      mode = 'all'; paintZoom(); kick();
      confetti();
    }

    /* --- Caminar --- */
    function goTo(i) {
      if (i < 0 || i >= TOTAL) return;
      if (walking) endWalk();
      const s = stops[i];
      cur = i;
      if (mode === 'all' && !userAll) mode = 'near';
      showStop(i); paintNav(); paintStamps(); paintZoom();
      const pts = atNode === s.node ? [N[s.node]] : path(atNode, s.node);
      atNode = s.node;
      if (pts.length < 2 || reduced()) { pos = [...N[s.node]]; addTrail(pts); arrive(i); kick(); return; }
      const cum = [0];
      for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
      const L = cum[cum.length - 1];
      walking = { i, pts, cum, L, t0: performance.now(), dur: clamp(L / 560, 0.55, 2.6) * 1000 };
      walker.classList.add('is-walking');
      kick();
    }
    function pointAt(w, dd) {
      let k = 1;
      while (k < w.cum.length - 1 && w.cum[k] < dd) k++;
      const a = w.pts[k - 1], b = w.pts[k], seg = w.cum[k] - w.cum[k - 1] || 1, t = clamp((dd - w.cum[k - 1]) / seg, 0, 1);
      return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], k };
    }
    function partial(w, dd) {
      if (!w) return '';
      const { p, k } = pointAt(w, dd);
      return `M${w.pts.slice(0, k).map((q) => q.join(' ')).join('L')}L${f1(p[0])} ${f1(p[1])}`;
    }
    function addTrail(pts) { if (pts.length > 1) trail += `M${pts.map((q) => q.join(' ')).join('L')}`; trailEl.setAttribute('d', trail); }
    function endWalk() {
      const w = walking;
      walking = null;
      pos = [...w.pts[w.pts.length - 1]];
      addTrail(w.pts);
      walker.classList.remove('is-walking');
      arrive(w.i);
    }
    function arrive(i) {
      const s = stops[i];
      walker.classList.remove('is-hop'); void walker.offsetWidth; walker.classList.add('is-hop');
      if (done.has(s.id)) { paintStamps(); return; }
      done.add(s.id); save();
      paintStamps(i);
      if (done.size === TOTAL && !finished) { finished = true; finale(); }
      else if (i === TOTAL - 1) showStop(i);
      paintNav();
    }
    function reset() {
      done = new Set(); finished = false; trail = ''; trailEl.setAttribute('d', '');
      save();
      stampBtns.forEach((b) => b.style.removeProperty('--r'));
      atNode = stops[0].node; pos = [...N[atNode]]; cur = -1;
      goTo(0);
    }

    /* --- Cámara: sigue al caminante --- */
    const cam = { x: W / 2, y: H / 2, s: 1 };
    let raf = 0, last = 0;
    function target() {
      const vw = mapEl.clientWidth, vh = mapEl.clientHeight, u = vw / W;
      const fit = Math.min(1, vh / (H * u));
      if (mode === 'all') return { x: W / 2, y: H / 2, s: fit, u, vw, vh };
      return { x: pos[0], y: pos[1], s: Math.max(fit, (vw < 640 ? 2.5 : 1.75) * fit), u, vw, vh };
    }
    function fitAxis(c, half, size) { return half * 2 >= size ? size / 2 : clamp(c, half, size - half); }
    function tick(now) {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      if (walking) {
        const k = clamp((now - walking.t0) / walking.dur, 0, 1);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const dd = e * walking.L;
        pos = pointAt(walking, dd).p;
        trailEl.setAttribute('d', trail + partial(walking, dd));
        if (k >= 1) endWalk();
      }
      walker.style.left = `${f1(pos[0] / 16)}%`;
      walker.style.top = `${f1(pos[1] / 11)}%`;
      const t = target();
      const a = reduced() ? 1 : 1 - Math.exp(-dt * 5.5);
      cam.s += (t.s - cam.s) * a; cam.x += (t.x - cam.x) * a; cam.y += (t.y - cam.y) * a;
      const pxu = cam.s * t.u;
      const cx = fitAxis(cam.x, t.vw / (2 * pxu), W), cy = fitAxis(cam.y, t.vh / (2 * pxu), H);
      world.style.transform = `translate3d(${f1(t.vw / 2 - cx * pxu)}px,${f1(t.vh / 2 - cy * pxu)}px,0) scale(${cam.s.toFixed(4)})`;
      const settled = Math.abs(t.s - cam.s) < 0.001 && Math.abs(t.x - cam.x) < 0.4 && Math.abs(t.y - cam.y) < 0.4;
      if (walking || !settled) raf = requestAnimationFrame(tick);
    }
    function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }
    function paintZoom() {
      zoomBtn.textContent = mode === 'all' ? 'Acercar' : 'Ver todo el mapa';
      zoomBtn.hidden = cur === -1;
    }

    /* --- Confeti al completar --- */
    function confetti() {
      if (reduced()) return;
      const box = d.createElement('div');
      box.className = 'ruta__confetti';
      box.setAttribute('aria-hidden', 'true');
      const cols = ['#CC544C', '#FBE36F', '#0B74C4', '#2F6A4F', '#C94B6D', '#D99A2B', '#FFFDF6'];
      const R = rng(Date.now() % 9973);
      for (let k = 0; k < 90; k++) {
        const p = d.createElement('i');
        p.style.cssText = `left:${f1(R() * 100)}%;background:${cols[k % cols.length]};--dx:${f1((R() - 0.5) * 160)}px;--rot:${Math.round(R() * 900 - 450)}deg;animation-delay:${f1(R() * 0.6)}s;animation-duration:${f1(2.2 + R() * 1.6)}s;width:${f1(6 + R() * 8)}px;height:${f1(8 + R() * 10)}px`;
        box.append(p);
      }
      mapEl.append(box);
      setTimeout(() => box.remove(), 4800);
    }

    /* --- Eventos --- */
    world.addEventListener('click', (e) => {
      const pin = e.target.closest('.rpin');
      if (!pin) return;
      if (pin.dataset.i !== undefined) { goTo(+pin.dataset.i); return; }
      const id = pin.dataset.x, info = bonusInfo[id];
      if (!info) return;
      const isNew = !found.has(id);
      found.add(id); save(); paintStamps();
      pin.classList.remove('is-pop'); void pin.offsetWidth; pin.classList.add('is-pop');
      setCard(isNew ? '¡Extra encontrado!' : 'Extra', info.name, info.text);
    });
    stampsEl.addEventListener('click', (e) => { const b = e.target.closest('.stamp'); if (b) goTo(+b.dataset.i); });
    prevBtn.addEventListener('click', () => goTo(cur - 1));
    nextBtn.addEventListener('click', () => {
      if (action === 'again') reset();
      else if (action === 'start') goTo(done.size ? Math.max(0, firstMissing()) : 0);
      else if (action === 'missing') { const m = firstMissing(); goTo(m < 0 ? 0 : m); }
      else goTo(cur + 1);
    });
    zoomBtn.addEventListener('click', () => { mode = mode === 'all' ? 'near' : 'all'; userAll = mode === 'all'; paintZoom(); kick(); });
    game.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); nextBtn.click(); }
      else if (e.key === 'ArrowLeft' && cur > 0) { e.preventDefault(); goTo(cur - 1); }
    });
    if ('ResizeObserver' in window) new ResizeObserver(() => kick()).observe(mapEl);
    else addEventListener('resize', kick);

    sec.classList.add('is-game');
    game.hidden = false;
    paintStamps(); paintNav(); paintZoom(); showIntro();
    kick();
  }

  /* ------------------------------------------------------------------
     Tique: impresión, código de barras y nota a mano
     ------------------------------------------------------------------ */
  // Barras de un código de barras decorativo: [[x, ancho], ...] y ancho total
  function barBars(str) {
    const R = rng([...str].reduce((a, c) => a + c.charCodeAt(0), 0));
    const bars = [[0, 2], [3, 1]];
    let x = 6;
    [...str].forEach((ch) => {
      const c = ch.charCodeAt(0);
      for (let b = 0; b < 4; b++) {
        const bw = 1 + ((c >> b) & 1) + (R() > 0.7 ? 1 : 0);
        bars.push([x, bw]);
        x += bw + 1 + (R() > 0.5 ? 1 : 0);
      }
    });
    bars.push([x, 1], [x + 2, 2]);
    return { bars, w: x + 4 };
  }
  function drawBarcode(svg, str) {
    const { bars, w } = barBars(str);
    svg.setAttribute('viewBox', `0 0 ${w} 50`);
    svg.innerHTML = `<g fill="#1D1D24">${bars.map(([x, bw]) => `<rect x="${x}" width="${bw}" height="50"/>`).join('')}</g>`;
  }
  const barcode = $('[data-barcode]');
  if (barcode) drawBarcode(barcode, barcode.dataset.barcode);
  const printer = $('[data-printer]');
  const note = $('[data-receipt-note]');
  const star = $('[data-star]');
  function placeNote() {
    if (!printer || !note || !star) return;
    let y = 0, n = star;
    while (n && n !== printer) { y += n.offsetTop; n = n.offsetParent; }
    note.style.top = `${y - 16}px`;
  }
  if (printer) {
    const pio = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { printer.classList.add('is-printed'); pio.disconnect(); }
    }, { threshold: 0.12 });
    pio.observe(printer);
  }

  /* ------------------------------------------------------------------
     Media: pestañas por año y visor con anterior / siguiente
     ------------------------------------------------------------------ */
  const tabsBox = $('[data-media-tabs]');
  if (tabsBox) {
    const tabs = $$('[role="tab"]', tabsBox);
    const panels = tabs.map((t) => d.getElementById(t.getAttribute('aria-controls')));
    const select = (i, focus) => {
      tabs.forEach((t, k) => {
        const on = k === i;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        panels[k].hidden = !on;
        if (!on) $$('video', panels[k]).forEach((v) => v.pause());
      });
      if (focus) tabs[i].focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(i));
      t.addEventListener('keydown', (e) => {
        const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (k) { e.preventDefault(); select((i + k + tabs.length) % tabs.length, true); }
        if (e.key === 'Home') { e.preventDefault(); select(0, true); }
        if (e.key === 'End') { e.preventDefault(); select(tabs.length - 1, true); }
      });
    });
    tabsBox.hidden = false;
    select(0);
  }

  const lb = $('[data-lightbox]');
  if (lb && typeof lb.showModal === 'function') {
    const img = $('[data-lightbox-img]', lb);
    const cap = $('[data-lightbox-cap]', lb);
    const count = $('[data-lightbox-count]', lb);
    const prev = $('[data-lightbox-prev]', lb);
    const next = $('[data-lightbox-next]', lb);
    let list = [], idx = 0, opener = null;
    const show = (i) => {
      idx = (i + list.length) % list.length;
      const b = list[idx];
      img.src = b.dataset.media;
      img.alt = $('img', b).alt;
      cap.textContent = b.dataset.cap || '';
      count.textContent = `${idx + 1} / ${list.length}`;
      const many = list.length > 1;
      prev.hidden = next.hidden = count.hidden = !many;
      // precarga la siguiente
      if (many) { const pre = new Image(); pre.src = list[(idx + 1) % list.length].dataset.media; }
    };
    $$('[data-media]').forEach((b) => b.addEventListener('click', () => {
      list = $$('[data-media]', b.closest('[data-gallery]'));
      opener = b;
      show(list.indexOf(b));
      lb.showModal();
    }));
    prev.addEventListener('click', () => show(idx - 1));
    next.addEventListener('click', () => show(idx + 1));
    lb.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(idx - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(idx + 1); }
    });
    let sx = 0;
    lb.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1)); });
    $('[data-lightbox-close]', lb).addEventListener('click', () => lb.close());
    lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });
    lb.addEventListener('close', () => { if (opener) opener.focus({ preventScroll: true }); });
  } else {
    $$('[data-media]').forEach((b) => b.addEventListener('click', () => window.open(b.dataset.media, '_blank', 'noopener')));
  }

  /* ------------------------------------------------------------------
     Calendario (.ics)
     ------------------------------------------------------------------ */
  $$('[data-ics]').forEach((icsBtn) => icsBtn.addEventListener('click', () => {
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CIFP Tony Gallardo//MercaBasica 2026//ES', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:mercabasica-2026@cifp-tony-gallardo',
      'DTSTAMP:20261030T000000Z',
      'DTSTART:20261211T090000Z',
      'DTEND:20261211T133000Z',
      'SUMMARY:MercaBásica 2026',
      'LOCATION:CIFP Tony Gallardo\\, Ctra. de las Coloradas\\, 35009 Las Palmas de Gran Canaria',
      'DESCRIPTION:Mercado navideño del CIFP Tony Gallardo hecho por su alumnado. Recorrido por las casas de 11:10 a 12:50. Programa: https://myappsserver.duckdns.org/mercabasica/',
      'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Mañana es MercaBásica', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = Object.assign(d.createElement('a'), { href: url, download: 'mercabasica-2026.ics' });
    d.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }));

  /* ------------------------------------------------------------------
     Consentimiento y estadística anónima (sin cookies, sin IP).
     Solo se envía algo si la persona acepta y su navegador no pide
     no ser rastreado (GPC / DNT).
     ------------------------------------------------------------------ */
  const CONSENT_KEY = 'mb26-consent';
  const consentBox = $('[data-consent]');
  const optedOutByBrowser = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
  const consent = () => store.get(CONSENT_KEY);
  const device = () => (innerWidth < 700 ? 'm' : innerWidth < 1100 ? 't' : 'd');
  const refHost = () => { try { const h = new URL(d.referrer).hostname; return h === location.hostname ? '' : h; } catch { return ''; } };
  const send = (payload) => {
    if (consent() !== 'yes' || optedOutByBrowser) return;
    const body = JSON.stringify(payload);
    const url = 'api/hit.php';
    if (navigator.sendBeacon) navigator.sendBeacon(url, body);
    else fetch(url, { method: 'POST', body, keepalive: true, credentials: 'omit' }).catch(() => {});
  };
  const pageView = () => send({ t: 'view', p: location.pathname.replace(/^.*\/mercabasica/, '') || '/', r: refHost(), d: device() });
  const showConsent = (show) => { if (consentBox) consentBox.hidden = !show; };
  const decide = (val) => {
    store.set(CONSENT_KEY, val);
    showConsent(false);
    if (val === 'yes') pageView();
  };
  if (consentBox) {
    $('[data-consent-yes]', consentBox).addEventListener('click', () => decide('yes'));
    $('[data-consent-no]', consentBox).addEventListener('click', () => decide('no'));
    if (!consent() && !optedOutByBrowser) showConsent(true);
  }
  $$('[data-consent-open]').forEach((b) => b.addEventListener('click', () => { showConsent(true); $('[data-consent-yes]', consentBox).focus(); }));
  $$('[data-track]').forEach((el) => el.addEventListener('click', () => send({ t: 'event', e: el.dataset.track, d: device() })));
  if (consent() === 'yes') pageView();

  /* ------------------------------------------------------------------
     Contador público de visitas (arriba a la derecha).
     Suma 1 por carga como mucho cada 30 min por conexión; sin cookies.
     Con "No rastrear" / GPC solo se lee, no se suma.
     ------------------------------------------------------------------ */
  const visits = $('[data-visits]');
  if (visits) {
    const nEl = $('[data-visits-n]', visits);
    const paintVisits = (n) => {
      if (!Number.isFinite(n) || n < 1) return;
      const word = n === 1 ? 'visita' : 'visitas';
      nEl.textContent = n.toLocaleString('es-ES');
      $('span', visits).textContent = word;
      visits.setAttribute('aria-label', `${n.toLocaleString('es-ES')} ${word}`);
      visits.hidden = false;
    };
    fetch('api/count.php', optedOutByBrowser ? { credentials: 'omit' } : { method: 'POST', credentials: 'omit' })
      .then((r) => r.json()).then((j) => paintVisits(+j.total)).catch(() => {});
  }

  /* ------------------------------------------------------------------
     Máquina de turnos
     ------------------------------------------------------------------ */
  const mDisplay = $('[data-machine-display]');
  const mBtn = $('[data-machine-btn]');
  const mTicket = $('[data-machine-ticket]');
  const mNum = $('[data-machine-num]');
  if (mDisplay && mBtn) {
    let num = 11 + Math.floor(Math.random() * 40);
    setSeg(mDisplay, pad(num));
    let busy = false;
    const print = () => {
      num = (num % 99) + 1;
      setSeg(mDisplay, pad(num));
      mNum.textContent = pad(num);
      mTicket.classList.remove('is-torn');
      void mTicket.offsetWidth;
      mTicket.classList.add('is-out');
      setTimeout(() => { busy = false; }, 1100);
    };
    mBtn.addEventListener('click', () => {
      if (busy) return;
      busy = true;
      if (mTicket.classList.contains('is-out')) {
        mTicket.classList.add('is-torn');
        setTimeout(() => {
          mTicket.style.transition = 'none';
          mTicket.classList.remove('is-out', 'is-torn');
          void mTicket.offsetWidth;
          mTicket.style.transition = '';
          print();
        }, 480);
      } else print();
    });
    // la máquina "da" un primer número cuando termina la animación de la portada
    setTimeout(() => { if (!mTicket.classList.contains('is-out') && !busy) mBtn.click(); }, reduced() ? 0 : 2500);
  }

  /* ------------------------------------------------------------------
     Navegación: menú móvil y sección activa
     ------------------------------------------------------------------ */
  const menuBtn = $('[data-menu-btn]');
  const menu = $('[data-menu]');
  const setMenu = (open) => {
    menuBtn.setAttribute('aria-expanded', String(open));
    $('.beam__menu-label', menuBtn).textContent = open ? 'Cerrar' : 'Menú';
    menu.hidden = !open;
    d.body.style.overflow = open ? 'hidden' : '';
  };
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', () => setMenu(menu.hidden));
    $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
    d.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); } });
  }
  const navLinks = $$('.beam__nav a');
  const sio = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      navLinks.forEach((a) => a.toggleAttribute('aria-current', a.getAttribute('href') === `#${e.target.id}`));
      navLinks.forEach((a) => { if (a.hasAttribute('aria-current')) a.setAttribute('aria-current', 'true'); });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main > section[id]').forEach((s) => sio.observe(s));

  /* ------------------------------------------------------------------
     Inscripción (control de aforo)
     ------------------------------------------------------------------ */
  const insc = $('[data-insc]');
  if (insc) {
    const form = $('[data-insc-form]', insc), fields = $('[data-insc-fields]', insc), msg = $('[data-insc-msg]', insc);
    const send = $('[data-insc-send]', insc), done = $('[data-insc-done]', insc), closed = $('[data-insc-closed]', insc);
    const tipo = $('#f-tipo', form), entidad = $('#f-entidad', form), hint = $('[data-entidad-hint]', form);
    const ORG = ['institucion', 'centro', 'empresa', 'prensa'];
    const t0 = Date.now();
    const needOrg = () => ORG.includes(tipo.value);
    const syncOrg = () => { entidad.required = needOrg(); hint.textContent = needOrg() ? '*' : '(si vienes en su nombre)'; hint.classList.toggle('is-req', needOrg()); };
    tipo.addEventListener('change', syncOrg);
    syncOrg();

    const showErr = (errs) => {
      $$('[data-err]', form).forEach((p) => {
        const k = p.dataset.err, m = errs[k] || '';
        p.textContent = m;
        const input = form.elements[k];
        if (input) input.setAttribute('aria-invalid', m ? 'true' : 'false');
      });
      const first = Object.keys(errs).map((k) => form.elements[k]).find(Boolean);
      if (first) first.focus();
    };
    const check = () => {
      const f = form.elements, e = {};
      if (f.nombre.value.trim().length < 3) e.nombre = 'Escribe tu nombre y apellidos.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.value.trim())) e.email = 'Revisa el correo electrónico.';
      if (f.telefono.value.trim() && !/^\+?[0-9 ]{9,18}$/.test(f.telefono.value.trim())) e.telefono = 'Revisa el teléfono (solo números).';
      const n = +f.personas.value;
      if (!Number.isInteger(n) || n < 1 || n > 20) e.personas = 'De 1 a 20 personas.';
      if (!f.tipo.value) e.tipo = 'Elige cómo vienes.';
      if (needOrg() && f.entidad.value.trim().length < 2) e.entidad = 'Indica la institución, centro o empresa.';
      if (!f.acepto.checked) e.acepto = 'Necesitamos tu permiso para guardar estos datos.';
      return e;
    };

    // ¿Sigue abierto?
    fetch('api/inscribir.php', { headers: { Accept: 'application/json' } })
      .then((r) => r.json()).then((j) => { if (j && j.abierto === false) { closed.hidden = false; fields.disabled = true; } })
      .catch(() => { /* si falla, se intentará al enviar */ });

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      msg.textContent = '';
      const errs = check();
      showErr(errs);
      if (Object.keys(errs).length) { msg.textContent = 'Revisa los campos marcados.'; return; }
      const f = form.elements;
      const body = {
        nombre: f.nombre.value, email: f.email.value, telefono: f.telefono.value, personas: f.personas.value,
        tipo: f.tipo.value, entidad: f.entidad.value, comentario: f.comentario.value, web: f.web.value,
        acepto: f.acepto.checked ? '1' : '', t: Date.now() - t0,
      };
      send.disabled = true;
      send.classList.add('is-busy');
      try {
        const r = await fetch('api/inscribir.php', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.ok) {
          $('[data-insc-name]', done).textContent = (j.nombre || f.nombre.value).split(' ')[0];
          $('[data-insc-code]', done).textContent = j.codigo;
          $('[data-insc-people]', done).textContent = j.personas;
          form.hidden = true;
          done.hidden = false;
          insc.classList.add('is-done');
          done.focus();
          return;
        }
        if (j.errores) showErr(j.errores);
        msg.textContent = j.mensaje || 'No se ha podido enviar. Inténtalo de nuevo.';
      } catch {
        msg.textContent = 'No hay conexión. Revisa internet e inténtalo de nuevo.';
      } finally {
        send.disabled = false;
        send.classList.remove('is-busy');
      }
    });
  }

  /* ------------------------------------------------------------------
     Pedidos: catálogo en vivo desde el Google Sheet + hoja de encargo
     ------------------------------------------------------------------ */
  const ped = $('[data-ped]');
  if (ped) initPedidos(ped);

  function initPedidos(root) {
    const ZN = { PAS: 'Panadería', MAD: 'Madera', FAB: 'Fabricación y montaje', ALM: 'Almacén' };
    const KEY = 'mb26-encargo';
    const POLL = 30000;
    const list = $('[data-ped-products]', root), filtersEl = $('[data-ped-filters]', root), liveEl = $('[data-ped-live]', root);
    const noticeEl = $('[data-ped-notice]', root), form = $('[data-ped-form]', root), linesEl = $('[data-ped-lines]', root);
    const emptyEl = $('[data-ped-empty]', root), totalEl = $('[data-ped-total]', root), msg = $('[data-ped-msg]', root);
    const sendBtn = $('[data-ped-send]', root), done = $('[data-ped-done]', root), bar = $('[data-ped-bar]', root);
    const eur = (c) => `${(c / 100).toLocaleString('es-ES', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const nice = (s) => (s === s.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{3}/.test(s) ? s.charAt(0) + s.slice(1).toLowerCase() : s);
    const t0 = Date.now();
    let prods = new Map(), filter = 'all', lastOk = 0, sig = '', failing = false;
    let cart = (() => { try { const c = JSON.parse(store.get(KEY) || '{}'); return c && typeof c === 'object' ? c : {}; } catch { return {}; } })();
    const save = () => store.set(KEY, JSON.stringify(cart));
    const desc = (c) => nice(prods.get(c)?.descripcion || c);

    // Mantiene el foco al redibujar (para no perder el sitio con teclado)
    const withFocus = (fn) => {
      const a = d.activeElement, k = a && a.dataset ? a.dataset.k : null;
      fn();
      if (k) { const el = root.querySelector(`[data-k="${CSS.escape(k)}"]`); if (el) el.focus(); }
    };

    function stockLabel(p) {
      if (p.quedan === null) return ['Por encargo', 'free'];
      if (p.quedan <= 0) return ['Agotado', 'out'];
      if (p.quedan <= 3) return [`¡Últimas ${p.quedan}!`, 'low'];
      return [`Quedan ${p.quedan}`, 'ok'];
    }

    function renderFilters() {
      const zones = [...new Set([...prods.values()].map((p) => p.zona))];
      filtersEl.hidden = zones.length < 2;
      if (filter !== 'all' && !zones.includes(filter)) filter = 'all';
      filtersEl.innerHTML = [['all', 'Todo'], ...Object.entries(ZN).filter(([z]) => zones.includes(z))]
        .map(([z, n]) => `<button type="button" class="chip" data-f="${z}" data-k="f-${z}" aria-pressed="${filter === z}">${esc(n)}</button>`).join('');
    }

    function renderProducts() {
      const items = [...prods.values()].filter((p) => filter === 'all' || p.zona === filter);
      list.setAttribute('aria-busy', 'false');
      if (!items.length) { list.innerHTML = `<li class="ped__nothing">${prods.size ? 'No hay productos en este apartado.' : 'Todavía no hay productos en el catálogo. Vuelve pronto.'}</li>`; return; }
      withFocus(() => {
        list.innerHTML = items.map((p) => {
          const [lab, cls] = stockLabel(p);
          const inCart = cart[p.codigo]?.q || 0;
          const full = p.quedan !== null && inCart >= p.quedan;
          return `<li class="pcard${p.quedan === 0 ? ' is-out' : ''}">
            <div class="pcard__img">${p.foto ? `<img src="${esc(p.foto)}" alt="${esc(nice(p.descripcion))}" loading="lazy" decoding="async">` : `<span class="pcard__ph" aria-hidden="true">${esc(p.zona)}</span>`}<span class="pcard__zone">${esc(ZN[p.zona] || p.zona)}</span></div>
            <div class="pcard__body">
              <p class="pcard__code">${esc(p.codigo)}</p>
              <h3 class="pcard__desc">${esc(nice(p.descripcion))}</h3>
              <p class="pcard__meta"><b class="pcard__price">${eur(p.precio)}</b><span class="pcard__stock pcard__stock--${cls}">${lab}</span></p>
              <div class="pcard__act">${p.quedan === 0
                ? '<button class="btn pcard__add" type="button" disabled>Agotado</button>'
                : `<button class="btn btn--solid pcard__add" type="button" data-add="${esc(p.codigo)}" data-k="add-${esc(p.codigo)}"${full ? ' disabled' : ''}>${full ? 'No quedan más' : 'Añadir'}</button>`}
                ${inCart ? `<span class="pcard__in">${inCart} en tu hoja</span>` : ''}</div>
            </div></li>`;
        }).join('');
      });
    }

    function renderCart() {
      const codes = Object.keys(cart).filter((c) => prods.has(c) || !prods.size);
      let total = 0, units = 0;
      withFocus(() => {
        linesEl.innerHTML = codes.map((c) => {
          const p = prods.get(c), it = cart[c];
          const price = p ? p.precio : 0;
          total += price * it.q; units += it.q;
          const max = p && p.quedan !== null ? p.quedan : 50;
          return `<li class="line">
            <div class="line__main"><span class="line__code">${esc(c)}</span><span class="line__desc">${esc(desc(c))}</span></div>
            <div class="line__qty">
              <button type="button" data-dec="${esc(c)}" data-k="dec-${esc(c)}" aria-label="Quitar una unidad de ${esc(desc(c))}">−</button>
              <input type="number" min="1" max="${max}" value="${it.q}" inputmode="numeric" data-qty="${esc(c)}" data-k="qty-${esc(c)}" aria-label="Unidades de ${esc(desc(c))}">
              <button type="button" data-inc="${esc(c)}" data-k="inc-${esc(c)}" aria-label="Añadir una unidad de ${esc(desc(c))}"${it.q >= max ? ' disabled' : ''}>+</button>
            </div>
            <p class="line__price"><span>${eur(price)} / ud.</span><b>${eur(price * it.q)}</b></p>
            <button type="button" class="line__del" data-del="${esc(c)}" data-k="del-${esc(c)}" aria-label="Quitar ${esc(desc(c))} del encargo">×</button>
            <input class="line__perso" type="text" maxlength="200" value="${esc(it.p || '')}" data-perso="${esc(c)}" data-k="perso-${esc(c)}" placeholder="Personalización: texto, color, medidas…" aria-label="Personalización de ${esc(desc(c))}">
          </li>`;
        }).join('');
      });
      emptyEl.hidden = codes.length > 0;
      totalEl.textContent = eur(total);
      bar.hidden = !units || !done.hidden;
      $('[data-ped-bar-n]', bar).textContent = `${units} ${units === 1 ? 'unidad' : 'unidades'}`;
      $('[data-ped-bar-total]', bar).textContent = eur(total);
    }

    function notice(text) { noticeEl.textContent = text; noticeEl.hidden = !text; }

    // Ajusta la hoja si el stock ha bajado mientras tanto
    function clampCart() {
      const out = [];
      Object.entries(cart).forEach(([c, it]) => {
        const p = prods.get(c);
        if (!p) { delete cart[c]; out.push(`«${c}» ya no está en el catálogo`); return; }
        if (p.quedan !== null && it.q > p.quedan) {
          if (p.quedan <= 0) { delete cart[c]; out.push(`«${desc(c)}» se ha agotado`); }
          else { it.q = p.quedan; out.push(`de «${desc(c)}» solo quedan ${p.quedan}`); }
        }
      });
      if (out.length) { save(); notice(`Atención: ${out.join('; ')}. Hemos ajustado tu hoja.`); }
    }

    function paintLive() {
      const span = $('span', liveEl);
      liveEl.classList.toggle('is-err', failing);
      if (failing) { span.textContent = lastOk ? 'Sin conexión con el catálogo. Reintentando…' : 'No podemos cargar el catálogo. Reintentando…'; return; }
      if (!lastOk) return;
      const s = Math.round((Date.now() - lastOk) / 1000);
      span.textContent = `Stock en directo · actualizado ${s < 5 ? 'ahora' : `hace ${s < 60 ? `${s} s` : `${Math.round(s / 60)} min`}`}`;
    }

    async function refresh() {
      try {
        const r = await fetch('api/catalogo.php', { cache: 'no-store', headers: { Accept: 'application/json' } });
        const j = await r.json();
        if (!j.ok) throw new Error('catálogo');
        prods = new Map(j.productos.map((p) => [p.codigo, p]));
        lastOk = Date.now(); failing = false;
        clampCart();
        const s = JSON.stringify(j.productos) + JSON.stringify(cart);
        if (s !== sig) { sig = s; renderFilters(); renderProducts(); renderCart(); }
      } catch {
        failing = true;
        if (!prods.size) list.innerHTML = '<li class="ped__nothing">No podemos cargar el catálogo ahora mismo. Lo seguimos intentando…</li>';
      }
      paintLive();
    }

    function add(c, n = 1) {
      const p = prods.get(c);
      if (!p) return;
      const cur = cart[c]?.q || 0, max = p.quedan === null ? 50 : p.quedan;
      const q = clamp(cur + n, 0, max);
      if (q <= 0) delete cart[c]; else cart[c] = { q, p: cart[c]?.p || '' };
      save(); sig = '';
      renderProducts(); renderCart();
    }

    filtersEl.addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (!b) return; filter = b.dataset.f; renderFilters(); renderProducts(); });
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-add]');
      if (!b) return;
      add(b.dataset.add);
      notice('');
      const btn = root.querySelector(`[data-add="${CSS.escape(b.dataset.add)}"]`);
      if (btn && !btn.disabled) { btn.textContent = '¡Añadido!'; setTimeout(() => { if (btn.isConnected && !btn.disabled) btn.textContent = 'Añadir'; }, 1100); }
    });
    linesEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-inc],[data-dec],[data-del]');
      if (!b) return;
      if (b.dataset.inc) add(b.dataset.inc, 1);
      else if (b.dataset.dec) add(b.dataset.dec, -1);
      else { delete cart[b.dataset.del]; save(); sig = ''; renderProducts(); renderCart(); }
    });
    linesEl.addEventListener('change', (e) => {
      const q = e.target.closest('[data-qty]');
      if (!q) return;
      const c = q.dataset.qty, n = parseInt(q.value, 10);
      add(c, (Number.isFinite(n) ? n : 1) - (cart[c]?.q || 0));
    });
    linesEl.addEventListener('input', (e) => {
      const p = e.target.closest('[data-perso]');
      if (p && cart[p.dataset.perso]) { cart[p.dataset.perso].p = p.value.slice(0, 200); save(); }
    });

    const showErr = (errs) => {
      $$('[data-err]', form).forEach((p) => {
        const k = p.dataset.err, m = errs[k] || '';
        p.textContent = m;
        const input = form.elements[k];
        if (input && input.setAttribute) input.setAttribute('aria-invalid', m ? 'true' : 'false');
      });
      const first = Object.keys(errs).map((k) => form.elements[k]).find((el) => el && el.focus);
      if (first) first.focus();
    };

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      msg.textContent = '';
      const f = form.elements, e = {};
      if (f.nombre.value.trim().length < 3) e.nombre = 'Escribe tu nombre y apellidos.';
      if (!/^\+?[0-9 ]{9,18}$/.test(f.telefono.value.trim())) e.telefono = 'Escribe un teléfono de contacto (solo números).';
      if (f.email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.value.trim())) e.email = 'Revisa el correo electrónico.';
      if (!Object.keys(cart).length) e.lineas = 'Añade al menos un producto del catálogo.';
      if (!f.acepto.checked) e.acepto = 'Necesitamos tu conformidad para hacer el encargo.';
      showErr(e);
      if (Object.keys(e).length) { msg.textContent = 'Revisa los campos marcados.'; return; }
      sendBtn.disabled = true; sendBtn.classList.add('is-busy');
      try {
        const r = await fetch('api/pedir.php', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            nombre: f.nombre.value, telefono: f.telefono.value, email: f.email.value, direccion: f.direccion.value,
            observaciones: f.observaciones.value, web: f.web.value, acepto: f.acepto.checked ? '1' : '', t: Date.now() - t0,
            lineas: Object.entries(cart).map(([codigo, it]) => ({ codigo, cantidad: it.q, personalizacion: it.p || '' })),
          }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.ok) {
          const nombre = (j.nombre || f.nombre.value).trim();
          $('[data-ped-name]', done).textContent = nombre.split(' ')[0];
          cart = {}; save(); sig = '';
          form.hidden = true; done.hidden = false; bar.hidden = true;
          ticket = ticketData(j, nombre);
          showTicket(ticket);
          done.focus();
          done.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
          refresh();
          return;
        }
        if (j.stock) {
          Object.entries(j.stock).forEach(([c, s]) => { const p = prods.get(c); if (p) p.quedan = s.quedan; else delete cart[c]; });
          clampCart(); sig = ''; renderProducts(); renderCart();
        }
        if (j.errores) showErr(j.errores);
        msg.textContent = j.mensaje || 'No se ha podido enviar. Inténtalo de nuevo.';
      } catch {
        msg.textContent = 'No hay conexión. Revisa internet e inténtalo de nuevo.';
      } finally {
        sendBtn.disabled = false; sendBtn.classList.remove('is-busy');
      }
    });
    /* --- Tique del encargo: mismo aspecto que «El tique del día» --- */
    const receiptEl = $('[data-ped-receipt]', root), printerEl = $('[data-ped-printer]', root);
    let ticket = null;
    const two = (n) => String(n).padStart(2, '0');
    function ticketData(j, nombre) {
      const n = new Date();
      return {
        code: j.codigo, total: j.total, nombre,
        fecha: `${two(n.getDate())}/${two(n.getMonth() + 1)}/${n.getFullYear()} ${two(n.getHours())}:${two(n.getMinutes())}`,
        lineas: (j.lineas || []).map((l) => ({ q: l.cantidad, d: nice(l.descripcion), c: l.codigo, u: l.precio, p: l.personalizacion || '' })),
      };
    }
    function showTicket(t) {
      const units = t.lineas.reduce((a, l) => a + l.q, 0);
      receiptEl.innerHTML = `
        <div class="r-head"><span class="r-word" role="img" aria-label="MercaBásica"></span>
          <p>CIFP TONY GALLARDO<br>LAS PALMAS DE GRAN CANARIA</p>
          <p class="r-row"><span>ENCARGO ${esc(t.code)}</span><span>${esc(t.fecha)}</span></p></div>
        <hr class="r-rule r-rule--double">
        <p class="r-row r-cols r-cols--buy"><span>UDS</span><span>CONCEPTO</span><span>IMPORTE</span></p>
        <hr class="r-rule">
        <ol class="r-list">${t.lineas.map((l) => `<li class="r-item r-item--buy"><b>${l.q}×</b><span>${esc(l.d)}<small>${esc(l.c)} · ${eur(l.u)}/ud.</small>${l.p ? `<small>✎ ${esc(l.p)}</small>` : ''}</span><b>${eur(l.u * l.q)}</b></li>`).join('')}</ol>
        <hr class="r-rule">
        <p class="r-row"><span>ARTÍCULOS</span><span>${units}</span></p>
        <p class="r-row"><span>CLIENTE</span><span class="r-ell">${esc(t.nombre.toUpperCase())}</span></p>
        <p class="r-row"><span>RECOGIDA</span><span>VIE 11/12/2026</span></p>
        <p class="r-row"><span>ESTADO</span><span>PENDIENTE DE CONFIRMAR</span></p>
        <hr class="r-rule r-rule--double">
        <p class="r-row r-total"><span>TOTAL</span><span>${eur(t.total)}</span></p>
        <p class="r-thanks">¡Gracias por su encargo!<br><span>Recogida en MercaBásica</span></p>
        <svg class="r-barcode" preserveAspectRatio="none" aria-hidden="true"></svg>
        <p class="r-code">${esc(t.code.replace('-', ' · '))}</p>`;
      drawBarcode($('.r-barcode', receiptEl), t.code);
      printerEl.classList.remove('is-printed');
      void printerEl.offsetWidth;
      requestAnimationFrame(() => printerEl.classList.add('is-printed'));
    }

    // Dibuja el tique en un lienzo (sin librerías) para descargarlo como PNG
    async function ticketPNG(t) {
      const S = 3, W = 400, P = 28, IN = 26, ink = '#1D1D24', soft = 'rgba(29,29,36,.6)';
      await Promise.all(['400 13px "DM Mono"', '500 13px "DM Mono"'].map((f) => d.fonts.load(f).catch(() => null)));
      const word = await new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = 'assets/img/wordmark-mask.webp'; });
      const c = d.createElement('canvas'), x = c.getContext('2d');
      const F = (sz, w = 400) => `${w} ${sz}px "DM Mono", ui-monospace, monospace`;
      const tw = (s, f) => { x.font = f; return x.measureText(s).width; };
      const wrap = (s, f, max) => {
        const out = []; let cur = '';
        s.split(' ').forEach((w) => { const t2 = cur ? `${cur} ${w}` : w; if (tw(t2, f) > max && cur) { out.push(cur); cur = w; } else cur = t2; });
        if (cur) out.push(cur);
        return out;
      };
      const fit = (s, f, max) => { if (tw(s, f) <= max) return s; while (s.length > 1 && tw(`${s}…`, f) > max) s = s.slice(0, -1); return `${s}…`; };
      const L = P + IN, R = P + W - IN, CW = R - L, MID = P + W / 2, QW = 40;
      const ops = [];
      let y = P + 34;
      const ww = CW * 0.76, wh = ww * 382 / 1209;
      ops.push(['word', MID - ww / 2, y, ww, wh]); y += wh + 22;
      ['CIFP TONY GALLARDO', 'LAS PALMAS DE GRAN CANARIA'].forEach((s) => { ops.push(['t', s, MID, y, F(13), 'center']); y += 19; });
      y += 12; ops.push(['row', `ENCARGO ${t.code}`, t.fecha, y, F(13)]); y += 14;
      ops.push(['dbl', y]); y += 22;
      ops.push(['t', 'UDS', L, y, F(13, 500)], ['t', 'CONCEPTO', L + QW, y, F(13, 500)], ['t', 'IMPORTE', R, y, F(13, 500), 'right']); y += 12;
      ops.push(['dash', y]); y += 24;
      t.lineas.forEach((l) => {
        const amt = eur(l.u * l.q), dw = CW - QW - tw(amt, F(13, 500)) - 14;
        ops.push(['t', `${l.q}×`, L, y, F(13, 500)], ['t', amt, R, y, F(13, 500), 'right']);
        wrap(l.d, F(13), dw).forEach((s, i) => ops.push(['t', s, L + QW, y + i * 19, F(13)]));
        y += wrap(l.d, F(13), dw).length * 19;
        ops.push(['t', `${l.c} · ${eur(l.u)}/ud.`, L + QW, y, F(11.5), 'left', soft]); y += 17;
        if (l.p) wrap(`✎ ${l.p}`, F(11.5), dw).forEach((s) => { ops.push(['t', s, L + QW, y, F(11.5), 'left', soft]); y += 17; });
        y += 9;
      });
      ops.push(['dash', y - 8]); y += 18;
      const units = t.lineas.reduce((a, l) => a + l.q, 0);
      [['ARTÍCULOS', String(units)], ['CLIENTE', t.nombre.toUpperCase()], ['RECOGIDA', 'VIE 11/12/2026'], ['ESTADO', 'PENDIENTE DE CONFIRMAR']].forEach(([a, b]) => { ops.push(['row', a, b, y, F(13)]); y += 21; });
      y += 2; ops.push(['dbl', y]); y += 30;
      ops.push(['row', 'TOTAL', eur(t.total), y, F(17, 500)]); y += 38;
      ops.push(['t', '¡GRACIAS POR SU ENCARGO!', MID, y, F(13), 'center', ink, 2]); y += 19;
      ops.push(['t', 'RECOGIDA EN MERCABÁSICA', MID, y, F(12), 'center', soft, 2]); y += 22;
      ops.push(['bars', y]); y += 54 + 18;
      ops.push(['t', t.code.replace('-', ' · '), MID, y, F(11.5), 'center', ink, 4]); y += 36;
      const H = y;
      c.width = (W + P * 2) * S; c.height = (H + P + 6) * S;
      x.scale(S, S);
      x.fillStyle = '#FBF6EC'; x.fillRect(0, 0, W + P * 2, H + P + 6);
      // papel con borde dentado abajo
      x.beginPath(); x.moveTo(P, P); x.lineTo(P + W, P); x.lineTo(P + W, H - 10);
      for (let zx = P + W; zx > P; zx -= 18) { x.lineTo(Math.max(P, zx - 9), H); x.lineTo(Math.max(P, zx - 18), H - 10); }
      x.closePath();
      x.save(); x.shadowColor = 'rgba(80,60,10,.18)'; x.shadowBlur = 22; x.shadowOffsetY = 10; x.fillStyle = '#FFFEFA'; x.fill(); x.restore();
      x.textBaseline = 'alphabetic';
      ops.forEach((o) => {
        const [k] = o;
        if (k === 'word' && word) {
          const oc = d.createElement('canvas'); oc.width = Math.round(o[3] * S); oc.height = Math.round(o[4] * S);
          const ox = oc.getContext('2d'); ox.drawImage(word, 0, 0, oc.width, oc.height); ox.globalCompositeOperation = 'source-in'; ox.fillStyle = ink; ox.fillRect(0, 0, oc.width, oc.height);
          x.drawImage(oc, o[1], o[2], o[3], o[4]);
        } else if (k === 't') {
          const [, s, tx, ty, f, al = 'left', col = ink, ls = 0] = o;
          x.font = f; x.fillStyle = col; x.textAlign = al;
          if ('letterSpacing' in x) x.letterSpacing = `${ls}px`;
          x.fillText(s, tx, ty);
          if ('letterSpacing' in x) x.letterSpacing = '0px';
        } else if (k === 'row') {
          const [, a, b, ty, f] = o;
          x.font = f; x.fillStyle = ink; x.textAlign = 'left'; x.fillText(a, L, ty);
          x.textAlign = 'right'; x.fillText(fit(b, f, CW - tw(a, f) - 18), R, ty);
        } else if (k === 'dbl') {
          x.fillStyle = ink; x.globalAlpha = 0.8; x.fillRect(L, o[1], CW, 1.2); x.fillRect(L, o[1] + 3.2, CW, 1.2); x.globalAlpha = 1;
        } else if (k === 'dash') {
          x.save(); x.strokeStyle = ink; x.globalAlpha = 0.7; x.lineWidth = 1.2; x.setLineDash([4, 3]); x.beginPath(); x.moveTo(L, o[1]); x.lineTo(R, o[1]); x.stroke(); x.restore();
        } else if (k === 'bars') {
          const { bars, w } = barBars(t.code), bw = CW * 0.78, k2 = bw / w, bx = MID - bw / 2;
          x.fillStyle = ink; bars.forEach(([bx0, b]) => x.fillRect(bx + bx0 * k2, o[1], b * k2, 54));
        }
      });
      return new Promise((ok) => c.toBlob(ok, 'image/png'));
    }
    $('[data-ped-png]', root).addEventListener('click', async (e) => {
      if (!ticket) return;
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        const blob = await ticketPNG(ticket);
        const a = d.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `MercaBasica2026-${ticket.code}.png`;
        d.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      } finally { btn.disabled = false; }
    });
    $('[data-ped-pdf]', root).addEventListener('click', () => {
      if (!ticket) return;
      printerEl.classList.add('is-printed');
      d.body.classList.add('print-ticket');
      const off = () => { d.body.classList.remove('print-ticket'); removeEventListener('afterprint', off); };
      addEventListener('afterprint', off);
      const old = d.title;
      d.title = `MercaBasica2026-${ticket.code}`;
      window.print();
      d.title = old;
      setTimeout(off, 1000);
    });

    $('[data-ped-again]', root).addEventListener('click', () => {
      form.reset(); form.hidden = false; done.hidden = true; notice('');
      renderProducts(); renderCart();
      $('#p-nombre', form).focus();
    });

    renderCart();
    refresh();
    setInterval(() => { if (!d.hidden) refresh(); }, POLL);
    setInterval(paintLive, 5000);
    d.addEventListener('visibilitychange', () => { if (!d.hidden && Date.now() - lastOk > 8000) refresh(); });
  }

  /* ------------------------------------------------------------------
     Recolocar al cambiar el tamaño
     ------------------------------------------------------------------ */
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(placeNote, 120); });
  mqReduce.addEventListener?.('change', () => location.reload());

  placeNote();
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(placeNote);
  addEventListener('load', placeNote);
})();
