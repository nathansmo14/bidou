// =============================================================
// app.js — Point d'entrée : navigation + écrans Accueil, Journal, Profil
// =============================================================
import { state, loadAll, saveSettings, wipeAll } from './store.js';
import {
  h, todayKey, nowISO, prettyDay, dayOf, timeOf, addDays, minutesBetween, fmtDelay, toast, openSheet, section, emptyState, toDayKey,
} from './ui.js';
import { mealTypeById, symptomById, foodById, BRISTOL } from './catalog.js';
import { mascot, bristolSVG } from './art.js';
import {
  openMealForm, openSymptomForm, openStoolForm, openMorningForm, openEveningForm, openQuickAdd, addWater,
} from './forms.js';
import { pendingRex, upcomingRex, rexDueAt, startReminderLoop, enableNotifications } from './reminders.js';
import { dayChecklist, levelInfo, streak, activeDaysCount, mascotMood, checkBadges, BADGES } from './gamification.js';
import { mealOutcome } from './analysis.js';
import { renderDashboard, renderReport } from './dashboard.js';
import { exportExcel, exportBackup, importBackup } from './export.js';

const main = document.getElementById('main');

// ---------------- Navigation (#/, #/journal, #/tendances, #/profil, #/rapport/du/au)
function route() {
  const [, page = '', a, b] = location.hash.split('/');
  main.classList.remove('report-mode');
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.page === (page || 'accueil')));
  document.body.classList.toggle('in-report', page === 'rapport');
  if (page === 'journal') renderJournal(a || todayKey());
  else if (page === 'tendances') renderDashboard(main);
  else if (page === 'profil') renderProfile();
  else if (page === 'rapport') renderReport(main, a, b);
  else renderHome();
}
window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });
window.addEventListener('data-changed', async () => {
  route();
  const fresh = await checkBadges();
  fresh.forEach((b, i) => setTimeout(() => celebrate(b), 500 + i * 2800));
});

function celebrate(b) {
  const el = h('div', { class: 'celebrate' },
    h('div', { class: 'celebrate-card' },
      h('div', { html: mascot('party', 90) }),
      h('div', { class: 'celebrate-badge' }, b.emoji),
      h('div', { class: 'celebrate-title' }, 'Nouveau badge !'),
      h('div', {}, h('b', {}, b.name), ' — ', b.desc)));
  el.addEventListener('click', () => el.remove());
  document.body.append(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 2600);
}

// ---------------- Ligne de temps d'une journée
function timeline(date) {
  const items = [
    ...state.meals.filter((m) => dayOf(m.at) === date).map((m) => ({ at: m.at, kind: 'meal', m })),
    ...state.symptoms.filter((s) => dayOf(s.at) === date).map((s) => ({ at: s.at, kind: 'sym', s })),
    ...state.stools.filter((s) => dayOf(s.at) === date).map((s) => ({ at: s.at, kind: 'stool', s })),
  ].sort((a, b) => (a.at < b.at ? -1 : 1));
  if (!items.length) return emptyState('🗒️', 'Rien de noté pour ce jour.');
  return h('div', { class: 'timeline' }, items.map((it) => {
    if (it.kind === 'meal') {
      const m = it.m;
      const mt = mealTypeById(m.type);
      const o = mealOutcome(m);
      const foods = (m.items || []).map((i) => foodById(i.foodId, state.customFoods)).filter(Boolean);
      return h('button', { class: 'tl-item tl-meal', onclick: () => openMealForm(m) },
        h('span', { class: 'tl-time' }, timeOf(m.at)),
        h('span', { class: 'tl-dot', style: { background: '#FF7A59' } }, mt.emoji),
        h('span', { class: 'tl-body' },
          h('b', {}, mt.label),
          h('span', { class: 'tl-foods' }, foods.map((f) => f.emoji).join(' ') || '📝'),
          h('small', {}, foods.map((f) => f.name).join(', ') || m.note || '')),
        h('span', { class: 'pill lvl-' + o.level }, o.level === 'unknown' ? (rexDueAt(m) > nowISO() ? '⏳ REX ' + timeOf(rexDueAt(m)) : 'REX ?') : o.worst ? `${o.worst}/10` : 'RAS'));
    }
    if (it.kind === 'sym') {
      const s = it.s;
      const sd = symptomById(s.type);
      return h('button', { class: 'tl-item', onclick: () => openSymptomForm({ symptom: s }) },
        h('span', { class: 'tl-time' }, timeOf(s.at)),
        h('span', { class: 'tl-dot', style: { background: '#7C5CFF' } }, sd.emoji),
        h('span', { class: 'tl-body' }, h('b', {}, sd.label), h('small', {}, `${s.intensity}/10${s.delayMin != null ? ' · ' + fmtDelay(s.delayMin) + ' après le repas' : ' · hors repas'}${s.durationMin ? ' · ' + fmtDelay(s.durationMin) : ''}`)),
        h('span', { class: 'pill lvl-' + (s.intensity >= 6 ? 'bad' : s.intensity >= 3 ? 'mid' : 'good') }, s.intensity + '/10'));
    }
    const s = it.s;
    const b = BRISTOL.find((x) => x.v === s.bristol);
    return h('button', { class: 'tl-item', onclick: () => openStoolForm(s) },
      h('span', { class: 'tl-time' }, timeOf(s.at)),
      h('span', { class: 'tl-dot', style: { background: '#8A5A35' } }, s.kind === 'selle' ? '💩' : '🚽'),
      h('span', { class: 'tl-body' }, h('b', {}, s.kind === 'selle' ? `Bristol ${s.bristol} · ${b?.short}` : 'Fausse envie'),
        h('small', {}, [s.urgency ? `urgence ${s.urgency}/10` : '', s.effort ? `effort ${s.effort}/10` : '', s.incomplete ? 'incomplète' : '', s.mucus ? 'glaires' : '', s.blood ? '⚠️ sang' : ''].filter(Boolean).join(' · '))),
      s.kind === 'selle' ? h('span', { class: 'tl-bristol', html: bristolSVG(s.bristol, 48) }) : null);
  }));
}

function checklistCard(date) {
  const c = dayChecklist(date);
  const pct = c.done / c.total;
  const actions = {
    morning: () => openMorningForm(date),
    meals: () => openMealForm(date === todayKey() ? null : { at: date + 'T12:00' }),
    rex: () => { const p = pendingRex(); p.length ? openSymptomForm({ meal: p[p.length - 1] }) : toast('Aucun REX en attente 👌', '🩺'); },
    transit: () => openStoolForm(date === todayKey() ? null : { at: date + 'T09:00' }),
    evening: () => openEveningForm(date),
  };
  return h('section', { class: 'card day-card' },
    h('div', { class: 'ring-wrap' },
      h('div', { class: 'ring', style: { '--p': pct * 100 + '%' } }, h('span', {}, `${c.done}/${c.total}`)),
      h('div', {}, h('div', { class: 'card-title' }, date === todayKey() ? 'Ma journée' : prettyDay(date)), h('div', { class: 'muted small' }, pct === 1 ? 'Journée complète 🎉' : 'Touche une étape pour la remplir'))),
    h('div', { class: 'checklist' }, c.items.map((i) => h('button', { class: 'check' + (i.done ? ' done' : ''), onclick: actions[i.id] },
      h('span', { class: 'check-emoji' }, i.emoji), h('span', { class: 'grow' }, i.label), h('span', { class: 'check-box' }, i.done ? '✓' : '')))));
}

// =============================================================
// ACCUEIL
// =============================================================
function renderHome() {
  const t = todayKey();
  const mm = mascotMood();
  const lvl = levelInfo();
  const st = streak();
  const pend = pendingRex();
  const upc = upcomingRex();
  const water = state.days[t]?.water || 0;
  const rdv = state.settings.rdvDate;
  const daysToRdv = rdv ? Math.ceil((new Date(rdv + 'T12:00') - new Date(t + 'T12:00')) / 86400000) : null;
  const active = activeDaysCount();
  const name = state.settings.name;

  main.innerHTML = '';
  main.append(
    h('section', { class: 'hero' },
      h('div', { class: 'hero-mascot', html: mascot(mm.mood, 92) }),
      h('div', { class: 'bubble' },
        h('div', { class: 'hello' }, `${new Date().getHours() < 18 ? 'Salut' : 'Bonsoir'}${name ? ' ' + name : ''} !`),
        h('div', {}, mm.msg))),
    h('div', { class: 'stats-row' },
      h('div', { class: 'stat' }, h('span', { class: 'stat-emoji' }, '🔥'), h('b', {}, st), h('small', {}, 'jours de suite')),
      h('div', { class: 'stat' }, h('span', { class: 'stat-emoji' }, lvl.emoji), h('b', {}, 'Niv. ' + lvl.level), h('small', {}, lvl.name)),
      h('div', { class: 'stat' }, h('span', { class: 'stat-emoji' }, '📅'), h('b', {}, daysToRdv != null && daysToRdv >= 0 ? 'J-' + daysToRdv : '—'), h('small', {}, 'RDV nutri')))
  );

  // REX en attente
  for (const m of pend.slice().reverse()) {
    const mt = mealTypeById(m.type);
    main.append(h('section', { class: 'card rex-card' },
      h('div', { class: 'rex-icon' }, '🩺'),
      h('div', { class: 'grow' }, h('b', {}, `Mini-REX : ${mt.label.toLowerCase()} de ${timeOf(m.at)}`), h('div', { class: 'small' }, `Il y a ${fmtDelay(minutesBetween(m.at, nowISO()))}. Comment va ton ventre ?`)),
      h('button', { class: 'btn btn-primary', onclick: () => openSymptomForm({ meal: m }) }, 'Go !')));
  }
  if (upc.length) {
    const next = upc[0];
    main.append(h('div', { class: 'info-line' }, `⏳ Prochain mini-REX vers ${timeOf(rexDueAt(next))} (${mealTypeById(next.type).label.toLowerCase()})`));
  }

  // Actions rapides
  main.append(h('div', { class: 'quick-row' },
    h('button', { class: 'quick-btn', style: { '--c': '#FF7A59' }, onclick: () => openMealForm() }, h('span', {}, '🍽️'), 'Repas'),
    h('button', { class: 'quick-btn', style: { '--c': '#7C5CFF' }, onclick: () => openSymptomForm() }, h('span', {}, '😣'), 'Symptôme'),
    h('button', { class: 'quick-btn', style: { '--c': '#8A5A35' }, onclick: () => openStoolForm() }, h('span', {}, '🚽'), 'Toilettes'),
    h('button', { class: 'quick-btn', style: { '--c': '#2EC4B6' }, onclick: () => (new Date().getHours() < 15 ? openMorningForm() : openEveningForm()) }, h('span', {}, new Date().getHours() < 15 ? '🌅' : '🌙'), 'Bilan')));

  // Hydratation
  main.append(h('section', { class: 'card water-card' },
    h('div', { class: 'grow' }, h('div', { class: 'card-title' }, '💧 Hydratation'),
      h('div', { class: 'glasses' }, Array.from({ length: Math.max(8, water) }, (_, i) => h('span', { class: 'glass' + (i < water ? ' full' : '') }, i < water ? '💧' : '○'))),
      h('div', { class: 'muted small' }, `${water} verre(s) ≈ ${(water * 0.25).toFixed(2).replace('.', ',')} L`)),
    h('div', { class: 'col' },
      h('button', { class: 'btn btn-water', onclick: async () => { const n = await addWater(1); toast(n >= 8 ? 'Objectif 8 verres atteint !' : `${n} verre(s)`, '💧'); } }, '+1'),
      h('button', { class: 'btn btn-ghost small', onclick: () => addWater(-1) }, '−1'))));

  main.append(checklistCard(t));
  main.append(h('section', { class: 'card' }, h('div', { class: 'card-title' }, '🕒 Aujourd\'hui'), timeline(t)));

  // Défi 15 jours + niveau
  main.append(h('section', { class: 'card' },
    h('div', { class: 'card-title' }, '🏅 Défi journal 15 jours'),
    h('div', { class: 'progress' }, h('div', { class: 'progress-fill', style: { width: Math.min(100, (active / 15) * 100) + '%' } })),
    h('div', { class: 'muted small' }, active >= 15 ? `Défi réussi : ${active} jours suivis ! 🎉` : `${active}/15 jours suivis${daysToRdv != null && daysToRdv > 0 ? ` · RDV dans ${daysToRdv} jours` : ''}`),
    h('div', { class: 'card-title', style: { marginTop: '14px' } }, `${lvl.emoji} Niveau ${lvl.level} · ${lvl.name}`),
    h('div', { class: 'progress xp' }, h('div', { class: 'progress-fill', style: { width: lvl.progress * 100 + '%' } })),
    h('div', { class: 'muted small' }, lvl.next ? `${lvl.xp} / ${lvl.next} XP` : `${lvl.xp} XP · niveau max !`)));
}

// =============================================================
// JOURNAL (jour par jour)
// =============================================================
function renderJournal(date) {
  const t = todayKey();
  main.innerHTML = '';
  main.append(h('div', { class: 'page-head' }, h('h2', {}, '📔 Journal'),
    h('div', { class: 'date-nav' },
      h('a', { class: 'icon-btn', href: '#/journal/' + addDays(date, -1), 'aria-label': 'Jour précédent' }, '◀'),
      h('label', { class: 'date-pick' }, prettyDay(date),
        h('input', { type: 'date', value: date, max: t, onchange: (e) => e.target.value && (location.hash = '#/journal/' + e.target.value) })),
      date < t ? h('a', { class: 'icon-btn', href: '#/journal/' + addDays(date, 1), 'aria-label': 'Jour suivant' }, '▶') : h('span', { class: 'icon-btn ghost' }))));
  main.append(checklistCard(date));
  main.append(h('section', { class: 'card' }, h('div', { class: 'card-title' }, '🕒 Ligne du temps'), timeline(date),
    h('div', { class: 'row gap wrap', style: { marginTop: '10px' } },
      h('button', { class: 'btn btn-soft', onclick: () => openMealForm(date === t ? null : { at: date + 'T12:00' }) }, '+ 🍽️ Repas'),
      h('button', { class: 'btn btn-soft', onclick: () => openSymptomForm(date === t ? {} : { at: date + 'T15:00' }) }, '+ 😣 Symptôme'),
      h('button', { class: 'btn btn-soft', onclick: () => openStoolForm(date === t ? null : { at: date + 'T09:00' }) }, '+ 🚽 Toilettes'))));

  // Historique des 21 derniers jours
  const rows = [];
  for (let i = 0; i < 21; i++) {
    const d = addDays(t, -i);
    const c = dayChecklist(d);
    const nMeals = state.meals.filter((m) => dayOf(m.at) === d).length;
    rows.push(h('a', { class: 'hist-row' + (d === date ? ' on' : ''), href: '#/journal/' + d },
      h('span', { class: 'grow' }, prettyDay(d)),
      h('span', { class: 'dots' }, c.items.map((it) => h('i', { class: it.done ? 'on' : '', title: it.label }))),
      h('small', { class: 'muted' }, nMeals ? `${nMeals} repas` : '')));
  }
  main.append(h('section', { class: 'card' }, h('div', { class: 'card-title' }, '🗓️ Derniers jours'), rows));
}

// =============================================================
// PROFIL : badges, exports, réglages
// =============================================================
function renderProfile() {
  const s = state.settings;
  const lvl = levelInfo();
  const t = todayKey();
  main.innerHTML = '';
  main.append(h('div', { class: 'page-head' }, h('h2', {}, '🏆 Profil & exports')));

  main.append(h('section', { class: 'card level-card' },
    h('div', { class: 'row gap center' }, h('div', { html: mascot('happy', 64) }),
      h('div', { class: 'grow' }, h('div', { class: 'card-title' }, `${lvl.emoji} Niveau ${lvl.level} · ${lvl.name}`),
        h('div', { class: 'progress xp' }, h('div', { class: 'progress-fill', style: { width: lvl.progress * 100 + '%' } })),
        h('div', { class: 'muted small' }, `${lvl.xp} XP · ${Object.keys(state.earned).length}/${BADGES.length} badges`)))));

  main.append(h('section', { class: 'card' }, h('div', { class: 'card-title' }, '🎖️ Badges'),
    h('div', { class: 'badges' }, BADGES.map((b) => h('div', { class: 'badge' + (state.earned[b.id] ? ' on' : ''), title: b.desc },
      h('span', { class: 'badge-emoji' }, state.earned[b.id] ? b.emoji : '🔒'), h('b', {}, b.name), h('small', {}, b.desc))))));

  // Exports
  const from = h('input', { type: 'date', class: 'input', value: addDays(t, -14), max: t });
  const to = h('input', { type: 'date', class: 'input', value: t, max: t });
  main.append(h('section', { class: 'card' }, h('div', { class: 'card-title' }, '📤 Pour ta nutritionniste'),
    h('p', { class: 'small muted' }, 'Choisis la période, puis exporte. Sur Android, le menu de partage te permet de l\'envoyer directement par mail.'),
    h('div', { class: 'row gap' }, h('label', { class: 'grow' }, h('small', {}, 'Du'), from), h('label', { class: 'grow' }, h('small', {}, 'Au'), to)),
    h('div', { class: 'row gap wrap', style: { marginTop: '10px' } },
      h('button', { class: 'btn btn-primary', onclick: () => exportExcel(from.value, to.value) }, '📊 Excel'),
      h('button', { class: 'btn btn-primary alt', onclick: async () => { await saveSettings({ exportedAt: new Date().toISOString() }); checkBadges(); location.hash = `#/rapport/${from.value}/${to.value}`; } }, '📄 Rapport PDF'))));

  // Réglages
  const name = h('input', { class: 'input', value: s.name || '', placeholder: 'Ton prénom' });
  const rdv = h('input', { class: 'input', type: 'date', value: s.rdvDate || '' });
  const delay = h('select', { class: 'input' }, [[120, '2 h après le repas'], [180, '3 h après le repas (recommandé)'], [240, '4 h après le repas']].map(([v, l]) => h('option', { value: v, selected: s.rexDelayMin === v ? true : null }, l)));
  const evening = h('select', { class: 'input' }, [19, 20, 21, 22].map((v) => h('option', { value: v, selected: s.eveningHour === v ? true : null }, `${v} h`)));
  const notifState = h('span', { class: 'small muted' }, !('Notification' in window) ? 'Non disponible ici' : s.notifications && Notification.permission === 'granted' ? '✅ Activées' : 'Désactivées');
  main.append(h('section', { class: 'card' }, h('div', { class: 'card-title' }, '⚙️ Réglages'),
    section('Prénom', name), section('Date du prochain RDV', rdv), section('Mini-REX', delay), section('Rappel du bilan du soir', evening),
    section('Notifications', h('div', { class: 'row gap center' },
      h('button', { class: 'btn btn-soft', onclick: async () => {
        const ok = await enableNotifications();
        await saveSettings({ notifications: ok });
        notifState.textContent = ok ? '✅ Activées' : 'Refusées : autorise-les dans les réglages du téléphone';
      } }, '🔔 Activer'), notifState),
      h('p', { class: 'tiny muted' }, 'Les rappels arrivent quand l\'appli est ouverte ou en arrière-plan. Si elle est complètement fermée, les REX en attente s\'affichent à l\'ouverture.')),
    h('button', { class: 'btn btn-primary btn-block', onclick: async () => {
      await saveSettings({ name: name.value.trim(), rdvDate: rdv.value, rexDelayMin: Number(delay.value), eveningHour: Number(evening.value) });
      toast('Réglages enregistrés', '⚙️');
    } }, 'Enregistrer les réglages')));

  // Sauvegarde
  const fileIn = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async (e) => {
    try { if (await importBackup(e.target.files[0])) route(); } catch (err) { toast(err.message, '⚠️'); }
  } });
  main.append(h('section', { class: 'card' }, h('div', { class: 'card-title' }, '💾 Sauvegarde'),
    h('p', { class: 'small muted' }, `Tes données sont uniquement sur ce téléphone. Fais une sauvegarde de temps en temps (Drive, mail…). ${s.lastBackup ? 'Dernière : ' + prettyDay(s.lastBackup.slice(0, 10)) + '.' : 'Aucune sauvegarde pour l\'instant.'}`),
    h('div', { class: 'row gap wrap' },
      h('button', { class: 'btn btn-soft', onclick: () => exportBackup(true) }, '⬇️ Sauvegarder'),
      h('button', { class: 'btn btn-soft', onclick: () => fileIn.click() }, '⬆️ Restaurer'), fileIn)));

  main.append(h('section', { class: 'card' }, h('div', { class: 'card-title' }, '❓ Comment ça marche'),
    h('details', { class: 'more' }, h('summary', {}, 'Pourquoi un mini-REX 3 h après le repas ?'),
      h('p', { class: 'small' }, 'Les études sur le SII considèrent qu\'un symptôme est lié au repas s\'il apparaît dans les 3 heures (journal « FAST »). Les sucres fermentescibles (FODMAP) produisent des gaz pendant plusieurs heures. Le mini-REX couvre donc toute cette période d\'un coup. Si un symptôme arrive plus tôt (crampe, envie pressante juste après le repas), note-le tout de suite avec le bouton « Symptôme » : le délai est calculé tout seul.'),
      h('p', { class: 'small' }, 'Certains aliments (alcool, édulcorants) peuvent agir plus tard, jusqu\'à 24-72 h : l\'appli les repère comme « symptômes tardifs ».')),
    h('details', { class: 'more' }, h('summary', {}, 'Comment est calculé mon profil de transit ?'),
      h('p', { class: 'small' }, 'Selon les critères de Rome IV : on regarde les jours où au moins une selle est anormale (Bristol 1-2 ou 6-7). Plus de 25 % de selles dures → profil constipation ; plus de 25 % de liquides → profil diarrhée ; les deux → profil mixte. C\'est une indication pour ta nutritionniste, pas un diagnostic.')),
    h('details', { class: 'more' }, h('summary', {}, 'Mes données sont-elles privées ?'),
      h('p', { class: 'small' }, 'Oui. Tout est stocké dans le navigateur de ton téléphone, rien n\'est envoyé sur internet. La dictée vocale utilise la reconnaissance de Google (comme le clavier). Pense à faire des sauvegardes.')),
    h('details', { class: 'more' }, h('summary', {}, 'Signes qui doivent faire consulter rapidement'),
      h('p', { class: 'small' }, 'Sang inhabituel ou abondant, selles noires, fièvre, douleur intense ou persistante, vomissements répétés, déshydratation, amaigrissement involontaire.'))));

  main.append(h('button', { class: 'btn btn-ghost danger btn-block', onclick: async () => {
    if (confirm('Effacer TOUTES les données ? (fais une sauvegarde avant)') && confirm('Vraiment sûr ? C\'est définitif.')) { await wipeAll(); route(); toast('Données effacées', '🗑️'); }
  } }, '🗑️ Effacer toutes les données'));
  main.append(h('p', { class: 'tiny muted center' }, 'Bidou v1.0 · fait sur mesure 💛'));
}

// =============================================================
// Premier lancement
// =============================================================
function onboarding() {
  const name = h('input', { class: 'input', placeholder: 'Ton prénom (facultatif)' });
  openSheet({
    title: 'Bienvenue !',
    emoji: '👋',
    saveLabel: 'C\'est parti !',
    body: h('div', {},
      h('div', { class: 'center', html: mascot('party', 110) }),
      h('p', {}, 'Moi c\'est ', h('b', {}, 'Bidou'), '. Je vais t\'aider à tenir ton journal digestif, sans prise de tête.'),
      h('ul', { class: 'small' },
        h('li', {}, '🍽️ Note tes repas en quelques touches (ou à la voix)'),
        h('li', {}, '🩺 3 h après, un mini-REX : « comment va ton ventre ? »'),
        h('li', {}, '🚽 Chaque passage aux toilettes avec l\'échelle de Bristol'),
        h('li', {}, '🌅🌙 Un bilan matin (sommeil) et soir (stress, eau, sport)'),
        h('li', {}, '📊 Des tendances et un rapport à envoyer à ta nutritionniste')),
      h('p', { class: 'small muted' }, 'Conseil de ta nutritionniste : mange comme d\'habitude, l\'objectif est d\'observer.'),
      section('Comment je t\'appelle ?', name)),
    onSave: async () => {
      await saveSettings({ name: name.value.trim(), onboarded: true, journalStart: todayKey() });
      route();
    },
  });
}

// ---------------- Démarrage
async function start() {
  await loadAll();
  document.getElementById('fab').addEventListener('click', openQuickAdd);
  // Raccourcis de l'icône (appui long sur l'icône Android)
  const shortcut = location.hash.match(/add=(meal|stool)/);
  if (shortcut) history.replaceState(null, '', '#/');
  route();
  if (shortcut && state.settings.onboarded) (shortcut[1] === 'meal' ? openMealForm : openStoolForm)();
  startReminderLoop();
  if (!state.settings.onboarded) onboarding();
  // Rafraîchit l'accueil toutes les minutes (REX qui deviennent "à faire")
  setInterval(() => { if (!document.querySelector('.overlay') && (location.hash === '' || location.hash === '#/')) renderHome(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !document.querySelector('.overlay')) route(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}
start();
