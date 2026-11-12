// =============================================================
// analysis.js — Calculs des tendances
//
// Principes (issus de la littérature sur le SII) :
//  • Un symptôme est dit "post-prandial" s'il commence dans les
//    3 h après un repas (journal FAST, Nouvelle-Zélande).
//  • Certains aliments agissent plus tard (alcool, édulcorants :
//    4 à 72 h) → on garde une case "effet retardé" (3-24 h).
//  • Sous-type de SII selon Rome IV : % de selles Bristol 1-2
//    et 6-7, calculé sur les jours avec au moins une selle anormale.
// Ce ne sont que des PISTES à discuter avec la nutritionniste :
// une association n'est pas une preuve.
// =============================================================
import { state } from './store.js';
import { FOODS, TRIGGER_GROUPS, CONTEXT_MOODS, CONTEXT_PLACES, foodById } from './catalog.js';
import { dayOf, addDays, todayKey, minutesBetween } from './ui.js';

export const EARLY_WINDOW = 180; // minutes

export function inRange(at, from, to) {
  const d = dayOf(at);
  return d >= from && d <= to;
}

// Bilan d'un repas : symptômes liés tôt (<3 h) et tard (>3 h)
export function mealOutcome(meal) {
  const linked = state.symptoms.filter((s) => s.mealId === meal.id);
  const early = linked.filter((s) => s.delayMin == null || s.delayMin <= EARLY_WINDOW);
  const late = linked.filter((s) => s.delayMin != null && s.delayMin > EARLY_WINDOW);
  const max = (l) => l.reduce((a, s) => Math.max(a, s.intensity || 0), 0);
  const evaluated = !!meal.rex || linked.length > 0;
  return {
    evaluated,
    early: max(early),
    late: max(late),
    worst: max(linked),
    symptoms: linked,
    level: !evaluated ? 'unknown' : max(linked) >= 6 ? 'bad' : max(linked) >= 3 ? 'mid' : 'good',
  };
}

const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
export const round1 = (n) => (n == null ? null : Math.round(n * 10) / 10);

// Statistiques par aliment
export function foodStats(from, to) {
  const meals = state.meals.filter((m) => inRange(m.at, from, to)).map((m) => ({ m, o: mealOutcome(m) })).filter((x) => x.o.evaluated);
  const baseline = avg(meals.map((x) => x.o.early)) ?? 0;
  const byFood = {};
  for (const { m, o } of meals) {
    for (const it of m.items || []) {
      const b = (byFood[it.foodId] ||= { foodId: it.foodId, scores: [], late: [], big: [], small: [] });
      b.scores.push(o.early);
      b.late.push(o.late);
      (it.portion === 3 ? b.big : b.small).push(o.early);
    }
  }
  const out = Object.values(byFood).map((b) => {
    const food = foodById(b.foodId, state.customFoods) || { name: b.foodId, emoji: '🍽️' };
    const n = b.scores.length;
    const a = avg(b.scores);
    const pctBad = b.scores.filter((s) => s >= 4).length / n;
    let verdict = 'observer';
    if (n >= 3 && (a >= baseline + 1.5 || (pctBad >= 0.5 && a >= baseline + 0.5))) verdict = 'suspect';
    else if (n >= 3 && a <= Math.max(1, baseline - 1) && pctBad < 0.25) verdict = 'ok';
    const doseNote = b.big.length >= 2 && b.small.length >= 2 && avg(b.big) - avg(b.small) >= 1.5
      ? 'Plus marqué en grande portion' : null;
    const lateNote = avg(b.late) >= 4 ? 'Symptômes tardifs fréquents (> 3 h)' : null;
    return { ...b, food, n, avg: round1(a), pctBad, verdict, doseNote, lateNote };
  });
  out.sort((x, y) => y.avg - x.avg || y.n - x.n);
  return { baseline: round1(baseline), evaluatedMeals: meals.length, foods: out };
}

// Statistiques par famille (FODMAP, gras, caféine…)
export function groupStats(from, to) {
  const meals = state.meals.filter((m) => inRange(m.at, from, to)).map((m) => ({ m, o: mealOutcome(m) })).filter((x) => x.o.evaluated);
  const baseline = avg(meals.map((x) => x.o.early)) ?? 0;
  const res = [];
  for (const [g, info] of Object.entries(TRIGGER_GROUPS)) {
    const withG = meals.filter(({ m }) => (m.items || []).some((it) => (foodById(it.foodId, state.customFoods)?.t || []).includes(g)));
    const without = meals.filter((x) => !withG.includes(x));
    if (!withG.length) continue;
    res.push({
      id: g, ...info, n: withG.length,
      avgWith: round1(avg(withG.map((x) => x.o.early))),
      avgWithout: round1(avg(without.map((x) => x.o.early)) ?? baseline),
    });
  }
  res.sort((a, b) => b.avgWith - b.avgWithout - (a.avgWith - a.avgWithout));
  return res;
}

// Contexte du repas (pressé, stressé, fast-food…)
export function contextStats(from, to) {
  const meals = state.meals.filter((m) => inRange(m.at, from, to)).map((m) => ({ m, o: mealOutcome(m) })).filter((x) => x.o.evaluated);
  const res = [];
  for (const c of [...CONTEXT_MOODS, ...CONTEXT_PLACES]) {
    const w = meals.filter(({ m }) => m.place === c.id || (m.moods || []).includes(c.id));
    if (w.length < 2) continue;
    const wo = meals.filter((x) => !w.includes(x));
    res.push({ ...c, n: w.length, avgWith: round1(avg(w.map((x) => x.o.early))), avgWithout: round1(avg(wo.map((x) => x.o.early))) });
  }
  const fast = meals.filter(({ m }) => m.chewing != null && m.chewing <= 3);
  const slow = meals.filter(({ m }) => m.chewing != null && m.chewing >= 7);
  if (fast.length >= 2 && slow.length >= 2) {
    res.push({ id: 'mastication', label: 'Mangé vite (mastication ≤ 3)', emoji: '⏩', n: fast.length, avgWith: round1(avg(fast.map((x) => x.o.early))), avgWithout: round1(avg(slow.map((x) => x.o.early))), compareLabel: 'lentement' });
  }
  return res.sort((a, b) => (b.avgWith - (b.avgWithout ?? 0)) - (a.avgWith - (a.avgWithout ?? 0)));
}

// Selles + indication de sous-type (Rome IV)
export function stoolStats(from, to) {
  const stools = state.stools.filter((s) => inRange(s.at, from, to));
  const bowel = stools.filter((s) => s.kind === 'selle' && s.bristol);
  const counts = [1, 2, 3, 4, 5, 6, 7].map((v) => bowel.filter((s) => s.bristol === v).length);
  const false_ = stools.filter((s) => s.kind === 'fausse-envie').length;
  // Rome IV : sur les jours avec au moins une selle anormale (1-2 ou 6-7)
  const abnormalDays = new Set(bowel.filter((s) => s.bristol <= 2 || s.bristol >= 6).map((s) => dayOf(s.at)));
  const onAbn = bowel.filter((s) => abnormalDays.has(dayOf(s.at)));
  const hard = onAbn.filter((s) => s.bristol <= 2).length / (onAbn.length || 1);
  const loose = onAbn.filter((s) => s.bristol >= 6).length / (onAbn.length || 1);
  const days = new Set(stools.map((s) => dayOf(s.at))).size;
  let subtype = null;
  if (bowel.length >= 10 && days >= 7) {
    if (!abnormalDays.size) subtype = { id: 'normal', label: 'Selles majoritairement normales', desc: 'Aucune selle anormale (1-2 ou 6-7) sur la période.' };
    else if (hard > 0.25 && loose > 0.25) subtype = { id: 'M', label: 'Profil mixte (SII-M)', desc: 'Plus de 25 % de selles dures ET plus de 25 % de selles liquides.' };
    else if (hard > 0.25) subtype = { id: 'C', label: 'Profil constipation (SII-C)', desc: 'Plus de 25 % de selles dures (1-2), moins de 25 % de liquides (6-7).' };
    else if (loose > 0.25) subtype = { id: 'D', label: 'Profil diarrhée (SII-D)', desc: 'Plus de 25 % de selles liquides (6-7), moins de 25 % de dures (1-2).' };
    else subtype = { id: 'U', label: 'Profil non classé (SII-U)', desc: 'Ni les selles dures ni les liquides ne dépassent 25 %.' };
  }
  return {
    total: bowel.length, falseUrges: false_, counts, hardPct: hard, loosePct: loose, subtype,
    perDay: days ? round1(bowel.length / days) : null,
    urgentPct: bowel.length ? bowel.filter((s) => (s.urgency || 0) >= 5).length / bowel.length : 0,
    incompletePct: bowel.length ? bowel.filter((s) => s.incomplete).length / bowel.length : 0,
    blood: stools.some((s) => s.blood),
  };
}

// Série jour par jour
export function dailySeries(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const sym = state.symptoms.filter((s) => dayOf(s.at) === d);
    const day = state.days[d] || {};
    const stools = state.stools.filter((s) => dayOf(s.at) === d);
    const meals = state.meals.filter((m) => dayOf(m.at) === d);
    out.push({
      date: d,
      maxSym: sym.length ? Math.max(...sym.map((s) => s.intensity || 0), day.wakeIntensity || 0) : day.wakeIntensity || (meals.some((m) => m.rex) ? 0 : null),
      symCount: sym.length,
      bristols: stools.filter((s) => s.kind === 'selle' && s.bristol).map((s) => ({ v: s.bristol, at: s.at })),
      falseUrges: stools.filter((s) => s.kind === 'fausse-envie').length,
      meals: meals.length,
      rexDone: meals.filter((m) => m.rex).length,
      sleepMin: day.sleepMin ?? null,
      sleepQuality: day.sleepQuality ?? null,
      stress: day.stress ?? null,
      water: day.water ?? null,
      sport: day.sport || null,
    });
  }
  return out;
}

// Mode de vie : sommeil, stress, sport → symptômes du jour
export function lifestyleStats(series) {
  const res = [];
  const valid = series.filter((d) => d.maxSym != null);
  const cmp = (label, emoji, pred, predOther, otherLabel) => {
    const a = valid.filter(pred);
    const b = valid.filter(predOther);
    if (a.length >= 2 && b.length >= 2) res.push({ label, emoji, n: a.length, avgWith: round1(avg(a.map((d) => d.maxSym))), avgWithout: round1(avg(b.map((d) => d.maxSym))), otherLabel });
  };
  cmp('Nuit courte (< 6 h 30)', '😴', (d) => d.sleepMin != null && d.sleepMin < 390, (d) => d.sleepMin != null && d.sleepMin >= 390, 'nuits ≥ 6 h 30');
  cmp('Journée stressante (≥ 7/10)', '😰', (d) => d.stress != null && d.stress >= 7, (d) => d.stress != null && d.stress < 7, 'journées calmes');
  cmp('Peu d\'eau (< 6 verres)', '🏜️', (d) => d.water != null && d.water < 6, (d) => d.water != null && d.water >= 6, '≥ 6 verres');
  cmp('Avec sport', '🏃', (d) => !!d.sport, (d) => d.sport === null && (d.stress != null || d.water != null), 'sans sport');
  return res;
}

export function periodBounds(period) {
  const to = todayKey();
  if (period === 'all') {
    const first = [state.meals[0]?.at, state.stools[0]?.at, state.symptoms[0]?.at, Object.keys(state.days).sort()[0]].filter(Boolean).map((x) => x.slice(0, 10)).sort()[0];
    return { from: first || to, to };
  }
  return { from: addDays(to, -(Number(period) - 1)), to };
}

export { avg, minutesBetween, FOODS };
