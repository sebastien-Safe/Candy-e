/**
 * [ candy-e ] — MODULE SOINS & PANSEMENTS
 */

import { supabase }        from '../../core/supabase.client.js';
import { getRole, addNotification } from '../../core/state.js';
import { can }             from '../../core/rbac.js';
import { formatDateTime, todayISO } from '../../utils/date.js';
import { formatNomComplet }         from '../../utils/format.js';

const TYPE_LABELS = {
  plaie:    '🩹 Plaie aiguë',
  escarre:  '⚠️ Escarre',
  ulcere:   '🔴 Ulcère',
  stomie:   '💧 Stomie',
  catheter: '🩺 Cathéter',
  drain:    '💉 Drain',
  autre:    'Autre',
};

const STADE_LABELS = { I: 'Stade I', II: 'Stade II', III: 'Stade III', IV: 'Stade IV' };

export async function mountSoins() {
  const main = document.getElementById('main-content');
  if (!main) return;

  const role     = getRole();
  const canWrite = can(role, 'soin.write');

  main.innerHTML = `
    <div class="page-header">
      <div class="page-header__eyebrow">Suivi infirmier</div>
      <h1 class="page-header__title">Soins & Pansements</h1>
    </div>

    <div style="display:flex;gap:var(--space-3);margin-bottom:var(--space-5);flex-wrap:wrap;align-items:center;">
      <div class="input-wrapper" style="width:260px;">
        <span class="input-wrapper__icon">👤</span>
        <select class="input" id="filter-patient" style="padding-left:2.25rem;">
          <option value="">Tous les résidents</option>
        </select>
      </div>
      <select class="select" id="filter-type-soin" style="width:180px;">
        <option value="">Tous les types</option>
        ${Object.entries(TYPE_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
      </select>
      ${canWrite ? `<button class="btn btn--primary" id="btn-new-soin" style="margin-left:auto;">+ Nouveau soin</button>` : ''}
    </div>

    <div id="soins-list">
      <div style="text-align:center;padding:var(--space-6);color:var(--color-text-muted);">Chargement…</div>
    </div>

    ${canWrite ? `
    <div class="modal-backdrop hidden" id="soin-modal">
      <div class="modal" style="max-width:580px;">
        <div class="modal__header">
          <div class="modal__title">Nouveau soin / Pansement</div>
          <button class="modal__close" id="soin-modal-close">✕</button>
        </div>
        <div class="modal__body">
          <div class="form-group">
            <label class="label label--required">Résident</label>
            <select class="select" id="s-patient" style="width:100%;"></select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="label label--required">Type de soin</label>
              <select class="select" id="s-type">
                ${Object.entries(TYPE_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="label">Stade (escarre)</label>
              <select class="select" id="s-stade">
                <option value="">—</option>
                ${Object.entries(STADE_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="label">Localisation</label>
              <input class="input" type="text" id="s-localisation" placeholder="Ex: Talon droit, Sacrum…" />
            </div>
            <div class="form-group">
              <label class="label">Prochain soin</label>
              <input class="input" type="date" id="s-prochain" />
            </div>
          </div>
          <div class="form-group">
            <label class="label label--required">Description / Observations</label>
            <textarea class="textarea" id="s-description" rows="3" placeholder="État de la plaie, évolution, aspect…"></textarea>
          </div>
          <div class="form-group">
            <label class="label">Matériel utilisé</label>
            <input class="input" type="text" id="s-materiel" placeholder="Ex: Compresses, Mepitel, Bétadine…" />
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--outline" id="soin-cancel">Annuler</button>
          <button class="btn btn--primary" id="soin-save">Enregistrer</button>
        </div>
      </div>
    </div>` : ''}
  `;

  await Promise.all([_loadPatientOptions(), _loadSoins()]);
  _bindEvents(canWrite);
}

async function _loadSoins() {
  const el = document.getElementById('soins-list');
  if (!el) return;

  const patientFilter = document.getElementById('filter-patient')?.value;
  const typeFilter    = document.getElementById('filter-type-soin')?.value;

  let query = supabase
    .from('soins_pansements')
    .select('*, patients(nom, prenom)')
    .order('date_soin', { ascending: false })
    .limit(40);

  if (patientFilter) query = query.eq('patient_id', patientFilter);
  if (typeFilter)    query = query.eq('type_soin', typeFilter);

  const { data, error } = await query;

  if (error) { el.innerHTML = _erreur(error.message); return; }

  if (!data?.length) {
    el.innerHTML = `
      <div class="card"><div class="table-empty">
        <div class="table-empty__icon">🩹</div>
        <div class="table-empty__text">Aucun soin enregistré</div>
      </div></div>`;
    return;
  }

  el.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr><th>Date</th><th>Résident</th><th>Type</th><th>Localisation</th><th>Description</th><th>Prochain soin</th></tr>
        </thead>
        <tbody>
          ${data.map(s => `
            <tr>
              <td style="white-space:nowrap;font-size:.8125rem;">${formatDateTime(s.date_soin)}</td>
              <td style="font-weight:500;">${s.patients ? formatNomComplet(s.patients.nom, s.patients.prenom) : '—'}</td>
              <td>
                <span class="badge badge--neutral">${TYPE_LABELS[s.type_soin] ?? s.type_soin}</span>
                ${s.stade ? `<span class="badge badge--warning" style="margin-left:.25rem;">${STADE_LABELS[s.stade]}</span>` : ''}
              </td>
              <td style="color:var(--color-text-muted);font-size:.8125rem;">${s.localisation ?? '—'}</td>
              <td style="font-size:.8125rem;max-width:220px;">${s.description ?? ''}</td>
              <td style="font-size:.8125rem;${s.prochain_soin && new Date(s.prochain_soin) <= new Date() ? 'color:var(--color-danger);font-weight:600;' : 'color:var(--color-text-muted);'}">
                ${s.prochain_soin ? new Date(s.prochain_soin).toLocaleDateString('fr-FR') : '—'}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function _loadPatientOptions() {
  const sels = [document.getElementById('filter-patient'), document.getElementById('s-patient')];
  const { data } = await supabase.from('patients').select('id, nom, prenom').eq('actif', true).order('nom');
  const opts = (data ?? []).map(p => `<option value="${p.id}">${formatNomComplet(p.nom, p.prenom)}</option>`).join('');
  sels.forEach(sel => {
    if (!sel) return;
    const empty = sel.id === 'filter-patient' ? `<option value="">Tous les résidents</option>` : `<option value="">— Choisir —</option>`;
    sel.innerHTML = empty + opts;
  });
}

async function _saveSoin() {
  const payload = {
    patient_id:   document.getElementById('s-patient')?.value || null,
    type_soin:    document.getElementById('s-type')?.value,
    stade:        document.getElementById('s-stade')?.value || null,
    localisation: document.getElementById('s-localisation')?.value.trim() || null,
    description:  document.getElementById('s-description')?.value.trim(),
    materiel:     document.getElementById('s-materiel')?.value.trim() || null,
    prochain_soin: document.getElementById('s-prochain')?.value || null,
  };

  if (!payload.patient_id || !payload.description) {
    addNotification({ type: 'warning', title: 'Champs requis', message: 'Résident et description sont obligatoires.' });
    return;
  }

  const { error } = await supabase.from('soins_pansements').insert(payload);
  if (error) { addNotification({ type: 'danger', title: 'Erreur', message: error.message }); return; }

  addNotification({ type: 'success', title: 'Soin enregistré' });
  document.getElementById('soin-modal')?.classList.add('hidden');
  await _loadSoins();
}

function _bindEvents(canWrite) {
  document.getElementById('filter-patient')?.addEventListener('change', _loadSoins);
  document.getElementById('filter-type-soin')?.addEventListener('change', _loadSoins);

  if (!canWrite) return;
  document.getElementById('btn-new-soin')?.addEventListener('click', () => {
    document.getElementById('soin-modal')?.classList.remove('hidden');
  });
  document.getElementById('soin-modal-close')?.addEventListener('click', () => {
    document.getElementById('soin-modal')?.classList.add('hidden');
  });
  document.getElementById('soin-cancel')?.addEventListener('click', () => {
    document.getElementById('soin-modal')?.classList.add('hidden');
  });
  document.getElementById('soin-save')?.addEventListener('click', _saveSoin);
}

function _erreur(msg) {
  return `<div class="table-empty"><div class="table-empty__icon">⚠️</div><div class="table-empty__text">${msg}</div></div>`;
}
