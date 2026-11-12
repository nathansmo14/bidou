// =============================================================
// ui.js — Petits outils d'interface réutilisables
// =============================================================

// h('div', {class:'x', onclick: fn}, enfant1, enfant2…) => élément DOM
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// ---------------- Dates (toujours en heure locale)
const pad = (n) => String(n).padStart(2, '0');
export const toDayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toLocalISO = (d) => `${toDayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const todayKey = () => toDayKey(new Date());
export const nowISO = () => toLocalISO(new Date());
export const parseAt = (s) => new Date(s);
export const dayOf = (at) => at.slice(0, 10);
export const timeOf = (at) => at.slice(11, 16).replace(':', 'h');
export const addDays = (key, n) => {
  const d = new Date(key + 'T12:00');
  d.setDate(d.getDate() + n);
  return toDayKey(d);
};
export const minutesBetween = (a, b) => Math.round((parseAt(b) - parseAt(a)) / 60000);
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export function prettyDay(key, withWeekday = true) {
  const d = new Date(key + 'T12:00');
  const t = todayKey();
  if (key === t) return "Aujourd'hui";
  if (key === addDays(t, -1)) return 'Hier';
  return `${withWeekday ? DAYS[d.getDay()] + ' ' : ''}${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export const shortDay = (key) => {
  const d = new Date(key + 'T12:00');
  return `${DAYS[d.getDay()].slice(0, 3)}. ${d.getDate()}/${d.getMonth() + 1}`;
};
export const fmtDelay = (min) => {
  if (min == null || isNaN(min)) return '';
  if (min < 60) return `${min} min`;
  const hh = Math.floor(min / 60);
  const mm = min % 60;
  return mm ? `${hh} h ${pad(mm)}` : `${hh} h`;
};

// ---------------- Toast (petit message en bas)
export function toast(msg, emoji = '✨') {
  const t = h('div', { class: 'toast' }, h('span', { class: 'toast-emoji' }, emoji), msg);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 2600);
}

// ---------------- Feuille (formulaire qui monte du bas)
// Plusieurs feuilles peuvent s'empiler : chacune connaît sa "profondeur"
// pour que le bouton retour ne ferme que celle du dessus.
let sheetDepth = 0;
export function openSheet({ title, emoji, body, onSave, saveLabel = 'Enregistrer', onDelete, color }) {
  const depth = ++sheetDepth;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    sheetDepth = depth - 1;
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 250);
    window.removeEventListener('popstate', onPop);
  };
  const onPop = (e) => {
    const d = e.state && e.state.sheet ? e.state.sheet : 0;
    if (d < depth) close();
  };
  const saveBtn = onSave
    ? h('button', {
        class: 'btn btn-primary btn-block',
        onclick: async () => {
          saveBtn.disabled = true;
          try {
            const ok = await onSave();
            if (ok !== false && !closed) history.back();
          } finally {
            saveBtn.disabled = false;
          }
        },
      }, saveLabel)
    : null;
  const sheet = h('div', { class: 'sheet', style: color ? { '--sheet-accent': color } : null },
    h('div', { class: 'sheet-head' },
      h('div', { class: 'sheet-title' }, emoji ? h('span', { class: 'sheet-emoji' }, emoji) : null, title),
      h('button', { class: 'icon-btn', 'aria-label': 'Fermer', onclick: () => history.back() }, '✕')
    ),
    h('div', { class: 'sheet-body' }, body),
    h('div', { class: 'sheet-foot' },
      onDelete ? h('button', {
        class: 'btn btn-ghost danger',
        onclick: async () => {
          if (confirm('Supprimer cet élément ?')) {
            await onDelete();
            history.back();
          }
        },
      }, '🗑️') : null,
      saveBtn
    )
  );
  const overlay = h('div', {
    class: 'overlay',
    onclick: (e) => { if (e.target === overlay) history.back(); },
  }, sheet);
  document.body.append(overlay);
  // Le bouton "retour" d'Android ferme la feuille
  history.pushState({ sheet: depth }, '');
  window.addEventListener('popstate', onPop);
  requestAnimationFrame(() => overlay.classList.add('open'));
  return { close: () => { if (!closed) history.back(); }, sheet };
}

// ---------------- Composants de formulaire
export function section(title, ...children) {
  return h('div', { class: 'f-section' }, title ? h('div', { class: 'f-label' }, title) : null, ...children);
}

// Groupe de puces (choix unique ou multiple)
export function chips(options, value, { multi = false, onChange, small = false } = {}) {
  let current = multi ? new Set(value || []) : value;
  const wrap = h('div', { class: 'chips' + (small ? ' small' : '') });
  const render = () => {
    wrap.innerHTML = '';
    for (const o of options) {
      const id = o.id ?? o.v;
      const on = multi ? current.has(id) : current === id;
      wrap.append(h('button', {
        type: 'button',
        class: 'chip' + (on ? ' on' : ''),
        onclick: () => {
          if (multi) current.has(id) ? current.delete(id) : current.add(id);
          else current = current === id ? null : id;
          render();
          onChange && onChange(multi ? [...current] : current);
        },
      }, o.emoji ? h('span', { class: 'chip-emoji' }, o.emoji) : null, o.label));
    }
  };
  render();
  wrap.getValue = () => (multi ? [...current] : current);
  return wrap;
}

// Curseur 0-10 avec visage qui change
const FACES = ['😀', '🙂', '🙂', '😐', '😐', '😕', '😟', '😣', '😖', '😫', '😭'];
const FACES_GOOD = ['😫', '😖', '😣', '😟', '😕', '😐', '🙂', '🙂', '😀', '😄', '🤩'];
export function scale(value, { onChange, good = false, labels = ['0', '10'] } = {}) {
  let v = value ?? 0;
  const face = h('span', { class: 'scale-face' });
  const num = h('span', { class: 'scale-num' });
  const input = h('input', { type: 'range', min: 0, max: 10, step: 1, value: v, class: 'range' + (good ? ' good' : '') });
  const update = () => {
    face.textContent = (good ? FACES_GOOD : FACES)[v];
    num.textContent = v + '/10';
    input.style.setProperty('--p', v * 10 + '%');
  };
  input.addEventListener('input', () => {
    v = Number(input.value);
    update();
    onChange && onChange(v);
  });
  update();
  const el = h('div', { class: 'scale' },
    h('div', { class: 'scale-top' }, face, num),
    input,
    h('div', { class: 'scale-labels' }, h('span', {}, labels[0]), h('span', {}, labels[1]))
  );
  el.getValue = () => v;
  el.setValue = (n) => { v = n; input.value = n; update(); };
  return el;
}

export function toggle(label, value, emoji) {
  const input = h('input', { type: 'checkbox' });
  input.checked = !!value;
  const el = h('label', { class: 'toggle' }, emoji ? h('span', { class: 'chip-emoji' }, emoji) : null, h('span', { class: 'toggle-label' }, label), input, h('span', { class: 'toggle-ui' }));
  el.getValue = () => input.checked;
  el.setValue = (b) => (input.checked = !!b);
  return el;
}

export function stepper(value, { min = 0, max = 30, unit = '', emoji = '' } = {}) {
  let v = value ?? 0;
  const out = h('span', { class: 'stepper-val' });
  const render = () => (out.textContent = `${emoji ? emoji + ' ' : ''}${v}${unit}`);
  const el = h('div', { class: 'stepper' },
    h('button', { type: 'button', class: 'icon-btn', onclick: () => { v = Math.max(min, v - 1); render(); } }, '−'),
    out,
    h('button', { type: 'button', class: 'icon-btn', onclick: () => { v = Math.min(max, v + 1); render(); } }, '+')
  );
  render();
  el.getValue = () => v;
  return el;
}

export function dateTimeInput(value) {
  const input = h('input', { type: 'datetime-local', class: 'input', value });
  input.getValue = () => input.value;
  return input;
}

export function textArea(value, placeholder) {
  const ta = h('textarea', { class: 'input', rows: 2, placeholder });
  ta.value = value || '';
  ta.getValue = () => ta.value.trim();
  return ta;
}

export function emptyState(emoji, text, action) {
  return h('div', { class: 'empty' }, h('div', { class: 'empty-emoji' }, emoji), h('p', {}, text), action || null);
}

export const escapeHTML = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
