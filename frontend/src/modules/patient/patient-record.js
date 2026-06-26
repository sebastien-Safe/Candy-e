/**
 * [ candy-e ] — FICHE PATIENT
 */

import { supabase }                    from '../../core/supabase.client.js';
import { getRole, getCurrentPatientId } from '../../core/state.js';
import { can, PATIENT_TABS }           from '../../core/rbac.js';
import { navigate }                    from '../../core/router.js';
import { formatDate, formatDateTime, calcAge, timeAgo } from '../../utils/date.js';
import { formatNomComplet, orDash, formatRole } from '../../utils/format.js';
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
    consultations: () => _tabConsultations(patientId, role),
    ordonnances:   () => _tabOrdonnances(patientId),
    documents:     () => _tabDocuments(patientId),
    notes:         () => _tabNotes(patientId, role),
  };

  const loader = loaders[tabId];
  content.innerHTML = loader ? await loader() : `<p style="color:var(--color-text-muted);">Module non disponible.</p>`;

  // Brancher les boutons après injection HTML
  if (tabId === 'notes') _bindNoteEvents(patientId, role);
  if (tabId === 'consultations' && can(role, 'consultation.write')) _bindConsultationEvents(patientId);
}

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
    ${p.allergies?.length ? `
      <div style="margin-top:var(--space-4);padding:var(--space-3);background:var(--color-danger-light);
                  border:1px solid var(--color-danger);border-radius:var(--radius-md);">
        <strong>⚠️ Allergies :</strong> ${p.allergies.join(', ')}
      </div>` : ''}`;
}

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
            <input class="input" type="date" id="c-date" value="${new Date().toISOString().split('T')[0]}" />
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
      patient_id: patientId,
      date_consult: document.getElementById('c-date').value,
      type_acte:    document.getElementById('c-type').value,
      titre:        document.getElementById('c-titre').value.trim(),
      notes:        document.getElementById('c-notes').value.trim() || null,
    };
    if (!payload.titre) { addNotification({ type: 'warning', title: 'Titre requis' }); return; }
    const { error } = await supabase.from('consultations').insert(payload);
    if (error) { addNotification({ type: 'danger', title: 'Erreur', message: error.message }); return; }
    addNotification({ type: 'success', title: 'Consultation enregistrée' });
    await _loadTab('consultations', patientId, getRole());
  });
}

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

async function _tabNotes(id, role) {
  const canWrite = can(role, 'note.write');
  const { data } = await supabase
    .from('notes_suivi')
    .select('*, profiles(prenom, nom)')
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
                ${n.profiles ? `${n.profiles.prenom} ${n.profiles.nom}` : '—'}
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
