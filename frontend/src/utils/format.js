/**
 * [ candy-e ] — UTILITAIRES DE FORMATAGE
 */

export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function formatNomComplet(nom, prenom) {
  return `${(nom ?? '').toUpperCase()} ${capitalize(prenom ?? '')}`.trim();
}

export function formatNIR(nir) {
  if (!nir) return '—';
  const n = String(nir).replace(/\s/g, '');
  return n.replace(/^(\d)(\d{2})(\d{2})(\d{2})(\d{3})(\d{3})(\d{2})$/, '$1 $2 $3 $4 $5 $6 $7');
}

export function formatTel(tel) {
  if (!tel) return '—';
  return String(tel).replace(/\D/g, '').replace(/(\d{2})(?=\d)/g, '$1 ').trim();
}

export function formatVitale(value, unit) {
  if (value == null) return '—';
  return `${Number(value).toLocaleString('fr-FR')} ${unit}`;
}

export function formatGIR(niveau) {
  const labels = {
    1: 'GIR 1 — Totalement dépendant', 2: 'GIR 2 — Très dépendant',
    3: 'GIR 3 — Dépendant', 4: 'GIR 4 — Partiellement dépendant',
    5: 'GIR 5 — Peu dépendant', 6: 'GIR 6 — Autonome',
  };
  return labels[niveau] ?? `GIR ${niveau}`;
}

export function girIcon(niveau) {
  if (!niveau) return '';
  if (niveau <= 2) return '🔴';
  if (niveau <= 4) return '🟠';
  return '🟢';
}

export function truncate(str, n = 80) {
  if (!str || str.length <= n) return str ?? '';
  return str.slice(0, n).trimEnd() + '…';
}

export function orDash(value) {
  if (value == null || value === '') return '—';
  return value;
}

export function formatRole(role) {
  const labels = {
    admin_crm:    'Administrateur',
    medecin:      'Médecin',
    secretaire:   'Secrétaire',
    medecin_demo: 'Médecin (démo)',
    administrateur: 'Administrateur',
    cadre:        'Cadre de santé',
    infirmiere:   'IDE',
    aide_soignante: 'Aide-soignante',
    ash:          'ASH',
    kine:         'Kinésithérapeute',
    psycho:       'Psychologue',
    ergo:         'Ergothérapeute',
  };
  return labels[role] ?? capitalize(role ?? '');
}
