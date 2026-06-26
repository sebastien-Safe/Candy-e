/**
 * [ candy-e ] — MODULE AGENDA
 */

import { supabase }        from '../../core/supabase.client.js';
import { getRole }         from '../../core/state.js';
import { can }             from '../../core/rbac.js';
import { formatDateTime, formatDate, todayISO } from '../../utils/date.js';
import { formatNomComplet } from '../../utils/format.js';
import { addNotification } from '../../core/state.js';

export async function mountAgenda() {
  const main = document.getElementById('main-content');
  if (!main) return;

  const role     = getRole();
  const canWrite = can(role, 'agenda.write');
  const today    = todayISO();

  main.innerHTML = `
    <div class="page-header">
      <div class="page-header__eyebrow">Planning</div>
      <h1 class="page-header__title">Agenda</h1>
    </div>

    <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-6);flex-wrap:wrap;">
      <input type="date" class="input" id="agenda-date" value="${today}" style="width:180px;" />
      ${canWrite ? `<button class="btn btn--primary" id="btn-new-rdv">+ Nouveau RDV</button>` : ''}
    </div>

    <div id="agenda-content">
      <div style="text-align:center;padding:var(--space-6);color:var(--color-text-muted);">Chargement…</div>
    </div>

    ${canWrite ? `
    <div class="modal-backdrop hidden" id="rdv-modal">
      <div class="modal">
        <div class="modal__header">
          <div class="modal__title">Nouveau rendez-vous</div>
          <button class="modal__close" id="rdv-modal-close">✕</button>
        </div>
        <div class="modal__body">
          <div class="form-group">
            <label class="label">Patient</label>
            <select class="select" id="rdv-patient" style="width:100%;"></select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="label label--required">Date et heure</label>
              <input class="input" type="datetime-local" id="rdv-date" />
            </div>
            <div class="form-group">
              <label class="label">Durée (min)</label>
              <input class="input" type="number" id="rdv-duree" value="30" min="5" step="5" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="label">Type</label>
              <select class="select" id="rdv-type">
                ${['Consultation','Bilan','Spécialiste','Suivi','Autre'].map(t => `<option>${t}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="label label--required">Titre / Motif</label>
            <input class="input" type="text" id="rdv-titre" placeholder="Ex: Renouvellement ordonnance" />
          </div>
          <div class="form-group">
            <label class="label">Notes</label>
            <textarea class="textarea" id="rdv-notes" rows="2"></textarea>
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--outline" id="rdv-cancel">Annuler</button>
          <button class="btn btn--primary" id="rdv-save">Enregistrer</button>
        </div>
      </div>
    </div>` : ''}
  `;

  await _loadAgenda(today);

  document.getElementById('agenda-date')?.addEventListener('change', (e) => _loadAgenda(e.target.value));

  if (canWrite) {
    document.getElementById('btn-new-rdv')?.addEventListener('click', async () => {
      await _loadPatientOptions();
      const dateEl = document.getElementById('rdv-date');
      if (dateEl) dateEl.value = today + 'T09:00';
      document.getElementById('rdv-modal')?.classList.remove('hidden');
    });
    document.getElementById('rdv-modal-close')?.addEventListener('click', () => {
      document.getElementById('rdv-modal')?.classList.add('hidden');
    });
    document.getElementById('rdv-cancel')?.addEventListener('click', () => {
      document.getElementById('rdv-modal')?.classList.add('hidden');
    });
    document.getElementById('rdv-save')?.addEventListener('click', _saveRdv);
  }
}

async function _loadAgenda(date) {
  const el = document.getElementById('agenda-content');
  if (!el) return;

  const { data, error } = await supabase
    .from('agenda')
    .select('id, date_rdv, duree_minutes, type_rdv, titre, statut, notes, patients(nom, prenom)')
    .gte('date_rdv', date + 'T00:00:00')
    .lte('date_rdv', date + 'T23:59:59')
    .order('date_rdv');

  if (error) { el.innerHTML = _erreur(error.message); return; }

  const statusColors = { planifie: 'var(--color-primary)', confirme: 'var(--color-success)', annule: 'var(--color-danger)', effectue: 'var(--color-text-muted)' };

  el.innerHTML = !data?.length
    ? `<div class="card"><div class="table-empty"><div class="table-empty__icon">📅</div>
         <div class="table-empty__text">Aucun rendez-vous ce jour</div></div></div>`
    : `<div class="card">
        <div class="card__body" style="padding:0;">
          ${data.map(r => `
            <div style="display:flex;align-items:flex-start;gap:var(--space-4);
                        padding:var(--space-4) var(--space-5);border-bottom:1px solid var(--color-border);">
              <div style="min-width:60px;text-align:center;">
                <div style="font-size:1.25rem;font-weight:700;color:var(--color-text);">
                  ${new Date(r.date_rdv).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style="font-size:.6875rem;color:var(--color-text-muted);">${r.duree_minutes} min</div>
              </div>
              <div style="width:4px;align-self:stretch;min-height:48px;border-radius:2px;flex-shrink:0;
                          background:${statusColors[r.statut] || 'var(--color-border)'}"></div>
              <div style="flex:1;">
                <div style="font-weight:600;font-size:.9375rem;">${r.titre}</div>
                ${r.patients ? `
                  <div style="font-size:.8125rem;color:var(--color-text-secondary);margin-top:2px;">
                    👤 ${formatNomComplet(r.patients.nom, r.patients.prenom)}
                  </div>` : ''}
                ${r.notes ? `<div style="font-size:.8125rem;color:var(--color-text-muted);margin-top:4px;">${r.notes}</div>` : ''}
              </div>
              <div style="display:flex;flex-direction:column;gap:var(--space-2);align-items:flex-end;">
                <span class="badge badge--${r.statut === 'planifie' ? 'neutral' : r.statut === 'confirme' ? 'success' : r.statut === 'annule' ? 'danger' : 'neutral'}">${r.statut}</span>
                <span class="badge badge--neutral">${r.type_rdv}</span>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
}

async function _loadPatientOptions() {
  const sel = document.getElementById('rdv-patient');
  if (!sel) return;
  const { data } = await supabase.from('patients').select('id, nom, prenom').eq('actif', true).order('nom');
  sel.innerHTML = `<option value="">— Aucun patient lié —</option>` +
    (data ?? []).map(p => `<option value="${p.id}">${formatNomComplet(p.nom, p.prenom)}</option>`).join('');
}

async function _saveRdv() {
  const payload = {
    patient_id:    document.getElementById('rdv-patient')?.value || null,
    date_rdv:      document.getElementById('rdv-date')?.value,
    duree_minutes: parseInt(document.getElementById('rdv-duree')?.value || '30'),
    type_rdv:      document.getElementById('rdv-type')?.value,
    titre:         document.getElementById('rdv-titre')?.value.trim(),
    notes:         document.getElementById('rdv-notes')?.value.trim() || null,
    statut:        'planifie',
  };

  if (!payload.titre || !payload.date_rdv) {
    addNotification({ type: 'warning', title: 'Champs requis', message: 'Titre et date/heure sont obligatoires.' });
    return;
  }

  const { error } = await supabase.from('agenda').insert(payload);
  if (error) { addNotification({ type: 'danger', title: 'Erreur', message: error.message }); return; }

  addNotification({ type: 'success', title: 'RDV enregistré' });
  document.getElementById('rdv-modal')?.classList.add('hidden');
  const date = payload.date_rdv.split('T')[0];
  document.getElementById('agenda-date').value = date;
  await _loadAgenda(date);
}

function _erreur(msg) {
  return `<div class="table-empty"><div class="table-empty__icon">⚠️</div><div class="table-empty__text">${msg}</div></div>`;
}
