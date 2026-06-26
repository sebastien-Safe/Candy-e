/**
 * [ candy-e ] — SIDEBAR
 * Fichier : layout/sidebar.js
 *
 * Génère la navigation latérale dynamiquement selon le rôle RBAC.
 * Se met à jour automatiquement quand le profil change dans le state.
 */

import { getRole, getProfile, subscribe, getSidebarOpen, toggleSidebar } from '../core/state.js';
import { filterNav, NAV_ITEMS }                                           from '../core/rbac.js';
import { navigate }                                                        from '../core/router.js';
import { formatRole }                                                      from '../utils/format.js';

// ─── Rendu ────────────────────────────────────────────────────────────────────

/**
 * Monte la sidebar dans #sidebar et la reactive.
 */
export function mountSidebar() {
  const el = document.getElementById('sidebar');
  if (!el) return;

  _render(el);

  // Re-render quand le profil change (connexion)
  subscribe('profile', () => _render(el));

  // Re-render quand la route change (item actif)
  subscribe('currentPage', () => _render(el));

  // Sync état ouvert/fermé mobile
  subscribe('sidebarOpen', (open) => {
    el.classList.toggle('open', open);
    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) overlay.classList.toggle('visible', open);
  });

  // Fermer la sidebar en cliquant sur l'overlay (mobile)
  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) {
    overlay.addEventListener('click', () => toggleSidebar());
  }
}

// ─── Rendu interne ────────────────────────────────────────────────────────────

function _render(el) {
  const role    = getRole();
  const profile = getProfile();
  const currentPage = window.location.hash.replace('#', '') || 'dashboard';

  el.innerHTML = `
    <!-- Marque -->
    <div class="sidebar__brand">
      <div class="sidebar__logo" aria-hidden="true">ce</div>
      <div>
        <div class="sidebar__app-name">[ <span>candy-e</span> ]</div>
      </div>
    </div>

    <!-- Navigation filtrée par rôle -->
    <nav class="sidebar__nav" aria-label="Navigation principale">
      ${_renderNav(role, currentPage)}
    </nav>

    <!-- Profil utilisateur en bas -->
    ${profile ? _renderProfile(profile) : ''}
  `;

  // Attacher les événements de navigation
  el.querySelectorAll('.nav-item[data-route]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(item.dataset.route);
      // Fermer la sidebar sur mobile après navigation
      if (getSidebarOpen()) toggleSidebar();
    });
  });
}

// ─── Blocs HTML ───────────────────────────────────────────────────────────────

function _renderNav(role, currentPage) {
  return NAV_ITEMS.map(section => {
    const visibleItems = filterNav(role, section.items);
    if (!visibleItems.length) return '';

    const itemsHtml = visibleItems.map(item => {
      const isActive = currentPage === item.route.replace('#', '');
      return `
        <a class="nav-item ${isActive ? 'active' : ''}"
           data-route="${item.route.replace('#', '')}"
           href="${item.route}"
           role="menuitem"
           aria-current="${isActive ? 'page' : 'false'}">
          <span class="nav-item__icon" aria-hidden="true">${item.icon}</span>
          <span class="nav-item__label">${item.label}</span>
          ${item.badge ? `<span class="nav-item__badge" id="badge-${item.id}" aria-live="polite"></span>` : ''}
        </a>`;
    }).join('');

    return `
      <div class="nav-section-label">${section.section}</div>
      ${itemsHtml}
      <div class="nav-separator" role="separator" aria-hidden="true"></div>`;
  }).join('');
}

function _renderProfile(profile) {
  const initiales = `${(profile.prenom?.[0] ?? '').toUpperCase()}${(profile.nom?.[0] ?? '').toUpperCase()}`;
  return `
    <div class="sidebar__footer">
      <div class="flex items-center gap-3">
        <div style="
          width:32px;height:32px;border-radius:50%;
          background:var(--color-primary);
          display:flex;align-items:center;justify-content:center;
          color:#fff;font-weight:700;font-size:.75rem;flex-shrink:0;">
          ${initiales}
        </div>
        <div style="overflow:hidden;">
          <div class="truncate" style="font-size:.8125rem;font-weight:600;">${profile.prenom} ${profile.nom}</div>
          <div style="font-size:.75rem;color:var(--color-text-muted);">${formatRole(profile.role)}</div>
        </div>
      </div>
    </div>`;
}

// ─── Mise à jour du badge de notifications (transmissions) ───────────────────

/**
 * Mettre à jour le badge d'un item de navigation.
 * @param {string} itemId   - ID de l'item (ex: 'transmissions')
 * @param {number} count    - Nombre à afficher (0 = masque)
 */
export function updateNavBadge(itemId, count) {
  const badge = document.getElementById(`badge-${itemId}`);
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}
