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

  /* Cuenta atrás: 11/12/2026 09:30 en Canarias (UTC+0 en diciembre) */
  const START = Date.UTC(2026, 11, 11, 9, 30);
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
  $$('[data-reveal], .casa').forEach((el) => io.observe(el));

  /* ------------------------------------------------------------------
     Recorrido: calle horizontal anclada en escritorio
     ------------------------------------------------------------------ */
  const route = $('[data-route]');
  const track = $('[data-track]');
  const bar = $('[data-route-bar]');
  let routeDist = 0, routePinned = false;
  function layoutRoute() {
    if (!route) return;
    routePinned = innerWidth >= 900 && !reduced();
    route.classList.toggle('is-pinned', routePinned);
    if (routePinned) {
      track.style.transform = '';
      routeDist = Math.max(0, track.scrollWidth - innerWidth);
      route.style.height = `${routeDist + innerHeight}px`;
    } else {
      route.style.height = '';
      track.style.transform = '';
    }
    updateRoute();
  }
  function updateRoute() {
    if (!route) return;
    if (routePinned) {
      const r = route.getBoundingClientRect();
      if (r.bottom < -50 || r.top > innerHeight + 50) return;
      const total = route.offsetHeight - innerHeight;
      const p = total > 0 ? clamp(-r.top / total, 0, 1) : 0;
      track.style.transform = `translate3d(${(-p * routeDist).toFixed(1)}px,0,0)`;
      bar.style.setProperty('--p', p.toFixed(4));
    } else {
      const max = track.scrollWidth - track.clientWidth;
      bar.style.setProperty('--p', max > 0 ? (track.scrollLeft / max).toFixed(4) : 0);
    }
  }
  if (track) track.addEventListener('scroll', () => { if (!routePinned) updateRoute(); }, { passive: true });

  /* ------------------------------------------------------------------
     Tique: impresión, código de barras y nota a mano
     ------------------------------------------------------------------ */
  const barcode = $('[data-barcode]');
  if (barcode) {
    const str = barcode.dataset.barcode;
    let x = 0, rects = '';
    const R = rng([...str].reduce((a, c) => a + c.charCodeAt(0), 0));
    rects += '<rect x="0" width="2" height="50"/><rect x="3" width="1" height="50"/>'; x = 6;
    [...str].forEach((ch) => {
      const c = ch.charCodeAt(0);
      for (let b = 0; b < 4; b++) {
        const bw = 1 + ((c >> b) & 1) + (R() > 0.7 ? 1 : 0);
        rects += `<rect x="${x}" width="${bw}" height="50"/>`;
        x += bw + 1 + (R() > 0.5 ? 1 : 0);
      }
    });
    rects += `<rect x="${x}" width="1" height="50"/><rect x="${x + 2}" width="2" height="50"/>`;
    barcode.setAttribute('viewBox', `0 0 ${x + 4} 50`);
    barcode.innerHTML = `<g fill="#1D1D24">${rects}</g>`;
  }
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
     Carteles: visor
     ------------------------------------------------------------------ */
  const lb = $('[data-lightbox]');
  if (lb && typeof lb.showModal === 'function') {
    const img = $('[data-lightbox-img]', lb);
    $$('[data-poster]').forEach((b) => b.addEventListener('click', () => {
      img.src = b.dataset.poster;
      img.alt = $('img', b).alt;
      lb.showModal();
    }));
    $('[data-lightbox-close]', lb).addEventListener('click', () => lb.close());
    lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });
  } else {
    $$('[data-poster]').forEach((b) => b.addEventListener('click', () => window.open(b.dataset.poster, '_blank', 'noopener')));
  }

  /* ------------------------------------------------------------------
     Calendario (.ics)
     ------------------------------------------------------------------ */
  const icsBtn = $('[data-ics]');
  if (icsBtn) icsBtn.addEventListener('click', () => {
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CIFP Tony Gallardo//MercaBasica 2026//ES', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:mercabasica-2026@cifp-tony-gallardo',
      'DTSTAMP:20261030T000000Z',
      'DTSTART:20261211T093000Z',
      'DTEND:20261211T133000Z',
      'SUMMARY:MercaBásica 2026',
      'LOCATION:CIFP Tony Gallardo\\, Las Palmas de Gran Canaria',
      'DESCRIPTION:Mercado navideño del CIFP Tony Gallardo hecho por su alumnado. Encendido navideño a las 11:05\\, recorrido por las casas de 11:10 a 12:50.',
      'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Mañana es MercaBásica', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = Object.assign(d.createElement('a'), { href: url, download: 'mercabasica-2026.ics' });
    d.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });

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
     Bucle de scroll
     ------------------------------------------------------------------ */
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; updateRoute(); });
  };
  addEventListener('scroll', onScroll, { passive: true });
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { layoutRoute(); placeNote(); onScroll(); }, 120); });
  mqReduce.addEventListener?.('change', () => location.reload());

  layoutRoute();
  placeNote();
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(() => { layoutRoute(); placeNote(); });
  addEventListener('load', () => { layoutRoute(); placeNote(); });
})();
