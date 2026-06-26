/**
 * [ candy-e ] — MOTEUR RBAC FRONTEND
 * Rôles : admin_crm, medecin, secretaire, medecin_demo
 */

export const ROLES = {
  ADMIN_CRM:    'admin_crm',
  MEDECIN:      'medecin',
  SECRETAIRE:   'secretaire',
  MEDECIN_DEMO: 'medecin_demo',
};

const PERMISSIONS = {
  admin_crm: ['*'],

  medecin: [
    'patient.read', 'patient.write',
    'consultation.read', 'consultation.write',
    'ordonnance.read', 'ordonnance.write',
    'agenda.read', 'agenda.write',
    'document.read', 'document.write',
    'note.read', 'note.write',
    'stats',
  ],

  secretaire: [
    'patient.read',
    'agenda.read', 'agenda.write',
    'ordonnance.read',
    'document.read',
    'note.read',
  ],

  medecin_demo: [
    'patient.read',
    'consultation.read',
    'ordonnance.read',
    'agenda.read',
    'document.read',
    'note.read',
    'stats',
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
