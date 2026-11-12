// =============================================================
// export.js — Exports pour la nutritionniste + sauvegarde
//   • Excel (.xlsx) généré directement dans le téléphone
//   • Rapport imprimable → "Enregistrer en PDF"
//   • Sauvegarde complète (.json) et restauration
// =============================================================
import { state, db, loadAll, saveSettings } from './store.js';
import {
  foodById, mealTypeById, symptomById, TRIGGER_GROUPS, CONTEXT_PLACES, CONTEXT_COMPANY, CONTEXT_MOODS, SPORTS, INTENSITIES, BRISTOL, PORTIONS,
} from './catalog.js';
import { dayOf, timeOf, addDays, fmtDelay, toast } from './ui.js';
import { mealOutcome, foodStats, stoolStats } from './analysis.js';

// ---------------- Libellés lisibles
const lbl = (list, id) => list.find((x) => x.id === id)?.label || '';
const portionLabel = (v) => PORTIONS.find((p) => p.v === v)?.label.toLowerCase() || '';
export const foodsText = (m) => (m.items || []).map((i) => `${foodById(i.foodId, state.customFoods)?.name || i.foodId} (${portionLabel(i.portion)})`).join(', ');
const triggersText = (m) => [...new Set((m.items || []).flatMap((i) => foodById(i.foodId, state.customFoods)?.t || []))].map((g) => TRIGGER_GROUPS[g]?.label.split(' (')[0]).join(', ');
export const contextText = (m) => [lbl(CONTEXT_PLACES, m.place), lbl(CONTEXT_COMPANY, m.company), ...(m.moods || []).map((x) => lbl(CONTEXT_MOODS, x))].filter(Boolean).join(', ');
const symText = (list) => list.map((s) => `${symptomById(s.type)?.label} ${s.intensity}/10${s.delayMin != null ? ' à +' + fmtDelay(s.delayMin) : ''}${s.durationMin ? ' pendant ' + fmtDelay(s.durationMin) : ''}`).join(' ; ');
const hm = (min) => (min == null ? '' : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`);
const fr = (d) => d.split('-').reverse().join('/');
const yes = (b) => (b ? 'oui' : '');

function collect(from, to) {
  const inR = (at) => dayOf(at) >= from && dayOf(at) <= to;
  return {
    meals: state.meals.filter((m) => inR(m.at)),
    symptoms: state.symptoms.filter((s) => inR(s.at)),
    stools: state.stools.filter((s) => inR(s.at)),
    days: (() => { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; })(),
  };
}

// ---------------- Tableaux (utilisés par Excel)
export function buildTables(from, to) {
  const c = collect(from, to);
  const journal = [['Date', 'Sommeil', 'Score Garmin', 'Qualité sommeil /10', 'Énergie réveil /10', 'Symptômes au réveil', 'Intensité réveil /10', 'Stress /10', 'Hydratation (verres)', 'Sport', 'Durée sport (min)', 'Intensité sport', 'Pas', 'Nb repas', 'Nb selles', 'Fausses envies', 'Symptôme max /10', 'Médicaments / probiotiques', 'Observations']];
  for (const d of c.days) {
    const day = state.days[d] || {};
    const meals = c.meals.filter((m) => dayOf(m.at) === d);
    const st = c.stools.filter((s) => dayOf(s.at) === d);
    const sy = c.symptoms.filter((s) => dayOf(s.at) === d);
    if (!meals.length && !st.length && !sy.length && !state.days[d]) continue;
    journal.push([fr(d), hm(day.sleepMin), day.sleepScore ?? '', day.sleepQuality ?? '', day.energy ?? '',
      (day.wakeSymptoms || []).map((x) => symptomById(x)?.label).join(', ') || (day.morningDone ? 'non' : ''), day.wakeIntensity || '',
      day.stress ?? '', day.water ?? '', lbl(SPORTS, day.sport?.type), day.sport?.durationMin ?? '', lbl(INTENSITIES, day.sport?.intensity), day.steps ?? '',
      meals.length, st.filter((s) => s.kind === 'selle').length, st.filter((s) => s.kind === 'fausse-envie').length,
      sy.length ? Math.max(...sy.map((s) => s.intensity)) : '', day.meds || '', day.notes || '']);
  }
  const repas = [['Date', 'Heure', 'Type', 'Aliments (portion)', 'Familles à surveiller', 'Précisions', 'Contexte', 'Durée (min)', 'Mastication /10', 'Mini-REX', 'Symptômes < 3 h', 'Intensité max < 3 h', 'Symptômes > 3 h', 'Photo']];
  for (const m of c.meals) {
    const o = mealOutcome(m);
    const early = o.symptoms.filter((s) => s.delayMin == null || s.delayMin <= 180);
    const late = o.symptoms.filter((s) => s.delayMin != null && s.delayMin > 180);
    repas.push([fr(dayOf(m.at)), timeOf(m.at), mealTypeById(m.type).label, foodsText(m), triggersText(m), m.note || '', contextText(m),
      m.durationMin ?? '', m.chewing ?? '', m.rex ? (m.rex.ok ? 'RAS' : 'symptômes') : 'non fait', symText(early), early.length ? o.early : (m.rex ? 0 : ''), symText(late), yes(m.photoId)]);
  }
  const sympt = [['Date', 'Heure', 'Zone', 'Symptôme', 'Intensité /10', 'Durée (min)', 'Repas lié', 'Délai après repas', 'Source', 'Ce qui a aidé / aggravé']];
  for (const s of c.symptoms) {
    const m = state.meals.find((x) => x.id === s.mealId);
    sympt.push([fr(dayOf(s.at)), timeOf(s.at), s.zone === 'haut' ? 'Digestif haut' : 'Digestif bas', symptomById(s.type)?.label, s.intensity, s.durationMin ?? '',
      m ? `${mealTypeById(m.type).label} ${timeOf(m.at)} : ${foodsText(m)}` : 'hors repas', s.delayMin != null ? fmtDelay(s.delayMin) : '', s.source === 'rex' ? 'mini-REX' : 'saisie libre', s.note || '']);
  }
  const transit = [['Date', 'Heure', 'Type', 'Bristol', 'Description', 'Urgence /10', 'Effort /10', 'Douleur /10', 'Évacuation incomplète', 'Brûlure', 'Jaune', 'Glaires', 'Sang', 'Note']];
  for (const s of c.stools) {
    transit.push([fr(dayOf(s.at)), timeOf(s.at), s.kind === 'selle' ? 'Selle' : 'Fausse envie', s.bristol ?? '', BRISTOL.find((b) => b.v === s.bristol)?.short || '',
      s.urgency ?? '', s.effort ?? '', s.pain ?? '', yes(s.incomplete), yes(s.burning), yes(s.yellow), yes(s.mucus), yes(s.blood), s.note || '']);
  }
  const fs = foodStats(from, to);
  const synth = [['Aliment', 'Repas évalués', 'Moyenne symptômes < 3 h (/10)', '% repas avec symptôme ≥ 4', 'Tendance', 'Remarques']];
  for (const f of fs.foods) {
    synth.push([f.food.name, f.n, f.avg, Math.round(f.pctBad * 100) + ' %', { suspect: 'À discuter (symptômes plus fréquents)', ok: 'Semble bien toléré', observer: 'Pas assez de données' }[f.verdict], [f.doseNote, f.lateNote].filter(Boolean).join(' ; ')]);
  }
  synth.push([], [`Moyenne de tous les repas évalués : ${fs.baseline}/10 (${fs.evaluatedMeals} repas)`], ['Ces tendances sont des pistes, pas un diagnostic.']);
  return [
    { name: 'Journal par jour', rows: journal },
    { name: 'Repas', rows: repas },
    { name: 'Symptômes', rows: sympt },
    { name: 'Transit', rows: transit },
    { name: 'Synthèse aliments', rows: synth },
  ];
}

// ---------------- Mini-générateur XLSX (zip sans compression)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function zip(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true); local.setUint32(14, crc, true); local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true); local.setUint16(26, name.length, true);
    chunks.push(new Uint8Array(local.buffer), name, data);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true);
    cen.setUint32(16, crc, true); cen.setUint32(20, data.length, true); cen.setUint32(24, data.length, true);
    cen.setUint16(28, name.length, true); cen.setUint32(42, offset, true);
    central.push(new Uint8Array(cen.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cenSize = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cenSize, true); end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
const xmlEsc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const colName = (i) => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

function sheetXML(rows) {
  const widths = [];
  rows.forEach((r) => r.forEach((v, i) => { widths[i] = Math.min(60, Math.max(widths[i] || 8, String(v ?? '').length + 2)); }));
  const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  const body = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
    const ref = colName(ci) + (ri + 1);
    const style = ri === 0 ? ' s="1"' : ' s="2"';
    if (v === '' || v == null) return '';
    if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"${style}><v>${v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
  }).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${body}</sheetData></worksheet>`;
}

export function buildXLSX(sheets) {
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xmlEsc(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`;
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFF7A59"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs></styleSheet>`;
  return zip([
    { name: '[Content_Types].xml', data: ct },
    { name: '_rels/.rels', data: rels },
    { name: 'xl/workbook.xml', data: wb },
    { name: 'xl/_rels/workbook.xml.rels', data: wbRels },
    { name: 'xl/styles.xml', data: styles },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXML(s.rows) })),
  ]);
}

// Partage (Android : menu de partage → Gmail, WhatsApp…) ou téléchargement
export async function shareOrDownload(blob, filename, title) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export async function exportExcel(from, to) {
  const blob = buildXLSX(buildTables(from, to));
  await saveSettings({ exportedAt: new Date().toISOString() });
  await shareOrDownload(blob, `journal-digestif_${from}_${to}.xlsx`, 'Journal digestif');
  window.dispatchEvent(new CustomEvent('data-changed'));
}

// ---------------- Sauvegarde complète (JSON)
const blobToDataURL = (b) => new Promise((r) => { const fr2 = new FileReader(); fr2.onload = () => r(fr2.result); fr2.readAsDataURL(b); });

export async function exportBackup(withPhotos = true) {
  const photos = withPhotos ? await db.all('photos') : [];
  const data = {
    app: 'bidou-journal', version: 1, exportedAt: new Date().toISOString(),
    meals: state.meals, symptoms: state.symptoms, stools: state.stools, days: Object.values(state.days),
    settings: state.settings, customFoods: state.customFoods, earned: state.earned,
    photos: await Promise.all(photos.map(async (p) => ({ id: p.id, data: await blobToDataURL(p.blob) }))),
  };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  await saveSettings({ lastBackup: new Date().toISOString() });
  await shareOrDownload(blob, `bidou-sauvegarde_${new Date().toISOString().slice(0, 10)}.json`, 'Sauvegarde Bidou');
}

export async function importBackup(file) {
  const data = JSON.parse(await file.text());
  if (data.app !== 'bidou-journal') throw new Error('Ce fichier n\'est pas une sauvegarde de l\'appli.');
  if (!confirm(`Remplacer toutes les données actuelles par cette sauvegarde du ${data.exportedAt.slice(0, 10)} ?`)) return false;
  for (const s of ['meals', 'symptoms', 'stools', 'days', 'photos', 'meta']) await db.clear(s);
  for (const m of data.meals) await db.put('meals', m);
  for (const s of data.symptoms) await db.put('symptoms', s);
  for (const s of data.stools) await db.put('stools', s);
  for (const d of data.days) await db.put('days', d);
  for (const p of data.photos || []) await db.put('photos', { id: p.id, blob: await (await fetch(p.data)).blob() });
  await db.put('meta', { key: 'settings', value: data.settings });
  await db.put('meta', { key: 'customFoods', value: data.customFoods || [] });
  await db.put('meta', { key: 'earned', value: data.earned || {} });
  await loadAll();
  toast('Sauvegarde restaurée !', '✅');
  return true;
}

export { stoolStats };
