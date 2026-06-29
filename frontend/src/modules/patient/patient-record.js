/**
 * [ candy-e ] — FICHE PATIENT
 */

import { supabase }                    from '../../core/supabase.client.js';
import { getRole, getCurrentPatientId } from '../../core/state.js';
import { can, PATIENT_TABS }           from '../../core/rbac.js';
import { navigate }                    from '../../core/router.js';
import { formatDate, formatDateTime, calcAge, timeAgo, todayISO } from '../../utils/date.js';
import { formatNomComplet, orDash }    from '../../utils/format.js';
import { addNotification }             from '../../core/state.js';

export async function mountPatientRecord(activeTabId = null) {
  const main      = document.getElementById('main-content');
  const patientId = getCurrentPatientId();
  if (!main) return;

  if (!patientId) {
    main.innerHTML = `
      <div style="text-align:center;padding:4rem 2rem;">
        <div style="font-size:3rem;margin-bottom:1rem;">👤</div>
        <p>Aucun patient sélectionné.
          <a href="#patients" style="color:var(--color-primary);" id="link-back">Retour à la liste</a>.
        </p>
      </div>`;
    document.getElementById('link-back')?.addEventListener('click', (e) => { e.preventDefault(); navigate('patients'); });
    return;
  }

  const { data: patient, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', patientId)
    .single();

  if (error || !patient) {
    main.innerHTML = `<div class="table-empty"><div class="table-empty__icon">⚠️</div>
      <div class="table-empty__text">${error?.message ?? 'Patient introuvable'}</div></div>`;
    return;
  }

  const role        = getRole();
  const allowedTabs = PATIENT_TABS.filter(t => can(role, t.permission));
  const firstTab    = (activeTabId && allowedTabs.find(t => t.id === activeTabId))
    ? activeTabId
    : allowedTabs[0]?.id;

  main.innerHTML = `
    <div style="display:flex;align-items:center;gap:.5rem;font-size:.8125rem;
                color:var(--color-text-muted);margin-bottom:var(--space-4);">
      <a href="#patients" style="color:var(--color-primary);" id="breadcrumb-patients">Patients</a>
      <span>›</span>
      <span>${formatNomComplet(patient.nom, patient.prenom)}</span>
    </div>

    <div class="card mb-6" style="border-left:4px solid var(--color-primary);">
      <div class="card__body">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-4);flex-wrap:wrap;">
          <div style="display:flex;align-items:flex-start;gap:var(--space-4);">
            <div style="width:56px;height:56px;border-radius:var(--radius-lg);
                        background:var(--color-primary-light);
                        display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0;">👤</div>
            <div>
              <h2 style="font-size:var(--text-xl);font-weight:700;">${formatNomComplet(patient.nom, patient.prenom)}</h2>
              <div style="display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap;margin-top:.25rem;">
                <span style="font-size:.875rem;color:var(--color-text-secondary);">
                  Né(e) le ${formatDate(patient.date_naissance)} · ${calcAge(patient.date_naissance)} ans
                  ${patient.sexe ? ` · ${patient.sexe}` : ''}
                </span>
                <span class="badge ${patient.actif ? 'badge--success' : 'badge--neutral'}">${patient.actif ? 'Actif' : 'Inactif'}</span>
              </div>
              <div style="display:flex;gap:var(--space-4);margin-top:.5rem;flex-wrap:wrap;font-size:.8125rem;color:var(--color-text-muted);">
                ${patient.ville ? `<span>📍 ${patient.ville}</span>` : ''}
                ${patient.telephone ? `<span>📞 ${patient.telephone}</span>` : ''}
                ${patient.groupe_sanguin ? `<span style="color:var(--color-danger);font-weight:600;">🩸 ${patient.groupe_sanguin}</span>` : ''}
              </div>
            </div>
          </div>
          <button class="btn btn--outline btn--sm" id="btn-back-patients">← Retour</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div style="display:flex;gap:var(--space-1);flex-wrap:wrap;
                  padding:var(--space-3) var(--space-4);
                  border-bottom:1px solid var(--color-border);overflow-x:auto;"
           id="tabs-container" role="tablist">
        ${allowedTabs.map(tab => `
          <button class="tab-btn ${tab.id === firstTab ? 'active' : ''}"
                  role="tab" data-tab="${tab.id}"
                  aria-selected="${tab.id === firstTab}">
            <span aria-hidden="true">${tab.icon}</span> ${tab.label}
          </button>`).join('')}
      </div>
      <div class="card__body" id="tab-content" role="tabpanel">
        <div style="text-align:center;padding:var(--space-6);color:var(--color-text-muted);">Chargement…</div>
      </div>
    </div>
  `;

  _injectTabStyles();

  document.getElementById('btn-back-patients')?.addEventListener('click', () => navigate('patients'));
  document.getElementById('breadcrumb-patients')?.addEventListener('click', (e) => { e.preventDefault(); navigate('patients'); });

  if (firstTab) await _loadTab(firstTab, patientId, role);

  document.getElementById('tabs-container')?.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      await _loadTab(btn.dataset.tab, patientId, role);
    });
  });
}

function _injectTabStyles() {
  if (document.getElementById('tab-styles')) return;
  const s = document.createElement('style');
  s.id = 'tab-styles';
  s.textContent = `
    .tab-btn { display:inline-flex;align-items:center;gap:.375rem;padding:.5rem .75rem;
      border-radius:var(--radius-md);font-size:.8125rem;font-weight:500;cursor:pointer;
      border:none;background:transparent;color:var(--color-text-secondary);
      transition:background var(--transition),color var(--transition);white-space:nowrap; }
    .tab-btn:hover { background:var(--color-surface-overlay);color:var(--color-text); }
    .tab-btn.active { background:var(--color-primary-light);color:var(--color-primary);font-weight:600; }
  `;
  document.head.appendChild(s);
}

async function _loadTab(tabId, patientId, role) {
  const content = document.getElementById('tab-content');
  if (!content) return;
  content.innerHTML = `<div style="text-align:center;padding:var(--space-6);color:var(--color-text-muted);">Chargement…</div>`;

  const loaders = {
    etat_civil:    () => _tabEtatCivil(patientId),
    constantes:    () => _tabConstantes(patientId, role),
    consultations: () => _tabConsultations(patientId, role),
    traitements:   () => _tabTraitements(patientId, role),
    soins:         () => _tabSoins(patientId, role),
    ordonnances:   () => _tabOrdonnances(patientId),
    notes:         () => _tabNotes(patientId, role),
    documents:     () => _tabDocuments(patientId),
  };

  const loader = loaders[tabId];
  content.innerHTML = loader ? await loader() : `<p style="color:var(--color-text-muted);">Module non disponible.</p>`;

  if (tabId === 'notes')         _bindNoteEvents(patientId, role);
  if (tabId === 'consultations' && can(role, 'consultation.write')) _bindConsultationEvents(patientId);
  if (tabId === 'constantes'    && can(role, 'constante.write'))    _bindConstantesEvents(patientId);
  if (tabId === 'traitements'   && can(role, 'traitement.write'))   _bindTraitementsEvents(patientId);
  if (tabId === 'soins'         && can(role, 'soin.write'))         _bindSoinsEvents(patientId);
}

// ── Onglet : État civil ──────────────────────────────────────────────────────

async function _tabEtatCivil(id) {
  const { data: p } = await supabase.from('patients').select('*').eq('id', id).single();
  if (!p) return _erreur('Données introuvables');
  return `
    <div class="grid-2">
      ${_field('Nom', p.nom?.toUpperCase())}
      ${_field('Prénom', p.prenom)}
      ${_field('Date de naissance', formatDate(p.date_naissance))}
      ${_field('Sexe', orDash(p.sexe))}
      ${_field('Situation', orDash(p.situation))}
      ${_field('Profession', orDash(p.profession))}
      ${_field('Téléphone', orDash(p.telephone))}
      ${_field('E-mail', orDash(p.email))}
      ${_field('Adresse', p.adresse ? `${p.adresse}, ${p.code_postal ?? ''} ${p.ville ?? ''}`.trim() : '—')}
      ${_field('N° Sécu', orDash(p.numero_secu))}
      ${_field('Groupe sanguin', orDash(p.groupe_sanguin))}
      ${_field('Médecin traitant', orDash(p.medecin_nom))}
    </div>
    ${Array.isArray(p.allergies) && p.allergies.length ? `
      <div style="margin-top:var(--space-4);padding:var(--space-3);background:var(--color-danger-light);
                  border:1px solid var(--color-danger);border-radius:var(--radius-md);">
        <strong>⚠️ Allergies :</strong> ${p.allergies.join(', ')}
      </div>` : ''}`;
}

// ── Onglet : Constantes vitales ──────────────────────────────────────────────

async function _tabConstantes(id, role) {
  const canWrite = can(role, 'constante.write');
  const { data } = await supabase
    .from('constantes')
    .select('*')
    .eq('patient_id', id)
    .order('date_mesure', { ascending: false })
    .limit(20);

  return `
    ${canWrite ? `
      <div style="margin-bottom:var(--space-4);">
        <button class="btn btn--primary btn--sm" id="btn-new-constante">+ Nouvelle mesure</button>
      </div>
      <div id="form-constante" class="hidden" style="padding:var(--space-4);background:var(--color-surface-raised);
           border-radius:var(--radius-lg);border:1px solid var(--color-border);margin-bottom:var(--space-4);">
        <div class="form-row">
          <div class="form-group">
            <label class="label">Tension (sys / dia)</label>
            <div style="display:flex;gap:.5rem;">
              <input class="input" type="number" id="c-tsys" placeholder="120" style="width:80px;" />
              <span style="align-self:center;color:var(--color-text-muted);">/</span>
              <input class="input" type="number" id="c-tdia" placeholder="80"  style="width:80px;" />
            </div>
          </div>
          <div class="form-group">
            <label class="label">FC (bpm)</label>
            <input class="input" type="number" id="c-fc" placeholder="70" />
          </div>
          <div class="form-group">
            <label class="label">SpO₂ (%)</label>
            <input class="input" type="number" id="c-spo2" placeholder="98" min="50" max="100" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="label">Température (°C)</label>
            <input class="input" type="number" id="c-temp" placeholder="37.0" step="0.1" />
          </div>
          <div class="form-group">
            <label class="label">Poids (kg)</label>
            <input class="input" type="number" id="c-poids" placeholder="70" step="0.1" />
          </div>
          <div class="form-group">
            <label class="label">Glycémie (mmol/L)</label>
            <input class="input" type="number" id="c-glycemie" placeholder="5.5" step="0.1" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="label">Douleur (0–10)</label>
            <input class="input" type="number" id="c-douleur" placeholder="0" min="0" max="10" />
          </div>
          <div class="form-group" style="flex:2;">
            <label class="label">Observations</label>
            <input class="input" type="text" id="c-obs" placeholder="Remarques…" />
          </div>
        </div>
        <div style="display:flex;gap:var(--space-2);">
          <button class="btn btn--primary btn--sm" id="btn-save-constante">Enregistrer</button>
          <button class="btn btn--outline btn--sm" id="btn-cancel-constante">Annuler</button>
        </div>
      </div>` : ''}

    <div class="table-wrapper" style="border:none;box-shadow:none;">
      <table class="table">
        <thead>
          <tr><th>Date</th><th>TA</th><th>FC</th><th>SpO₂</th><th>Temp.</th><th>Poids</th><th>Glycémie</th><th>Douleur</th></tr>
        </thead>
        <tbody>
          ${!data?.length
            ? `<tr><td colspan="8"><div class="table-empty"><div class="table-empty__text">Aucune mesure enregistrée</div></div></td></tr>`
            : data.map(c => `
              <tr>
                <td style="white-space:nowrap;font-size:.8125rem;">${formatDateTime(c.date_mesure)}</td>
                <td>${c.tension_sys && c.tension_dia ? `<strong>${c.tension_sys}/${c.tension_dia}</strong>` : '—'}</td>
                <td>${c.frequence_cardiaque ?? '—'}</td>
                <td>${c.saturation_o2 != null ? `<span style="${c.saturation_o2 < 95 ? 'color:var(--color-danger);font-weight:600;' : ''}">${c.saturation_o2}%</span>` : '—'}</td>
                <td>${c.temperature != null ? `<span style="${c.temperature > 38 ? 'color:var(--color-danger);font-weight:600;' : ''}">${c.temperature}°C</span>` : '—'}</td>
                <td>${c.poids != null ? `${c.poids} kg` : '—'}</td>
                <td>${c.glycemie != null ? `${c.glycemie} mmol/L` : '—'}</td>
                <td>${c.echelle_douleur != null ? `${c.echelle_douleur}/10` : '—'}</td>
              </tr>
              ${c.observations ? `<tr><td colspan="8" style="padding:.25rem 1rem .75rem;font-size:.8125rem;color:var(--color-text-secondary);border-top:none;">📝 ${c.observations}</td></tr>` : ''}`).join('')}
        </tbody>
      </table>
    </div>`;
}

function _bindConstantesEvents(patientId) {
  document.getElementById('btn-new-constante')?.addEventListener('click', () => {
    document.getElementById('form-constante')?.classList.toggle('hidden');
  });
  document.getElementById('btn-cancel-constante')?.addEventListener('click', () => {
    document.getElementById('form-constante')?.classList.add('hidden');
  });
  document.getElementById('btn-save-constante')?.addEventListener('click', async () => {
    const v = (id) => { const el = document.getElementById(id); return el?.value ? Number(el.value) : null; };
    const payload = {
      patient_id:          patientId,
      tension_sys:         v('c-tsys'),
      tension_dia:         v('c-tdia'),
      frequence_cardiaque: v('c-fc'),
      saturation_o2:       v('c-spo2'),
      temperature:         v('c-temp'),
      poids:               v('c-poids'),
      glycemie:            v('c-glycemie'),
      echelle_douleur:     v('c-douleur'),
      observations:        document.getElementById('c-obs')?.value.trim() || null,
    };
    const { error } = await supabase.from('constantes').insert(payload);
    if (error) { addNotification({ type: 'danger', title: 'Erreur', message: error.message }); return; }
    addNotification({ type: 'success', title: 'Mesure enregistrée' });
    await _loadTab('constantes', patientId, getRole());
  });
}

// ── Onglet : Consultations ───────────────────────────────────────────────────

async function _tabConsultations(id, role) {
  const canWrite = can(role, 'consultation.write');
  const { data } = await supabase
    .from('consultations')
    .select('*, profiles(prenom, nom)')
    .eq('patient_id', id)
    .order('date_consult', { ascending: false });

  return `
    ${canWrite ? `
      <div style="margin-bottom:var(--space-4);">
        <button class="btn btn--primary btn--sm" id="btn-new-consult">+ Nouvelle consultation</button>
      </div>
      <div id="new-consult-form" class="hidden" style="padding:var(--space-4);background:var(--color-surface-raised);
           border-radius:var(--radius-lg);border:1px solid var(--color-border);margin-bottom:var(--space-4);">
        <div class="form-row">
          <div class="form-group">
            <label class="label">Date</label>
            <input class="input" type="date" id="c-date" value="${todayISO()}" />
          </div>
          <div class="form-group">
            <label class="label">Type</label>
            <select class="select" id="c-type">
              ${['Consultation','Bilan','Spécialiste','Examen','Urgence','Autre'].map(t => `<option>${t}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="label">Titre / Motif</label>
          <input class="input" type="text" id="c-titre" placeholder="Ex: Douleur thoracique" />
        </div>
        <div class="form-group">
          <label class="label">Notes cliniques</label>
          <textarea class="textarea" id="c-notes" rows="4" placeholder="Observations…"></textarea>
        </div>
        <div class="form-row" style="gap:var(--space-2);">
          <button class="btn btn--primary btn--sm" id="btn-save-consult">Enregistrer</button>
          <button class="btn btn--outline btn--sm" id="btn-cancel-consult">Annuler</button>
        </div>
      </div>` : ''}
    <div class="table-wrapper" style="border:none;box-shadow:none;">
      <table class="table">
        <thead><tr><th>Date</th><th>Type</th><th>Titre</th><th>Médecin</th><th>Constantes</th></tr></thead>
        <tbody>
          ${!data?.length
            ? `<tr><td colspan="5"><div class="table-empty"><div class="table-empty__text">Aucune consultation</div></div></td></tr>`
            : data.map(c => `
              <tr>
                <td style="white-space:nowrap;">${formatDate(c.date_consult)}</td>
                <td><span class="badge badge--neutral">${c.type_acte}</span></td>
                <td style="font-weight:500;">${c.titre}</td>
                <td style="color:var(--color-text-muted);font-size:.8125rem;">
                  ${c.profiles ? `Dr ${c.profiles.prenom} ${c.profiles.nom}` : '—'}
                </td>
                <td style="font-size:.75rem;color:var(--color-text-muted);">
                  ${c.tension_sys && c.tension_dia ? `TA ${c.tension_sys}/${c.tension_dia}` : ''}
                  ${c.spo2 ? ` · SpO₂ ${c.spo2}%` : ''}
                  ${c.poids ? ` · ${c.poids} kg` : ''}
                </td>
              </tr>
              ${c.notes ? `<tr><td colspan="5" style="padding:.25rem 1rem .75rem;color:var(--color-text-secondary);font-size:.8125rem;border-top:none;">
                📝 ${c.notes}</td></tr>` : ''}`).join('')}
        </tbody>
      </table>
    </div>`;
}

function _bindConsultationEvents(patientId) {
  document.getElementById('btn-new-consult')?.addEventListener('click', () => {
    document.getElementById('new-consult-form')?.classList.toggle('hidden');
  });
  document.getElementById('btn-cancel-consult')?.addEventListener('click', () => {
    document.getElementById('new-consult-form')?.classList.add('hidden');
  });
  document.getElementById('btn-save-consult')?.addEventListener('click', async () => {
    const payload = {
      patient_id:  patientId,
      date_consult: document.getElementById('c-date').value,
      type_acte:   document.getElementById('c-type').value,
      titre:       document.getElementById('c-titre').value.trim(),
      notes:       document.getElementById('c-notes').value.trim() || null,
    };
    if (!payload.titre) { addNotification({ type: 'warning', title: 'Titre requis' }); return; }
    const { error } = await supabase.from('consultations').insert(payload);
    if (error) { addNotification({ type: 'danger', title: 'Erreur', message: error.message }); return; }
    addNotification({ type: 'success', title: 'Consultation enregistrée' });
    await _loadTab('consultations', patientId, getRole());
  });
}

// ── Onglet : Traitements ─────────────────────────────────────────────────────

async function _tabTraitements(id, role) {
  const canWrite = can(role, 'traitement.write');
  const { data } = await supabase
    .from('traitements')
    .select('*, profiles(prenom, nom)')
    .eq('patient_id', id)
    .order('actif', { ascending: false })
    .order('created_at', { ascending: false });

  const VOIE_LABELS = { orale: '💊', IV: '💉', SC: '💉', IM: '💉', cutanee: '🩹', inhalee: '💨', rectale: '↓', autre: '' };

  return `
    ${canWrite ? `
      <div style="margin-bottom:var(--space-4);">
        <button class="btn btn--primary btn--sm" id="btn-new-traitement-tab">+ Prescrire un traitement</button>
      </div>
      <div id="form-traitement-tab" class="hidden" style="padding:var(--space-4);background:var(--color-surface-raised);
           border-radius:var(--radius-lg);border:1px solid var(--color-border);margin-bottom:var(--space-4);">
        <div class="form-row">
          <div class="form-group">
            <label class="label label--required">Médicament</label>
            <input class="input" type="text" id="tt-medicament" placeholder="Ex: Doliprane" />
          </div>
          <div class="form-group">
            <label class="label">DCI</label>
            <input class="input" type="text" id="tt-dci" placeholder="Ex: Paracétamol" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="label label--required">Dose</label>
            <input class="input" type="text" id="tt-dose" placeholder="Ex: 500 mg" />
          </div>
          <div class="form-group">
            <label class="label label--required">Fréquence</label>
            <input class="input" type="text" id="tt-frequence" placeholder="Ex: 3x/jour" />
          </div>
          <div class="form-group">
            <label class="label">Voie</label>
            <select class="select" id="tt-voie">
              <option value="orale">💊 Orale</option>
              <option value="IV">💉 IV</option>
              <option value="SC">💉 SC</option>
              <option value="cutanee">🩹 Cutanée</option>
              <option value="inhalee">💨 Inhalée</option>
              <option value="autre">Autre</option>
            </select>
          </div>
        </div>
        <div class="form-row" style="gap:var(--space-2);">
          <button class="btn btn--primary btn--sm" id="btn-save-traitement-tab">Prescrire</button>
          <button class="btn btn--outline btn--sm" id="btn-cancel-traitement-tab">Annuler</button>
        </div>
      </div>` : ''}
    <div>
      ${!data?.length
        ? `<p style="color:var(--color-text-muted);">Aucun traitement en cours.</p>`
        : data.map(t => `
          <div class="card mb-3" style="${t.actif ? 'border-left:3px solid var(--color-success);' : 'opacity:.7;'}">
            <div class="card__body" style="padding:var(--space-3) var(--space-4);">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-3);">
                <div>
                  <div style="font-size:.9375rem;font-weight:700;">${VOIE_LABELS[t.voie] ?? ''} ${t.medicament}
                    ${t.dci ? `<span style="font-size:.8125rem;font-weight:400;color:var(--color-text-muted);">(${t.dci})</span>` : ''}
                  </div>
                  <div style="font-size:.875rem;color:var(--color-text-secondary);margin-top:2px;">
                    ${t.dose} · ${t.frequence}
                  </div>
                  <div style="font-size:.75rem;color:var(--color-text-muted);margin-top:4px;">
                    Depuis le ${formatDate(t.date_debut)}
                    ${t.date_fin ? ` jusqu'au ${formatDate(t.date_fin)}` : ''}
                    ${t.profiles ? ` · Dr ${t.profiles.prenom} ${t.profiles.nom}` : ''}
                  </div>
                  ${t.notes ? `<div style="font-size:.8125rem;color:var(--color-text-muted);margin-top:4px;">📝 ${t.notes}</div>` : ''}
                </div>
                <div style="display:flex;align-items:center;gap:var(--space-2);flex-shrink:0;">
                  <span class="badge ${t.actif ? 'badge--success' : 'badge--neutral'}">${t.actif ? 'Actif' : 'Arrêté'}</span>
                  ${canWrite && t.actif ? `<button class="btn btn--ghost btn--sm btn-stop-t" data-id="${t.id}" title="Arrêter">⏹</button>` : ''}
                </div>
              </div>
            </div>
          </div>`).join('')}
    </div>`;
}

function _bindTraitementsEvents(patientId) {
  document.getElementById('btn-new-traitement-tab')?.addEventListener('click', () => {
    document.getElementById('form-traitement-tab')?.classList.toggle('hidden');
  });
  document.getElementById('btn-cancel-traitement-tab')?.addEventListener('click', () => {
    document.getElementById('form-traitement-tab')?.classList.add('hidden');
  });
  document.getElementById('btn-save-traitement-tab')?.addEventListener('click', async () => {
    const payload = {
      patient_id: patientId,
      medicament: document.getElementById('tt-medicament')?.value.trim(),
      dci:        document.getElementById('tt-dci')?.value.trim() || null,
      dose:       document.getElementById('tt-dose')?.value.trim(),
      frequence:  document.getElementById('tt-frequence')?.value.trim(),
      voie:       document.getElementById('tt-voie')?.value,
    };
    if (!payload.medicament || !payload.dose || !payload.frequence) {
      addNotification({ type: 'warning', title: 'Champs requis' }); return;
    }
    const { error } = await supabase.from('traitements').insert(payload);
    if (error) { addNotification({ type: 'danger', title: 'Erreur', message: error.message }); return; }
    addNotification({ type: 'success', title: 'Traitement prescrit' });
    await _loadTab('traitements', patientId, getRole());
  });

  document.querySelectorAll('.btn-stop-t').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { error } = await supabase.from('traitements').update({ actif: false, date_fin: todayISO() }).eq('id', btn.dataset.id);
      if (error) { addNotification({ type: 'danger', title: 'Erreur', message: error.message }); return; }
      addNotification({ type: 'success', title: 'Traitement arrêté' });
      await _loadTab('traitements', patientId, getRole());
    });
  });
}

// ── Onglet : Soins & Pansements ──────────────────────────────────────────────

async function _tabSoins(id, role) {
  const canWrite = can(role, 'soin.write');
  const { data } = await supabase
    .from('soins_pansements')
    .select('*')
    .eq('patient_id', id)
    .order('date_soin', { ascending: false })
    .limit(15);

  const TYPE_LABELS = { plaie: '🩹 Plaie', escarre: '⚠️ Escarre', ulcere: '🔴 Ulcère', stomie: '💧 Stomie', catheter: '🩺 Cathéter', drain: '💉 Drain', autre: 'Autre' };

  return `
    ${canWrite ? `
      <div style="margin-bottom:var(--space-4);">
        <button class="btn btn--primary btn--sm" id="btn-new-soin-tab">+ Nouveau soin</button>
      </div>
      <div id="form-soin-tab" class="hidden" style="padding:var(--space-4);background:var(--color-surface-raised);
           border-radius:var(--radius-lg);border:1px solid var(--color-border);margin-bottom:var(--space-4);">
        <div class="form-row">
          <div class="form-group">
            <label class="label">Type de soin</label>
            <select class="select" id="st-type">
              ${Object.entries(TYPE_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="label">Localisation</label>
            <input class="input" type="text" id="st-localisation" placeholder="Ex: Talon gauche" />
          </div>
        </div>
        <div class="form-group">
          <label class="label label--required">Description / Observations</label>
          <textarea class="textarea" id="st-description" rows="2" placeholder="État de la plaie, évolution…"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="label">Matériel utilisé</label>
            <input class="input" type="text" id="st-materiel" placeholder="Ex: Mepitel, Bétadine…" />
          </div>
          <div class="form-group">
            <label class="label">Prochain soin</label>
            <input class="input" type="date" id="st-prochain" />
          </div>
        </div>
        <div class="form-row" style="gap:var(--space-2);">
          <button class="btn btn--primary btn--sm" id="btn-save-soin-tab">Enregistrer</button>
          <button class="btn btn--outline btn--sm" id="btn-cancel-soin-tab">Annuler</button>
        </div>
      </div>` : ''}
    <div>
      ${!data?.length
        ? `<p style="color:var(--color-text-muted);">Aucun soin enregistré.</p>`
        : data.map(s => `
          <div class="card mb-3">
            <div class="card__body" style="padding:var(--space-3) var(--space-4);">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;">
                <div>
                  <div style="display:flex;gap:var(--space-2);align-items:center;margin-bottom:4px;">
                    <span class="badge badge--neutral">${TYPE_LABELS[s.type_soin] ?? s.type_soin}</span>
                    ${s.stade ? `<span class="badge badge--warning">Stade ${s.stade}</span>` : ''}
                    ${s.localisation ? `<span style="font-size:.8125rem;color:var(--color-text-muted);">📍 ${s.localisation}</span>` : ''}
                  </div>
                  <div style="font-size:.875rem;">${s.description}</div>
                  ${s.materiel ? `<div style="font-size:.75rem;color:var(--color-text-muted);margin-top:4px;">🧰 ${s.materiel}</div>` : ''}
                </div>
                <div style="text-align:right;flex-shrink:0;font-size:.75rem;color:var(--color-text-muted);">
                  ${formatDateTime(s.date_soin)}
                  ${s.prochain_soin ? `<br>Prochain : <strong style="${new Date(s.prochain_soin) <= new Date() ? 'color:var(--color-danger);' : ''}">${new Date(s.prochain_soin).toLocaleDateString('fr-FR')}</strong>` : ''}
                </div>
              </div>
            </div>
          </div>`).join('')}
    </div>`;
}

function _bindSoinsEvents(patientId) {
  document.getElementById('btn-new-soin-tab')?.addEventListener('click', () => {
    document.getElementById('form-soin-tab')?.classList.toggle('hidden');
  });
  document.getElementById('btn-cancel-soin-tab')?.addEventListener('click', () => {
    document.getElementById('form-soin-tab')?.classList.add('hidden');
  });
  document.getElementById('btn-save-soin-tab')?.addEventListener('click', async () => {
    const payload = {
      patient_id:   patientId,
      type_soin:    document.getElementById('st-type')?.value,
      localisation: document.getElementById('st-localisation')?.value.trim() || null,
      description:  document.getElementById('st-description')?.value.trim(),
      materiel:     document.getElementById('st-materiel')?.value.trim() || null,
      prochain_soin: document.getElementById('st-prochain')?.value || null,
    };
    if (!payload.description) { addNotification({ type: 'warning', title: 'Description requise' }); return; }
    const { error } = await supabase.from('soins_pansements').insert(payload);
    if (error) { addNotification({ type: 'danger', title: 'Erreur', message: error.message }); return; }
    addNotification({ type: 'success', title: 'Soin enregistré' });
    await _loadTab('soins', patientId, getRole());
  });
}

// ── Onglet : Ordonnances ─────────────────────────────────────────────────────

async function _tabOrdonnances(id) {
  const { data } = await supabase
    .from('ordonnances')
    .select('*, profiles(prenom, nom)')
    .eq('patient_id', id)
    .order('date_emission', { ascending: false });

  return `
    <div>
      ${!data?.length
        ? `<p style="color:var(--color-text-muted);">Aucune ordonnance.</p>`
        : data.map(o => `
          <div class="card mb-4">
            <div class="card__header">
              <div>
                <div class="card__title">📋 ${o.reference}</div>
                <div class="card__subtitle">Émise le ${formatDate(o.date_emission)}
                  ${o.profiles ? ` · Dr ${o.profiles.prenom} ${o.profiles.nom}` : ''}
                </div>
              </div>
              <span class="badge badge--${o.statut === 'active' ? 'success' : o.statut === 'expiree' ? 'warning' : 'neutral'}">${o.statut}</span>
            </div>
            <div class="card__body"><pre style="white-space:pre-wrap;font-size:.875rem;font-family:inherit;">${o.contenu}</pre></div>
          </div>`).join('')}
    </div>`;
}

// ── Onglet : Notes de suivi ──────────────────────────────────────────────────

async function _tabNotes(id, role) {
  const canWrite = can(role, 'note.write');
  const { data } = await supabase
    .from('notes_suivi')
    .select('*')
    .eq('patient_id', id)
    .order('updated_at', { ascending: false });

  return `
    ${canWrite ? `
      <div style="margin-bottom:var(--space-4);padding:var(--space-4);background:var(--color-surface-raised);
           border-radius:var(--radius-lg);border:1px solid var(--color-border);">
        <textarea class="textarea" id="new-note" rows="3" placeholder="Saisir une note de suivi…"></textarea>
        <div style="margin-top:var(--space-2);">
          <button class="btn btn--primary btn--sm" id="btn-add-note">Enregistrer</button>
        </div>
      </div>` : ''}
    <div id="notes-list">
      ${!data?.length
        ? `<p style="color:var(--color-text-muted);">Aucune note de suivi.</p>`
        : data.map(n => `
          <div style="padding:var(--space-3) 0;border-bottom:1px solid var(--color-border);">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
              <span style="font-size:.75rem;font-weight:600;color:var(--color-text-muted);">
                Note de suivi
              </span>
              <span style="font-size:.6875rem;color:var(--color-text-muted);">${timeAgo(n.updated_at)}</span>
            </div>
            <p style="font-size:.875rem;margin:0;">${n.contenu ?? ''}</p>
          </div>`).join('')}
    </div>`;
}

function _bindNoteEvents(patientId, role) {
  document.getElementById('btn-add-note')?.addEventListener('click', async () => {
    const contenu = document.getElementById('new-note')?.value.trim();
    if (!contenu) return;
    const { error } = await supabase.from('notes_suivi').insert({ patient_id: patientId, contenu });
    if (error) { addNotification({ type: 'danger', title: 'Erreur', message: error.message }); return; }
    addNotification({ type: 'success', title: 'Note enregistrée' });
    await _loadTab('notes', patientId, role);
  });
}

// ── Onglet : Documents ───────────────────────────────────────────────────────

async function _tabDocuments(id) {
  const { data } = await supabase
    .from('documents')
    .select('*')
    .eq('patient_id', id)
    .order('created_at', { ascending: false });

  return `
    <div class="table-wrapper" style="border:none;box-shadow:none;">
      <table class="table">
        <thead><tr><th>Nom</th><th>Type</th><th>Date</th><th>Taille</th></tr></thead>
        <tbody>
          ${!data?.length
            ? `<tr><td colspan="4"><div class="table-empty"><div class="table-empty__text">Aucun document</div></div></td></tr>`
            : data.map(d => `
              <tr>
                <td style="font-weight:500;">📄 ${d.nom}</td>
                <td><span class="badge badge--neutral">${d.type_doc}</span></td>
                <td>${formatDateTime(d.created_at)}</td>
                <td style="color:var(--color-text-muted);font-size:.75rem;">
                  ${d.taille_bytes ? `${(d.taille_bytes / 1024).toFixed(1)} Ko` : '—'}
                </td>
              </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _field(label, value) {
  return `
    <div style="margin-bottom:var(--space-4);">
      <div style="font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;
                  color:var(--color-text-muted);margin-bottom:3px;">${label}</div>
      <div style="font-size:.9375rem;">${value ?? '—'}</div>
    </div>`;
}

function _erreur(msg) {
  return `<div class="table-empty"><div class="table-empty__icon">⚠️</div><div class="table-empty__text">${msg}</div></div>`;
}
