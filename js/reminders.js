// =============================================================
// reminders.js — Rappels de mini-REX et de bilan
//
// Limite technique honnête : une appli web (PWA) ne peut pas
// programmer une notification exacte quand elle est complètement
// fermée (pas de serveur). Donc :
//  1) l'accueil affiche toujours les REX "en attente" (fiable)
//  2) tant que l'appli est ouverte ou en arrière-plan récent,
//     une notification est envoyée à l'heure prévue.
// =============================================================
import { state } from './store.js';
import { parseAt, toLocalISO, nowISO, minutesBetween, timeOf, todayKey } from './ui.js';
import { mealTypeById } from './catalog.js';

const notified = new Set(JSON.parse(localStorageGet('notified') || '[]'));

function localStorageGet(k) {
  try { return localStorage.getItem(k); } catch { return null; }
}
function localStorageSet(k, v) {
  try { localStorage.setItem(k, v); } catch { /* ignore */ }
}

export function rexDueAt(meal) {
  const d = parseAt(meal.at);
  d.setMinutes(d.getMinutes() + (state.settings.rexDelayMin || 180));
  return toLocalISO(d);
}

export function scheduleRexReminder(meal) {
  return rexDueAt(meal);
}

// Repas dont le mini-REX est à faire (délai atteint, pas encore fait, < 24 h)
export function pendingRex() {
  const now = nowISO();
  return state.meals.filter((m) => !m.rex && rexDueAt(m) <= now && minutesBetween(m.at, now) < 24 * 60);
}
// Repas dont le REX arrive bientôt
export function upcomingRex() {
  const now = nowISO();
  return state.meals.filter((m) => !m.rex && rexDueAt(m) > now);
}

export async function enableNotifications() {
  if (!('Notification' in window)) return false;
  const p = await Notification.requestPermission();
  return p === 'granted';
}

async function notify(title, body, tag) {
  if (!state.settings.notifications || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const opts = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', vibrate: [80, 40, 80], data: { url: './#/' } };
    if (reg) await reg.showNotification(title, opts);
    else new Notification(title, opts);
  } catch { /* ignore */ }
}

// Vérifie toutes les 30 s s'il faut envoyer un rappel
export function startReminderLoop() {
  const tick = () => {
    for (const m of pendingRex()) {
      const key = 'rex-' + m.id;
      if (notified.has(key)) continue;
      notified.add(key);
      const mt = mealTypeById(m.type);
      notify('🩺 Mini-REX', `Comment va ton ventre depuis ton ${mt.label.toLowerCase()} de ${timeOf(m.at)} ? 10 secondes suffisent !`, key);
    }
    const hr = new Date().getHours();
    const day = state.days[todayKey()];
    const key = 'soir-' + todayKey();
    if (hr >= (state.settings.eveningHour || 20) && !(day && day.eveningDone) && !notified.has(key)) {
      notified.add(key);
      notify('🌙 Bilan du soir', 'Stress, eau, sport : 30 secondes pour boucler ta journée.', key);
    }
    localStorageSet('notified', JSON.stringify([...notified].slice(-200)));
  };
  tick();
  setInterval(tick, 30000);
}
