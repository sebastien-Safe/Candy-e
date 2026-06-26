/**
 * [ candy-e ] — UTILITAIRES DE FORMATAGE
 * Fichier : utils/format.js
 */

/** Capitalise la première lettre d'une chaîne. */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/** Formate un nom complet (NOM Prénom). */
export function formatNomComplet(nom, prenom) {
  return `${(nom ?? '').toUpperCase()} ${capitalize(prenom ?? '')}`.trim();
}

/** Formate un numéro de sécurité sociale en XX XX XX XXX XXX XX. */
export function formatNIR(nir) {
  if (!nir) return '—';
  const n = String(nir).replace(/\s/g, '');
  return n.replace(/^(\d)(\d{2})(\d{2})(\d{2})(\d{3})(\d{3})(\d{2})$/, '$1 $2 $3 $4 $5 $6 $7');
}

/** Formate un numéro de téléphone français. Ex: "0612345678" → "06 12 34 56 78" */
export function formatTel(tel) {
  if (!str) return '—';
  return String(tel).replace(/\D/g, '').replace(/(\d{2})(?=\d)/g, '$1 ').trim();
}

/** Formate une valeur numérique avec unité médicale. */
export function formatVitale(value, unit) {
  if (value == null) return '—';
  return `${Number(value).toLocaleString('fr-FR')} ${unit}`;
}

/** Formate un niveau GIR. */
export function formatGIR(niveau) {
  const labels = { 1: 'GIR 1 — Totalement dépendant', 2: 'GIR 2 — Très dépendant',
    3: 'GIR 3 — Dépendant', 4: 'GIR 4 — Partiellement dépendant',
    5: 'GIR 5 — Peu dépendant', 6: 'GIR 6 — Autonome' };
  return labels[niveau] ?? `GIR ${niveau}`;
}

/** Tronque un texte à n caractères avec ellipse. */
export function truncate(str, n = 80) {
  if (!str || str.length <= n) return str ?? '';
  return str.slice(0, n).trimEnd() + '…';
}

/** Renvoie '—' si la valeur est vide/null/undefined. */
export function orDash(value) {
  if (value == null || value === '') return '—';
  return value;
}

/** Retourne le label lisible d'un rôle. */
export function formatRole(role) {
  const labels = {
    administrateur: 'Administrateur',
    cadre:          'Cadre de santé',
    infirmiere:     'IDE',
    aide_soignante: 'Aide-soignante',
    ash:            'ASH',
    medecin:        'Médecin',
    kine:           'Kinésithérapeute',
    psycho:         'Psychologue',
    ergo:           'Ergothérapeute',
  };
  return labels[role] ?? capitalize(role ?? '');
}
