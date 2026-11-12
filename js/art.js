// =============================================================
// art.js — Illustrations dessinées sur mesure (SVG)
// - Bidou, la mascotte
// - Les 7 types de l'échelle de Bristol
// =============================================================

// Bidou : un petit ventre tout rond. Humeurs : happy, calm, sleepy, worried, party
export function mascot(mood = 'happy', size = 96) {
  const eyes = {
    happy: '<path d="M38 50 q5 -6 10 0" /><path d="M62 50 q5 -6 10 0" />',
    calm: '<circle cx="43" cy="49" r="3.6" class="fill"/><circle cx="67" cy="49" r="3.6" class="fill"/>',
    sleepy: '<path d="M38 50 q5 4 10 0" /><path d="M62 50 q5 4 10 0" />',
    worried: '<circle cx="43" cy="50" r="3.6" class="fill"/><circle cx="67" cy="50" r="3.6" class="fill"/><path d="M37 41 l10 3"/><path d="M73 41 l-10 3"/>',
    party: '<path d="M38 50 q5 -7 10 0" /><path d="M62 50 q5 -7 10 0" />',
  }[mood];
  const mouth = {
    happy: '<path d="M46 60 q9 10 18 0" />',
    calm: '<path d="M48 61 q7 5 14 0" />',
    sleepy: '<ellipse cx="55" cy="62" rx="3.5" ry="2.6" class="fill"/>',
    worried: '<path d="M47 64 q8 -6 16 0" />',
    party: '<path d="M45 58 q10 14 20 0 z" class="fill-mouth"/>',
  }[mood];
  const extra = {
    sleepy: '<text x="84" y="28" class="zzz">z</text><text x="92" y="18" class="zzz small">z</text>',
    party: '<path d="M30 14 l6 10 l-12 0 z" fill="#FFC845"/><circle cx="30" cy="12" r="3" fill="#FF6B9A"/><circle cx="92" cy="30" r="3" fill="#7C5CFF"/><circle cx="16" cy="40" r="2.5" fill="#2EC4B6"/><circle cx="96" cy="58" r="2.5" fill="#FF7A59"/>',
    worried: '<path d="M88 36 q3 6 0 8 q-3 -2 0 -8z" fill="#7CC6FE"/>',
  }[mood] || '';
  return `<svg class="mascot" width="${size}" height="${size}" viewBox="0 0 110 110" role="img" aria-label="Bidou, la mascotte">
    <defs><radialGradient id="bidouG" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#FFD3BE"/><stop offset="1" stop-color="#FF9F80"/></radialGradient></defs>
    <ellipse cx="55" cy="101" rx="30" ry="5" fill="rgba(0,0,0,.08)"/>
    <path d="M22 70 q-12 4 -10 -8" class="limb"/><path d="M88 70 q12 4 10 -8" class="limb"/>
    <path d="M42 94 v6" class="limb"/><path d="M68 94 v6" class="limb"/>
    <path d="M55 18 C82 18 94 40 92 62 C90 84 74 96 55 96 C36 96 20 84 18 62 C16 40 28 18 55 18 Z" fill="url(#bidouG)" stroke="#E86A4A" stroke-width="2.5"/>
    <ellipse cx="34" cy="64" rx="6" ry="3.6" fill="#FF7A8A" opacity=".45"/><ellipse cx="76" cy="64" rx="6" ry="3.6" fill="#FF7A8A" opacity=".45"/>
    <path d="M52 76 q3 3 6 0" stroke="#E86A4A" stroke-width="2" fill="none" stroke-linecap="round"/>
    <g class="face" stroke="#5B2E1F" stroke-width="3" fill="none" stroke-linecap="round">${eyes}${mouth}</g>
    ${extra}
  </svg>`;
}

// Échelle de Bristol : dessins simplifiés (viewBox 120x50)
const BR = '#8A5A35';
const BR_D = '#6E4527';
const BR_L = '#B07A4A';
const BRISTOL_SVG = {
  1: `<g fill="${BR}" stroke="${BR_D}" stroke-width="1.5">
      <circle cx="18" cy="28" r="7"/><circle cx="38" cy="20" r="6.5"/><circle cx="56" cy="31" r="7"/>
      <circle cx="76" cy="21" r="6.5"/><circle cx="95" cy="30" r="7"/></g>`,
  2: `<g fill="${BR}" stroke="${BR_D}" stroke-width="1.5">
      <circle cx="22" cy="26" r="10"/><circle cx="38" cy="22" r="10"/><circle cx="54" cy="28" r="10"/>
      <circle cx="70" cy="22" r="10"/><circle cx="86" cy="27" r="10"/><circle cx="99" cy="24" r="8"/></g>`,
  3: `<rect x="12" y="15" width="96" height="22" rx="11" fill="${BR}" stroke="${BR_D}" stroke-width="1.5"/>
      <g stroke="${BR_D}" stroke-width="1.6" fill="none" stroke-linecap="round">
      <path d="M30 16 l3 7 l-3 5"/><path d="M50 36 l2 -6 l-3 -5"/><path d="M68 16 l-2 8"/><path d="M86 36 l3 -7 l-2 -4"/></g>`,
  4: `<path d="M12 30 C30 10, 48 42, 66 24 S100 18, 110 26" stroke="${BR}" stroke-width="15" fill="none" stroke-linecap="round"/>
      <path d="M14 26 C30 8, 48 38, 66 20" stroke="#A9764B" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/>`,
  5: `<g fill="${BR_L}" stroke="${BR_D}" stroke-width="1.5">
      <path d="M12 32 q2 -14 14 -12 q10 2 8 12 q-2 8 -12 7 q-10 0 -10 -7z"/>
      <path d="M44 26 q4 -12 15 -8 q9 4 5 13 q-4 7 -13 5 q-9 -2 -7 -10z"/>
      <path d="M76 34 q1 -12 13 -11 q11 2 9 11 q-2 7 -12 6 q-10 -1 -10 -6z"/></g>`,
  6: `<path d="M10 32 l6 -8 l4 4 l7 -10 l5 7 l8 -6 l3 8 l9 -7 l4 9 l8 -6 l3 8 l9 -5 l2 8 l8 -3 l-2 9 l6 4 l-10 4 l-6 -3 l-8 5 l-6 -4 l-9 4 l-5 -5 l-9 4 l-6 -5 l-8 3 l-4 -5 l-8 3 z"
      fill="${BR_L}" stroke="${BR_D}" stroke-width="1.3" stroke-linejoin="round"/>`,
  7: `<path d="M14 30 q8 -12 28 -8 q12 -10 30 -4 q22 -4 34 8 q4 10 -14 12 q-12 6 -30 2 q-18 6 -32 0 q-20 0 -16 -10z" fill="#C8955F" stroke="${BR}" stroke-width="1.3" opacity=".9"/>
      <ellipse cx="44" cy="30" rx="10" ry="3" fill="#E2B886" opacity=".7"/>`,
};

export function bristolSVG(type, w = 96) {
  return `<svg class="bristol-svg" width="${w}" height="${(w * 50) / 120}" viewBox="0 0 120 50" role="img" aria-label="Bristol type ${type}">${BRISTOL_SVG[type]}</svg>`;
}

// Couleur par type de Bristol (dur = orangé, normal = vert, mou/liquide = bleu)
export const BRISTOL_COLORS = {
  1: '#C2410C', 2: '#F59E0B', 3: '#22A06B', 4: '#16A34A', 5: '#60A5FA', 6: '#3B82F6', 7: '#1E40AF',
};

// Petit dessin "toilettes" pour la fausse envie
export const FAUSSE_ENVIE_SVG = `<svg width="60" height="40" viewBox="0 0 60 40"><text x="30" y="30" text-anchor="middle" font-size="28">🚽</text></svg>`;
