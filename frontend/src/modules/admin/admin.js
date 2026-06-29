/**
 * [ candy-e ] — MODULE ADMINISTRATION
 * Accessible uniquement aux utilisateurs avec rôle admin_crm.
 */

import { supabase }             from '../../core/supabase.client.js';
import { addNotification, getRole } from '../../core/state.js';
import { formatRole }           from '../../utils/format.js';
import { formatDateTime }       from '../../utils/date.js';

export async function mountAdmin() {
  const main = document.getElementById('main-content');
  if (!main) return;

  main.innerHTML = `
    <div class="page-header">
      <div class="page-header__eyebrow">Paramètres système</div>
      <h1 class="page-header__title">Administration</h1>
    </div>

    <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-6);flex-wrap:wrap;">
      <button class="btn btn--primary btn--sm admin-tab active" data-section="users">👥 Utilisateurs</button>
      <button class="btn btn--outline btn--sm admin-tab" data-section="logs">📋 Journal d'audit</button>
    </div>

    <div id="admin-content">
      <div style="text-align:center;padding:var(--space-6);color:var(--color-text-muted);">Chargement…</div>
    </div>
  `;

  _bindTabEvents();
  await _loadSection('users');
}

function _bindTabEvents() {
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.admin-tab').forEach(b => {
        b.classList.remove('active', 'btn--primary');
        b.classList.add('btn--outline');
      });
      btn.classList.add('active', 'btn--primary');
      btn.classList.remove('btn--outline');
      await _loadSection(btn.dataset.section);
    });
  });
}

async function _loadSection(section) {
  if (section === 'users') await _loadUsers();
  if (section === 'logs')  await _loadLogs();
}

async function _loadUsers() {
  const el = document.getElementById('admin-content');
  if (!el) return;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, prenom, nom, role, specialite, actif, created_at')
    .order('created_at', { ascending: false });

  if (error) { el.innerHTML = _erreur(error.message); return; }

  const canDelete = getRole() === 'admin_crm';

  el.innerHTML = `
    <div class="card">
      <div class="card__header">
        <div class="card__title">Comptes utilisateurs</div>
        <button class="btn btn--primary btn--sm" id="btn-new-user">+ Nouvel utilisateur</button>
      </div>
      <div class="table-wrapper" style="border:none;border-radius:0;box-shadow:none;">
        <table class="table">
          <thead>
            <tr><th>Nom</th><th>E-mail</th><th>Rôle</th><th>Spécialité</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            ${!data?.length
              ? `<tr><td colspan="6"><div class="table-empty"><div class="table-empty__text">Aucun utilisateur</div></div></td></tr>`
              : data.map(u => `
                <tr>
                  <td style="font-weight:500;">${u.prenom ?? ''} ${u.nom ?? ''}</td>
                  <td style="color:var(--color-text-muted);font-size:.8125rem;">${u.email ?? '—'}</td>
                  <td><span class="badge badge--neutral">${formatRole(u.role)}</span></td>
                  <td style="color:var(--color-text-muted);font-size:.8125rem;">${u.specialite ?? '—'}</td>
                  <td><span class="badge ${u.actif ? 'badge--success' : 'badge--neutral'}">${u.actif ? 'Actif' : 'Inactif'}</span></td>
                  <td>
                    <div class="table__actions">
                      <button class="btn btn--ghost btn--sm btn-toggle-user"
                              data-id="${u.id}" data-actif="${u.actif}"
                              title="${u.actif ? 'Désactiver' : 'Activer'}">
                        ${u.actif ? '🔒' : '🔓'}
                      </button>
                      ${canDelete ? `
                      <button class="btn btn--ghost btn--sm btn-delete-user"
                              data-id="${u.id}"
                              data-nom="${(u.prenom ?? '') + ' ' + (u.nom ?? '')}"
                              title="Supprimer ce compte"
                              style="color:var(--color-danger, #e53e3e);">
                        ❌
                      </button>` : ''}
                    </div>
                  </td>
                </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal nouvel utilisateur -->
    <div class="modal-backdrop hidden" id="user-modal">
      <div class="modal">
        <div class="modal__header">
          <div class="modal__title">Nouvel utilisateur</div>
          <button class="modal__close" id="user-modal-close">✕</button>
        </div>
        <div class="modal__body">
          <div class="form-group">
            <label class="label label--required">E-mail (identifiant de connexion)</label>
            <input class="input" type="email" id="u-email" placeholder="prenom.nom@cabinet.fr" />
          </div>
          <div class="form-group">
            <label class="label label--required">Mot de passe temporaire</label>
            <input class="input" type="password" id="u-password" placeholder="Min. 6 caractères" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="label label--required">Prénom</label>
              <input class="input" type="text" id="u-prenom" />
            </div>
            <div class="form-group">
              <label class="label label--required">Nom</label>
              <input class="input" type="text" id="u-nom" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="label label--required">Rôle</label>
              <select class="select" id="u-role">
                <optgroup label="Administration">
                  <option value="admin_crm">Administrateur CRM</option>
                  <option value="administrateur">Administrateur EHPAD</option>
                  <option value="cadre">Cadre de santé</option>
                </optgroup>
                <optgroup label="Personnel médical">
                  <option value="medecin">Médecin</option>
                  <option value="medecin_demo">Médecin (démo)</option>
                  <option value="infirmiere">Infirmier(e)</option>
                  <option value="aide_soignante">Aide-soignant(e)</option>
                  <option value="kine">Kinésithérapeute</option>
                  <option value="psycho">Psychologue</option>
                  <option value="ergo">Ergothérapeute</option>
                </optgroup>
                <optgroup label="Autres">
                  <option value="ash">ASH</option>
                  <option value="secretaire">Secrétaire</option>
                </optgroup>
              </select>
            </div>
            <div class="form-group">
              <label class="label">Spécialité</label>
              <input class="input" type="text" id="u-specialite" placeholder="Ex: Cardiologie" />
            </div>
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--outline" id="u-cancel">Annuler</button>
          <button class="btn btn--primary" id="u-save">Créer le compte</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-new-user')?.addEventListener('click', () => {
    document.getElementById('user-modal')?.classList.remove('hidden');
  });
  document.getElementById('user-modal-close')?.addEventListener('click', () => {
    document.getElementById('user-modal')?.classList.add('hidden');
  });
  document.getElementById('u-cancel')?.addEventListener('click', () => {
    document.getElementById('user-modal')?.classList.add('hidden');
  });
  document.getElementById('u-save')?.addEventListener('click', _createUser);

  document.querySelectorAll('.btn-toggle-user').forEach(btn => {
    btn.addEventListener('click', async () => {
      const newActif = btn.dataset.actif === 'true' ? false : true;
      const { error } = await supabase.from('profiles').update({ actif: newActif }).eq('id', btn.dataset.id);
      if (error) { addNotification({ type: 'danger', title: 'Erreur', message: error.message }); return; }
      addNotification({ type: 'success', title: newActif ? 'Compte activé' : 'Compte désactivé' });
      await _loadUsers();
    });
  });

  document.querySelectorAll('.btn-delete-user').forEach(btn => {
    btn.addEventListener('click', () => _deleteUser(btn.dataset.id, btn.dataset.nom));
  });
}

async function _deleteUser(id, nom) {
  if (!window.confirm(`Supprimer définitivement le compte de ${nom} ?\n\nCette action est irréversible.`)) return;

  const { error } = await supabase.rpc('delete_user_by_id', { user_id: id });
  if (error) {
    addNotification({ type: 'danger', title: 'Erreur suppression', message: error.message });
    return;
  }

  addNotification({ type: 'success', title: 'Compte supprimé', message: nom });
  await _loadUsers();
}

async function _createUser() {
  const email    = document.getElementById('u-email')?.value.trim();
  const password = document.getElementById('u-password')?.value;
  const prenom   = document.getElementById('u-prenom')?.value.trim();
  const nom      = document.getElementById('u-nom')?.value.trim();
  const role     = document.getElementById('u-role')?.value;
  const specialite = document.getElementById('u-specialite')?.value.trim() || null;

  if (!email || !password || !prenom || !nom) {
    addNotification({ type: 'warning', title: 'Champs requis', message: 'E-mail, mot de passe, prénom et nom sont obligatoires.' });
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email, password,
    email_confirm: true,
    user_metadata: { prenom, nom, role, specialite },
  });

  if (error) {
    addNotification({ type: 'danger', title: 'Erreur création', message: error.message });
    return;
  }

  // Mettre à jour le profil créé par le trigger
  if (data?.user?.id) {
    await supabase.from('profiles')
      .update({ prenom, nom, role, specialite })
      .eq('id', data.user.id);
  }

  addNotification({ type: 'success', title: 'Compte créé', message: `${prenom} ${nom} (${email})` });
  document.getElementById('user-modal')?.classList.add('hidden');
  await _loadUsers();
}

async function _loadLogs() {
  const el = document.getElementById('admin-content');
  if (!el) return;

  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, action, table_name, user_role, details, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) { el.innerHTML = _erreur(error.message); return; }

  el.innerHTML = `
    <div class="card">
      <div class="card__header">
        <div class="card__title">Journal d'audit</div>
        <span style="font-size:.8125rem;color:var(--color-text-muted);">50 dernières entrées</span>
      </div>
      <div class="table-wrapper" style="border:none;border-radius:0;box-shadow:none;">
        <table class="table">
          <thead><tr><th>Date</th><th>Action</th><th>Table</th><th>Rôle</th><th>Détails</th></tr></thead>
          <tbody>
            ${!data?.length
              ? `<tr><td colspan="5"><div class="table-empty"><div class="table-empty__text">Aucune entrée</div></div></td></tr>`
              : data.map(l => `
                <tr>
                  <td style="font-size:.75rem;white-space:nowrap;">${formatDateTime(l.created_at)}</td>
                  <td><span class="badge badge--neutral">${l.action}</span></td>
                  <td style="color:var(--color-text-muted);font-size:.8125rem;">${l.table_name ?? '—'}</td>
                  <td style="font-size:.75rem;">${formatRole(l.user_role ?? '')}</td>
                  <td style="font-size:.75rem;color:var(--color-text-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;">
                    ${l.details ? JSON.stringify(l.details).slice(0, 80) : '—'}
                  </td>
                </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function _erreur(msg) {
  return `<div class="table-empty"><div class="table-empty__icon">⚠️</div><div class="table-empty__text">${msg}</div></div>`;
}
