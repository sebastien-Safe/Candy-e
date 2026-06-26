/**
 * [ candy-e ] — TOPBAR
 * Fichier : layout/topbar.js
 *
 * Barre supérieure : bouton sidebar, recherche, thème, profil, déconnexion.
 */

import { getProfile, getTheme, setTheme, toggleSidebar } from '../core/state.js';
import { logout }                                          from '../core/auth.js';
import { formatRole }                                      from '../utils/format.js';
import { formatDateLong }                                  from '../utils/date.js';

// ─── Monte ────────────────────────────────────────────────────────────────────

export function mountTopbar() {
  const el = document.getElementById('topbar');
  if (!el) return;

  _render(el);

  // Ré-initialise le thème depuis localStorage au montage
  const saved = localStorage.getItem('candy-theme') ?? 'light';
  document.documentElement.setAttribute('data-theme', saved);
}

// ─── Rendu ────────────────────────────────────────────────────────────────────

function _render(el) {
  const profile = getProfile();
  const theme   = getTheme();
  const today   = formatDateLong(new Date());

  el.innerHTML = `
    <!-- Gauche : toggle sidebar + date -->
    <div class="topbar__left">
      <button class="btn btn--ghost btn--icon" id="btn-toggle-sidebar" aria-label="Ouvrir/fermer la navigation">
        ☰
      </button>
      <div class="topbar__date" style="font-size:.8125rem;color:var(--color-text-muted);">
        ${today}
      </div>
    </div>

    <!-- Droite : statut serveur, thème, profil, logout -->
    <div class="topbar__right">

      <!-- Indicateur serveur local -->
      <div style="display:flex;align-items:center;gap:.5rem;
                  font-size:.75rem;color:var(--color-text-muted);
                  background:var(--color-surface-raised);
                  padding:4px 10px;border-radius:999px;
                  border:1px solid var(--color-border);"
           role="status" aria-live="polite">
        <span class="status-dot" aria-hidden="true"></span>
        Serveur local
      </div>

      <!-- Bascule thème jour/nuit -->
      <button class="btn btn--ghost btn--icon"
              id="btn-theme-toggle"
              aria-label="${theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}">
        ${theme === 'dark' ? '☀️' : '🌙'}
      </button>

      <!-- Chip profil -->
      ${profile ? _renderUserChip(profile) : ''}
    </div>
  `;

  // Événements
  el.querySelector('#btn-toggle-sidebar')?.addEventListener('click', toggleSidebar);

  el.querySelector('#btn-theme-toggle')?.addEventListener('click', () => {
    const current = getTheme();
    setTheme(current === 'dark' ? 'light' : 'dark');
    _render(el); // Re-render pour mettre à jour l'icône
  });

  el.querySelector('#btn-logout')?.addEventListener('click', async () => {
    if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
      await logout();
    }
  });
}

// ─── Chip utilisateur ─────────────────────────────────────────────────────────

function _renderUserChip(profile) {
  const initiales = `${(profile.prenom?.[0] ?? '').toUpperCase()}${(profile.nom?.[0] ?? '').toUpperCase()}`;
  return `
    <div style="display:flex;align-items:center;gap:.5rem;
                padding:.375rem .75rem;border-radius:.75rem;
                border:1px solid var(--color-border);
                background:var(--color-surface-raised);cursor:default;">
      <div style="
        width:28px;height:28px;border-radius:50%;
        background:var(--color-primary);
        display:flex;align-items:center;justify-content:center;
        color:#fff;font-weight:700;font-size:.6875rem;flex-shrink:0;">
        ${initiales}
      </div>
      <div style="display:flex;flex-direction:column;line-height:1.2;">
        <span style="font-size:.8125rem;font-weight:600;">${profile.prenom} ${profile.nom}</span>
        <span style="font-size:.6875rem;color:var(--color-text-muted);">${formatRole(profile.role)}</span>
      </div>
      <button id="btn-logout"
              class="btn btn--ghost btn--icon"
              style="width:24px;height:24px;font-size:.8rem;color:var(--color-text-muted);"
              aria-label="Se déconnecter"
              title="Se déconnecter">
        ↪
      </button>
    </div>`;
}
