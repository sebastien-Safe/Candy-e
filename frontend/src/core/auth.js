/**
 * [ candy-e ] — SERVICE D'AUTHENTIFICATION
 */

import { supabase }                from './supabase.client.js';
import { setUser, setProfile }     from './state.js';

// ─── Initialisation ───────────────────────────────────────────────────────────

export async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await _syncUserState(session.user);
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      await _syncUserState(session.user);
    }
    if (event === 'SIGNED_OUT') {
      setUser(null);
      setProfile(null);
    }
    if (event === 'TOKEN_REFRESHED' && session?.user) {
      setUser(session.user);
    }
  });
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function logout() {
  await supabase.auth.signOut().catch(() => {});
  setUser(null);
  setProfile(null);
  sessionStorage.removeItem('candy_demo_role');
  window.location.replace('login.html?fresh=1');
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

// ─── Guards de route ──────────────────────────────────────────────────────────

/**
 * Vérifie qu'une session active existe.
 * Si absent → redirige vers login?fresh=1 (déconnexion propre garantie, pas de boucle).
 */
export async function requireAuth() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return true;
  } catch {
    // erreur réseau
  }
  window.location.replace('login.html?fresh=1');
  return false;
}

/**
 * Sur la page login : redirige si déjà connecté.
 * ?fresh=1 → déconnecte toujours (démarrage propre).
 */
export async function redirectIfAuthenticated() {
  if (new URLSearchParams(window.location.search).get('fresh') === '1') {
    await supabase.auth.signOut().catch(() => {});
    window.history.replaceState({}, '', window.location.pathname);
    return;
  }
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const email = session.user?.email?.toLowerCase() ?? '';
    if (email === 'emilie@safe-digitalisation.fr') {
      window.location.replace('role-select.html');
    } else {
      window.location.replace('index.html');
    }
  } catch {
    await supabase.auth.signOut().catch(() => {});
  }
}

// ─── Interne ──────────────────────────────────────────────────────────────────

async function _syncUserState(user) {
  setUser(user);

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, role, nom, prenom, specialite, actif')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('[candy-e] Profil introuvable :', error.message);
    return;
  }

  if (!profile?.actif) {
    console.warn('[candy-e] Compte désactivé — déconnexion.');
    await logout();
    return;
  }

  setProfile(profile);
}
