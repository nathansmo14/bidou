// =============================================================
// gamification.js — XP, niveaux, séries, badges, humeur de Bidou
// =============================================================
import { state, saveMeta } from './store.js';
import { dayOf, todayKey, addDays, nowISO } from './ui.js';
import { pendingRex } from './reminders.js';

export const XP = { meal: 10, photo: 5, rex: 15, symptom: 5, stool: 10, morning: 15, evening: 15 };

const LEVELS = [
  [0, 'Bébé Bidou', '🥚'], [100, 'Curieux', '🐣'], [250, 'Observateur', '👀'], [450, 'Explorateur', '🧭'],
  [700, 'Détective du bidou', '🕵️'], [1000, 'Enquêteur chevronné', '🔍'], [1400, 'Scientifique', '🧪'],
  [1900, 'Expert du bidou', '🎓'], [2500, 'Maître zen', '🧘'], [3200, 'Légende', '🏆'],
];

export function totalXP() {
  let xp = 0;
  for (const m of state.meals) xp += XP.meal + (m.photoId ? XP.photo : 0) + (m.rex ? XP.rex : 0);
  xp += state.symptoms.length * XP.symptom;
  xp += state.stools.length * XP.stool;
  for (const d of Object.values(state.days)) xp += (d.morningDone ? XP.morning : 0) + (d.eveningDone ? XP.evening : 0);
  return xp;
}

export function levelInfo(xp = totalXP()) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1][0]) i++;
  const [min, name, emoji] = LEVELS[i];
  const next = LEVELS[i + 1];
  return { level: i + 1, name, emoji, xp, min, next: next ? next[0] : null, progress: next ? (xp - min) / (next[0] - min) : 1 };
}

// Checklist d'une journée
export function dayChecklist(date = todayKey()) {
  const d = state.days[date] || {};
  const meals = state.meals.filter((m) => dayOf(m.at) === date);
  const now = nowISO();
  const rexDue = meals.filter((m) => !m.rex && (date < todayKey() || pendingRex().includes(m)));
  const stools = state.stools.filter((s) => dayOf(s.at) === date);
  const items = [
    { id: 'morning', emoji: '🌅', label: 'Bilan du matin', done: !!d.morningDone },
    { id: 'meals', emoji: '🍽️', label: `Repas notés (${meals.length}/3)`, done: meals.length >= 3 },
    { id: 'rex', emoji: '🩺', label: 'Mini-REX faits', done: meals.length > 0 && rexDue.length === 0 && meals.every((m) => m.rex || m.at > now) },
    { id: 'transit', emoji: '🚽', label: 'Transit noté', done: stools.length > 0 || !!d.noStool },
    { id: 'evening', emoji: '🌙', label: 'Bilan du soir', done: !!d.eveningDone },
  ];
  return { items, done: items.filter((i) => i.done).length, total: items.length };
}

// Jour "actif" = au moins 2 éléments notés
function isActiveDay(date) {
  const n = state.meals.filter((m) => dayOf(m.at) === date).length
    + state.stools.filter((s) => dayOf(s.at) === date).length
    + (state.days[date]?.morningDone ? 1 : 0) + (state.days[date]?.eveningDone ? 1 : 0);
  return n >= 2;
}

export function streak() {
  let d = todayKey();
  if (!isActiveDay(d)) d = addDays(d, -1);
  let n = 0;
  while (isActiveDay(d)) { n++; d = addDays(d, -1); }
  return n;
}

export function activeDaysCount() {
  const set = new Set([...state.meals.map((m) => dayOf(m.at)), ...state.stools.map((s) => dayOf(s.at)), ...Object.keys(state.days)]);
  return [...set].filter(isActiveDay).length;
}

export const BADGES = [
  { id: 'first-meal', emoji: '🍽️', name: 'Premier repas', desc: 'Noter ton premier repas', test: () => state.meals.length >= 1 },
  { id: 'first-rex', emoji: '🩺', name: 'Premier REX', desc: 'Faire ton premier mini-REX', test: () => state.meals.some((m) => m.rex) },
  { id: 'first-stool', emoji: '💩', name: 'Sans tabou', desc: 'Noter ta première selle sur l\'échelle de Bristol', test: () => state.stools.length >= 1 },
  { id: 'photo', emoji: '📸', name: 'Food reporter', desc: 'Prendre un repas en photo', test: () => state.meals.some((m) => m.photoId) },
  { id: 'full-day', emoji: '⭐', name: 'Journée parfaite', desc: 'Compléter les 5 étapes d\'une journée', test: () => [...new Set(state.meals.map((m) => dayOf(m.at)))].some((d) => dayChecklist(d).done === 5) },
  { id: 'streak-3', emoji: '🔥', name: 'En feu', desc: '3 jours de suite', test: () => streak() >= 3 },
  { id: 'streak-7', emoji: '⚡', name: 'Inarrêtable', desc: '7 jours de suite', test: () => streak() >= 7 },
  { id: 'rex-10', emoji: '🎯', name: 'Sniper du REX', desc: '10 mini-REX réalisés', test: () => state.meals.filter((m) => m.rex).length >= 10 },
  { id: 'water-8', emoji: '💧', name: 'Bien hydraté', desc: '8 verres d\'eau en une journée', test: () => Object.values(state.days).some((d) => (d.water || 0) >= 8) },
  { id: 'sport', emoji: '🏃', name: 'En mouvement', desc: 'Noter une activité sportive', test: () => Object.values(state.days).some((d) => d.sport) },
  { id: 'morning-5', emoji: '🌅', name: 'Lève-tôt', desc: '5 bilans du matin', test: () => Object.values(state.days).filter((d) => d.morningDone).length >= 5 },
  { id: 'evening-5', emoji: '🌙', name: 'Oiseau de nuit', desc: '5 bilans du soir', test: () => Object.values(state.days).filter((d) => d.eveningDone).length >= 5 },
  { id: 'foodie-30', emoji: '🥗', name: 'Gourmet curieux', desc: '30 aliments différents notés', test: () => new Set(state.meals.flatMap((m) => (m.items || []).map((i) => i.foodId))).size >= 30 },
  { id: 'journal-15', emoji: '🏅', name: 'Journal 15 jours', desc: '15 jours de suivi : le défi de ta nutritionniste !', test: () => activeDaysCount() >= 15 },
  { id: 'report', emoji: '📋', name: 'Prêt pour le RDV', desc: 'Exporter ton rapport pour la nutritionniste', test: () => !!state.settings.exportedAt },
];

// Vérifie les nouveaux badges ; renvoie ceux qui viennent d'être gagnés
export async function checkBadges() {
  const fresh = [];
  for (const b of BADGES) {
    if (!state.earned[b.id] && b.test()) {
      state.earned[b.id] = new Date().toISOString();
      fresh.push(b);
    }
  }
  if (fresh.length) await saveMeta('earned', state.earned);
  return fresh;
}

// Humeur de Bidou selon ta journée
export function mascotMood() {
  const hr = new Date().getHours();
  const c = dayChecklist();
  if (c.done === c.total) return { mood: 'party', msg: 'Journée complète ! Tu es une machine 🎉' };
  if (pendingRex().length) return { mood: 'worried', msg: 'Hé ! Comment va ton ventre depuis le dernier repas ?' };
  if (hr < 6 || hr >= 23) return { mood: 'sleepy', msg: 'Il est tard… pense à bien dormir, ton intestin aussi se repose 😴' };
  if (hr < 11 && !state.days[todayKey()]?.morningDone) return { mood: 'calm', msg: 'Bonjour ! On commence par le bilan du matin ?' };
  const s = streak();
  if (s >= 3) return { mood: 'happy', msg: `${s} jours de suite, continue comme ça 🔥` };
  return { mood: 'happy', msg: 'Chaque note aide à comprendre ton ventre. On y va ?' };
}
