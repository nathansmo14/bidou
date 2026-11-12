// =============================================================
// charts.js — Petits graphiques SVG faits maison (sans librairie)
// Touche ou survole un point/une barre pour voir le détail.
// =============================================================
import { shortDay, timeOf } from './ui.js';
import { BRISTOL_COLORS } from './art.js';
import { BRISTOL } from './catalog.js';

// Infobulle partagée
let tipEl = null;
function tip() {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.className = 'chart-tip';
    document.body.append(tipEl);
    document.addEventListener('pointerdown', (e) => { if (!e.target.closest('[data-tip]')) tipEl.classList.remove('show'); });
    window.addEventListener('scroll', () => tipEl.classList.remove('show'), { passive: true });
  }
  return tipEl;
}
export function bindTips(root) {
  root.querySelectorAll('[data-tip]').forEach((el) => {
    const show = (e) => {
      const t = tip();
      t.innerHTML = el.getAttribute('data-tip');
      t.classList.add('show');
      const r = el.getBoundingClientRect();
      const x = Math.min(window.innerWidth - t.offsetWidth - 8, Math.max(8, r.left + r.width / 2 - t.offsetWidth / 2));
      const y = r.top - t.offsetHeight - 10 < 8 ? r.bottom + 10 : r.top - t.offsetHeight - 10;
      t.style.left = x + 'px';
      t.style.top = y + 'px';
      e.stopPropagation();
    };
    el.addEventListener('pointerenter', show);
    el.addEventListener('click', show);
    el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') tip().classList.remove('show'); });
  });
}

const W = 340;

// Étiquettes de l'axe X (on en saute si trop de jours)
function xLabels(series, x, y0) {
  const step = Math.ceil(series.length / 7);
  return series.map((d, i) => (i % step === 0 || i === series.length - 1)
    ? `<text x="${x(i)}" y="${y0 + 14}" class="ax" text-anchor="middle">${shortDay(d.date).split(' ')[1]}</text>` : '').join('');
}

// --- Bristol jour par jour (points), zone normale 3-4 en fond
export function bristolChart(series) {
  const H = 200, L = 26, R = 8, T = 10, B = 22;
  const n = series.length;
  const x = (i) => L + ((W - L - R) * (i + 0.5)) / n;
  const y = (v) => T + ((H - T - B) * (v - 1)) / 6;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Type de selles (Bristol) par jour">`;
  s += `<rect x="${L}" y="${y(3) - 6}" width="${W - L - R}" height="${y(4) - y(3) + 12}" rx="6" class="band-ok"/>`;
  for (let v = 1; v <= 7; v++) s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 6}" y="${y(v) + 3.5}" class="ax" text-anchor="end">${v}</text>`;
  s += `<text x="${W - R - 2}" y="${y(1) + 12}" class="ax-note" text-anchor="end">dur</text><text x="${W - R - 2}" y="${y(7) - 5}" class="ax-note" text-anchor="end">liquide</text>`;
  series.forEach((d, i) => {
    const pts = d.bristols;
    pts.forEach((p, k) => {
      const dx = (k - (pts.length - 1) / 2) * 7;
      const b = BRISTOL.find((z) => z.v === p.v);
      s += `<circle cx="${x(i) + dx}" cy="${y(p.v)}" r="5.5" fill="${BRISTOL_COLORS[p.v]}" class="dot" data-tip="<b>${shortDay(d.date)} · ${timeOf(p.at)}</b><br>Bristol ${p.v} : ${b.short}"/>`;
    });
    if (d.falseUrges) s += `<text x="${x(i)}" y="${H - B - 2}" class="fe" text-anchor="middle" data-tip="<b>${shortDay(d.date)}</b><br>${d.falseUrges} fausse(s) envie(s)">✕</text>`;
  });
  s += xLabels(series, x, H - B);
  return s + '</svg>';
}

// --- Intensité max des symptômes par jour (barres)
export function symptomChart(series) {
  const H = 170, L = 26, R = 8, T = 10, B = 22;
  const n = series.length;
  const bw = Math.max(4, Math.min(22, ((W - L - R) / n) - 4));
  const x = (i) => L + ((W - L - R) * (i + 0.5)) / n;
  const y = (v) => T + ((H - T - B) * (10 - v)) / 10;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Intensité maximale des symptômes par jour">`;
  for (const v of [0, 5, 10]) s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 6}" y="${y(v) + 3.5}" class="ax" text-anchor="end">${v}</text>`;
  series.forEach((d, i) => {
    if (d.maxSym == null) {
      s += `<circle cx="${x(i)}" cy="${y(0) - 3}" r="1.6" class="nodata"/>`;
      return;
    }
    const v = d.maxSym;
    const top = y(Math.max(v, 0.25));
    const hgt = y(0) - top;
    const cls = v >= 6 ? 'bar-bad' : v >= 3 ? 'bar-mid' : 'bar-good';
    s += `<path d="M${x(i) - bw / 2},${y(0)} v${-(hgt - 4)} q0,-4 4,-4 h${bw - 8} q4,0 4,4 v${hgt - 4} z" class="${cls}"/>`;
    s += `<rect x="${x(i) - bw / 2 - 3}" y="${T}" width="${bw + 6}" height="${H - T - B}" fill="transparent" data-tip="<b>${shortDay(d.date)}</b><br>Symptôme max : ${v}/10<br>${d.symCount} symptôme(s) noté(s)"/>`;
  });
  s += xLabels(series, x, H - B);
  return s + '</svg>';
}

// --- Répartition Bristol (barres horizontales)
export function bristolDistribution(counts) {
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const max = Math.max(...counts, 1);
  return `<div class="hbars">${counts.map((c, i) => {
    const b = BRISTOL[i];
    return `<div class="hbar" data-tip="<b>Type ${b.v}</b> : ${b.short}<br>${c} selle(s) · ${Math.round((c / total) * 100)} %">
      <span class="hbar-label">${b.v}</span>
      <span class="hbar-track"><span class="hbar-fill" style="width:${(c / max) * 100}%;background:${BRISTOL_COLORS[b.v]}"></span></span>
      <span class="hbar-val">${c ? Math.round((c / total) * 100) + ' %' : '–'}</span></div>`;
  }).join('')}</div>`;
}

// --- Comparaison "avec / sans" (moyenne de symptômes /10)
export function compareRows(rows, otherLabelDefault = 'sans') {
  if (!rows.length) return '<p class="muted small">Pas encore assez de données. Continue à noter ! 💪</p>';
  return `<div class="cmp">${rows.map((r) => {
    const diff = (r.avgWith ?? 0) - (r.avgWithout ?? 0);
    const tone = diff >= 1.5 ? 'up' : diff <= -1.5 ? 'down' : 'flat';
    const other = r.otherLabel || r.compareLabel || otherLabelDefault;
    return `<div class="cmp-row ${tone}" data-tip="<b>${r.emoji} ${r.label}</b><br>Moyenne : ${r.avgWith}/10 (${r.n} fois)<br>${other} : ${r.avgWithout ?? '–'}/10">
      <span class="cmp-emoji">${r.emoji}</span>
      <span class="cmp-label">${r.label}<small>${r.n} fois</small></span>
      <span class="cmp-bars">
        <span class="cmp-bar a" style="width:${(r.avgWith ?? 0) * 10}%"></span>
        <span class="cmp-bar b" style="width:${(r.avgWithout ?? 0) * 10}%"></span>
      </span>
      <span class="cmp-val">${r.avgWith}<small> vs ${r.avgWithout ?? '–'}</small></span></div>`;
  }).join('')}</div>`;
}
