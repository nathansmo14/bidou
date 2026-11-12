// =============================================================
// catalog.js — Toutes les listes de référence de l'appli
// (aliments, symptômes, types de repas, contextes, Bristol...)
// Pour ajouter un aliment : ajoute une ligne dans FOODS.
// =============================================================

// Catégories d'aliments (ordre d'affichage dans le sélecteur)
export const FOOD_CATEGORIES = [
  { id: 'feculents', label: 'Féculents', emoji: '🍚' },
  { id: 'proteines', label: 'Protéines', emoji: '🍗' },
  { id: 'legumes', label: 'Légumes', emoji: '🥕' },
  { id: 'fruits', label: 'Fruits', emoji: '🍓' },
  { id: 'laitiers', label: 'Laitiers', emoji: '🧀' },
  { id: 'plats', label: 'Plats & fast-food', emoji: '🍔' },
  { id: 'sucre', label: 'Sucré', emoji: '🍫' },
  { id: 'sauces', label: 'Sauces & gras', emoji: '🫒' },
  { id: 'boissons', label: 'Boissons', emoji: '🥤' },
  { id: 'autres', label: 'Autres', emoji: '🥜' },
];

// Familles FODMAP + autres "déclencheurs" connus du SII.
// Elles servent à regrouper les aliments dans l'analyse.
export const TRIGGER_GROUPS = {
  lactose: { label: 'Lactose', emoji: '🥛' },
  fructanes: { label: 'Fructanes (blé, oignon, ail…)', emoji: '🌾' },
  GOS: { label: 'GOS (légumineuses)', emoji: '🫘' },
  fructose: { label: 'Fructose en excès', emoji: '🍎' },
  polyols: { label: 'Polyols (sorbitol, mannitol)', emoji: '🍑' },
  cruciferes: { label: 'Choux & crucifères', emoji: '🥦' },
  gras: { label: 'Gras / friture', emoji: '🍟' },
  epice: { label: 'Épicé', emoji: '🌶️' },
  cafeine: { label: 'Caféine', emoji: '☕' },
  alcool: { label: 'Alcool', emoji: '🍷' },
  gazeux: { label: 'Boissons gazeuses', emoji: '🫧' },
};

// f = niveau FODMAP indicatif (low / mod / high) pour une portion normale.
// t = familles/déclencheurs (voir TRIGGER_GROUPS).
// Sources : classifications FODMAP usuelles (Monash University), simplifiées.
const F = (id, name, emoji, cat, f, t = [], syn = []) => ({ id, name, emoji, cat, f, t, syn });

export const FOODS = [
  // --- Féculents
  F('pain-blanc', 'Pain blanc / de mie', '🍞', 'feculents', 'high', ['fructanes'], ['pain', 'pain de mie']),
  F('baguette', 'Baguette', '🥖', 'feculents', 'high', ['fructanes'], ['baguette']),
  F('pain-complet', 'Pain complet / céréales', '🍞', 'feculents', 'high', ['fructanes'], ['pain complet']),
  F('pain-levain', 'Pain au levain', '🥖', 'feculents', 'low', [], ['levain']),
  F('riz', 'Riz', '🍚', 'feculents', 'low', [], ['riz']),
  F('pates', 'Pâtes', '🍝', 'feculents', 'high', ['fructanes'], ['pâtes', 'pates', 'spaghetti', 'tagliatelles', 'penne']),
  F('pates-sg', 'Pâtes sans gluten', '🍝', 'feculents', 'low', [], ['pâtes sans gluten']),
  F('pdt', 'Pommes de terre', '🥔', 'feculents', 'low', [], ['pomme de terre', 'pommes de terre', 'purée', 'patates']),
  F('patate-douce', 'Patate douce', '🍠', 'feculents', 'mod', ['polyols'], ['patate douce']),
  F('quinoa', 'Quinoa', '🌾', 'feculents', 'low', [], ['quinoa']),
  F('semoule', 'Semoule / couscous / boulgour', '🌾', 'feculents', 'high', ['fructanes'], ['semoule', 'couscous', 'boulgour']),
  F('avoine', 'Flocons d\'avoine', '🥣', 'feculents', 'low', [], ['avoine', 'porridge', 'flocons']),
  F('cereales', 'Céréales petit-déj', '🥣', 'feculents', 'mod', ['fructanes'], ['céréales', 'muesli']),
  F('biscottes', 'Biscottes / crackers', '🍘', 'feculents', 'mod', ['fructanes'], ['biscotte', 'biscottes', 'crackers']),
  F('mais', 'Maïs', '🌽', 'feculents', 'mod', ['polyols'], ['maïs', 'mais']),
  F('lentilles', 'Lentilles', '🫘', 'feculents', 'high', ['GOS'], ['lentilles']),
  F('pois-chiches', 'Pois chiches / houmous', '🫘', 'feculents', 'high', ['GOS'], ['pois chiche', 'pois chiches', 'houmous']),
  F('haricots-secs', 'Haricots rouges / blancs', '🫘', 'feculents', 'high', ['GOS'], ['haricots rouges', 'haricots blancs', 'flageolets']),

  // --- Protéines
  F('poulet', 'Poulet / dinde', '🍗', 'proteines', 'low', [], ['poulet', 'dinde', 'volaille']),
  F('boeuf', 'Bœuf / steak', '🥩', 'proteines', 'low', [], ['boeuf', 'bœuf', 'steak', 'steak haché', 'viande']),
  F('porc', 'Porc', '🥓', 'proteines', 'low', [], ['porc', 'côte de porc']),
  F('jambon', 'Jambon', '🍖', 'proteines', 'low', [], ['jambon']),
  F('charcuterie', 'Charcuterie / saucisses', '🌭', 'proteines', 'mod', ['gras'], ['charcuterie', 'saucisson', 'saucisse', 'saucisses', 'chorizo', 'lardons']),
  F('oeufs', 'Œufs', '🥚', 'proteines', 'low', [], ['oeuf', 'oeufs', 'œuf', 'œufs', 'omelette']),
  F('poisson', 'Poisson', '🐟', 'proteines', 'low', [], ['poisson', 'saumon', 'thon', 'cabillaud', 'colin']),
  F('fruits-mer', 'Crevettes / fruits de mer', '🦐', 'proteines', 'low', [], ['crevettes', 'fruits de mer', 'moules']),
  F('tofu', 'Tofu', '🧊', 'proteines', 'low', [], ['tofu']),
  F('pane', 'Pané / nuggets / cordon bleu', '🍗', 'proteines', 'high', ['fructanes', 'gras'], ['nuggets', 'pané', 'cordon bleu', 'poisson pané']),

  // --- Légumes
  F('carotte', 'Carottes', '🥕', 'legumes', 'low', [], ['carotte', 'carottes']),
  F('courgette', 'Courgettes', '🥒', 'legumes', 'low', [], ['courgette', 'courgettes']),
  F('concombre', 'Concombre', '🥒', 'legumes', 'low', [], ['concombre']),
  F('tomate', 'Tomates', '🍅', 'legumes', 'low', [], ['tomate', 'tomates']),
  F('salade', 'Salade verte', '🥬', 'legumes', 'low', [], ['salade', 'laitue', 'mâche']),
  F('epinards', 'Épinards', '🍃', 'legumes', 'low', [], ['épinards', 'epinards']),
  F('haricots-verts', 'Haricots verts', '🫛', 'legumes', 'low', [], ['haricots verts']),
  F('poivron', 'Poivron', '🫑', 'legumes', 'low', [], ['poivron', 'poivrons']),
  F('aubergine', 'Aubergine', '🍆', 'legumes', 'low', [], ['aubergine']),
  F('radis', 'Radis', '🌱', 'legumes', 'low', [], ['radis']),
  F('courge', 'Potiron / courge', '🎃', 'legumes', 'low', [], ['potiron', 'courge', 'butternut', 'potimarron']),
  F('brocoli', 'Brocoli', '🥦', 'legumes', 'mod', ['cruciferes'], ['brocoli', 'brocolis']),
  F('chou-fleur', 'Chou-fleur', '🥦', 'legumes', 'high', ['polyols', 'cruciferes'], ['chou-fleur', 'chou fleur']),
  F('chou', 'Chou (blanc, vert, rouge)', '🥬', 'legumes', 'mod', ['cruciferes'], ['chou', 'choux', 'chou rouge', 'chou blanc', 'choucroute']),
  F('chou-bruxelles', 'Choux de Bruxelles', '🥬', 'legumes', 'mod', ['fructanes', 'cruciferes'], ['choux de bruxelles', 'chou de bruxelles']),
  F('oignon', 'Oignon / échalote', '🧅', 'legumes', 'high', ['fructanes'], ['oignon', 'oignons', 'échalote']),
  F('ail', 'Ail', '🧄', 'legumes', 'high', ['fructanes'], ['ail']),
  F('poireau', 'Poireau', '🥬', 'legumes', 'high', ['fructanes'], ['poireau', 'poireaux']),
  F('champignons', 'Champignons', '🍄', 'legumes', 'high', ['polyols'], ['champignon', 'champignons']),
  F('asperges', 'Asperges / artichaut', '🌿', 'legumes', 'high', ['fructanes', 'fructose'], ['asperges', 'artichaut']),
  F('petits-pois', 'Petits pois', '🫛', 'legumes', 'high', ['GOS'], ['petits pois']),
  F('avocat', 'Avocat', '🥑', 'legumes', 'mod', ['polyols'], ['avocat', 'guacamole']),
  F('celeri', 'Céleri', '🥬', 'legumes', 'high', ['polyols'], ['céleri', 'celeri']),
  F('betterave', 'Betterave', '🟣', 'legumes', 'mod', ['fructanes'], ['betterave']),

  // --- Fruits
  F('banane', 'Banane', '🍌', 'fruits', 'mod', ['fructanes'], ['banane', 'bananes']),
  F('pomme', 'Pomme', '🍎', 'fruits', 'high', ['fructose', 'polyols'], ['pomme', 'pommes']),
  F('poire', 'Poire', '🍐', 'fruits', 'high', ['fructose', 'polyols'], ['poire', 'poires']),
  F('peche', 'Pêche / abricot / prune', '🍑', 'fruits', 'high', ['polyols'], ['pêche', 'peche', 'abricot', 'prune', 'nectarine']),
  F('cerises', 'Cerises', '🍒', 'fruits', 'high', ['fructose', 'polyols'], ['cerises', 'cerise']),
  F('mangue', 'Mangue', '🥭', 'fruits', 'high', ['fructose'], ['mangue']),
  F('pasteque', 'Pastèque', '🍉', 'fruits', 'high', ['fructose', 'polyols'], ['pastèque', 'pasteque']),
  F('melon', 'Melon', '🍈', 'fruits', 'low', [], ['melon']),
  F('raisin', 'Raisin', '🍇', 'fruits', 'low', [], ['raisin', 'raisins']),
  F('fraises', 'Fraises / framboises', '🍓', 'fruits', 'low', [], ['fraise', 'fraises', 'framboise', 'framboises']),
  F('myrtilles', 'Myrtilles', '🫐', 'fruits', 'low', [], ['myrtilles']),
  F('orange', 'Orange / clémentine', '🍊', 'fruits', 'low', [], ['orange', 'oranges', 'clémentine', 'clementine', 'mandarine']),
  F('kiwi', 'Kiwi', '🥝', 'fruits', 'low', [], ['kiwi']),
  F('ananas', 'Ananas', '🍍', 'fruits', 'low', [], ['ananas']),
  F('fruits-secs', 'Fruits secs (dattes, raisins secs…)', '🌰', 'fruits', 'high', ['fructanes', 'fructose'], ['dattes', 'fruits secs', 'raisins secs', 'pruneaux']),
  F('compote', 'Compote', '🥫', 'fruits', 'high', ['fructose', 'polyols'], ['compote']),

  // --- Laitiers
  F('lait', 'Lait', '🥛', 'laitiers', 'high', ['lactose'], ['lait']),
  F('lait-sl', 'Lait sans lactose', '🥛', 'laitiers', 'low', [], ['lait sans lactose']),
  F('yaourt', 'Yaourt', '🥄', 'laitiers', 'mod', ['lactose'], ['yaourt', 'yaourts', 'yogourt']),
  F('fromage-blanc', 'Fromage blanc / petit-suisse', '🥄', 'laitiers', 'high', ['lactose'], ['fromage blanc', 'petit suisse', 'skyr']),
  F('fromage-dur', 'Fromage à pâte dure (comté, emmental…)', '🧀', 'laitiers', 'low', [], ['comté', 'emmental', 'gruyère', 'parmesan', 'cheddar']),
  F('fromage-mou', 'Fromage à pâte molle (camembert, brie…)', '🧀', 'laitiers', 'low', ['gras'], ['camembert', 'brie', 'fromage', 'reblochon', 'raclette']),
  F('fromage-frais', 'Fromage frais (mozza, chèvre frais, ricotta)', '🧀', 'laitiers', 'mod', ['lactose'], ['mozzarella', 'mozza', 'ricotta', 'chèvre', 'feta']),
  F('creme', 'Crème fraîche', '🍶', 'laitiers', 'mod', ['lactose', 'gras'], ['crème', 'creme', 'crème fraîche']),
  F('beurre', 'Beurre', '🧈', 'laitiers', 'low', ['gras'], ['beurre']),
  F('glace', 'Glace', '🍨', 'laitiers', 'high', ['lactose'], ['glace', 'glaces']),
  F('boisson-veg', 'Boisson végétale (soja, avoine…)', '🌾', 'laitiers', 'mod', ['GOS'], ['lait de soja', 'lait d\'avoine', 'boisson végétale']),

  // --- Plats & fast-food
  F('burger', 'Burger', '🍔', 'plats', 'high', ['fructanes', 'gras'], ['burger', 'hamburger', 'cheeseburger']),
  F('pizza', 'Pizza', '🍕', 'plats', 'high', ['fructanes', 'lactose', 'gras'], ['pizza']),
  F('kebab', 'Kebab / tacos', '🥙', 'plats', 'high', ['fructanes', 'gras'], ['kebab', 'tacos', 'grec']),
  F('frites', 'Frites', '🍟', 'plats', 'low', ['gras'], ['frites']),
  F('sandwich', 'Sandwich', '🥪', 'plats', 'high', ['fructanes'], ['sandwich', 'panini', 'jambon beurre']),
  F('hotdog', 'Hot-dog', '🌭', 'plats', 'high', ['fructanes', 'gras'], ['hot dog', 'hot-dog']),
  F('sushi', 'Sushis / makis', '🍣', 'plats', 'low', [], ['sushi', 'sushis', 'maki', 'makis']),
  F('asiatique', 'Plat asiatique (wok, nouilles…)', '🥡', 'plats', 'high', ['fructanes', 'gras'], ['chinois', 'wok', 'nouilles', 'thaï', 'pad thai']),
  F('curry', 'Curry / plat indien', '🍛', 'plats', 'high', ['fructanes', 'epice'], ['curry', 'indien', 'tikka']),
  F('lasagnes', 'Lasagnes / gratin', '🫕', 'plats', 'high', ['fructanes', 'lactose', 'gras'], ['lasagnes', 'gratin']),
  F('quiche', 'Quiche / tarte salée', '🥧', 'plats', 'high', ['fructanes', 'lactose', 'gras'], ['quiche', 'tarte salée', 'tourte']),
  F('salade-composee', 'Salade composée', '🥗', 'plats', 'mod', [], ['salade composée', 'salade césar']),
  F('soupe', 'Soupe / velouté', '🍲', 'plats', 'mod', ['fructanes'], ['soupe', 'velouté']),
  F('plat-prepare', 'Plat préparé / cantine', '🍱', 'plats', 'mod', [], ['plat préparé', 'cantine', 'self']),
  F('raclette', 'Raclette / fondue / tartiflette', '🫕', 'plats', 'mod', ['gras'], ['raclette', 'fondue', 'tartiflette']),

  // --- Sucré
  F('choco-noir', 'Chocolat noir', '🍫', 'sucre', 'low', [], ['chocolat noir']),
  F('choco-lait', 'Chocolat au lait / blanc', '🍫', 'sucre', 'mod', ['lactose'], ['chocolat', 'chocolat au lait']),
  F('biscuits', 'Biscuits / gâteaux secs', '🍪', 'sucre', 'high', ['fructanes'], ['biscuit', 'biscuits', 'cookie', 'cookies']),
  F('gateau', 'Gâteau / pâtisserie', '🍰', 'sucre', 'high', ['fructanes', 'lactose', 'gras'], ['gâteau', 'gateau', 'pâtisserie', 'tarte', 'éclair']),
  F('viennoiserie', 'Croissant / viennoiserie', '🥐', 'sucre', 'high', ['fructanes', 'gras'], ['croissant', 'pain au chocolat', 'viennoiserie', 'brioche']),
  F('bonbons', 'Bonbons', '🍬', 'sucre', 'low', [], ['bonbon', 'bonbons']),
  F('chewing-gum', 'Chewing-gum sans sucre', '🫧', 'sucre', 'high', ['polyols'], ['chewing gum', 'chewing-gum']),
  F('miel', 'Miel', '🍯', 'sucre', 'high', ['fructose'], ['miel']),
  F('confiture', 'Confiture', '🍓', 'sucre', 'low', [], ['confiture']),
  F('pate-tartiner', 'Pâte à tartiner', '🌰', 'sucre', 'mod', ['lactose', 'gras'], ['nutella', 'pâte à tartiner']),

  // --- Sauces & gras
  F('huile-olive', 'Huile d\'olive', '🫒', 'sauces', 'low', [], ['huile']),
  F('mayonnaise', 'Mayonnaise', '🥚', 'sauces', 'low', ['gras'], ['mayonnaise', 'mayo']),
  F('ketchup', 'Ketchup / sauce barbecue', '🍅', 'sauces', 'mod', ['fructanes'], ['ketchup', 'barbecue']),
  F('sauce-tomate', 'Sauce tomate / bolognaise', '🥫', 'sauces', 'high', ['fructanes'], ['sauce tomate', 'bolognaise']),
  F('sauce-creme', 'Sauce à la crème / fromagère', '🍶', 'sauces', 'mod', ['lactose', 'gras'], ['sauce crème', 'carbonara', 'sauce fromage']),
  F('vinaigrette', 'Vinaigrette', '🫗', 'sauces', 'low', [], ['vinaigrette']),
  F('soja', 'Sauce soja', '🍶', 'sauces', 'low', [], ['sauce soja']),
  F('piment', 'Piment / épices fortes', '🌶️', 'sauces', 'low', ['epice'], ['piment', 'épicé', 'harissa', 'tabasco']),

  // --- Boissons
  F('eau', 'Eau', '💧', 'boissons', 'low', [], ['eau']),
  F('eau-gazeuse', 'Eau gazeuse', '🫧', 'boissons', 'low', ['gazeux'], ['eau gazeuse', 'perrier']),
  F('cafe', 'Café', '☕', 'boissons', 'low', ['cafeine'], ['café', 'cafe', 'expresso']),
  F('the', 'Thé', '🍵', 'boissons', 'low', ['cafeine'], ['thé', 'the']),
  F('tisane', 'Tisane', '🌿', 'boissons', 'low', [], ['tisane', 'infusion']),
  F('soda', 'Soda sucré', '🥤', 'boissons', 'high', ['fructose', 'gazeux'], ['soda', 'coca', 'limonade', 'ice tea']),
  F('soda-zero', 'Soda zéro / light', '🥤', 'boissons', 'low', ['gazeux'], ['coca zéro', 'light', 'zéro']),
  F('jus', 'Jus de fruits', '🧃', 'boissons', 'high', ['fructose'], ['jus', 'jus d\'orange', 'jus de pomme']),
  F('biere', 'Bière', '🍺', 'boissons', 'mod', ['alcool', 'gazeux'], ['bière', 'biere']),
  F('vin', 'Vin', '🍷', 'boissons', 'low', ['alcool'], ['vin']),
  F('alcool-fort', 'Alcool fort / cocktail', '🍸', 'boissons', 'mod', ['alcool'], ['whisky', 'vodka', 'rhum', 'cocktail', 'apéro']),
  F('energisante', 'Boisson énergisante', '⚡', 'boissons', 'mod', ['cafeine', 'gazeux'], ['red bull', 'monster', 'boisson énergisante']),

  // --- Autres
  F('noix', 'Noix / amandes / noisettes', '🥜', 'autres', 'mod', ['GOS'], ['noix', 'amandes', 'noisettes', 'cajou']),
  F('cacahuetes', 'Cacahuètes', '🥜', 'autres', 'low', [], ['cacahuètes', 'cacahuetes']),
  F('graines', 'Graines (chia, lin…)', '🌻', 'autres', 'low', [], ['graines', 'chia', 'lin']),
];

export const PORTIONS = [
  { v: 1, label: 'Petite', emoji: '🤏', hint: 'quelques bouchées' },
  { v: 2, label: 'Normale', emoji: '✋', hint: 'portion classique' },
  { v: 3, label: 'Grande', emoji: '🙌', hint: 'généreuse / resservi' },
];

export const MEAL_TYPES = [
  { id: 'petit-dej', label: 'Petit-déj', emoji: '🌅', hour: 7 },
  { id: 'dejeuner', label: 'Déjeuner', emoji: '☀️', hour: 12 },
  { id: 'gouter', label: 'Goûter', emoji: '🍪', hour: 16 },
  { id: 'diner', label: 'Dîner', emoji: '🌙', hour: 19 },
  { id: 'collation', label: 'Grignotage', emoji: '🍿', hour: null },
  { id: 'boisson', label: 'Boisson seule', emoji: '🥤', hour: null },
];

export const CONTEXT_PLACES = [
  { id: 'maison', label: 'Maison', emoji: '🏠' },
  { id: 'travail', label: 'Travail', emoji: '💼' },
  { id: 'resto', label: 'Restaurant', emoji: '🍽️' },
  { id: 'fastfood', label: 'Fast-food', emoji: '🍟' },
  { id: 'amis', label: 'Chez des proches', emoji: '👥' },
  { id: 'route', label: 'En route', emoji: '🚗' },
];
export const CONTEXT_COMPANY = [
  { id: 'seul', label: 'Seul', emoji: '🙋' },
  { id: 'accompagne', label: 'Accompagné', emoji: '👫' },
];
export const CONTEXT_MOODS = [
  { id: 'detendu', label: 'Détendu', emoji: '😌' },
  { id: 'presse', label: 'Pressé', emoji: '⏱️' },
  { id: 'stresse', label: 'Stressé', emoji: '😰' },
  { id: 'fatigue', label: 'Fatigué', emoji: '😴' },
  { id: 'ecran', label: 'Devant un écran', emoji: '📱' },
  { id: 'faim', label: 'Très faim', emoji: '🐺' },
];

// Symptômes : zone "haut" (estomac) ou "bas" (intestin), comme dans le journal de la nutritionniste
export const SYMPTOMS = [
  { id: 'reflux', label: 'Reflux / brûlure', emoji: '🔥', zone: 'haut', kw: ['reflux', 'brûlure d\'estomac', 'remontée', 'aigreur'] },
  { id: 'nausee', label: 'Nausée', emoji: '🤢', zone: 'haut', kw: ['nausée', 'nausées', 'envie de vomir', 'mal au coeur', 'mal au cœur'] },
  { id: 'lourdeur', label: 'Lourdeur / pesanteur', emoji: '🪨', zone: 'haut', kw: ['lourdeur', 'lourd', 'pesanteur', 'estomac plein', 'barbouillé'] },
  { id: 'ballonnement', label: 'Ballonnement', emoji: '🎈', zone: 'bas', kw: ['ballonné', 'ballonnement', 'ballonnements', 'gonflé', 'ventre gonflé'] },
  { id: 'gaz', label: 'Gaz', emoji: '💨', zone: 'bas', kw: ['gaz', 'flatulence', 'flatulences', 'pets', 'gargouillis'] },
  { id: 'douleur', label: 'Douleur au ventre', emoji: '😣', zone: 'bas', kw: ['douleur', 'mal au ventre', 'mal', 'douleurs'] },
  { id: 'crampe', label: 'Crampe / spasme', emoji: '⚡', zone: 'bas', kw: ['crampe', 'crampes', 'spasme', 'spasmes', 'tiraillement'] },
  { id: 'urgence', label: 'Urgence à aller aux toilettes', emoji: '🚨', zone: 'bas', kw: ['urgence', 'besoin urgent', 'courir aux toilettes'] },
  { id: 'fausse-envie', label: 'Fausse envie', emoji: '🚽', zone: 'bas', kw: ['fausse envie', 'fausses envies'] },
];

export const DURATIONS = [
  { v: 15, label: '15 min' },
  { v: 30, label: '30 min' },
  { v: 60, label: '1 h' },
  { v: 120, label: '2 h' },
  { v: 240, label: '4 h +' },
];

// Échelle de Bristol (descriptions reprises du document de la nutritionniste)
export const BRISTOL = [
  { v: 1, short: 'Billes dures', desc: 'Petites crottes dures et détachées, comme des noisettes. Difficiles à évacuer.', group: 'dur' },
  { v: 2, short: 'Saucisse grumeleuse', desc: 'En forme de saucisse, mais dure et grumeleuse.', group: 'dur' },
  { v: 3, short: 'Saucisse craquelée', desc: 'Comme une saucisse avec des craquelures en surface.', group: 'normal' },
  { v: 4, short: 'Lisse et souple', desc: 'Comme une saucisse ou un serpent, lisse et douce. Idéal.', group: 'normal' },
  { v: 5, short: 'Morceaux mous', desc: 'Morceaux mous aux bords nets, faciles à évacuer.', group: 'mou' },
  { v: 6, short: 'Morceaux pâteux', desc: 'Morceaux duveteux, en lambeaux, selles détrempées.', group: 'liquide' },
  { v: 7, short: 'Liquide', desc: 'Pas de morceau solide, entièrement liquide.', group: 'liquide' },
];

export const SPORTS = [
  { id: 'marche', label: 'Marche', emoji: '🚶' },
  { id: 'course', label: 'Course', emoji: '🏃' },
  { id: 'velo', label: 'Vélo', emoji: '🚴' },
  { id: 'muscu', label: 'Muscu', emoji: '🏋️' },
  { id: 'natation', label: 'Natation', emoji: '🏊' },
  { id: 'collectif', label: 'Sport co', emoji: '⚽' },
  { id: 'yoga', label: 'Yoga / étirements', emoji: '🧘' },
  { id: 'autre', label: 'Autre', emoji: '🤸' },
];

export const INTENSITIES = [
  { id: 'faible', label: 'Faible', emoji: '🟢' },
  { id: 'moyenne', label: 'Moyenne', emoji: '🟡' },
  { id: 'forte', label: 'Forte', emoji: '🔴' },
];

export const foodById = (id, custom = []) =>
  FOODS.find((f) => f.id === id) || custom.find((f) => f.id === id) || null;

export const symptomById = (id) => SYMPTOMS.find((s) => s.id === id);
export const mealTypeById = (id) => MEAL_TYPES.find((m) => m.id === id) || MEAL_TYPES[4];
