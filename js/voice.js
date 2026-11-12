// =============================================================
// voice.js — Dictée vocale + compréhension simple du texte
// Utilise la reconnaissance vocale de Chrome (Android).
// Le texte reconnu est ensuite analysé ICI, sur le téléphone,
// pour remplir automatiquement le formulaire.
// =============================================================
import { FOODS, SYMPTOMS } from './catalog.js';
import { h, toast } from './ui.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const voiceSupported = !!SR;

// Bouton micro : appelle onText(texte) quand la dictée est finie
export function micButton(onText, label = 'Dicter') {
  const btn = h('button', { type: 'button', class: 'btn btn-mic' }, h('span', { class: 'mic-dot' }, '🎙️'), label);
  if (!voiceSupported) {
    btn.disabled = true;
    btn.title = 'Dictée non disponible sur ce navigateur (utilise Chrome)';
    btn.lastChild.textContent = 'Dictée indisponible';
    return btn;
  }
  let rec = null;
  btn.addEventListener('click', () => {
    if (rec) { rec.stop(); return; }
    rec = new SR();
    rec.lang = 'fr-FR';
    rec.interimResults = false;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    btn.classList.add('listening');
    btn.lastChild.textContent = 'Je t\'écoute… (touche pour arrêter)';
    let got = '';
    rec.onresult = (e) => {
      got = Array.from(e.results).map((r) => r[0].transcript).join(' ');
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed') toast('Autorise le micro pour utiliser la dictée', '🎙️');
      else if (e.error !== 'no-speech' && e.error !== 'aborted') toast('Dictée : ' + e.error, '⚠️');
    };
    rec.onend = () => {
      btn.classList.remove('listening');
      btn.lastChild.textContent = label;
      rec = null;
      if (got.trim()) onText(got.trim());
    };
    rec.start();
  });
  return btn;
}

// ---------------- Analyse du texte
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ');

const WORD_NUMBERS = { zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10 };

// Cherche une intensité "/10" près d'un mot-clé (ex: "douleur à 6", "ballonné 7 sur 10")
function intensityNear(text, index, keywordLength) {
  const after = text.slice(index + keywordLength, index + keywordLength + 28);
  // Chiffre (pas suivi de "heure"/"min") ou nombre en lettres précédé de "à" ou suivi de "sur 10"
  const m = after.match(/\b(10|[0-9])\b(?!\s*(h\b|heure|min))/)
    || after.match(/\ba\s+(zero|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\b/)
    || after.match(/\b(zero|une?|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s+sur\s+dix\b/);
  if (m) {
    const v = /\d/.test(m[1]) ? Number(m[1]) : WORD_NUMBERS[m[1]];
    if (v >= 0 && v <= 10) return v;
  }
  if (/(tres|vraiment|enormement|beaucoup|fort)/.test(text.slice(Math.max(0, index - 20), index + keywordLength + 20))) return 7;
  if (/(un peu|legere|leger|petit)/.test(text.slice(Math.max(0, index - 20), index + keywordLength + 20))) return 3;
  return 5;
}

// "j'ai mal au ventre à 6 et je suis ballonné, des gaz depuis une heure"
export function parseSymptoms(raw) {
  const text = norm(raw);
  const found = [];
  for (const s of SYMPTOMS) {
    for (const kw of [...s.kw].sort((a, b) => b.length - a.length)) {
      const k = norm(kw);
      const re = new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const m = re.exec(text);
      if (m) {
        // "mal" seul ne doit pas déclencher si "mal au coeur" (nausée) a déjà été vu
        if (s.id === 'douleur' && k === 'mal' && /mal au c(oe|œ)ur/.test(text)) continue;
        found.push({ type: s.id, intensity: intensityNear(text, m.index, k.length) });
        break;
      }
    }
  }
  let duration = null;
  const dm = text.match(/(pendant|depuis|dure|duree)\s+(une?|deux|trois|quatre|\d+)\s*(h|heure|heures|min|minute|minutes)/);
  if (dm) {
    const n = /\d/.test(dm[2]) ? Number(dm[2]) : WORD_NUMBERS[dm[2]];
    duration = dm[3].startsWith('h') ? n * 60 : n;
  } else if (/(demi|1\/2) ?heure/.test(text)) duration = 30;
  return { symptoms: found, duration };
}

// "un burger avec beaucoup de frites et un coca"
export function parseFoods(raw, customFoods = []) {
  const text = ' ' + norm(raw) + ' ';
  const all = [...customFoods, ...FOODS];
  const items = [];
  const used = [];
  // On teste d'abord les expressions les plus longues ("pomme de terre" avant "pomme")
  const candidates = [];
  for (const f of all) for (const s of [f.name, ...(f.syn || [])]) candidates.push({ f, s: norm(s) });
  candidates.sort((a, b) => b.s.length - a.s.length);
  for (const { f, s } of candidates) {
    if (s.length < 2) continue;
    const re = new RegExp('[^a-z]' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^a-z]');
    const m = re.exec(text);
    if (!m) continue;
    const start = m.index;
    const end = start + s.length + 2;
    if (used.some(([a, b]) => start < b && end > a)) continue; // déjà couvert par une expression plus longue
    if (items.some((i) => i.foodId === f.id)) continue;
    used.push([start, end]);
    const before = text.slice(Math.max(0, start - 25), start);
    let portion = 2;
    if (/(beaucoup|grosse|gros|grand|enorme|double|plein)/.test(before)) portion = 3;
    else if (/(un peu|petit|petite|quelques|une cuillere|un bout)/.test(before)) portion = 1;
    items.push({ foodId: f.id, portion });
  }
  return items;
}

// "selle type 4, un peu d'urgence" / "fausse envie" / "glaires"
export function parseStool(raw) {
  const t = norm(raw);
  const out = {};
  const m = t.match(/type\s*(\d|un|deux|trois|quatre|cinq|six|sept)/);
  if (m) out.bristol = /\d/.test(m[1]) ? Number(m[1]) : WORD_NUMBERS[m[1]];
  if (/fausse envie/.test(t)) out.kind = 'fausse-envie';
  if (/liquide|diarrhee/.test(t) && !out.bristol) out.bristol = 7;
  if (/(dur|dures|constip|billes|cailloux)/.test(t) && !out.bristol) out.bristol = 1;
  if (/urgen/.test(t)) out.urgency = /(tres|forte|grosse)/.test(t) ? 8 : 5;
  if (/glaire|mucus/.test(t)) out.mucus = true;
  if (/brul/.test(t)) out.burning = true;
  if (/jaune/.test(t)) out.yellow = true;
  if (/sang/.test(t)) out.blood = true;
  if (/(pas fini|incomplet|incomplete|pas vide)/.test(t)) out.incomplete = true;
  if (/(effort|pousser|force)/.test(t)) out.effort = 6;
  return out;
}
