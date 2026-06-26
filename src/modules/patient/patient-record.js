/**
 * [ candy-e ] — MODULE FICHE PATIENT
 * Fichier : modules/patient/patient-record.js
 *
 * Fiche complète avec onglets dynamiques filtrés par rôle RBAC.
 * Chaque onglet charge ses données à la demande (lazy loading).
 */

import { supabase }               from '../../core/supabase.client.js';
import { getRole, getCurrentPatientId } from '../../core/state.js';
import { can, PATIENT_TABS }      from '../../core/rbac.js';
import { navigate }               from '../../core/router.js';
import { formatDate, formatDateTime, calcAge, timeAgo } from '../../utils/date.js';
import { formatNomComplet, formatGIR, orDash, formatRole } from '../../utils/format.js';
import { addNotification }        from '../../core/state.js';

// ─── Point d'entrée ───────────────────────────────────────────────────────────

export async function mountPatientRecord(activeTabId = null) {
  const main      = document.getElementById('main-content');
  const patientId = getCurrentPatientId();

  if (!main) return;

  if (!patientId) {
    main.innerHTML = `
      <div style="text-align:center;padding:4rem 2rem;">
        <div style="font-size:3rem;margin-bottom:1rem;">👤</div>
        <p>Aucun patient sélectionné. <a href="#patients" style="color:var(--color-primary);">Retour à la liste</a>.</p>
      </div>`;
    return;
  }

  // Chargement de l'état civil (toujours nécessaire pour l'en-tête)
  const { data: patient, error } = await supabase
    .from('patients_etat_civil')
    .select('*')
    .eq('id', patientId)
    .single();

  if (error || !patient) {
    main.innerHTML = `<div class="table-empty"><div class="table-empty__icon">⚠️</div><div class="table-empty__text">${error?.message ?? 'Patient introuvable'}</div></div>`;
    return;
  }

  const role         = getRole();
  const allowedTabs  = PATIENT_TABS.filter(t => can(role, t.permission));
  const firstTab     = activeTabId && allowedTabs.find(t => t.id === activeTabId)
    ? activeTabId
    : allowedTabs[0]?.id;

  main.innerHTML = `
    <!-- Fil d'Ariane -->
    <div style="display:flex;align-items:center;gap:.5rem;font-size:.8125rem;
                color:var(--color-text-muted);margin-bottom:var(--space-4);">
      <a href="#patients" style="color:var(--color-primary);">Patients</a>
      <span>›</span>
      <span>${formatNomComplet(patient.nom, patient.prenom)}</span>
    </div>

    <!-- En-tête du patient -->
    <div class="card mb-6" style="border-left:4px solid var(--color-primary);">
      <div class="card__body">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-4);flex-wrap:wrap;">
          <div style="display:flex;align-items:flex-start;gap:var(--space-4);">
            <!-- Avatar -->
            <div style="width:56px;height:56px;border-radius:var(--radius-lg);
                        background:var(--color-primary-light);
                        display:flex;align-items:center;justify-content:center;
                        font-size:1.5rem;flex-shrink:0;">👤</div>
            <div>
              <h2 style="font-size:var(--text-xl);font-weight:700;letter-spacing:-0.01em;">
                ${formatNomComplet(patient.nom, patient.prenom)}
              </h2>
              <div style="display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap;margin-top:.25rem;">
                <span style="font-size:.875rem;color:var(--color-text-secondary);">
                  Né(e) le ${formatDate(patient.date_naissance)} &nbsp;·&nbsp; ${calcAge(patient.date_naissance)} ans
                </span>
                <span class="badge ${patient.actif ? 'badge--success' : 'badge--neutral'}">
                  ${patient.actif ? 'Actif' : 'Sorti'}
                </span>
              </div>
              <div style="display:flex;gap:var(--space-4);margin-top:.5rem;flex-wrap:wrap;font-size:.8125rem;color:var(--color-text-muted);">
                ${patient.chambre ? `<span>🛏 Chambre ${patient.chambre}</span>` : ''}
                ${patient.date_entree ? `<span>📅 Entré(e) le ${formatDate(patient.date_entree)}</span>` : ''}
              </div>
            </div>
          </div>
          <button class="btn btn--outline btn--sm" onclick="navigate('patients')">← Retour</button>
        </div>
      </div>
    </div>

    <!-- Onglets -->
    <div class="card">
      <div style="display:flex;gap:var(--space-1);flex-wrap:wrap;
                  padding:var(--space-3) var(--space-4);
                  border-bottom:1px solid var(--color-border);
                  overflow-x:auto;" id="tabs-container" role="tablist">
        ${allowedTabs.map(tab => `
          <button class="tab-btn ${tab.id === firstTab ? 'active' : ''}"
                  role="tab"
                  data-tab="${tab.id}"
                  aria-selected="${tab.id === firstTab}"
                  aria-controls="tab-panel-${tab.id}">
            <span aria-hidden="true">${tab.icon}</span>
            ${tab.label}
          </button>`).join('')}
      </div>

      <!-- Contenu de l'onglet actif -->
      <div class="card__body" id="tab-content" role="tabpanel">
        <div style="text-align:center;padding:var(--space-6);color:var(--color-text-muted);">
          Chargement…
        </div>
      </div>
    </div>
  `;

  // Styles des onglets (inline pour isolation)
  _injectTabStyles();

  // Charger le premier onglet
  if (firstTab) await _loadTab(firstTab, patientId, role);

  // Événements des onglets
  document.getElementById('tabs-container')?.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      await _loadTab(btn.dataset.tab, patientId, role);
    });
  });
}

// ─── Styles des onglets ───────────────────────────────────────────────────────

function _injectTabStyles() {
  if (document.getElementById('tab-styles')) return;
  const style = document.createElement('style');
  style.id = 'tab-styles';
  style.textContent = `
    .tab-btn {
      display: inline-flex; align-items: center; gap: .375rem;
      padding: .5rem .75rem; border-radius: var(--radius-md);
      font-size: .8125rem; font-weight: 500; cursor: pointer;
      border: none; background: transparent; color: var(--color-text-secondary);
      transition: background var(--transition), color var(--transition);
      white-space: nowrap;
    }
    .tab-btn:hover { background: var(--color-surface-overlay); color: var(--color-text); }
    .tab-btn.active {
      background: var(--color-primary-light);
      color: var(--color-primary);
      font-weight: 600;
    }
  `;
  document.head.appendChild(style);
}

// ─── Dispatcher des onglets ───────────────────────────────────────────────────

async function _loadTab(tabId, patientId, role) {
  const content = document.getElementById('tab-content');
  if (!content) return;
  content.innerHTML = `<div style="text-align:center;padding:var(--space-6);color:var(--color-text-muted);">Chargement…</div>`;

  const loaders = {
    etat_civil:    () => _tabEtatCivil(patientId),
    constantes:    () => _tabConstantes(patientId, role),
    allergies:     () => _tabAllergies(patientId, role),
    antecedents:   () => _tabAntecedents(patientId),
    gir:           () => _tabGir(patientId),
    pathos:        () => _tabPathos(patientId),
    directives:    () => _tabDirectives(patientId),
    protocoles:    () => _tabProtocoles(patientId),
    transmissions: () => _tabTransmissions(patientId, role),
    traitements:   () => _tabTraitements(patientId, role),
    pansements:    () => _tabPansements(patientId),
  };

  const loader = loaders[tabId];
  if (loader) {
    content.innerHTML = await loader();
  } else {
    content.innerHTML = `<p style="color:var(--color-text-muted);">Module non disponible.</p>`;
  }
}

// ─── Onglets individuels ──────────────────────────────────────────────────────

async function _tabEtatCivil(id) {
  const { data: p } = await supabase.from('patients_etat_civil').select('*').eq('id', id).single();
  if (!p) return _erreur('Données introuvables');
  return `
    <div class="grid-2">
      ${_field('Nom', p.nom?.toUpperCase())}
      ${_field('Prénom', p.prenom)}
      ${_field('Nom d\'usage', orDash(p.nom_usage))}
      ${_field('Date de naissance', formatDate(p.date_naissance))}
      ${_field('Lieu de naissance', orDash(p.lieu_naissance))}
      ${_field('Nationalité', orDash(p.nationalite))}
      ${_field('N° Sécu', orDash(p.numero_secu))}
      ${_field('Situation familiale', orDash(p.situation_familiale))}
      ${_field('Adresse antérieure', orDash(p.adresse_anterieure))}
      ${_field('Chambre', orDash(p.chambre))}
      ${_field('Date d\'entrée', formatDate(p.date_entree))}
      ${_field('Contact urgence', orDash(p.contact_urgence_nom))}
      ${_field('Lien', orDash(p.contact_urgence_lien))}
      ${_field('Tél urgence', orDash(p.contact_urgence_tel))}
      ${_field('Protection juridique', p.sous_protection ? `Oui — ${orDash(p.type_protection)}` : 'Non')}
    </div>`;
}

async function _tabConstantes(id, role) {
  const { data } = await supabase
    .from('donnees_medicales_constantes')
    .select('*, profiles!donnees_medicales_constantes_saisie_par_fkey(prenom, nom)')
    .eq('patient_id', id)
    .order('date_mesure', { ascending: false })
    .limit(10);

  const canWrite = can(role, 'constantes');
  return `
    <div class="table-wrapper" style="border:none;box-shadow:none;">
      <table class="table">
        <thead>
          <tr>
            <th>Date</th><th>TA (mmHg)</th><th>FC (bpm)</th>
            <th>SpO₂ (%)</th><th>Temp (°C)</th><th>Poids (kg)</th>
            <th>Glycémie</th><th>Douleur /10</th><th>Saisi par</th>
          </tr>
        </thead>
        <tbody>
          ${!data?.length
            ? `<tr><td colspan="9" class="table-empty"><div class="table-empty__text">Aucune constante enregistrée</div></td></tr>`
            : data.map(c => `
              <tr>
                <td>${formatDateTime(c.date_mesure)}</td>
                <td>${c.tension_systolique && c.tension_diastolique ? `${c.tension_systolique}/${c.tension_diastolique}` : '—'}</td>
                <td>${orDash(c.frequence_cardiaque)}</td>
                <td>${c.saturation_o2 != null ? `<span class="badge ${c.saturation_o2 < 94 ? 'badge--danger' : 'badge--success'}">${c.saturation_o2}%</span>` : '—'}</td>
                <td>${c.temperature != null ? `<span class="${c.temperature > 38 ? 'text-danger' : ''}">${c.temperature}</span>` : '—'}</td>
                <td>${orDash(c.poids_kg)}</td>
                <td>${orDash(c.glycemie_mmol)}</td>
                <td>${c.echelle_douleur != null ? `<span class="badge ${c.echelle_douleur >= 7 ? 'badge--danger' : c.echelle_douleur >= 4 ? 'badge--warning' : 'badge--success'}">${c.echelle_douleur}/10</span>` : '—'}</td>
                <td style="color:var(--color-text-muted);font-size:.75rem;">${c.profiles ? `${c.profiles.prenom} ${c.profiles.nom}` : '—'}</td>
              </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function _tabAllergies(id) {
  const { data } = await supabase
    .from('donnees_medicales_allergies')
    .select('*')
    .eq('patient_id', id)
    .order('severite');

  return `
    <div class="grid-auto">
      ${!data?.length
        ? `<p style="color:var(--color-text-muted);">Aucune allergie renseignée.</p>`
        : data.map(a => `
          <div class="card card--raised" style="border-left:4px solid ${a.severite === 'anaphylaxie' || a.severite === 'sévère' ? 'var(--color-danger)' : 'var(--color-warning)'}">
            <div class="card__body">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem;">
                <span style="font-weight:600;">⚠️ ${a.substance}</span>
                <span class="badge badge--${a.severite === 'anaphylaxie' || a.severite === 'sévère' ? 'danger' : 'warning'}">${a.severite}</span>
              </div>
              <div style="font-size:.8125rem;color:var(--color-text-secondary);">
                <div>Type : ${a.type_allergie}</div>
                ${a.symptomes ? `<div>Symptômes : ${a.symptomes}</div>` : ''}
                <div>Confirmée : ${a.confirmee ? '✅ Oui' : '⏳ Non confirmée'}</div>
              </div>
            </div>
          </div>`).join('')}
    </div>`;
}

async function _tabAntecedents(id) {
  const { data } = await supabase
    .from('donnees_medicales_antecedents')
    .select('*')
    .eq('patient_id', id)
    .order('type_antecedent');

  return `
    <div class="table-wrapper" style="border:none;box-shadow:none;">
      <table class="table">
        <thead><tr><th>Type</th><th>Description</th><th>Début</th><th>Statut</th></tr></thead>
        <tbody>
          ${!data?.length
            ? `<tr><td colspan="4"><div class="table-empty"><div class="table-empty__text">Aucun antécédent</div></div></td></tr>`
            : data.map(a => `
              <tr>
                <td><span class="badge badge--neutral">${a.type_antecedent}</span></td>
                <td>${a.description}</td>
                <td>${a.date_debut ? formatDate(a.date_debut) : '—'}</td>
                <td><span class="badge ${a.actif ? 'badge--warning' : 'badge--success'}">${a.actif ? 'Actif' : 'Résolu'}</span></td>
              </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function _tabGir(id) {
  const { data } = await supabase
    .from('donnees_medicales_gir')
    .select('*, profiles!donnees_medicales_gir_evalue_par_fkey(prenom, nom)')
    .eq('patient_id', id)
    .order('date_evaluation', { ascending: false })
    .limit(5);

  return `
    <div>
      ${!data?.length
        ? `<p style="color:var(--color-text-muted);">Aucune évaluation GIR enregistrée.</p>`
        : data.map((g, i) => `
          <div class="card ${i > 0 ? 'mt-4' : ''}" style="${i > 0 ? 'opacity:.7' : ''}">
            <div class="card__header">
              <div>
                <div class="card__title">${formatGIR(g.niveau_gir)}</div>
                <div class="card__subtitle">Évaluation du ${formatDate(g.date_evaluation)}
                  ${g.profiles ? ` — par ${g.profiles.prenom} ${g.profiles.nom}` : ''}
                </div>
              </div>
              <span class="badge badge--${g.niveau_gir <= 2 ? 'danger' : g.niveau_gir <= 4 ? 'warning' : 'success'}" style="font-size:1rem;padding:.5rem 1rem;">
                GIR ${g.niveau_gir}
              </span>
            </div>
            ${g.observations ? `<div class="card__body"><p>${g.observations}</p></div>` : ''}
          </div>`).join('')}
    </div>`;
}

async function _tabPathos(id) {
  const { data } = await supabase
    .from('donnees_medicales_pathos')
    .select('*')
    .eq('patient_id', id)
    .order('statut');

  return `
    <div class="table-wrapper" style="border:none;box-shadow:none;">
      <table class="table">
        <thead><tr><th>Code CIM-10</th><th>Pathologie</th><th>Type</th><th>Diagnostic</th><th>Statut</th></tr></thead>
        <tbody>
          ${!data?.length
            ? `<tr><td colspan="5"><div class="table-empty"><div class="table-empty__text">Aucune pathologie</div></div></td></tr>`
            : data.map(p => `
              <tr>
                <td style="font-family:var(--font-mono);font-size:.75rem;">${orDash(p.code_cim10)}</td>
                <td style="font-weight:500;">${p.libelle}</td>
                <td><span class="badge badge--neutral">${p.type_pathologie}</span></td>
                <td>${p.date_diagnostic ? formatDate(p.date_diagnostic) : '—'}</td>
                <td><span class="badge badge--${p.statut === 'active' ? 'warning' : p.statut === 'guérie' ? 'success' : 'neutral'}">${p.statut}</span></td>
              </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function _tabDirectives(id) {
  const { data } = await supabase
    .from('directives_anticipees')
    .select('*')
    .eq('patient_id', id)
    .order('date_redaction', { ascending: false });

  return `
    <div>
      ${!data?.length
        ? `<p style="color:var(--color-text-muted);">Aucune directive anticipée enregistrée.</p>`
        : data.map(d => `
          <div class="card mb-4" style="border-left:4px solid var(--color-info);">
            <div class="card__header">
              <div>
                <div class="card__title">✍️ ${d.type_directive}</div>
                <div class="card__subtitle">Rédigée le ${formatDate(d.date_redaction)}${d.date_validite ? ` · Valable jusqu\'au ${formatDate(d.date_validite)}` : ''}</div>
              </div>
              ${d.document_numerise ? `<span class="badge badge--success">Document numérisé</span>` : ''}
            </div>
            <div class="card__body">
              <p>${d.contenu}</p>
              ${d.personne_confiance_nom ? `
                <div style="margin-top:var(--space-3);padding:var(--space-3);background:var(--color-surface-raised);border-radius:var(--radius-md);">
                  <strong>Personne de confiance :</strong> ${d.personne_confiance_nom}
                  ${d.personne_confiance_lien ? ` (${d.personne_confiance_lien})` : ''}
                  ${d.personne_confiance_tel ? ` — ${d.personne_confiance_tel}` : ''}
                </div>` : ''}
            </div>
          </div>`).join('')}
    </div>`;
}

async function _tabProtocoles(id) {
  const { data } = await supabase
    .from('protocoles')
    .select('*, profiles!protocoles_cree_par_fkey(prenom, nom)')
    .eq('patient_id', id)
    .eq('actif', true)
    .order('date_debut', { ascending: false });

  return `
    <div>
      ${!data?.length
        ? `<p style="color:var(--color-text-muted);">Aucun protocole actif.</p>`
        : data.map(p => `
          <div class="card mb-4">
            <div class="card__header">
              <div>
                <div class="card__title">📋 ${p.titre}</div>
                <div class="card__subtitle">
                  <span class="badge badge--neutral">${p.type_protocole}</span>
                  &nbsp;·&nbsp; Depuis le ${formatDate(p.date_debut)}
                  ${p.frequence ? ` · ${p.frequence}` : ''}
                </div>
              </div>
            </div>
            <div class="card__body"><p>${p.contenu}</p></div>
          </div>`).join('')}
    </div>`;
}

async function _tabTransmissions(id, role) {
  const { data } = await supabase
    .from('transmissions')
    .select('*, profiles!transmissions_saisie_par_fkey(prenom, nom, role)')
    .eq('patient_id', id)
    .order('cree_le', { ascending: false })
    .limit(20);

  const canWrite = can(role, 'transmission.write');
  return `
    ${canWrite ? `
      <div style="margin-bottom:var(--space-4);padding:var(--space-4);background:var(--color-surface-raised);border-radius:var(--radius-lg);border:1px solid var(--color-border);">
        <textarea class="textarea" id="new-transmission" rows="2" placeholder="Nouvelle transmission…"></textarea>
        <div style="display:flex;gap:var(--space-2);margin-top:var(--space-2);">
          <select class="select" id="trans-type" style="width:180px;">
            <option value="observation">Observation</option>
            <option value="alerte">Alerte</option>
            <option value="consigne">Consigne</option>
            <option value="information">Information</option>
          </select>
          <select class="select" id="trans-prio" style="width:140px;">
            <option value="normale">Normale</option>
            <option value="urgente">Urgente</option>
            <option value="critique">Critique</option>
          </select>
          <button class="btn btn--primary btn--sm" id="btn-add-trans">Envoyer</button>
        </div>
      </div>` : ''}
    <div id="trans-list">
      ${!data?.length
        ? `<p style="color:var(--color-text-muted);">Aucune transmission.</p>`
        : data.map(t => `
          <div style="display:flex;gap:var(--space-3);padding:var(--space-3) 0;border-bottom:1px solid var(--color-border);">
            <div style="width:4px;border-radius:2px;align-self:stretch;min-height:40px;flex-shrink:0;
                        background:${t.priorite === 'critique' ? 'var(--color-danger)' : t.priorite === 'urgente' ? 'var(--color-warning)' : 'var(--color-border)'}"></div>
            <div style="flex:1;">
              <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:3px;flex-wrap:wrap;">
                <span class="badge badge--neutral" style="font-size:.6875rem;">${t.type_transmission}</span>
                ${t.priorite !== 'normale' ? `<span class="badge badge--${t.priorite}" style="font-size:.6875rem;">${t.priorite}</span>` : ''}
                <span style="font-size:.6875rem;color:var(--color-text-muted);margin-left:auto;">${timeAgo(t.cree_le)}</span>
              </div>
              <p style="font-size:.875rem;margin:0 0 3px;">${t.contenu}</p>
              <span style="font-size:.6875rem;color:var(--color-text-muted);">
                ${t.profiles ? `${t.profiles.prenom} ${t.profiles.nom} — ${formatRole(t.profiles.role)}` : '—'}
              </span>
            </div>
          </div>`).join('')}
    </div>`;
}

async function _tabTraitements(id, role) {
  const { data } = await supabase
    .from('traitements')
    .select('*, profiles!traitements_prescrit_par_fkey(prenom, nom)')
    .eq('patient_id', id)
    .order('actif', { ascending: false })
    .order('date_debut', { ascending: false });

  return `
    <div class="table-wrapper" style="border:none;box-shadow:none;">
      <table class="table">
        <thead>
          <tr><th>DCI</th><th>Nom comm.</th><th>Dose</th><th>Voie</th><th>Fréquence</th><th>Début</th><th>Statut</th></tr>
        </thead>
        <tbody>
          ${!data?.length
            ? `<tr><td colspan="7"><div class="table-empty"><div class="table-empty__text">Aucun traitement</div></div></td></tr>`
            : data.map(t => `
              <tr ${!t.actif ? 'style="opacity:.6"' : ''}>
                <td style="font-weight:500;">💊 ${t.dci}</td>
                <td style="color:var(--color-text-muted);">${orDash(t.nom_commercial)}</td>
                <td>${t.dose}</td>
                <td><span class="badge badge--neutral">${t.voie_administration}</span></td>
                <td>${t.frequence}</td>
                <td>${formatDate(t.date_debut)}</td>
                <td><span class="badge ${t.actif ? 'badge--success' : 'badge--neutral'}">${t.actif ? 'Actif' : 'Arrêté'}</span></td>
              </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function _tabPansements(id) {
  const { data } = await supabase
    .from('soins_pansement')
    .select('*, profiles!soins_pansement_saisie_par_fkey(prenom, nom)')
    .eq('patient_id', id)
    .order('date_soin', { ascending: false })
    .limit(15);

  return `
    <div class="grid-auto">
      ${!data?.length
        ? `<p style="color:var(--color-text-muted);">Aucun soin enregistré.</p>`
        : data.map(s => `
          <div class="card">
            <div class="card__body">
              <div style="display:flex;justify-content:space-between;margin-bottom:.5rem;">
                <span style="font-weight:600;">🩹 ${s.type_soin}</span>
                ${s.stade_escarre ? `<span class="badge badge--warning">Stade ${s.stade_escarre}</span>` : ''}
              </div>
              ${s.localisation ? `<div style="font-size:.8125rem;color:var(--color-text-secondary);">📍 ${s.localisation}</div>` : ''}
              <p style="font-size:.8125rem;margin:.25rem 0;">${s.description}</p>
              ${s.surface_cm2 ? `<div style="font-size:.75rem;color:var(--color-text-muted);">Surface : ${s.surface_cm2} cm²</div>` : ''}
              ${s.materiel_utilise ? `<div style="font-size:.75rem;color:var(--color-text-muted);">Matériel : ${s.materiel_utilise}</div>` : ''}
              <div style="margin-top:.5rem;font-size:.75rem;color:var(--color-text-muted);">
                ${formatDateTime(s.date_soin)} — ${s.profiles ? `${s.profiles.prenom} ${s.profiles.nom}` : '—'}
              </div>
            </div>
          </div>`).join('')}
    </div>`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
