/**
 * [ candy-e ] — MODULE TRANSMISSIONS CIBLÉES
 */

import { supabase }        from '../../core/supabase.client.js';
import { getRole, getProfile, addNotification } from '../../core/state.js';
import { can }             from '../../core/rbac.js';
import { formatDateTime, timeAgo } from '../../utils/date.js';
import { formatNomComplet, formatRole } from '../../utils/format.js';

const PRIORITE_STYLE = {
  normale:  { badge: 'badge--neutral',  icon: '💬' },
  urgente:  { badge: 'badge--warning',  icon: '⚠️' },
  critique: { badge: 'badge--danger',   icon: '🚨' },
};

const TYPE_LABELS = {
  observation: 'Observation',
  alerte:      'Alerte',
  consigne:    'Consigne',
  information: 'Information',
};

export async function mountTransmissions() {
  const main = document.getElementById('main-content');
  if (!main) return;

  const role     = getRole();
  const canWrite = can(role, 'transmission.write');

  main.innerHTML = `
    <div class="page-header">
      <div class="page-header__eyebrow">Communication inter-équipes</div>
      <h1 class="page-header__title">Transmissions ciblées</h1>
    </div>

    <div style="display:flex;gap:var(--space-3);margin-bottom:var(--space-5);flex-wrap:wrap;align-items:center;">
      <select class="select" id="filter-priorite" style="width:160px;">
        <option value="">Toutes priorités</option>
        <option value="critique">🚨 Critique</option>
        <option value="urgente">⚠️ Urgente</option>
        <option value="normale">💬 Normale</option>
      </select>
      <select class="select" id="filter-type" style="width:160px;">
        <option value="">Tous types</option>
        <option value="alerte">Alerte</option>
        <option value="consigne">Consigne</option>
        <option value="observation">Observation</option>
        <option value="information">Information</option>
      </select>
      <label style="display:flex;align-items:center;gap:.5rem;font-size:.875rem;color:var(--color-text-secondary);cursor:pointer;">
        <input type="checkbox" id="filter-non-lus" /> Non lues uniquement
      </label>
      ${canWrite ? `<button class="btn btn--primary" id="btn-new-transmission" style="margin-left:auto;">+ Nouvelle transmission</button>` : ''}
    </div>

    <div id="transmissions-list">
      <div style="text-align:center;padding:var(--space-6);color:var(--color-text-muted);">Chargement…</div>
    </div>

    ${canWrite ? `
    <div class="modal-backdrop hidden" id="transmission-modal">
      <div class="modal" style="max-width:560px;">
        <div class="modal__header">
          <div class="modal__title">Nouvelle transmission</div>
          <button class="modal__close" id="t-modal-close">✕</button>
        </div>
        <div class="modal__body">
          <div class="form-row">
            <div class="form-group">
              <label class="label">Patient (optionnel)</label>
              <select class="select" id="t-patient" style="width:100%;"></select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="label label--required">Type</label>
              <select class="select" id="t-type">
                <option value="observation">Observation</option>
                <option value="alerte">Alerte</option>
                <option value="consigne">Consigne</option>
                <option value="information">Information</option>
              </select>
            </div>
            <div class="form-group">
              <label class="label label--required">Priorité</label>
              <select class="select" id="t-priorite">
                <option value="normale">Normale</option>
                <option value="urgente">Urgente</option>
                <option value="critique">Critique</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="label">Destinataire (rôle)</label>
            <select class="select" id="t-cible">
              <option value="">Toute l'équipe</option>
              <option value="medecin">Médecin</option>
              <option value="infirmiere">Infirmier(e)</option>
              <option value="aide_soignante">Aide-soignant(e)</option>
              <option value="kine">Kinésithérapeute</option>
              <option value="psycho">Psychologue</option>
              <option value="cadre">Cadre de santé</option>
            </select>
          </div>
          <div class="form-group">
            <label class="label label--required">Contenu</label>
            <textarea class="textarea" id="t-contenu" rows="4" placeholder="Saisir la transmission…"></textarea>
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--outline" id="t-cancel">Annuler</button>
          <button class="btn btn--primary" id="t-save">Enregistrer</button>
        </div>
      </div>
    </div>` : ''}
  `;

  await _loadTransmissions();
  _bindEvents(canWrite);
}

async function _loadTransmissions() {
  const el = document.getElementById('transmissions-list');
  if (!el) return;

  const priorite  = document.getElementById('filter-priorite')?.value;
  const type      = document.getElementById('filter-type')?.value;
  const nonLus    = document.getElementById('filter-non-lus')?.checked;

  let query = supabase
    .from('transmissions')
    .select('*, patients(nom, prenom)')
    .order('created_at', { ascending: false })
    .limit(60);

  if (priorite) query = query.eq('priorite', priorite);
  if (type)     query = query.eq('type', type);
  if (nonLus)   query = query.eq('lu', false);

  const { data, error } = await query;

  if (error) { el.innerHTML = _erreur(error.message); return; }

  if (!data?.length) {
    el.innerHTML = `
      <div class="card">
        <div class="table-empty">
          <div class="table-empty__icon">💬</div>
          <div class="table-empty__text">Aucune transmission</div>
        </div>
      </div>`;
    return;
  }

  const role     = getRole();
  const canWrite = can(role, 'transmission.write');

  el.innerHTML = data.map(t => {
    const ps = PRIORITE_STYLE[t.priorite] ?? PRIORITE_STYLE.normale;
    return `
      <div class="card mb-3 ${!t.lu ? 'transmission--unread' : ''}" data-id="${t.id}"
           style="${!t.lu ? 'border-left:3px solid var(--color-primary);' : ''}">
        <div class="card__body" style="padding:var(--space-4);">
          <div style="display:flex;align-items:flex-start;gap:var(--space-3);flex-wrap:wrap;">
            <span style="font-size:1.25rem;flex-shrink:0;">${ps.icon}</span>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap;margin-bottom:var(--space-2);">
                <span class="badge ${ps.badge}">${t.priorite}</span>
                <span class="badge badge--neutral">${TYPE_LABELS[t.type] ?? t.type}</span>
                ${t.cible_role ? `<span class="badge badge--neutral">→ ${formatRole(t.cible_role)}</span>` : ''}
                ${!t.lu ? `<span class="badge badge--primary">Nouveau</span>` : ''}
                ${t.patients ? `<span style="font-size:.8125rem;font-weight:600;">👤 ${formatNomComplet(t.patients.nom, t.patients.prenom)}</span>` : ''}
              </div>
              <p style="font-size:.9375rem;margin:0 0 var(--space-2);">${t.contenu}</p>
              <div style="font-size:.75rem;color:var(--color-text-muted);">${timeAgo(t.created_at)}</div>
            </div>
            ${canWrite && !t.lu ? `
              <button class="btn btn--ghost btn--sm btn-mark-lu" data-id="${t.id}" title="Marquer comme lu">✓ Lu</button>
            ` : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  el.querySelectorAll('.btn-mark-lu').forEach(btn => {
    btn.addEventListener('click', async () => {
      await supabase.from('transmissions').update({ lu: true }).eq('id', btn.dataset.id);
      await _loadTransmissions();
    });
  });
}

async function _saveTransmission() {
  const payload = {
    patient_id: document.getElementById('t-patient')?.value || null,
    type:       document.getElementById('t-type')?.value,
    priorite:   document.getElementById('t-priorite')?.value,
    cible_role: document.getElementById('t-cible')?.value || null,
    contenu:    document.getElementById('t-contenu')?.value.trim(),
  };

  if (!payload.contenu) {
    addNotification({ type: 'warning', title: 'Contenu requis' });
    return;
  }

  const { error } = await supabase.from('transmissions').insert(payload);
  if (error) { addNotification({ type: 'danger', title: 'Erreur', message: error.message }); return; }

  addNotification({ type: 'success', title: 'Transmission enregistrée' });
  document.getElementById('transmission-modal')?.classList.add('hidden');
  await _loadTransmissions();
}

function _bindEvents(canWrite) {
  document.getElementById('filter-priorite')?.addEventListener('change', _loadTransmissions);
  document.getElementById('filter-type')?.addEventListener('change', _loadTransmissions);
  document.getElementById('filter-non-lus')?.addEventListener('change', _loadTransmissions);

  if (!canWrite) return;

  document.getElementById('btn-new-transmission')?.addEventListener('click', async () => {
    await _loadPatientOptions();
    document.getElementById('t-contenu').value = '';
    document.getElementById('transmission-modal')?.classList.remove('hidden');
  });
  document.getElementById('t-modal-close')?.addEventListener('click', () => {
    document.getElementById('transmission-modal')?.classList.add('hidden');
  });
  document.getElementById('t-cancel')?.addEventListener('click', () => {
    document.getElementById('transmission-modal')?.classList.add('hidden');
  });
  document.getElementById('t-save')?.addEventListener('click', _saveTransmission);
}

async function _loadPatientOptions() {
  const sel = document.getElementById('t-patient');
  if (!sel) return;
  const { data } = await supabase.from('patients').select('id, nom, prenom').eq('actif', true).order('nom');
  sel.innerHTML = `<option value="">— Aucun patient lié —</option>` +
    (data ?? []).map(p => `<option value="${p.id}">${formatNomComplet(p.nom, p.prenom)}</option>`).join('');
}

function _erreur(msg) {
  return `<div class="table-empty"><div class="table-empty__icon">⚠️</div><div class="table-empty__text">${msg}</div></div>`;
}
