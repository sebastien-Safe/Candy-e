/**
 * [ candy-e ] — SERVICE D'AUTHENTIFICATION
 * Fichier : core/auth.js
 *
 * Centralise toutes les opérations d'authentification Supabase.
 * Synchronise automatiquement user + profile dans le state global.
 */

import { supabase }                    from './supabase.client.js';
import { setUser, setProfile, setState } from './state.js';

// ─── Initialisation ───────────────────────────────────────────────────────────

/**
 * À appeler au démarrage de l'app.
 * Restaure la session existante et écoute les changements d'état auth.
 */
export async function initAuth() {
  // Restaurer la session persistée (localStorage)
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await _syncUserState(session.user);
  }

  // Écouter les changements d'état (login, logout, refresh token)
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

/**
 * Connexion par email / mot de passe.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import('@supabase/supabase-js').User>}
 */
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

/**
 * Déconnexion — nettoie le state et redirige vers la page de login.
 */
export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  setUser(null);
  setProfile(null);
  window.location.href = '/login.html';
}

/**
 * Récupère la session courante.
 * @returns {Promise<import('@supabase/supabase-js').Session|null>}
 */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

/**
 * Récupère l'utilisateur courant depuis Supabase Auth.
 * @returns {Promise<import('@supabase/supabase-js').User|null>}
 */
export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

// ─── Guard de route ───────────────────────────────────────────────────────────

/**
 * Vérifie qu'une session active existe.
 * Redirige vers /login.html si l'utilisateur n'est pas connecté.
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

/**
 * Redirige vers le dashboard si une session existe déjà.
 * À utiliser sur la page de login.
 */
export async function redirectIfAuthenticated() {
  const session = await getSession();
  if (session) {
    window.location.href = '/index.html';
  }
}

// ─── Interne ──────────────────────────────────────────────────────────────────

/**
 * Synchronise l'utilisateur et son profil dans le state global.
 * @param {import('@supabase/supabase-js').User} user
 */
async function _syncUserState(user) {
  setUser(user);

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, role, nom, prenom, service, actif')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('[candy-e] Impossible de charger le profil :', error.message);
    return;
  }

  if (!profile?.actif) {
    console.warn('[candy-e] Compte désactivé — déconnexion forcée.');
    await logout();
    return;
  }

  setProfile(profile);
}
