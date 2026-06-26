/**
 * [ candy-e ] — MOTEUR RBAC FRONTEND
 * Fichier : core/rbac.js
 *
 * Gère les permissions d'affichage côté client.
 * NOTE CRITIQUE : La sécurité réelle repose sur la RLS PostgreSQL (02_rls_policies.sql).
 * Ce fichier contrôle uniquement l'affichage (menus, boutons, onglets).
 * Un attaquant peut contourner le JS — jamais les politiques SQL.
 */

// ─── Rôles disponibles ────────────────────────────────────────────────────────
export const ROLES = {
  ADMINISTRATEUR:  'administrateur',
  CADRE:           'cadre',
  INFIRMIERE:      'infirmiere',
  AIDE_SOIGNANTE:  'aide_soignante',
  ASH:             'ash',
  MEDECIN:         'medecin',
  KINE:            'kine',
  PSYCHO:          'psycho',
  ERGO:            'ergo',
};

// ─── Matrice de permissions par module ───────────────────────────────────────
// Chaque clé est un identifiant de fonctionnalité ou de module.
// La valeur '*' signifie accès complet (admin uniquement).
const PERMISSIONS = {
  administrateur: ['*'],

  cadre: [
    'kpi', 'alerts', 'agenda', 'stats',
    'etat_civil', 'constantes', 'allergies', 'antecedents',
    'gir', 'pathos', 'directives', 'protocoles',
    'transmissions', 'traitements', 'pansements',
    'patient.read', 'patient.write',
    'transmission.read', 'transmission.write',
    'traitement.read', 'traitement.write',
  ],

  infirmiere: [
    'kpi', 'alerts', 'agenda',
    'etat_civil', 'constantes', 'allergies', 'antecedents',
    'gir', 'pathos', 'directives', 'protocoles',
    'transmissions', 'traitements', 'pansements',
    'patient.read', 'patient.write',
    'transmission.read', 'transmission.write',
    'traitement.read', 'traitement.write',
  ],

  aide_soignante: [
    'kpi', 'alerts', 'agenda',
    'constantes', 'allergies', 'antecedents',
    'gir', 'directives',
    'transmissions',
    'patient.read',
    'transmission.read', 'transmission.write',
  ],

  ash: [
    'agenda',
    'gir',
    'transmissions',
    'transmission.read', 'transmission.write',
  ],

  medecin: [
    'kpi', 'alerts', 'agenda', 'stats',
    'etat_civil', 'constantes', 'allergies', 'antecedents',
    'gir', 'pathos', 'directives', 'protocoles',
    'transmissions', 'traitements', 'pansements',
    'patient.read', 'patient.write',
    'transmission.read', 'transmission.write',
    'traitement.read', 'traitement.write',
  ],

  kine: [
    'kpi', 'agenda',
    'constantes', 'allergies',
    'gir',
    'transmissions',
    'patient.read',
    'transmission.read', 'transmission.write',
  ],

  psycho: [
    'agenda',
    'etat_civil', 'antecedents',
    'gir', 'pathos', 'directives',
    'transmissions',
    'patient.read',
    'transmission.read', 'transmission.write',
  ],

  ergo: [
    'agenda',
    'gir',
    'transmissions',
    'patient.read',
    'transmission.read',
  ],
};

// ─── Fonctions d'accès ────────────────────────────────────────────────────────

/**
 * Vérifie si un rôle possède une permission.
 * @param {string} role   - Rôle de l'utilisateur (ex: 'cadre')
 * @param {string} perm   - Permission à vérifier (ex: 'patient.write')
 * @returns {boolean}
 */
export function can(role, perm) {
  const perms = PERMISSIONS[role];
  if (!perms) return false;
  return perms.includes('*') || perms.includes(perm);
}

/**
 * Retourne true si le rôle a accès à un module donné.
 * Alias lisible de can() pour les modules.
 */
export function hasModule(role, moduleId) {
  return can(role, moduleId);
}

/**
 * Filtre une liste de définitions de modules selon le rôle.
 * @param {string} role
 * @param {Array<{id: string, ...}>} modules
 * @returns {Array}
 */
export function filterModules(role, modules) {
  return modules.filter(m => !m.permission || can(role, m.permission));
}

/**
 * Filtre les items de navigation selon le rôle.
 * @param {string} role
 * @param {Array<{permission?: string, ...}>} items
 * @returns {Array}
 */
export function filterNav(role, items) {
  return items.filter(item => !item.permission || can(role, item.permission));
}

// ─── Configuration navigation (source unique de vérité) ──────────────────────
export const NAV_ITEMS = [
  {
    section: 'Dossier Patient',
    items: [
      { id: 'etat_civil',   label: 'État civil',         icon: '🆔', route: '#etat-civil',   permission: 'etat_civil' },
      { id: 'constantes',   label: 'Constantes',         icon: '🩺', route: '#constantes',   permission: 'constantes' },
      { id: 'allergies',    label: 'Allergies',          icon: '⚠️', route: '#allergies',    permission: 'allergies' },
      { id: 'antecedents',  label: 'Antécédents',        icon: '📜', route: '#antecedents',  permission: 'antecedents' },
      { id: 'gir',          label: 'GIR / Dépendance',   icon: '🧓', route: '#gir',          permission: 'gir' },
      { id: 'pathos',       label: 'Pathologies',        icon: '🧠', route: '#pathos',        permission: 'pathos' },
      { id: 'directives',   label: 'Directives anticipées', icon: '✍️', route: '#directives', permission: 'directives' },
      { id: 'protocoles',   label: 'Protocoles',         icon: '📋', route: '#protocoles',   permission: 'protocoles' },
    ],
  },
  {
    section: 'Activité Métier',
    items: [
      { id: 'transmissions', label: 'Transmissions', icon: '💬', route: '#transmissions', permission: 'transmissions', badge: true },
      { id: 'traitements',   label: 'Traitements',   icon: '💊', route: '#traitements',   permission: 'traitements' },
      { id: 'pansements',    label: 'Soins & Pansements', icon: '🩹', route: '#pansements', permission: 'pansements' },
    ],
  },
  {
    section: 'Pilotage',
    items: [
      { id: 'stats', label: 'Statistiques', icon: '📊', route: '#stats', permission: 'stats' },
    ],
  },
  {
    section: 'Administration',
    items: [
      { id: 'admin', label: 'Gestion utilisateurs', icon: '⚙️', route: '#admin', permission: 'admin.access' },
    ],
  },
];

// ─── Configuration des onglets de la fiche patient ────────────────────────────
export const PATIENT_TABS = [
  { id: 'etat_civil',   label: 'État civil',       icon: '🆔', permission: 'etat_civil' },
  { id: 'constantes',   label: 'Constantes',       icon: '🩺', permission: 'constantes' },
  { id: 'allergies',    label: 'Allergies',        icon: '⚠️', permission: 'allergies' },
  { id: 'antecedents',  label: 'Antécédents',      icon: '📜', permission: 'antecedents' },
  { id: 'gir',          label: 'GIR',              icon: '🧓', permission: 'gir' },
  { id: 'pathos',       label: 'Pathologies',      icon: '🧠', permission: 'pathos' },
  { id: 'directives',   label: 'Directives',       icon: '✍️', permission: 'directives' },
  { id: 'protocoles',   label: 'Protocoles',       icon: '📋', permission: 'protocoles' },
  { id: 'transmissions',label: 'Transmissions',    icon: '💬', permission: 'transmissions' },
  { id: 'traitements',  label: 'Traitements',      icon: '💊', permission: 'traitements' },
  { id: 'pansements',   label: 'Soins & Pansements', icon: '🩹', permission: 'pansements' },
];
