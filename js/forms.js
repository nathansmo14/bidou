// =============================================================
// forms.js — Les formulaires de saisie
//   - Repas (aliments + portions + photo + contexte)
//   - Symptômes / mini-REX
//   - Selles (échelle de Bristol)
//   - Bilan du matin / du soir
// =============================================================
import {
  FOODS, FOOD_CATEGORIES, PORTIONS, MEAL_TYPES, CONTEXT_PLACES, CONTEXT_COMPANY, CONTEXT_MOODS,
  SYMPTOMS, DURATIONS, BRISTOL, SPORTS, INTENSITIES, foodById, symptomById, mealTypeById,
} from './catalog.js';
import { state, saveItem, deleteItem, saveDay, saveMeta, savePhoto, getPhoto, uid } from './store.js';
import {
  h, openSheet, section, chips, scale, toggle, stepper, dateTimeInput, textArea, toast,
  nowISO, todayKey, dayOf, timeOf, parseAt, minutesBetween, fmtDelay, toLocalISO, prettyDay,
} from './ui.js';
import { bristolSVG } from './art.js';
import { micButton, parseFoods, parseSymptoms, parseStool } from './voice.js';
import { scheduleRexReminder } from './reminders.js';

const changed = () => window.dispatchEvent(new CustomEvent('data-changed'));

// Type de repas proposé selon l'heure
function guessMealType(date = new Date()) {
  const hr = date.getHours();
  if (hr >= 5 && hr < 10.5) return 'petit-dej';
  if (hr >= 11 && hr < 14.5) return 'dejeuner';
  if (hr >= 15.5 && hr < 17.5) return 'gouter';
  if (hr >= 18.5 && hr < 22.5) return 'diner';
  return 'collation';
}

// Réduit une photo (le téléphone prend des photos de 4-12 Mo !)
async function compressImage(file, max = 1000) {
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = URL.createObjectURL(file);
  });
  const ratio = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * ratio);
  c.height = Math.round(img.height * ratio);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(img.src);
  return new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.78));
}

// =============================================================
// SÉLECTEUR D'ALIMENTS
// =============================================================
function foodPicker(initialItems = []) {
  let items = initialItems.map((i) => ({ ...i }));
  let cat = 'recent';
  let query = '';

  const selectedBox = h('div', { class: 'food-selected' });
  const grid = h('div', { class: 'food-grid' });
  const tabs = h('div', { class: 'food-tabs' });
  const search = h('input', { class: 'input', type: 'search', placeholder: '🔎 Chercher un aliment (ex : pâtes, kebab…)' });

  const allFoods = () => [...state.customFoods, ...FOODS];

  // Aliments les plus utilisés récemment
  function recentFoods() {
    const count = {};
    for (const m of state.meals.slice(-60)) for (const it of m.items || []) count[it.foodId] = (count[it.foodId] || 0) + 1;
    const ids = Object.keys(count).sort((a, b) => count[b] - count[a]).slice(0, 16);
    const list = ids.map((id) => foodById(id, state.customFoods)).filter(Boolean);
    return list.length ? list : FOODS.filter((f) => ['riz', 'pates', 'poulet', 'pain-blanc', 'cafe', 'eau', 'yaourt', 'salade', 'pdt', 'oeufs', 'fromage-mou', 'burger'].includes(f.id));
  }

  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  function renderSelected() {
    selectedBox.innerHTML = '';
    if (!items.length) {
      selectedBox.append(h('div', { class: 'muted small' }, 'Aucun aliment pour l\'instant. Touche les aliments ci-dessous 👇'));
      return;
    }
    for (const it of items) {
      const f = foodById(it.foodId, state.customFoods) || { name: it.foodId, emoji: '🍽️' };
      selectedBox.append(h('div', { class: 'sel-item' },
        h('span', { class: 'sel-emoji' }, f.emoji),
        h('span', { class: 'sel-name' }, f.name),
        h('div', { class: 'portion-switch' },
          PORTIONS.map((p) => h('button', {
            type: 'button',
            class: 'portion' + (it.portion === p.v ? ' on' : ''),
            title: `${p.label} — ${p.hint}`,
            onclick: () => { it.portion = p.v; renderSelected(); },
          }, p.emoji))
        ),
        h('button', { type: 'button', class: 'icon-btn small', 'aria-label': 'Retirer', onclick: () => { items = items.filter((x) => x !== it); renderAll(); } }, '✕')
      ));
    }
    selectedBox.append(h('div', { class: 'muted tiny' }, 'Portion : 🤏 petite · ✋ normale · 🙌 grande'));
  }

  function renderTabs() {
    tabs.innerHTML = '';
    const all = [{ id: 'recent', label: 'Fréquents', emoji: '⭐' }, ...FOOD_CATEGORIES];
    if (state.customFoods.length) all.push({ id: 'perso', label: 'Mes aliments', emoji: '✏️' });
    for (const c of all) {
      tabs.append(h('button', { type: 'button', class: 'food-tab' + (cat === c.id && !query ? ' on' : ''), onclick: () => { cat = c.id; query = ''; search.value = ''; renderAll(); } }, c.emoji + ' ' + c.label));
    }
  }

  function renderGrid() {
    grid.innerHTML = '';
    let list;
    if (query) {
      const q = norm(query);
      list = allFoods().filter((f) => norm(f.name).includes(q) || (f.syn || []).some((s) => norm(s).includes(q)));
    } else if (cat === 'recent') list = recentFoods();
    else if (cat === 'perso') list = state.customFoods;
    else list = allFoods().filter((f) => f.cat === cat);

    for (const f of list) {
      const on = items.some((i) => i.foodId === f.id);
      grid.append(h('button', {
        type: 'button',
        class: 'food-tile' + (on ? ' on' : ''),
        onclick: () => {
          if (on) items = items.filter((i) => i.foodId !== f.id);
          else items.push({ foodId: f.id, portion: 2 });
          renderAll();
        },
      }, h('span', { class: 'food-emoji' }, f.emoji), h('span', { class: 'food-name' }, f.name)));
    }
    if (query) {
      grid.append(h('button', { type: 'button', class: 'food-tile add', onclick: () => addCustomFood(query) },
        h('span', { class: 'food-emoji' }, '➕'), h('span', { class: 'food-name' }, `Créer « ${query} »`)));
    }
  }

  async function addCustomFood(name) {
    const emoji = prompt(`Un emoji pour « ${name} » ? (laisse vide pour 🍽️)`, '🍽️') || '🍽️';
    const f = { id: 'perso-' + uid(), name: name.trim(), emoji: emoji.trim().slice(0, 4), cat: 'autres', f: 'unknown', t: [], syn: [], custom: true };
    state.customFoods.push(f);
    await saveMeta('customFoods', state.customFoods);
    items.push({ foodId: f.id, portion: 2 });
    query = '';
    search.value = '';
    cat = 'perso';
    renderAll();
    toast(`« ${f.name} » ajouté à tes aliments`, f.emoji);
  }

  function renderAll() {
    renderSelected();
    renderTabs();
    renderGrid();
  }

  search.addEventListener('input', () => { query = search.value.trim(); renderAll(); });
  renderAll();

  const el = h('div', { class: 'food-picker' }, selectedBox, search, tabs, grid);
  el.getValue = () => items;
  el.addItems = (newItems) => {
    for (const n of newItems) if (!items.some((i) => i.foodId === n.foodId)) items.push(n);
    renderAll();
  };
  return el;
}

// =============================================================
// REPAS
// =============================================================
export function openMealForm(meal = null) {
  // meal sans id = nouveau repas pré-rempli (ex : ajout sur un jour passé)
  const isNew = !meal || !meal.id;
  const m = { at: nowISO(), type: guessMealType(), items: [], moods: [], ...(meal ? structuredClone(meal) : {}) };
  if (isNew && meal?.at && !meal.type) m.type = guessMealType(parseAt(meal.at));
  let photoBlob = null;
  let photoId = m.photoId || null;

  const typeChips = chips(MEAL_TYPES, m.type, { onChange: (v) => (m.type = v) });
  const when = dateTimeInput(m.at);
  const picker = foodPicker(m.items);
  const note = textArea(m.note, 'Précisions : sauce, marque, cuisson, ce que tu as bu…');

  // Photo
  const photoPreview = h('div', { class: 'photo-preview' });
  const photoInput = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
  photoInput.addEventListener('change', async () => {
    const file = photoInput.files[0];
    if (!file) return;
    photoBlob = await compressImage(file);
    showPhoto(photoBlob);
  });
  const showPhoto = (blob) => {
    photoPreview.innerHTML = '';
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    photoPreview.append(h('img', { src: url, alt: 'Photo du repas' }),
      h('button', { type: 'button', class: 'icon-btn small photo-del', onclick: () => { photoBlob = null; photoId = null; photoPreview.innerHTML = ''; } }, '✕'));
  };
  if (photoId) getPhoto(photoId).then(showPhoto);

  const mic = micButton((text) => {
    const found = parseFoods(text, state.customFoods);
    picker.addItems(found);
    note.value = (note.value ? note.value + ' — ' : '') + text;
    toast(found.length ? `${found.length} aliment(s) reconnu(s) 👍 Vérifie les portions` : 'Texte ajouté aux précisions', '🎙️');
  }, 'Dicter mon repas');

  const place = chips(CONTEXT_PLACES, m.place, { small: true });
  const company = chips(CONTEXT_COMPANY, m.company, { small: true });
  const moods = chips(CONTEXT_MOODS, m.moods, { multi: true, small: true });
  const duration = chips([5, 10, 15, 20, 30, 45].map((v) => ({ v, label: v === 45 ? '45 min +' : v + ' min' })), m.durationMin, { small: true });
  const chewing = scale(m.chewing ?? 5, { good: true, labels: ['Très vite', 'Très lentement'] });

  const body = h('div', {},
    section('Quel repas ?', typeChips),
    section('Quand ?', when),
    h('div', { class: 'row gap' },
      mic,
      h('button', { type: 'button', class: 'btn btn-soft', onclick: () => photoInput.click() }, '📸 Photo'),
      photoInput
    ),
    photoPreview,
    section('Qu\'as-tu mangé et bu ?', picker),
    section('', note),
    h('details', { class: 'more', open: isNew ? null : true },
      h('summary', {}, '🧭 Contexte du repas (lieu, ressenti, rythme)'),
      section('Où ?', place),
      section('Avec qui ?', company),
      section('Comment te sentais-tu ?', moods),
      section('Durée du repas', duration),
      section('Mastication / rythme', chewing)
    )
  );

  openSheet({
    title: isNew ? 'Nouveau repas' : 'Modifier le repas',
    emoji: mealTypeById(m.type).emoji,
    color: '#FF7A59',
    body,
    onDelete: isNew ? null : async () => { await deleteItem('meals', m.id); changed(); },
    onSave: async () => {
      m.type = typeChips.getValue() || 'collation';
      m.at = when.getValue() || nowISO();
      m.items = picker.getValue();
      m.note = note.getValue();
      if (!m.items.length && !m.note && !photoBlob && !photoId) {
        toast('Ajoute au moins un aliment, une photo ou une note', '🍽️');
        return false;
      }
      m.place = place.getValue();
      m.company = company.getValue();
      m.moods = moods.getValue();
      m.durationMin = duration.getValue();
      m.chewing = chewing.getValue();
      if (photoBlob) {
        photoId = photoId || 'ph-' + uid();
        await savePhoto(photoId, photoBlob);
      }
      m.photoId = photoId;
      if (!m.id) m.id = uid();
      await saveItem('meals', m);
      if (isNew) {
        const at = scheduleRexReminder(m);
        toast(`Repas noté ! Mini-REX prévu vers ${timeOf(at)}`, '🍽️');
      } else toast('Repas mis à jour', '✅');
      changed();
    },
  });
}

// =============================================================
// SYMPTÔMES & MINI-REX
// =============================================================
// opts.meal => mode REX pour ce repas ; opts.symptom => édition d'un symptôme existant
export function openSymptomForm(opts = {}) {
  const { meal, symptom } = opts;
  const isEdit = !!symptom;
  const isRex = !!meal && !isEdit;
  const selected = new Map(); // type -> { intensity, durationMin }
  if (isEdit) selected.set(symptom.type, { intensity: symptom.intensity, durationMin: symptom.durationMin });

  const when = dateTimeInput(isEdit ? symptom.at : opts.at || nowISO());

  // Repas lié : par défaut le dernier repas dans les 24 h avant le symptôme
  const mealSelect = h('select', { class: 'input' });
  const fillMeals = () => {
    const at = when.getValue() || nowISO();
    const t = parseAt(at);
    const candidates = state.meals.filter((x) => {
      const d = (t - parseAt(x.at)) / 3600000;
      return d >= 0 && d <= 24;
    }).reverse();
    const current = isEdit ? symptom.mealId : isRex ? meal.id : candidates[0]?.id || '';
    mealSelect.innerHTML = '';
    mealSelect.append(h('option', { value: '' }, '— Aucun (symptôme hors repas)'));
    for (const x of candidates) {
      const mt = mealTypeById(x.type);
      const names = (x.items || []).slice(0, 3).map((i) => foodById(i.foodId, state.customFoods)?.name).filter(Boolean).join(', ');
      mealSelect.append(h('option', { value: x.id, selected: x.id === current ? true : null },
        `${mt.emoji} ${mt.label} ${prettyDay(dayOf(x.at)) === "Aujourd'hui" ? '' : prettyDay(dayOf(x.at)) + ' '}${timeOf(x.at)} — il y a ${fmtDelay(minutesBetween(x.at, at))}${names ? ' · ' + names : ''}`));
    }
    if (isRex && !candidates.some((c) => c.id === meal.id)) {
      mealSelect.append(h('option', { value: meal.id, selected: true }, `${mealTypeById(meal.type).emoji} ${mealTypeById(meal.type).label} ${timeOf(meal.at)}`));
    }
  };
  when.addEventListener('change', fillMeals);
  fillMeals();

  const detailBox = h('div', { class: 'sym-details' });
  const grid = h('div', {});

  function renderGrid() {
    grid.innerHTML = '';
    for (const zone of ['haut', 'bas']) {
      const list = SYMPTOMS.filter((s) => s.zone === zone);
      grid.append(h('div', { class: 'f-label' }, zone === 'haut' ? '⬆️ Digestif haut (estomac)' : '⬇️ Digestif bas (intestin)'));
      grid.append(h('div', { class: 'sym-grid' }, list.map((s) => h('button', {
        type: 'button',
        class: 'sym-tile' + (selected.has(s.id) ? ' on' : ''),
        disabled: isEdit && s.id !== symptom.type ? true : null,
        onclick: () => {
          if (selected.has(s.id)) selected.delete(s.id);
          else selected.set(s.id, { intensity: 5, durationMin: null });
          renderGrid();
          renderDetails();
        },
      }, h('span', { class: 'sym-emoji' }, s.emoji), h('span', {}, s.label)))));
    }
  }

  function renderDetails() {
    detailBox.innerHTML = '';
    for (const [type, v] of selected) {
      const s = symptomById(type);
      detailBox.append(h('div', { class: 'sym-card' },
        h('div', { class: 'sym-card-title' }, s.emoji + ' ' + s.label),
        h('div', { class: 'muted tiny' }, 'Intensité'),
        scale(v.intensity, { onChange: (n) => (v.intensity = n), labels: ['Aucune', 'Insupportable'] }),
        h('div', { class: 'muted tiny' }, 'Durée'),
        chips(DURATIONS, v.durationMin, { small: true, onChange: (n) => (v.durationMin = n) })
      ));
    }
  }

  renderGrid();
  renderDetails();

  const note = textArea(isEdit ? symptom.note : '', 'Ce qui a aidé ou aggravé (bouillotte, marche, repos…)');
  const mic = micButton((text) => {
    const r = parseSymptoms(text);
    for (const s of r.symptoms) selected.set(s.type, { intensity: s.intensity, durationMin: r.duration });
    renderGrid();
    renderDetails();
    note.value = (note.value ? note.value + ' — ' : '') + text;
    toast(r.symptoms.length ? `${r.symptoms.length} symptôme(s) reconnu(s). Vérifie les intensités` : 'Je n\'ai pas reconnu de symptôme, le texte est dans la note', '🎙️');
  }, 'Décrire à l\'oral');

  // En mini-REX : "ça a commencé combien de temps après le repas ?" (1 geste)
  // → indispensable pour distinguer effet rapide (< 3 h) et tardif.
  let onsetChosen = false;
  const onset = isRex ? chips([
    { v: 20, label: '< 30 min' }, { v: 45, label: '30 min – 1 h' }, { v: 90, label: '1 – 2 h' },
    { v: 150, label: '2 – 3 h' }, { v: -1, label: 'Ça vient de commencer' },
  ], null, {
    small: true,
    onChange: (v) => {
      onsetChosen = v != null;
      if (v == null) return;
      const d = v === -1 ? new Date() : new Date(parseAt(meal.at).getTime() + v * 60000);
      when.value = toLocalISO(d > new Date() ? new Date() : d);
    },
  }) : null;

  let rasBtn = null;
  if (isRex) {
    const mt = mealTypeById(meal.type);
    rasBtn = h('div', { class: 'rex-head' },
      h('p', {}, `Depuis ton ${mt.label.toLowerCase()} de ${timeOf(meal.at)} (il y a ${fmtDelay(minutesBetween(meal.at, nowISO()))}), as-tu ressenti quelque chose ?`),
      h('button', {
        type: 'button', class: 'btn btn-ok btn-block',
        onclick: async () => {
          meal.rex = { at: nowISO(), ok: true };
          await saveItem('meals', meal);
          changed();
          toast('Super, rien à signaler ! +15 XP', '😊');
          history.back();
        },
      }, '😊 Rien à signaler'),
      h('div', { class: 'or' }, 'ou sélectionne ce que tu as ressenti 👇')
    );
  }

  const body = h('div', {},
    rasBtn,
    h('div', { class: 'row' }, mic),
    grid,
    detailBox,
    isRex ? section('Ça a commencé combien de temps après le repas ?', onset) : null,
    section(isRex ? 'Heure de début (ajustable)' : 'Quand ça a commencé ?', when),
    section('Repas probablement lié', mealSelect, h('div', { class: 'muted tiny' }, 'Le délai depuis le repas est calculé automatiquement.')),
    section('', note)
  );

  openSheet({
    title: isEdit ? 'Modifier le symptôme' : isRex ? 'Mini-REX' : 'Symptôme',
    emoji: isRex ? '🩺' : '😣',
    color: '#7C5CFF',
    body,
    saveLabel: isRex ? 'Enregistrer mon REX' : 'Enregistrer',
    onDelete: isEdit ? async () => { await deleteItem('symptoms', symptom.id); changed(); } : null,
    onSave: async () => {
      if (!selected.size) {
        toast(isRex ? 'Choisis un symptôme ou « Rien à signaler »' : 'Choisis au moins un symptôme', '👆');
        return false;
      }
      if (isRex && !onsetChosen) {
        toast('Indique quand ça a commencé (1 touche)', '⏱️');
        return false;
      }
      const at = when.getValue() || nowISO();
      const mealId = mealSelect.value || null;
      const linked = mealId ? state.meals.find((x) => x.id === mealId) : null;
      for (const [type, v] of selected) {
        const rec = isEdit ? symptom : { id: uid(), source: isRex ? 'rex' : 'libre' };
        Object.assign(rec, {
          at, type, zone: symptomById(type).zone, intensity: v.intensity, durationMin: v.durationMin,
          mealId, delayMin: linked ? minutesBetween(linked.at, at) : null, note: note.getValue(),
        });
        await saveItem('symptoms', rec);
      }
      if (linked && !linked.rex) {
        linked.rex = { at: nowISO(), ok: false };
        await saveItem('meals', linked);
      }
      toast(isEdit ? 'Symptôme mis à jour' : 'C\'est noté. Courage 💪', '🩺');
      changed();
    },
  });
}

// =============================================================
// SELLES
// =============================================================
export function openStoolForm(stool = null) {
  const isNew = !stool || !stool.id;
  const s = { at: nowISO(), kind: 'selle', bristol: null, ...(stool ? structuredClone(stool) : {}) };
  const when = dateTimeInput(s.at);
  const kind = chips([{ id: 'selle', label: 'Selle', emoji: '💩' }, { id: 'fausse-envie', label: 'Fausse envie', emoji: '🚽' }], s.kind, {
    onChange: (v) => { s.kind = v || 'selle'; bristolBox.style.display = s.kind === 'selle' ? '' : 'none'; },
  });

  const desc = h('div', { class: 'bristol-desc' });
  const bristolGrid = h('div', { class: 'bristol-grid' });
  const renderBristol = () => {
    bristolGrid.innerHTML = '';
    for (const b of BRISTOL) {
      bristolGrid.append(h('button', {
        type: 'button',
        class: `bristol-card g-${b.group}` + (s.bristol === b.v ? ' on' : ''),
        onclick: () => { s.bristol = b.v; renderBristol(); },
      }, h('span', { class: 'bristol-num' }, b.v), h('span', { html: bristolSVG(b.v, 84) }), h('span', { class: 'bristol-short' }, b.short)));
    }
    const b = BRISTOL.find((x) => x.v === s.bristol);
    desc.textContent = b ? `Type ${b.v} : ${b.desc}` : 'Touche le dessin qui ressemble le plus.';
  };
  renderBristol();
  const bristolBox = h('div', {}, section('Aspect (échelle de Bristol)', bristolGrid, desc));
  if (s.kind !== 'selle') bristolBox.style.display = 'none';

  const urgency = scale(s.urgency ?? 0, { labels: ['Aucune', 'Très urgent'] });
  const effort = scale(s.effort ?? 0, { labels: ['Facile', 'Gros effort'] });
  const pain = scale(s.pain ?? 0, { labels: ['Aucune', 'Très forte'] });
  const incomplete = toggle('Sensation de ne pas avoir fini', s.incomplete, '🔁');
  const burning = toggle('Brûlure', s.burning, '🔥');
  const yellow = toggle('Couleur jaune', s.yellow, '🟡');
  const mucus = toggle('Glaires', s.mucus, '💧');
  const alert = h('div', { class: 'alert', style: { display: s.blood ? '' : 'none' } },
    '⚠️ Du sang inhabituel ou abondant, ou des selles noires, sont à signaler rapidement à ton médecin.');
  const blood = toggle('Sang', s.blood, '🩸');
  blood.querySelector('input').addEventListener('change', () => (alert.style.display = blood.getValue() ? '' : 'none'));
  const note = textArea(s.note, 'Remarque libre');

  const mic = micButton((text) => {
    const r = parseStool(text);
    if (r.kind) kind.querySelectorAll('.chip')[1].click();
    if (r.bristol) { s.bristol = r.bristol; renderBristol(); }
    if (r.urgency != null) urgency.setValue(r.urgency);
    if (r.effort != null) effort.setValue(r.effort);
    if (r.incomplete) incomplete.setValue(true);
    if (r.burning) burning.setValue(true);
    if (r.yellow) yellow.setValue(true);
    if (r.mucus) mucus.setValue(true);
    if (r.blood) { blood.setValue(true); alert.style.display = ''; }
    note.value = (note.value ? note.value + ' — ' : '') + text;
    toast('Formulaire pré-rempli, vérifie avant d\'enregistrer', '🎙️');
  }, 'Dicter');

  const body = h('div', {},
    section('Quoi ?', kind),
    section('Quand ?', when),
    h('div', { class: 'row' }, mic),
    bristolBox,
    section('Urgence', urgency),
    section('Difficulté / effort', effort),
    section('Douleur', pain),
    section('Détails', h('div', { class: 'toggles' }, incomplete, burning, yellow, mucus, blood), alert),
    section('', note)
  );

  openSheet({
    title: isNew ? 'Passage aux toilettes' : 'Modifier',
    emoji: '🚽',
    color: '#8A5A35',
    body,
    onDelete: isNew ? null : async () => { await deleteItem('stools', s.id); changed(); },
    onSave: async () => {
      s.kind = kind.getValue() || 'selle';
      if (s.kind === 'selle' && !s.bristol) { toast('Choisis un type sur l\'échelle de Bristol', '👆'); return false; }
      if (s.kind !== 'selle') s.bristol = null;
      Object.assign(s, {
        at: when.getValue() || nowISO(),
        urgency: urgency.getValue(), effort: effort.getValue(), pain: pain.getValue(),
        incomplete: incomplete.getValue(), burning: burning.getValue(), yellow: yellow.getValue(),
        mucus: mucus.getValue(), blood: blood.getValue(), note: note.getValue(),
      });
      await saveItem('stools', s);
      toast(isNew ? 'Noté ! Merci pour ta rigueur 🕵️' : 'Mis à jour', '🚽');
      changed();
    },
  });
}

// =============================================================
// BILAN DU MATIN
// =============================================================
export function getDay(date) {
  return state.days[date] || { date };
}

export function openMorningForm(date = todayKey()) {
  const d = structuredClone(getDay(date));
  const sh = h('input', { class: 'input num', type: 'number', min: 0, max: 16, inputmode: 'numeric', placeholder: 'h', value: d.sleepMin != null ? Math.floor(d.sleepMin / 60) : '' });
  const sm = h('input', { class: 'input num', type: 'number', min: 0, max: 59, inputmode: 'numeric', placeholder: 'min', value: d.sleepMin != null ? d.sleepMin % 60 : '' });
  const garmin = h('input', { class: 'input num', type: 'number', min: 0, max: 100, inputmode: 'numeric', placeholder: '/100', value: d.sleepScore ?? '' });
  const quality = scale(d.sleepQuality ?? 5, { good: true, labels: ['Très mauvais', 'Excellent'] });
  const energy = scale(d.energy ?? 5, { good: true, labels: ['Épuisé', 'En pleine forme'] });
  const wake = chips([{ id: 'non', label: 'Non', emoji: '👍' }, ...SYMPTOMS.map((s) => ({ id: s.id, label: s.label, emoji: s.emoji }))],
    d.wakeSymptoms?.length ? d.wakeSymptoms : d.wakeSymptoms ? ['non'] : [], { multi: true, small: true });
  const wakeInt = scale(d.wakeIntensity ?? 0, { labels: ['Aucune', 'Très forte'] });

  const body = h('div', {},
    h('div', { class: 'tip' }, '⌚ Regarde ta Garmin (appli Garmin Connect → Sommeil) et recopie la durée et le score.'),
    section('Durée de sommeil', h('div', { class: 'row gap center' }, sh, h('span', {}, 'h'), sm, h('span', {}, 'min'))),
    section('Score de sommeil Garmin (facultatif)', garmin),
    section('Qualité ressentie', quality),
    section('Énergie au réveil', energy),
    section('Symptômes au réveil, avant de manger ?', wake),
    section('Intensité de ces symptômes', wakeInt)
  );

  openSheet({
    title: `Bilan du matin · ${prettyDay(date)}`,
    emoji: '🌅',
    color: '#FFC845',
    body,
    onSave: async () => {
      const hh = Number(sh.value || 0);
      const mm = Number(sm.value || 0);
      d.sleepMin = sh.value || sm.value ? hh * 60 + mm : null;
      d.sleepScore = garmin.value ? Number(garmin.value) : null;
      d.sleepQuality = quality.getValue();
      d.energy = energy.getValue();
      const ws = wake.getValue();
      d.wakeSymptoms = ws.includes('non') ? [] : ws;
      d.wakeIntensity = d.wakeSymptoms.length ? wakeInt.getValue() : 0;
      d.morningDone = true;
      await saveDay(d);
      toast('Bonne journée ! ☀️', '🌅');
      changed();
    },
  });
}

// =============================================================
// BILAN DU SOIR
// =============================================================
export function openEveningForm(date = todayKey()) {
  const d = structuredClone(getDay(date));
  const stress = scale(d.stress ?? 3, { labels: ['Zen', 'Très stressé'] });
  const water = stepper(d.water ?? 0, { max: 30, emoji: '💧', unit: ' verres' });
  const sport = chips(SPORTS, d.sport?.type, { small: true });
  const sportMin = h('input', { class: 'input num', type: 'number', min: 0, max: 600, inputmode: 'numeric', placeholder: 'min', value: d.sport?.durationMin ?? '' });
  const sportInt = chips(INTENSITIES, d.sport?.intensity, { small: true });
  const steps = h('input', { class: 'input num', type: 'number', min: 0, inputmode: 'numeric', placeholder: 'pas', value: d.steps ?? '' });
  const noStool = toggle('Pas de selle aujourd\'hui', d.noStool, '🚫');
  const meds = textArea(d.meds, 'Médicaments, probiotiques, compléments…');
  const obs = textArea(d.notes, 'Événement stressant, repas inhabituel, remarques…');

  const body = h('div', {},
    section('Stress global de la journée', stress),
    section('Hydratation (1 verre ≈ 25 cl)', water),
    section('Sport / déplacement actif', sport, h('div', { class: 'row gap center' }, sportMin, h('span', {}, 'min'), sportInt)),
    section('Nombre de pas (Garmin, facultatif)', steps),
    section('Transit', noStool),
    section('Médicaments / probiotiques', meds),
    section('Autres observations', obs),
    h('button', { type: 'button', class: 'btn btn-soft btn-block', onclick: () => openSymptomForm() }, '➕ Ajouter un symptôme oublié (hors repas)')
  );

  openSheet({
    title: `Bilan du soir · ${prettyDay(date)}`,
    emoji: '🌙',
    color: '#7C5CFF',
    body,
    onSave: async () => {
      Object.assign(d, {
        stress: stress.getValue(),
        water: water.getValue(),
        sport: sport.getValue() ? { type: sport.getValue(), durationMin: sportMin.value ? Number(sportMin.value) : null, intensity: sportInt.getValue() } : null,
        steps: steps.value ? Number(steps.value) : null,
        noStool: noStool.getValue(),
        meds: meds.getValue(),
        notes: obs.getValue(),
        eveningDone: true,
      });
      await saveDay(d);
      toast('Journée bouclée, bravo ! 🌙', '⭐');
      changed();
    },
  });
}

// +1 verre d'eau en un geste depuis l'accueil
export async function addWater(n = 1, date = todayKey()) {
  const d = { ...getDay(date) };
  d.water = Math.max(0, (d.water || 0) + n);
  await saveDay(d);
  changed();
  return d.water;
}

// Menu "+" : que veux-tu noter ?
export function openQuickAdd() {
  const pending = state.meals.filter((m) => !m.rex && minutesBetween(m.at, nowISO()) >= 30 && minutesBetween(m.at, nowISO()) < 24 * 60);
  const items = [
    { emoji: '🍽️', label: 'Repas / boisson', color: '#FF7A59', fn: () => openMealForm() },
    { emoji: '😣', label: 'Symptôme', color: '#7C5CFF', fn: () => openSymptomForm() },
    { emoji: '🚽', label: 'Toilettes', color: '#8A5A35', fn: () => openStoolForm() },
    { emoji: '🌅', label: 'Bilan matin', color: '#E0A800', fn: () => openMorningForm() },
    { emoji: '🌙', label: 'Bilan soir', color: '#4F46E5', fn: () => openEveningForm() },
  ];
  if (pending.length) items.splice(1, 0, { emoji: '🩺', label: 'Mini-REX', color: '#2EC4B6', fn: () => openSymptomForm({ meal: pending[pending.length - 1] }) });
  const sheet = openSheet({
    title: 'Que veux-tu noter ?',
    emoji: '✍️',
    body: h('div', { class: 'quick-grid' }, items.map((it) => h('button', {
      type: 'button', class: 'quick-tile', style: { '--c': it.color },
      onclick: () => { sheet.close(); setTimeout(it.fn, 260); },
    }, h('span', { class: 'quick-emoji' }, it.emoji), it.label))),
  });
}
