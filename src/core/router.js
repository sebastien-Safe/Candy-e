/**
 * [ candy-e ] — ROUTEUR HASH SPA
 * Fichier : core/router.js
 *
 * Routeur basé sur window.location.hash.
 * Supporte les guards d'authentification et de permission.
 */

import { getRole }            from './state.js';
import { requireAuth }        from './auth.js';
import { can }                from './rbac.js';
import { setCurrentPage }     from './state.js';

// ─── Registre des routes ──────────────────────────────────────────────────────
const _routes = {};
let _notFoundHandler = null;
let _defaultRoute    = 'dashboard';

/**
 * Définir une route.
 * @param {string}   hash       - Fragment hash sans '#' (ex: 'dashboard')
 * @param {Function} handler    - Fonction async appelée à la navigation
 * @param {Object}   [opts]
 * @param {boolean}  [opts.requiresAuth=true]    - Nécessite d'être connecté
 * @param {string}   [opts.permission]           - Permission RBAC requise
 */
export function route(hash, handler, opts = {}) {
  _routes[hash] = { handler, requiresAuth: opts.requiresAuth !== false, permission: opts.permission ?? null };
}

/**
 * Gestionnaire de route introuvable (404).
 */
export function notFound(handler) {
  _notFoundHandler = handler;
}

/**
 * Définir la route par défaut (si hash vide).
 */
export function setDefaultRoute(hash) {
  _defaultRoute = hash;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

/**
 * Naviguer vers une route.
 * @param {string} hash
 */
export function navigate(hash) {
  window.location.hash = hash;
}

/**
 * Remplacer la route sans historique.
 */
export function replace(hash) {
  const url = window.location.href.split('#')[0] + '#' + hash;
  window.history.replaceState(null, '', url);
  _dispatch(hash);
}

// ─── Démarrage ────────────────────────────────────────────────────────────────

/**
 * Démarrer le routeur (écouter les changements de hash).
 */
export function startRouter() {
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '') || _defaultRoute;
    _dispatch(hash);
  });

  // Traiter la route initiale
  const initial = window.location.hash.replace('#', '') || _defaultRoute;
  _dispatch(initial);
}

// ─── Dispatch interne ─────────────────────────────────────────────────────────

async function _dispatch(hash) {
  const def = _routes[hash];

  if (!def) {
    if (_notFoundHandler) _notFoundHandler(hash);
    return;
  }

  // Guard d'authentification
  if (def.requiresAuth) {
    const ok = await requireAuth();
    if (!ok) return;
  }

  // Guard de permission RBAC
  if (def.permission) {
    const role = getRole();
    if (!can(role, def.permission)) {
      _render403();
      return;
    }
  }

  setCurrentPage(hash);

  try {
    await def.handler(hash);
  } catch (err) {
    console.error(`[candy-e] Erreur route "${hash}" :`, err);
    _renderError(err);
  }
}

// ─── Pages d'erreur inline ────────────────────────────────────────────────────

function _render403() {
  const el = document.getElementById('main-content');
  if (!el) return;
  el.innerHTML = `
    <div style="text-align:center;padding:4rem 2rem;">
      <div style="font-size:3rem;margin-bottom:1rem">🔒</div>
      <h2 style="font-size:1.5rem;font-weight:700;margin-bottom:.5rem">Accès refusé</h2>
      <p style="color:var(--color-text-muted)">
        Vous n'avez pas les droits nécessaires pour accéder à cette section.
      </p>
    </div>`;
}

function _renderError(err) {
  const el = document.getElementById('main-content');
  if (!el) return;
  el.innerHTML = `
    <div style="text-align:center;padding:4rem 2rem;">
      <div style="font-size:3rem;margin-bottom:1rem">⚠️</div>
      <h2 style="font-size:1.5rem;font-weight:700;margin-bottom:.5rem">Une erreur est survenue</h2>
      <p style="color:var(--color-text-muted);font-size:.875rem">${err?.message ?? 'Erreur inconnue'}</p>
    </div>`;
}
