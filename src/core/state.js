/**
 * [ candy-e ] — ÉTAT GLOBAL (State Management)
 * Fichier : core/state.js
 *
 * Store réactif minimal — pas de dépendance externe.
 * Pattern Observer : les composants s'abonnent aux changements.
 */

// ─── Store interne ─────────────────────────────────────────────────────────────
const _state = {
  user:        null,    // Objet auth.users de Supabase
  profile:     null,    // Objet public.profiles (contient le rôle)
  currentPage: null,    // Route active (ex: 'dashboard', 'patients')
  currentPatientId: null, // UUID du patient en cours de consultation
  sidebarOpen: false,   // État de la sidebar sur mobile
  theme:       localStorage.getItem('candy-theme') || 'light',
  loading:     false,   // Indicateur de chargement global
  notifications: [],    // File de notifications/toasts
};

// Abonnés par clé de propriété
const _subscribers = {};

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * Lire une valeur du state.
 * @param {string} key
 * @returns {*}
 */
export function getState(key) {
  return _state[key];
}

/**
 * Modifier une valeur et notifier les abonnés.
 * @param {string} key
 * @param {*} value
 */
export function setState(key, value) {
  const prev = _state[key];
  _state[key] = value;
  if (_subscribers[key]) {
    _subscribers[key].forEach(fn => fn(value, prev));
  }
  // Notifier les abonnés '*' (tous changements)
  if (_subscribers['*']) {
    _subscribers['*'].forEach(fn => fn({ key, value, prev }));
  }
}

/**
 * S'abonner aux changements d'une clé.
 * @param {string} key  - Clé ou '*' pour tout écouter
 * @param {Function} fn - Callback(newValue, prevValue)
 * @returns {Function}  - Fonction de désabonnement
 */
export function subscribe(key, fn) {
  if (!_subscribers[key]) _subscribers[key] = [];
  _subscribers[key].push(fn);
  return () => {
    _subscribers[key] = _subscribers[key].filter(f => f !== fn);
  };
}

// ─── Helpers sémantiques ──────────────────────────────────────────────────────

export function getUser()    { return _state.user; }
export function getProfile() { return _state.profile; }
export function getRole()    { return sessionStorage.getItem('candy_demo_role') || _state.profile?.role || null; }
export function isDemoMode() { return !!sessionStorage.getItem('candy_demo_role'); }

export function setUser(user)       { setState('user', user); }
export function setProfile(profile) { setState('profile', profile); }

export function setLoading(v)  { setState('loading', v); }
export function isLoading()    { return _state.loading; }

export function getTheme()     { return _state.theme; }
export function setTheme(t) {
  setState('theme', t);
  localStorage.setItem('candy-theme', t);
  document.documentElement.setAttribute('data-theme', t);
}

export function getCurrentPage() { return _state.currentPage; }
export function setCurrentPage(p) { setState('currentPage', p); }

export function getSidebarOpen()   { return _state.sidebarOpen; }
export function toggleSidebar()    { setState('sidebarOpen', !_state.sidebarOpen); }
export function setSidebarOpen(v)  { setState('sidebarOpen', v); }

export function getCurrentPatientId() { return _state.currentPatientId; }
export function setCurrentPatientId(id) { setState('currentPatientId', id); }

// ─── Notifications internes ───────────────────────────────────────────────────

/**
 * Ajouter une notification à la file.
 * @param {{ type: 'success'|'warning'|'danger'|'info', title: string, message?: string, duration?: number }} notif
 */
export function addNotification(notif) {
  const id = crypto.randomUUID();
  const item = { id, duration: 4000, ...notif };
  const current = [..._state.notifications, item];
  setState('notifications', current);
  return id;
}

export function removeNotification(id) {
  setState('notifications', _state.notifications.filter(n => n.id !== id));
}

export function getNotifications() { return _state.notifications; }
