// =============================================================
// dashboard.js — Écran "Tendances" + rapport imprimable (PDF)
// =============================================================
import { state, getPhoto } from './store.js';
import { h, prettyDay, shortDay, timeOf, dayOf, fmtDelay, todayKey, addDays, emptyState, escapeHTML } from './ui.js';
import { foodStats, groupStats, contextStats, stoolStats, dailySeries, lifestyleStats, periodBounds, mealOutcome, round1 } from './analysis.js';
import { bristolChart, symptomChart, bristolDistribution, compareRows, bindTips } from './charts.js';
import { mealTypeById, symptomById, SPORTS, INTENSITIES, BRISTOL } from './catalog.js';
import { foodsText, contextText } from './export.js';
import { openMealForm } from './forms.js';

let period = '15';

function kpi(emoji, value, label, sub) {
  return h('div', { class: 'kpi' }, h('div', { class: 'kpi-emoji' }, emoji), h('div', { class: 'kpi-val' }, value), h('div', { class: 'kpi-label' }, label), sub ? h('div', { class: 'kpi-sub' }, sub) : null);
}

function card(title, ...children) {
  return h('section', { class: 'card' }, title ? h('h3', { class: 'card-title' }, title) : null, ...children);
}

const levelBadge = (lvl, v) => h('span', { class: 'pill lvl-' + lvl }, lvl === 'unknown' ? 'REX ?' : `${v}/10`);

export function renderDashboard(root) {
  const { from, to } = periodBounds(period);
  const series = dailySeries(from, to);
  const fs = foodStats(from, to);
  const ss = stoolStats(from, to);
  const meals = state.meals.filter((m) => dayOf(m.at) >= from && dayOf(m.at) <= to);
  const rexRate = meals.length ? Math.round((meals.filter((m) => m.rex).length / meals.length) * 100) : 0;
  const symDays = series.filter((d) => d.maxSym != null);
  const avgSym = symDays.length ? round1(symDays.reduce((a, d) => a + d.maxSym, 0) / symDays.length) : '–';

  const tabs = h('div', { class: 'seg' }, [['7', '7 jours'], ['15', '15 jours'], ['30', '30 jours'], ['all', 'Tout']].map(([v, l]) =>
    h('button', { class: 'seg-btn' + (period === v ? ' on' : ''), onclick: () => { period = v; renderDashboard(root); } }, l)));

  root.innerHTML = '';
  root.append(h('div', { class: 'page-head' }, h('h2', {}, '📊 Tendances'), tabs));

  if (!state.meals.length && !state.stools.length) {
    root.append(emptyState('🔍', 'Les tendances apparaîtront après quelques jours de saisie. Commence par noter ton prochain repas !'));
    return;
  }

  root.append(h('div', { class: 'kpis' },
    kpi('🍽️', meals.length, 'repas notés', `${rexRate} % avec REX`),
    kpi('😣', avgSym, 'symptôme max moyen', '/10 par jour'),
    kpi('🚽', ss.perDay ?? '–', 'selles / jour', `${ss.falseUrges} fausse(s) envie(s)`),
    kpi('🎯', fs.foods.filter((f) => f.verdict === 'suspect').length, 'pistes aliments', 'à discuter')
  ));

  // --- Sous-type (Rome IV)
  const sub = ss.subtype;
  root.append(card('🧭 Ton profil de transit',
    sub
      ? h('div', { class: 'subtype st-' + sub.id }, h('div', { class: 'subtype-title' }, sub.label), h('div', { class: 'small' }, sub.desc))
      : h('p', { class: 'muted small' }, `Il faut au moins 10 selles notées sur 7 jours pour estimer ton profil (actuellement : ${ss.total}).`),
    h('div', { class: 'row gap wrap small' },
      h('span', { class: 'pill' }, `Dures (1-2) : ${Math.round(ss.hardPct * 100)} %`),
      h('span', { class: 'pill' }, `Liquides (6-7) : ${Math.round(ss.loosePct * 100)} %`),
      h('span', { class: 'pill' }, `Urgence ≥ 5 : ${Math.round(ss.urgentPct * 100)} %`),
      h('span', { class: 'pill' }, `Incomplète : ${Math.round(ss.incompletePct * 100)} %`)),
    h('p', { class: 'tiny muted' }, 'Calcul selon les critères de Rome IV (seuil de 25 %, sur les jours avec au moins une selle anormale). C\'est une indication à montrer à ta nutritionniste, pas un diagnostic. Le profil peut évoluer dans le temps.'),
    ss.blood ? h('div', { class: 'alert' }, '⚠️ Du sang a été noté sur la période : parles-en à ton médecin.') : null
  ));

  const c1 = card('💩 Selles jour par jour (Bristol)', h('div', { html: bristolChart(series) }),
    h('div', { class: 'legend' },
      h('span', {}, h('i', { style: { background: '#C2410C' } }), 'dur (1-2)'),
      h('span', {}, h('i', { style: { background: '#16A34A' } }), 'normal (3-4)'),
      h('span', {}, h('i', { style: { background: '#3B82F6' } }), 'mou / liquide (5-7)'),
      h('span', {}, '✕ fausse envie')));
  root.append(c1);
  root.append(card('📈 Répartition des selles', h('div', { html: bristolDistribution(ss.counts) })));
  root.append(card('😣 Symptôme le plus fort de la journée', h('div', { html: symptomChart(series) }),
    h('div', { class: 'legend' },
      h('span', {}, h('i', { class: 'bar-good' }), '0-2'), h('span', {}, h('i', { class: 'bar-mid' }), '3-5'), h('span', {}, h('i', { class: 'bar-bad' }), '6-10'))));

  // --- Pistes aliments
  const suspects = fs.foods.filter((f) => f.verdict === 'suspect');
  const oks = fs.foods.filter((f) => f.verdict === 'ok');
  const foodRow = (f) => h('div', { class: 'food-row', 'data-tip': `<b>${escapeHTML(f.food.name)}</b><br>${f.n} repas évalués<br>Moyenne : ${f.avg}/10 (tous repas : ${fs.baseline}/10)<br>${Math.round(f.pctBad * 100)} % des repas suivis d'un symptôme ≥ 4` },
    h('span', { class: 'food-emoji' }, f.food.emoji),
    h('span', { class: 'grow' }, f.food.name, h('small', {}, ` · ${f.n} repas${f.doseNote ? ' · ' + f.doseNote : ''}${f.lateNote ? ' · ' + f.lateNote : ''}`)),
    h('span', { class: 'pill ' + (f.verdict === 'suspect' ? 'lvl-bad' : 'lvl-good') }, `${f.avg}/10`));
  root.append(card('🔎 Pistes alimentaires',
    h('p', { class: 'tiny muted' }, `Moyenne des symptômes dans les 3 h après chaque repas contenant l'aliment. Tous repas confondus : ${fs.baseline}/10 (${fs.evaluatedMeals} repas évalués). Il faut au moins 3 repas avec un aliment pour qu'il apparaisse ici.`),
    h('div', { class: 'f-label' }, '⚠️ À discuter avec ta nutritionniste'),
    suspects.length ? suspects.map(foodRow) : h('p', { class: 'muted small' }, 'Aucun aliment ne ressort pour l\'instant.'),
    h('div', { class: 'f-label' }, '✅ Semblent bien tolérés'),
    oks.length ? oks.slice(0, 12).map(foodRow) : h('p', { class: 'muted small' }, 'Pas encore assez de données.'),
    h('p', { class: 'tiny muted' }, 'Rappel de ta nutritionniste : ne cherche pas à identifier seul un aliment responsable et ne change pas ton alimentation sans son avis.')
  ));

  root.append(card('🧪 Par famille d\'aliments (FODMAP & co)',
    h('p', { class: 'tiny muted' }, 'Barre colorée : moyenne des symptômes quand la famille est présente dans le repas. Barre grise : quand elle est absente.'),
    h('div', { html: compareRows(groupStats(from, to).map((g) => ({ ...g, label: g.label, otherLabel: 'sans' }))) })));
  root.append(card('🧭 Contexte des repas', h('div', { html: compareRows(contextStats(from, to), 'autres repas') })));
  root.append(card('🛌 Mode de vie (sommeil, stress, eau, sport)',
    h('p', { class: 'tiny muted' }, 'Symptôme max de la journée selon tes habitudes.'),
    h('div', { html: compareRows(lifestyleStats(series)) })));

  // --- Par repas
  const list = meals.slice().reverse().slice(0, 30);
  root.append(card('🍽️ Repas par repas', list.map((m) => {
    const o = mealOutcome(m);
    const mt = mealTypeById(m.type);
    return h('button', { class: 'meal-line', onclick: () => openMealForm(m) },
      h('span', { class: 'food-emoji' }, mt.emoji),
      h('span', { class: 'grow' }, h('b', {}, `${prettyDay(dayOf(m.at))} ${timeOf(m.at)}`), h('small', {}, foodsText(m) || m.note || '')),
      levelBadge(o.level, o.worst));
  })));

  bindTips(root);
}

// =============================================================
// RAPPORT IMPRIMABLE (→ PDF)
// =============================================================
export async function renderReport(root, from, to) {
  const series = dailySeries(from, to);
  const fs = foodStats(from, to);
  const ss = stoolStats(from, to);
  const name = state.settings.name;
  const fr = (d) => d.split('-').reverse().join('/');
  root.innerHTML = '';
  root.classList.add('report-mode');

  const bar = h('div', { class: 'report-bar no-print' },
    h('button', { class: 'btn btn-ghost', onclick: () => { location.hash = '#/profil'; } }, '← Retour'),
    h('button', { class: 'btn btn-primary', onclick: () => window.print() }, '🖨️ Imprimer / Enregistrer en PDF'));
  root.append(bar, h('p', { class: 'tip no-print' }, 'Sur Android : touche le bouton ci-dessus, puis choisis « Enregistrer au format PDF » comme imprimante. Tu pourras ensuite l\'envoyer à ta nutritionniste.'));

  const rep = h('div', { class: 'report' });
  root.append(rep);
  rep.append(h('header', { class: 'rep-head' },
    h('h1', {}, '📔 Journal digestif'),
    h('p', {}, `${name ? name + ' — ' : ''}du ${fr(from)} au ${fr(to)}${state.settings.rdvDate ? ' · RDV du ' + fr(state.settings.rdvDate) : ''}`)));

  // Synthèse
  const meals = state.meals.filter((m) => dayOf(m.at) >= from && dayOf(m.at) <= to);
  const suspects = fs.foods.filter((f) => f.verdict === 'suspect');
  const oks = fs.foods.filter((f) => f.verdict === 'ok');
  rep.append(h('section', { class: 'rep-sec' },
    h('h2', {}, 'Synthèse'),
    h('ul', {},
      h('li', {}, `${series.filter((d) => d.meals || d.bristols.length || state.days[d.date]).length} jours suivis, ${meals.length} repas notés (${meals.filter((m) => m.rex).length} avec mini-REX).`),
      h('li', {}, `${ss.total} selles notées (${ss.perDay ?? '–'} / jour) et ${ss.falseUrges} fausse(s) envie(s). Dures (1-2) : ${Math.round(ss.hardPct * 100)} %, liquides (6-7) : ${Math.round(ss.loosePct * 100)} % sur les jours avec une selle anormale.`),
      h('li', {}, ss.subtype ? `Profil indicatif (Rome IV) : ${ss.subtype.label}. ${ss.subtype.desc}` : 'Profil de transit : pas encore assez de données.'),
      h('li', {}, `Symptômes dans les 3 h après les repas : moyenne ${fs.baseline}/10 sur ${fs.evaluatedMeals} repas évalués.`),
      suspects.length ? h('li', {}, 'Aliments suivis plus souvent de symptômes : ' + suspects.map((f) => `${f.food.name} (${f.avg}/10, ${f.n} repas)`).join(', ') + '.') : null,
      oks.length ? h('li', {}, 'Aliments qui semblent bien tolérés : ' + oks.slice(0, 15).map((f) => f.food.name).join(', ') + '.') : null),
    h('div', { class: 'rep-charts' },
      h('div', {}, h('h3', {}, 'Selles (Bristol)'), h('div', { html: bristolChart(series) })),
      h('div', {}, h('h3', {}, 'Symptôme max / jour'), h('div', { html: symptomChart(series) }))),
    h('h3', {}, 'Répartition Bristol'), h('div', { html: bristolDistribution(ss.counts) })
  ));

  // Jour par jour (même structure que le journal papier)
  for (const d of series) {
    const day = state.days[d.date] || {};
    const dMeals = state.meals.filter((m) => dayOf(m.at) === d.date);
    const dStools = state.stools.filter((s) => dayOf(s.at) === d.date);
    const freeSym = state.symptoms.filter((s) => dayOf(s.at) === d.date && !s.mealId);
    if (!dMeals.length && !dStools.length && !freeSym.length && !state.days[d.date]) continue;
    const sport = day.sport ? `${SPORTS.find((s) => s.id === day.sport.type)?.label || ''} ${day.sport.durationMin ? day.sport.durationMin + ' min' : ''} ${INTENSITIES.find((i) => i.id === day.sport.intensity)?.label.toLowerCase() || ''}` : '—';
    const sec = h('section', { class: 'rep-day' },
      h('h2', {}, prettyDay(d.date).replace(/^./, (c) => c.toUpperCase()), h('small', {}, ' ' + fr(d.date))),
      h('div', { class: 'rep-grid' },
        h('div', {}, h('b', {}, 'Sommeil : '), day.sleepMin != null ? `${Math.floor(day.sleepMin / 60)} h ${String(day.sleepMin % 60).padStart(2, '0')}` : '—', day.sleepQuality != null ? ` · qualité ${day.sleepQuality}/10` : '', day.sleepScore ? ` · Garmin ${day.sleepScore}` : ''),
        h('div', {}, h('b', {}, 'Stress : '), day.stress != null ? day.stress + '/10' : '—'),
        h('div', {}, h('b', {}, 'Hydratation : '), day.water != null ? `${day.water} verres (~${(day.water * 0.25).toFixed(1)} L)` : '—'),
        h('div', {}, h('b', {}, 'Énergie au réveil : '), day.energy != null ? day.energy + '/10' : '—'),
        h('div', {}, h('b', {}, 'Symptômes au réveil : '), day.wakeSymptoms?.length ? day.wakeSymptoms.map((x) => symptomById(x)?.label).join(', ') + ` (${day.wakeIntensity}/10)` : day.morningDone ? 'non' : '—'),
        h('div', {}, h('b', {}, 'Sport : '), sport)),
      dMeals.length ? h('table', {},
        h('thead', {}, h('tr', {}, ['Heure / type', 'Aliments, boissons et quantités', 'Contexte', 'Durée + mastication', 'Symptômes après le repas'].map((t) => h('th', {}, t)))),
        h('tbody', {}, dMeals.map((m) => {
          const o = mealOutcome(m);
          return h('tr', {},
            h('td', {}, `${timeOf(m.at)} ${mealTypeById(m.type).label}`),
            h('td', {}, foodsText(m), m.note ? h('div', { class: 'tiny' }, m.note) : null, m.photoId ? h('img', { class: 'rep-photo', 'data-photo': m.photoId, alt: '' }) : null),
            h('td', {}, contextText(m)),
            h('td', {}, [m.durationMin ? m.durationMin + ' min' : '', m.chewing != null ? `mastication ${m.chewing}/10` : ''].filter(Boolean).join(' · ')),
            h('td', {}, o.symptoms.length
              ? o.symptoms.map((s) => h('div', {}, `${s.zone === 'haut' ? 'haut' : 'bas'} • ${symptomById(s.type)?.label} • +${fmtDelay(s.delayMin)} • ${s.intensity}/10${s.durationMin ? ' • ' + fmtDelay(s.durationMin) : ''}`))
              : m.rex ? 'RAS' : '—'));
        }))) : null,
      freeSym.length ? h('div', {}, h('h3', {}, 'Symptômes hors repas'), freeSym.map((s) => h('div', {}, `${timeOf(s.at)} • ${s.zone} • ${symptomById(s.type)?.label} • ${s.intensity}/10${s.durationMin ? ' • ' + fmtDelay(s.durationMin) : ''}${s.note ? ' • ' + s.note : ''}`))) : null,
      dStools.length || day.noStool ? h('div', {}, h('h3', {}, 'Transit'),
        day.noStool && !dStools.length ? h('div', {}, 'Pas de selle ce jour.') : null,
        dStools.map((s) => h('div', {}, [timeOf(s.at), s.kind === 'selle' ? `Bristol ${s.bristol} (${BRISTOL.find((b) => b.v === s.bristol)?.short})` : 'Fausse envie',
          s.urgency ? `urgence ${s.urgency}/10` : '', s.effort ? `effort ${s.effort}/10` : '', s.pain ? `douleur ${s.pain}/10` : '', s.incomplete ? 'incomplète' : '',
          s.burning ? 'brûlure' : '', s.yellow ? 'jaune' : '', s.mucus ? 'glaires' : '', s.blood ? 'SANG' : '', s.note || ''].filter(Boolean).join(' • ')))) : null,
      day.meds || day.notes ? h('div', {}, h('h3', {}, 'Autres observations'), day.meds ? h('div', {}, 'Médicaments / probiotiques : ' + day.meds) : null, day.notes ? h('div', {}, day.notes) : null) : null
    );
    rep.append(sec);
  }
  rep.append(h('p', { class: 'tiny muted' }, 'Généré par Bidou, journal digestif personnel. Les tendances sont des pistes d\'observation, pas un diagnostic.'));

  // Photos (chargées après coup)
  for (const img of rep.querySelectorAll('img[data-photo]')) {
    const b = await getPhoto(img.dataset.photo);
    if (b) img.src = URL.createObjectURL(b);
    else img.remove();
  }
}
