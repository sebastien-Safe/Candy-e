/**
 * [ candy-e ] — MOTEUR RBAC FRONTEND
 * Rôles : admin_crm, medecin, secretaire, medecin_demo
 */

export const ROLES = {
  ADMIN_CRM:      'admin_crm',
  ADMINISTRATEUR: 'administrateur',
  MEDECIN:        'medecin',
  MEDECIN_DEMO:   'medecin_demo',
  CADRE:          'cadre',
  INFIRMIERE:     'infirmiere',
  AIDE_SOIGNANTE: 'aide_soignante',
  ASH:            'ash',
  KINE:           'kine',
  PSYCHO:         'psycho',
  ERGO:           'ergo',
  SECRETAIRE:     'secretaire',
};

const _full = [
  'patient.read', 'patient.write',
  'consultation.read', 'consultation.write',
  'ordonnance.read', 'ordonnance.write',
  'agenda.read', 'agenda.write',
  'document.read', 'document.write',
  'note.read', 'note.write',
  'stats',
];

const PERMISSIONS = {
  admin_crm:      ['*'],
  administrateur: ['*'],

  medecin:        _full,
  medecin_demo:   ['patient.read', 'consultation.read', 'ordonnance.read', 'agenda.read', 'document.read', 'note.read', 'stats'],

  cadre: [
    'patient.read', 'patient.write',
    'consultation.read',
    'ordonnance.read',
    'agenda.read', 'agenda.write',
    'document.read',
    'note.read', 'note.write',
    'stats',
  ],

  infirmiere: [
    'patient.read', 'patient.write',
    'consultation.read',
    'ordonnance.read',
    'agenda.read',
    'document.read',
    'note.read', 'note.write',
  ],

  aide_soignante: [
    'patient.read',
    'agenda.read',
    'note.read', 'note.write',
  ],

  ash: [
    'patient.read',
    'agenda.read',
    'note.read',
  ],

  kine: [
    'patient.read',
    'consultation.read',
    'agenda.read',
    'note.read', 'note.write',
  ],

  psycho: [
    'patient.read',
    'consultation.read',
    'agenda.read',
    'note.read', 'note.write',
  ],

  ergo: [
    'patient.read',
    'agenda.read',
    'note.read',
  ],

  secretaire: [
    'patient.read',
    'agenda.read', 'agenda.write',
    'ordonnance.read',
    'document.read',
    'note.read',
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
      { id: 'admin', label: 'Administration', icon: '⚙️', route: '#admin', permission: 'admin.access' },
    ],
  },
];

export const PATIENT_TABS = [
  { id: 'etat_civil',    label: 'État civil',     icon: '🆔', permission: 'patient.read' },
  { id: 'consultations', label: 'Consultations',  icon: '🩺', permission: 'consultation.read' },
  { id: 'ordonnances',   label: 'Ordonnances',    icon: '📋', permission: 'ordonnance.read' },
  { id: 'documents',     label: 'Documents',      icon: '📁', permission: 'document.read' },
  { id: 'notes',         label: 'Notes de suivi', icon: '💬', permission: 'note.read' },
];
