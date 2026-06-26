/**
 * [ candy-e ] — TOPBAR
 */

import { getProfile, getTheme, setTheme, toggleSidebar, subscribe } from '../core/state.js';
import { logout }       from '../core/auth.js';
import { formatRole }   from '../utils/format.js';
import { formatDateLong } from '../utils/date.js';

export function mountTopbar() {
  const el = document.getElementById('topbar');
  if (!el) return;

  _render(el);
  subscribe('profile', () => _render(el));

  const saved = localStorage.getItem('candy-theme') ?? 'light';
  document.documentElement.setAttribute('data-theme', saved);
}

function _render(el) {
  const profile = getProfile();
  const theme   = getTheme();
  const today   = formatDateLong(new Date());

  el.innerHTML = `
    <div class="topbar__left">
      <button class="btn btn--ghost btn--icon" id="btn-toggle-sidebar" aria-label="Menu">☰</button>
      <div class="topbar__date" style="font-size:.8125rem;color:var(--color-text-muted);">${today}</div>
    </div>
    <div class="topbar__right">
      <div style="display:flex;align-items:center;gap:.5rem;font-size:.75rem;color:var(--color-text-muted);
                  background:var(--color-surface-raised);padding:4px 10px;border-radius:999px;
                  border:1px solid var(--color-border);">
        <span class="status-dot" aria-hidden="true"></span>
        Supabase Cloud
      </div>
      <button class="btn btn--ghost btn--icon" id="btn-theme-toggle"
              aria-label="${theme === 'dark' ? 'Mode clair' : 'Mode sombre'}">
        ${theme === 'dark' ? '☀️' : '🌙'}
      </button>
      ${profile ? _renderUserChip(profile) : ''}
    </div>
  `;

  el.querySelector('#btn-toggle-sidebar')?.addEventListener('click', toggleSidebar);
  el.querySelector('#btn-theme-toggle')?.addEventListener('click', () => {
    setTheme(getTheme() === 'dark' ? 'light' : 'dark');
    _render(el);
  });
  el.querySelector('#btn-logout')?.addEventListener('click', async () => {
    if (confirm('Voulez-vous vraiment vous déconnecter ?')) await logout();
  });
}

function _renderUserChip(profile) {
  const initiales = `${(profile.prenom?.[0] ?? '?').toUpperCase()}${(profile.nom?.[0] ?? '').toUpperCase()}`;
  return `
    <div style="display:flex;align-items:center;gap:.5rem;padding:.375rem .75rem;border-radius:.75rem;
                border:1px solid var(--color-border);background:var(--color-surface-raised);">
      <div style="width:28px;height:28px;border-radius:50%;background:var(--color-primary);
                  display:flex;align-items:center;justify-content:center;
                  color:#fff;font-weight:700;font-size:.6875rem;flex-shrink:0;">
        ${initiales}
      </div>
      <div style="display:flex;flex-direction:column;line-height:1.2;">
        <span style="font-size:.8125rem;font-weight:600;">${profile.prenom ?? ''} ${profile.nom ?? ''}</span>
        <span style="font-size:.6875rem;color:var(--color-text-muted);">${formatRole(profile.role)}</span>
      </div>
      <button id="btn-logout" class="btn btn--ghost btn--icon"
              style="width:24px;height:24px;font-size:.8rem;color:var(--color-text-muted);"
              aria-label="Se déconnecter" title="Se déconnecter">↪</button>
    </div>`;
}
