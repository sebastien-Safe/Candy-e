/**
 * [ candy-e ] — MOTEUR RBAC FRONTEND
 */

export const ROLES = {
  ADMIN_CRM:      'admin_crm',
  ADMINISTRATEUR: 'administrateur',
  CADRE:          'cadre',
  MEDECIN:        'medecin',
  MEDECIN_DEMO:   'medecin_demo',
  INFIRMIERE:     'infirmiere',
  AIDE_SOIGNANTE: 'aide_soignante',
  ASH:            'ash',
  KINE:           'kine',
  PSYCHO:         'psycho',
  ERGO:           'ergo',
  SECRETAIRE:     'secretaire',
};

const _full = ['*'];

const PERMISSIONS = {
  // ── Administration ──────────────────────────────────────────
  admin_crm:      _full,
  administrateur: _full,

  // ── Cadre de santé ──────────────────────────────────────────
  cadre: [
    'patient.read', 'patient.write',
    'consultation.read',
    'ordonnance.read',
    'agenda.read', 'agenda.write',
    'note.read', 'note.write',
    'transmission.read', 'transmission.write',
    'constante.read',
    'traitement.read',
    'soin.read',
    'tournee.read',
    'stat.read',
    'admin.access',
  ],

  // ── Médecin ─────────────────────────────────────────────────
  medecin: [
    'patient.read', 'patient.write',
    'consultation.read', 'consultation.write',
    'ordonnance.read', 'ordonnance.write',
    'agenda.read', 'agenda.write',
    'note.read', 'note.write',
    'transmission.read', 'transmission.write',
    'constante.read', 'constante.write',
    'traitement.read', 'traitement.write',
    'soin.read', 'soin.write',
    'tournee.read',
    'stat.read',
  ],

  medecin_demo: [
    'patient.read',
    'consultation.read',
    'ordonnance.read',
    'agenda.read',
    'note.read',
    'transmission.read',
    'constante.read',
    'traitement.read',
    'soin.read',
  ],

  // ── Infirmier(e) ────────────────────────────────────────────
  infirmiere: [
    'patient.read', 'patient.write',
    'consultation.read',
    'ordonnance.read',
    'agenda.read',
    'note.read', 'note.write',
    'transmission.read', 'transmission.write',
    'constante.read', 'constante.write',
    'traitement.read',
    'soin.read', 'soin.write',
    'tournee.read', 'tournee.write',
  ],

  // ── Aide-soignant(e) ────────────────────────────────────────
  aide_soignante: [
    'patient.read',
    'agenda.read',
    'note.read', 'note.write',
    'transmission.read', 'transmission.write',
    'constante.read', 'constante.write',
    'tournee.read', 'tournee.write',
  ],

  // ── Kinésithérapeute ────────────────────────────────────────
  kine: [
    'patient.read',
    'consultation.read', 'consultation.write',
    'agenda.read', 'agenda.write',
    'note.read', 'note.write',
    'transmission.read', 'transmission.write',
    'constante.read', 'constante.write',
  ],

  // ── Psychologue ─────────────────────────────────────────────
  psycho: [
    'patient.read',
    'consultation.read', 'consultation.write',
    'agenda.read', 'agenda.write',
    'note.read', 'note.write',
    'transmission.read', 'transmission.write',
  ],

  // ── Ergothérapeute ──────────────────────────────────────────
  ergo: [
    'patient.read',
    'agenda.read',
    'note.read', 'note.write',
    'transmission.read', 'transmission.write',
    'constante.read', 'constante.write',
  ],

  // ── ASH ─────────────────────────────────────────────────────
  ash: [
    'patient.read',
    'agenda.read',
    'note.read',
    'transmission.read',
  ],

  // ── Secrétaire ──────────────────────────────────────────────
  secretaire: [
    'patient.read',
    'agenda.read', 'agenda.write',
    'ordonnance.read',
    'note.read',
    'transmission.read',
  ],
};

export function can(role, perm) {
  const perms = PERMISSIONS[role];
  if (!perms) return false;
  return perms.includes('*') || perms.includes(perm);
}

export function hasModule(role, moduleId) {
  return can(role, moduleId);
}

export function filterModules(role, modules) {
  return modules.filter(m => !m.permission || can(role, m.permission));
}

export function filterNav(role, items) {
  return items.filter(item => !item.permission || can(role, item.permission));
}

export const NAV_ITEMS = [
  {
    section: 'Accueil',
    items: [
      { id: 'dashboard', label: 'Tableau de bord', icon: '🏠', route: '#dashboard' },
    ],
  },
  {
    section: 'Soins EHPAD',
    items: [
      { id: 'tournee',       label: 'Tournées 24H',     icon: '🔄', route: '#tournee',       permission: 'tournee.read' },
      { id: 'transmissions', label: 'Transmissions',    icon: '💬', route: '#transmissions', permission: 'transmission.read', badge: true },
      { id: 'soins',         label: 'Soins & Pansements', icon: '🩹', route: '#soins',      permission: 'soin.read' },
      { id: 'traitements',   label: 'Traitements',      icon: '💊', route: '#traitements',  permission: 'traitement.read' },
    ],
  },
  {
    section: 'Patients',
    items: [
      { id: 'patients', label: 'Patients', icon: '👥', route: '#patients', permission: 'patient.read' },
    ],
  },
  {
    section: 'Clinique',
    items: [
      { id: 'agenda',        label: 'Agenda',        icon: '📅', route: '#agenda',        permission: 'agenda.read' },
      { id: 'consultations', label: 'Consultations', icon: '🩺', route: '#consultations', permission: 'consultation.read' },
      { id: 'ordonnances',   label: 'Ordonnances',   icon: '📋', route: '#ordonnances',   permission: 'ordonnance.read' },
    ],
  },
  {
    section: 'Administration',
    items: [
      { id: 'stats', label: 'Statistiques', icon: '📊', route: '#stats', permission: 'stat.read' },
      { id: 'admin', label: 'Administration', icon: '⚙️', route: '#admin', permission: 'admin.access' },
    ],
  },
];

export const PATIENT_TABS = [
  { id: 'etat_civil',    label: 'État civil',      icon: '🆔', permission: 'patient.read' },
  { id: 'constantes',   label: 'Constantes',       icon: '📊', permission: 'constante.read' },
  { id: 'consultations', label: 'Consultations',   icon: '🩺', permission: 'consultation.read' },
  { id: 'traitements',  label: 'Traitements',      icon: '💊', permission: 'traitement.read' },
  { id: 'soins',        label: 'Soins & Pansements', icon: '🩹', permission: 'soin.read' },
  { id: 'ordonnances',  label: 'Ordonnances',       icon: '📋', permission: 'ordonnance.read' },
  { id: 'notes',        label: 'Notes de suivi',    icon: '💬', permission: 'note.read' },
  { id: 'transmissions', label: 'Transmissions',    icon: '📣', permission: 'transmission.read' },
  { id: 'documents',    label: 'Documents',         icon: '📁', permission: 'patient.read' },
];
