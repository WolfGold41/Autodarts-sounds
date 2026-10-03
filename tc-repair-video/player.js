/* TC Service & Repair – deterministischer Motion-Player.
 * seek(t) setzt den kompletten Bildzustand für Sekunde t (keine laufenden Animationen),
 * damit render.mjs Frame für Frame exakt aufnehmen kann.
 * Erwartet window.VIDEO = { content, timeline } (von render.mjs bzw. preview injiziert).
 */
(function () {
  const ICONS = {
    smartphone: '<rect x="26" y="8" width="44" height="80" rx="6"/><path d="M42 16h12"/><circle cx="48" cy="78" r="3" fill="currentColor" stroke="none"/>',
    tablet: '<rect x="14" y="10" width="68" height="76" rx="6"/><circle cx="48" cy="78" r="3" fill="currentColor" stroke="none"/>',
    laptop: '<rect x="18" y="18" width="60" height="42" rx="3"/><path d="M8 72h80l-6 8H14z"/>',
    desktop: '<rect x="10" y="12" width="76" height="52" rx="3"/><path d="M48 64v14M30 82h36"/>',
    phone: '<rect x="12" y="34" width="72" height="48" rx="5"/><path d="M24 34V22c0-6 6-10 12-10h24c6 0 12 4 12 10v12"/><path d="M32 50h8M44 50h8M56 50h8M32 62h8M44 62h8M56 62h8"/>',
    watch: '<rect x="26" y="26" width="44" height="44" rx="8"/><path d="M34 26l4-16h20l4 16M34 70l4 16h20l4-16M48 38v12l8 6"/>',
    console: '<path d="M24 34h48c8 0 14 8 14 20v10c0 8-8 12-14 6l-8-8H32l-8 8c-6 6-14 2-14-6V54c0-12 6-20 14-20z"/><path d="M30 44v14M23 51h14"/><circle cx="64" cy="48" r="3" fill="currentColor" stroke="none"/><circle cx="70" cy="56" r="3" fill="currentColor" stroke="none"/>',
    headphones: '<path d="M16 60V48a32 32 0 0 1 64 0v12"/><rect x="12" y="56" width="16" height="26" rx="4"/><rect x="68" y="56" width="16" height="26" rx="4"/>',
    wrench: '<path d="M62 12a18 18 0 0 0-18 24L14 66l16 16 30-30a18 18 0 0 0 24-18l-12 12-10-4-4-10z"/>',
    transfer: '<rect x="8" y="22" width="30" height="52" rx="5"/><rect x="58" y="22" width="30" height="52" rx="5"/><path d="M42 40h12l-6-6M54 56H42l6 6"/>',
    refurbished: '<path d="M22 40a28 28 0 0 1 50-10l6-8v22H56l8-8a20 20 0 0 0-34 6"/><path d="M74 56a28 28 0 0 1-50 10l-6 8V52h22l-8 8a20 20 0 0 0 34-6"/>',
    business: '<rect x="10" y="30" width="76" height="50" rx="5"/><path d="M34 30v-8c0-4 2-6 6-6h16c4 0 6 2 6 6v8M10 52h76M44 52v8h8v-8"/>',
    leaf: '<path d="M18 78C18 40 40 18 80 16c0 40-22 62-58 62z"/><path d="M18 78l36-36"/>',
    course: '<path d="M8 36l40-18 40 18-40 18z"/><path d="M24 44v18c0 6 12 12 24 12s24-6 24-12V44M84 38v24"/>',
    home: '<path d="M12 46L48 16l36 30"/><path d="M22 40v42h52V40"/><path d="M40 82V60h16v22"/>',
    shield: '<path d="M48 10l32 12v22c0 22-14 36-32 42-18-6-32-20-32-42V22z"/><path d="M34 48l10 10 18-20"/>',
    data: '<ellipse cx="48" cy="22" rx="30" ry="10"/><path d="M18 22v52c0 6 14 10 30 10s30-4 30-10V22M18 48c0 6 14 10 30 10s30-4 30-10"/>',
    doc: '<path d="M22 8h36l16 16v64H22z"/><path d="M58 8v16h16M32 44h32M32 56h32M32 68h20"/>',
    lock: '<rect x="18" y="42" width="60" height="44" rx="5"/><path d="M30 42V30a18 18 0 0 1 36 0v12M48 58v12"/>',
    eye: '<path d="M6 48s16-26 42-26 42 26 42 26-16 26-42 26S6 48 6 48z"/><circle cx="48" cy="48" r="12"/>',
    case: '<rect x="26" y="8" width="44" height="80" rx="10"/><circle cx="40" cy="24" r="6"/><path d="M14 30v36M82 30v36"/>',
    chip: '<rect x="24" y="24" width="48" height="48" rx="4"/><rect x="38" y="38" width="20" height="20"/><path d="M36 24V12M48 24V12M60 24V12M36 84V72M48 84V72M60 84V72M24 36H12M24 48H12M24 60H12M84 36H72M84 48H72M84 60H72"/>',
  };
  const icon = (name) => `<svg viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="square" stroke-linejoin="miter">${ICONS[name] || ICONS.chip}</svg>`;

  // Leiterbahn: orthogonal und 45°, Knoten gefüllt, in der Ecke verankert
  const TRACE = '<svg viewBox="0 0 760 470" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square" stroke-linejoin="miter">' +
    '<path d="M0 120H180L240 180H420L470 230H600"/>' +
    '<path d="M0 220H90L140 270H260"/>' +
    '<path d="M120 0V60L170 110H330"/>' +
    '<path d="M300 0V40L340 80H520L560 120"/>' +
    '<path d="M420 180V110H500"/>' +
    '<path d="M0 330H40L90 380H170"/>' +
    '<circle class="node" cx="600" cy="230" r="8" fill="currentColor" stroke="none"/>' +
    '<circle class="node" cx="260" cy="270" r="8" fill="currentColor" stroke="none"/>' +
    '<circle class="node" cx="330" cy="110" r="8" fill="currentColor" stroke="none"/>' +
    '<circle class="node" cx="560" cy="120" r="8" fill="currentColor" stroke="none"/>' +
    '<circle class="node" cx="500" cy="110" r="8" fill="currentColor" stroke="none"/>' +
    '<circle class="node" cx="170" cy="380" r="8" fill="currentColor" stroke="none"/>' +
    '</svg>';

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeOut = (p) => 1 - Math.pow(1 - p, 3);
  const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

  function h(tag, cls, html, anim) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    if (anim) {
      n.classList.add('el');
      n.dataset.anim = anim.type || 'up';
      n.dataset.cue = anim.cue != null ? anim.cue : '';
      n.dataset.delay = anim.delay || 0;
      n.dataset.dur = anim.dur || 0.7;
      if (anim.count != null) { n.dataset.count = anim.count; n.dataset.suffix = anim.suffix || ''; }
    }
    return n;
  }

  function trace(corner, opacity, cue) {
    const t = h('div', 'trace trace--' + corner, TRACE, { type: 'draw', cue: cue == null ? 0 : cue, dur: 2.2 });
    t.style.opacity = opacity;
    return t;
  }

  /* ---------- Szenen-Bausteine ---------- */
  const BUILD = {
    intro(s, d) {
      s.appendChild(trace('tl', 0.2));
      s.appendChild(trace('br', 0.2));
      const c = h('div', 'intro-center');
      if (d.logo) {
        const img = h('img', 'logo-img', null, { type: 'scale', cue: 0, delay: 0.2, dur: 1.0 });
        img.src = d.logo; img.alt = 'TC Service & Repair';
        c.appendChild(img);
      } else {
        c.appendChild(h('div', 'brand-fallback', d.brand, { type: 'scale', cue: 0, delay: 0.2, dur: 1.0 }));
      }
      c.appendChild(h('div', 'rule', null, { type: 'grow', cue: 0, delay: 0.9 }));
      c.appendChild(h('div', 'claim', d.claim, { type: 'up', cue: d.claimCue ?? 1 }));
      c.appendChild(h('div', 'services-line', d.servicesLine, { type: 'fade', cue: d.claimCue ?? 1, delay: 0.6 }));
      s.appendChild(c);
    },
    stats(s, d) {
      s.appendChild(trace('br', 0.2));
      const w = h('div', 'wrap');
      w.appendChild(h('div', 'eyebrow', d.eyebrow, { type: 'fade', cue: 0 }));
      w.appendChild(h('div', 'h2', d.title, { type: 'up', cue: 0, delay: 0.15 }));
      const row = h('div', 'stats');
      d.items.forEach((it) => {
        const card = h('div', 'stat', null, { type: 'up', cue: it.cue, dur: 0.8 });
        card.appendChild(h('div', 'num', '0', { type: 'count', cue: it.cue, count: it.value, suffix: it.suffix || '', dur: 1.6 }));
        card.appendChild(h('div', 'lbl', it.label));
        if (it.sub) card.appendChild(h('div', 'sub', it.sub));
        row.appendChild(card);
      });
      w.appendChild(row);
      if (d.brands && d.brands.length) {
        const b = h('div', 'brands');
        d.brands.forEach((name, i) => b.appendChild(h('span', 'brand-chip', name, { type: 'fade', cue: d.brandsCue, delay: i * 0.06, dur: 0.5 })));
        w.appendChild(b);
      }
      s.appendChild(w);
    },
    grid(s, d) {
      s.appendChild(trace('tl', 0.2));
      const w = h('div', 'wrap');
      w.appendChild(h('div', 'eyebrow', d.eyebrow, { type: 'fade', cue: 0 }));
      w.appendChild(h('div', 'h2', d.title, { type: 'up', cue: 0, delay: 0.15 }));
      const g = h('div', 'grid' + (d.compact ? ' compact' : ''));
      g.style.gridTemplateColumns = `repeat(${d.columns || 4}, 1fr)`;
      d.items.forEach((it, i) => {
        const card = h('div', 'card', null, { type: 'up', cue: it.cue ?? d.itemsCue ?? 1, delay: it.cue != null ? 0 : i * (d.stagger ?? 0.18) });
        card.innerHTML = icon(it.icon) + `<div class="t">${it.title}</div>` + (it.text ? `<div class="d">${it.text}</div>` : '');
        g.appendChild(card);
      });
      w.appendChild(g);
      s.appendChild(w);
    },
    chips(s, d) {
      s.appendChild(trace('br', 0.2));
      const w = h('div', 'wrap');
      w.appendChild(h('div', 'eyebrow', d.eyebrow, { type: 'fade', cue: 0 }));
      w.appendChild(h('div', 'h2', d.title, { type: 'up', cue: 0, delay: 0.15 }));
      const g = h('div', 'chips');
      g.style.gridTemplateColumns = `repeat(${d.columns || 3}, 1fr)`;
      d.items.forEach((it, i) => {
        const item = typeof it === 'string' ? { title: it } : it;
        const c = h('div', 'chip', `<span class="dot"></span><span class="t">${item.title}</span>`,
          { type: 'left', cue: item.cue ?? d.itemsCue ?? 1, delay: item.cue != null ? 0 : i * (d.stagger ?? 0.12), dur: 0.55 });
        g.appendChild(c);
      });
      w.appendChild(g);
      s.appendChild(w);
    },
    steps(s, d) {
      s.appendChild(trace('tl', 0.2));
      const w = h('div', 'wrap');
      w.appendChild(h('div', 'eyebrow', d.eyebrow, { type: 'fade', cue: 0 }));
      w.appendChild(h('div', 'h2', d.title, { type: 'up', cue: 0, delay: 0.15 }));
      const st = h('div', 'steps');
      st.style.gridTemplateColumns = `repeat(${d.items.length}, 1fr)`;
      const line = h('div', 'line', null, { type: 'grow', cue: d.items[0].cue, dur: Math.max(2, d.lineDur || 6) });
      line.style.right = `calc(100% / ${d.items.length} - 48px)`;
      st.appendChild(line);
      d.items.forEach((it, i) => {
        const step = h('div', 'step');
        step.appendChild(h('div', 'n', String(i + 1), { type: 'scale', cue: it.cue, dur: 0.6 }));
        step.appendChild(h('div', 't', it.title, { type: 'up', cue: it.cue, delay: 0.15 }));
        step.appendChild(h('div', 'd', it.text, { type: 'up', cue: it.cue, delay: 0.3 }));
        st.appendChild(step);
      });
      w.appendChild(st);
      s.appendChild(w);
    },
    owner(s, d) {
      s.appendChild(trace('br', 0.2));
      const o = h('div', 'owner');
      if (d.portrait) {
        const f = h('div', 'portrait-frame', null, { type: 'scale', cue: 0, dur: 0.9 });
        const img = document.createElement('img'); img.src = d.portrait; img.alt = d.name; f.appendChild(img);
        o.appendChild(f);
      } else {
        // Ohne Porträtfoto: Kennzahlen-Spalte statt Bild
        const f = h('div', 'facts');
        d.facts.forEach((x, i) => f.appendChild(h('div', 'fact', `<div class="v">${x.value}</div><div class="l">${x.label}</div>`, { type: 'up', cue: x.cue ?? 0, delay: 0.3 + i * 0.2 })));
        o.appendChild(f);
      }
      const txt = h('div');
      txt.appendChild(h('div', 'eyebrow', d.eyebrow, { type: 'fade', cue: 0, delay: 0.2 }));
      txt.appendChild(h('div', 'name', d.name, { type: 'up', cue: 0, delay: 0.35 }));
      txt.appendChild(h('div', 'role', d.role, { type: 'up', cue: 0, delay: 0.5 }));
      const ul = h('ul');
      d.points.forEach((p) => ul.appendChild(h('li', null, p.text, { type: 'left', cue: p.cue })));
      txt.appendChild(ul);
      o.appendChild(txt);
      s.appendChild(o);
    },
    outro(s, d) {
      s.appendChild(trace('tl', 0.2));
      s.appendChild(trace('br', 0.2));
      const o = h('div', 'outro');
      if (d.logo) { const img = h('img', 'logo-img', null, { type: 'scale', cue: 0, dur: 0.9 }); img.src = d.logo; img.style.width = '460px'; o.appendChild(img); }
      else o.appendChild(h('div', 'brand-fallback', d.brand, { type: 'scale', cue: 0, dur: 0.9 }));
      o.appendChild(h('div', 'claim', d.claim, { type: 'up', cue: 0, delay: 0.3 }));
      o.appendChild(h('div', 'cta', d.cta, { type: 'scale', cue: d.ctaCue ?? 1 }));
      const row = h('div', 'contact-row', null, { type: 'up', cue: d.contactCue ?? 1, delay: 0.3 });
      row.innerHTML = d.contact.map((c) => `<span>${c}</span>`).join('');
      o.appendChild(row);
      o.appendChild(h('div', 'domain', d.domain, { type: 'up', cue: d.contactCue ?? 1, delay: 0.5 }));
      s.appendChild(o);
    },
  };

  /* ---------- Aufbau ---------- */
  const { content, timeline } = window.VIDEO;
  const stage = document.getElementById('stage');
  const scenes = timeline.scenes.map((ts) => {
    const def = content.scenes.find((c) => c.id === ts.id);
    const node = h('section', 'scene scene--' + def.type);
    BUILD[def.type](node, def.data);
    stage.appendChild(node);
    const els = Array.from(node.querySelectorAll('.el')).map((n) => {
      const cue = n.dataset.cue === '' ? null : Number(n.dataset.cue);
      const cueStart = cue == null ? ts.start : (ts.lines[Math.min(cue, ts.lines.length - 1)] || { start: ts.start }).start;
      const item = { n, type: n.dataset.anim, t0: cueStart + Number(n.dataset.delay), dur: Number(n.dataset.dur) };
      if (item.type === 'draw') {
        item.paths = Array.from(n.querySelectorAll('path')).map((p) => { const L = p.getTotalLength(); p.style.strokeDasharray = L; return { p, L }; });
        item.nodes = Array.from(n.querySelectorAll('.node'));
      }
      if (item.type === 'count') { item.to = Number(n.dataset.count); item.suffix = n.dataset.suffix; }
      return item;
    });
    return { ts, node, els };
  });

  const subsBox = document.querySelector('#subs .box');
  if (content.subtitleStyle === 'light') document.getElementById('subs').classList.add('light');
  const cues = timeline.subtitles;

  function applyEl(e, t) {
    const p = clamp((t - e.t0) / e.dur);
    const q = easeOut(p);
    const s = e.n.style;
    switch (e.type) {
      case 'fade': s.opacity = q; break;
      case 'up': s.opacity = q; s.transform = `translateY(${(1 - q) * 40}px)`; break;
      case 'left': s.opacity = q; s.transform = `translateX(${(1 - q) * -40}px)`; break;
      case 'scale': s.opacity = q; s.transform = `scale(${0.92 + 0.08 * q})`; break;
      case 'grow': s.transform = `scaleX(${easeInOut(p)})`; s.transformOrigin = s.transformOrigin || 'left center'; break;
      case 'count': {
        const v = Math.round(e.to * easeOut(p));
        e.n.innerHTML = v + (e.suffix ? `<small>${e.suffix}</small>` : '');
        break;
      }
      case 'draw': {
        const pp = easeInOut(p);
        e.paths.forEach(({ p: path, L }) => { path.style.strokeDashoffset = L * (1 - pp); });
        e.nodes.forEach((c) => { c.style.opacity = clamp((p - 0.75) / 0.25); });
        break;
      }
    }
  }

  window.seek = function (t) {
    for (const sc of scenes) {
      const { start, end } = sc.ts;
      const fadeIn = clamp((t - start) / 0.45);
      const fadeOut = clamp((end - t) / 0.4);
      const o = Math.min(fadeIn, fadeOut);
      sc.node.style.opacity = o;
      sc.node.style.visibility = o > 0 ? 'visible' : 'hidden';
      if (o > 0) sc.els.forEach((e) => applyEl(e, t));
    }
    // Untertitel: direkte Wechsel zwischen aufeinanderfolgenden Einblendungen, Fade nur an Pausen
    let ci = -1;
    for (let i = 0; i < cues.length; i++) if (t >= cues[i].start && t < cues[i].end) { ci = i; break; }
    if (ci >= 0) {
      const cur = cues[ci], prev = cues[ci - 1], next = cues[ci + 1];
      if (subsBox.textContent !== cur.text) subsBox.textContent = cur.text;
      const fin = prev && cur.start - prev.end < 0.3 ? 1 : clamp((t - cur.start) / 0.15);
      const fout = next && next.start - cur.end < 0.3 ? 1 : clamp((cur.end - t) / 0.15);
      subsBox.style.opacity = Math.min(fin, fout);
    } else subsBox.style.opacity = 0;
  };
  window.VIDEO_DURATION = timeline.duration;
  window.seek(0);
  window.PLAYER_READY = true;
})();
