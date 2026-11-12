// =============================================================
// store.js — Stockage des données sur l'appareil (IndexedDB)
// Rien ne part sur internet : tout reste dans le téléphone.
// =============================================================

// ?db=test dans l'adresse => base séparée (pour tester sans toucher aux vraies données)
const TEST_DB = new URLSearchParams(location.search).get('db');
const DB_NAME = TEST_DB ? 'bidou-journal-' + TEST_DB.replace(/\W/g, '') : 'bidou-journal';
const DB_VERSION = 1;
// Une "table" par type de donnée
const STORES = {
  meals: 'id', // repas
  symptoms: 'id', // symptômes (REX ou hors repas)
  stools: 'id', // selles / fausses envies
  days: 'date', // bilan quotidien (sommeil, stress, hydratation, sport…)
  photos: 'id', // photos des plats (images compressées)
  meta: 'key', // réglages, aliments perso, badges…
};

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [name, keyPath] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(store, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then((r) => (result = r));
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
  });
}

const reqToPromise = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export const db = {
  async all(store) {
    return tx(store, 'readonly', (s) => reqToPromise(s.getAll()));
  },
  async get(store, key) {
    return tx(store, 'readonly', (s) => reqToPromise(s.get(key)));
  },
  async put(store, value) {
    await tx(store, 'readwrite', (s) => s.put(value));
    return value;
  },
  async del(store, key) {
    return tx(store, 'readwrite', (s) => s.delete(key));
  },
  async clear(store) {
    return tx(store, 'readwrite', (s) => s.clear());
  },
};

// Identifiant unique simple
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// -------------------------------------------------------------
// Cache en mémoire : on charge tout au démarrage (volume faible),
// ce qui rend l'interface instantanée.
// -------------------------------------------------------------
export const state = {
  meals: [],
  symptoms: [],
  stools: [],
  days: {}, // { 'YYYY-MM-DD': {...} }
  settings: {},
  customFoods: [],
  earned: {}, // badges débloqués { id: dateISO }
};

const DEFAULT_SETTINGS = {
  name: '',
  rdvDate: '', // à renseigner dans Profil → Réglages
  journalStart: null, // date de début du journal 15 jours
  // Mini-REX 3 h après le repas : la littérature (journal FAST, études SII)
  // considère qu'un symptôme est "post-prandial" s'il survient dans les 3 h.
  rexDelayMin: 180,
  notifications: false,
  eveningHour: 20,
};

export async function loadAll() {
  const [meals, symptoms, stools, days, meta] = await Promise.all([
    db.all('meals'),
    db.all('symptoms'),
    db.all('stools'),
    db.all('days'),
    db.all('meta'),
  ]);
  state.meals = meals.sort(byAt);
  state.symptoms = symptoms.sort(byAt);
  state.stools = stools.sort(byAt);
  state.days = Object.fromEntries(days.map((d) => [d.date, d]));
  const m = Object.fromEntries(meta.map((x) => [x.key, x.value]));
  state.settings = { ...DEFAULT_SETTINGS, ...(m.settings || {}) };
  state.customFoods = m.customFoods || [];
  state.earned = m.earned || {};
  // Demande au navigateur de ne pas effacer les données en cas de manque de place
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

const byAt = (a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0);

// --- Sauvegardes typées (mettent à jour le cache + la base)
export async function saveItem(store, item) {
  if (!item.id) item.id = uid();
  item.updatedAt = new Date().toISOString();
  await db.put(store, item);
  const list = state[store];
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = item;
  else list.push(item);
  list.sort(byAt);
  return item;
}

export async function deleteItem(store, id) {
  await db.del(store, id);
  state[store] = state[store].filter((x) => x.id !== id);
}

export async function saveDay(day) {
  day.updatedAt = new Date().toISOString();
  await db.put('days', day);
  state.days[day.date] = day;
  return day;
}

export async function saveMeta(key, value) {
  await db.put('meta', { key, value });
}

export async function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  await saveMeta('settings', state.settings);
}

export async function savePhoto(id, blob) {
  await db.put('photos', { id, blob });
}
export async function getPhoto(id) {
  const p = await db.get('photos', id);
  return p ? p.blob : null;
}

export async function wipeAll() {
  for (const s of Object.keys(STORES)) await db.clear(s);
  await loadAll();
}
