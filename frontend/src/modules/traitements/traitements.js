/**
 * [ candy-e ] — MODULE TRAITEMENTS MÉDICAMENTEUX
 */

import { supabase }        from '../../core/supabase.client.js';
import { getRole, getProfile, addNotification } from '../../core/state.js';
import { can }             from '../../core/rbac.js';
import { formatDate, todayISO } from '../../utils/date.js';
import { formatNomComplet }     from '../../utils/format.js';

const VOIE_LABELS = {
  orale:    '💊 Orale',
  IV:       '💉 IV',
  SC:       '💉 SC',
  IM:       '💉 IM',
  cutanee:  '🩹 Cutanée',
  inhalee:  '💨 Inhalée',
  rectale:  'Rectale',
  autre:    'Autre',
};

export async function mountTraitements() {
  const main = document.getElementById('main-content');
  if (!main) return;

  const role     = getRole();
  const canWrite = can(role, 'traitement.write');

  main.innerHTML = `
    <div class="page-header">
      <div class="page-header__eyebrow">Pharmacologie</div>
      <h1 class="page-header__title">Traitements médicamenteux</h1>
    </div>

    <div style="display:flex;gap:var(--space-3);margin-bottom:var(--space-5);flex-wrap:wrap;align-items:center;">
      <select class="select" id="filter-patient-t" style="width:260px;">
        <option value="">Tous les résidents</option>
      </select>
      <label style="display:flex;align-items:center;gap:.5rem;font-size:.875rem;cursor:pointer;">
        <input type="checkbox" id="filter-actif-only" checked /> Traitements actifs uniquement
      </label>
      ${canWrite ? `<button class="btn btn--primary" id="btn-new-traitement" style="margin-left:auto;">+ Nouveau traitement</button>` : ''}
    </div>

    <div id="traitements-list">
      <div style="text-align:center;padding:var(--space-6);color:var(--color-text-muted);">Chargement…</div>
    </div>

    ${canWrite ? `
    <div class="modal-backdrop hidden" id="traitement-modal">
      <div class="modal" style="max-width:600px;">
        <div class="modal__header">
          <div class="modal__title" id="traitement-modal-title">Nouveau traitement</div>
          <button class="modal__close" id="traitement-modal-close">✕</button>
        </div>
        <div class="modal__body">
          <div class="form-group">
            <label class="label label--required">Résident</label>
            <select class="select" id="tr-patient" style="width:100%;"></select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="label label--required">Médicament (nom commercial)</label>
              <input class="input" type="text" id="tr-medicament" placeholder="Ex: Doliprane" />
            </div>
            <div class="form-group">
              <label class="label">DCI</label>
              <input class="input" type="text" id="tr-dci" placeholder="Ex: Paracétamol" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="label label--required">Dose</label>
              <input class="input" type="text" id="tr-dose" placeholder="Ex: 500 mg, 1 cp" />
            </div>
            <div class="form-group">
              <label class="label label--required">Voie d'administration</label>
              <select class="select" id="tr-voie">
                ${Object.entries(VOIE_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="label label--required">Fréquence / Posologie</label>
            <input class="input" type="text" id="tr-frequence" placeholder="Ex: 3x/jour, matin et soir, si besoin" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="label label--required">Date de début</label>
              <input class="input" type="date" id="tr-debut" value="${todayISO()}" />
            </div>
            <div class="form-group">
              <label class="label">Date de fin (si limitée)</label>
              <input class="input" type="date" id="tr-fin" />
            </div>
          </div>
          <div class="form-group">
            <label class="label">Observations / Indication</label>
            <textarea class="textarea" id="tr-notes" rows="2" placeholder="Indication thérapeutique, surveillance particulière…"></textarea>
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--outline" id="traitement-cancel">Annuler</button>
          <button class="btn btn--primary" id="traitement-save">Prescrire</button>
        </div>
      </div>
    </div>` : ''}
  `;

  await Promise.all([_loadPatientOptions(), _loadTraitements()]);
  _bindEvents(canWrite);
}

async function _loadTraitements() {
  const el = document.getElementById('traitements-list');
  if (!el) return;

  const patientFilter = document.getElementById('filter-patient-t')?.value;
  const actifOnly     = document.getElementById('filter-actif-only')?.checked;

  let query = supabase
    .from('traitements')
    .select('*, patients(nom, prenom), profiles(prenom, nom)')
    .order('created_at', { ascending: false });

  if (patientFilter) query = query.eq('patient_id', patientFilter);
  if (actifOnly)     query = query.eq('actif', true);

  const { data, error } = await query;
  const role     = getRole();
  const canWrite = can(role, 'traitement.write');

  if (error) { el.innerHTML = _erreur(error.message); return; }

  if (!data?.length) {
    el.innerHTML = `
      <div class="card"><div class="table-empty">
        <div class="table-empty__icon">💊</div>
        <div class="table-empty__text">Aucun traitement enregistré</div>
      </div></div>`;
    return;
  }

  el.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr><th>Résident</th><th>Médicament</th><th>Dose / Fréquence</th><th>Voie</th><th>Période</th><th>Statut</th>${canWrite ? '<th>Actions</th>' : ''}</tr>
        </thead>
        <tbody>
          ${data.map(t => `
            <tr>
              <td style="font-weight:500;">${t.patients ? formatNomComplet(t.patients.nom, t.patients.prenom) : '—'}</td>
              <td>
                <div style="font-weight:600;">${t.medicament}</div>
                ${t.dci ? `<div style="font-size:.75rem;color:var(--color-text-muted);">${t.dci}</div>` : ''}
              </td>
              <td>
                <div>${t.dose}</div>
                <div style="font-size:.75rem;color:var(--color-text-muted);">${t.frequence}</div>
              </td>
              <td><span class="badge badge--neutral">${VOIE_LABELS[t.voie] ?? t.voie}</span></td>
              <td style="font-size:.8125rem;color:var(--color-text-muted);">
                ${formatDate(t.date_debut)}${t.date_fin ? ` → ${formatDate(t.date_fin)}` : ' (en cours)'}
              </td>
              <td>
                <span class="badge ${t.actif ? 'badge--success' : 'badge--neutral'}">${t.actif ? 'Actif' : 'Arrêté'}</span>
              </td>
              ${canWrite ? `
              <td>
                <div class="table__actions">
                  ${t.actif ? `<button class="btn btn--ghost btn--sm btn-stop-traitement" data-id="${t.id}" title="Arrêter le traitement">⏹</button>` : ''}
                </div>
              </td>` : ''}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  if (canWrite) {
    el.querySelectorAll('.btn-stop-traitement').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Arrêter ce traitement ?')) return;
        const { error } = await supabase.from('traitements').update({ actif: false, date_fin: todayISO() }).eq('id', btn.dataset.id);
        if (error) { addNotification({ type: 'danger', title: 'Erreur', message: error.message }); return; }
        addNotification({ type: 'success', title: 'Traitement arrêté' });
        await _loadTraitements();
      });
    });
  }
}

async function _loadPatientOptions() {
  const sels = [document.getElementById('filter-patient-t'), document.getElementById('tr-patient')];
  const { data } = await supabase.from('patients').select('id, nom, prenom').eq('actif', true).order('nom');
  const opts = (data ?? []).map(p => `<option value="${p.id}">${formatNomComplet(p.nom, p.prenom)}</option>`).join('');
  sels.forEach(sel => {
    if (!sel) return;
    const empty = sel.id === 'filter-patient-t' ? `<option value="">Tous les résidents</option>` : `<option value="">— Choisir —</option>`;
    sel.innerHTML = empty + opts;
  });
}

async function _saveTraitement() {
  const profile = getProfile();
  const payload = {
    patient_id:      document.getElementById('tr-patient')?.value || null,
    medicament:      document.getElementById('tr-medicament')?.value.trim(),
    dci:             document.getElementById('tr-dci')?.value.trim() || null,
    dose:            document.getElementById('tr-dose')?.value.trim(),
    voie:            document.getElementById('tr-voie')?.value,
    frequence:       document.getElementById('tr-frequence')?.value.trim(),
    date_debut:      document.getElementById('tr-debut')?.value,
    date_fin:        document.getElementById('tr-fin')?.value || null,
    notes:           document.getElementById('tr-notes')?.value.trim() || null,
    prescripteur_id: profile?.id ?? null,
  };

  if (!payload.patient_id || !payload.medicament || !payload.dose || !payload.frequence) {
    addNotification({ type: 'warning', title: 'Champs requis', message: 'Résident, médicament, dose et fréquence sont obligatoires.' });
    return;
  }

  const { error } = await supabase.from('traitements').insert(payload);
  if (error) { addNotification({ type: 'danger', title: 'Erreur', message: error.message }); return; }

  addNotification({ type: 'success', title: 'Traitement prescrit' });
  document.getElementById('traitement-modal')?.classList.add('hidden');
  await _loadTraitements();
}

function _bindEvents(canWrite) {
  document.getElementById('filter-patient-t')?.addEventListener('change', _loadTraitements);
  document.getElementById('filter-actif-only')?.addEventListener('change', _loadTraitements);

  if (!canWrite) return;
  document.getElementById('btn-new-traitement')?.addEventListener('click', () => {
    document.getElementById('traitement-modal')?.classList.remove('hidden');
  });
  document.getElementById('traitement-modal-close')?.addEventListener('click', () => {
    document.getElementById('traitement-modal')?.classList.add('hidden');
  });
  document.getElementById('traitement-cancel')?.addEventListener('click', () => {
    document.getElementById('traitement-modal')?.classList.add('hidden');
  });
  document.getElementById('traitement-save')?.addEventListener('click', _saveTraitement);
}

function _erreur(msg) {
  return `<div class="table-empty"><div class="table-empty__icon">⚠️</div><div class="table-empty__text">${msg}</div></div>`;
}
