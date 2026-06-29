/**
 * [ candy-e ] — MODULE TOURNÉE 24H EHPAD
 * Interface tactile de traçabilité des soins quotidiens
 */

import { supabase }        from '../../core/supabase.client.js';
import { getRole, addNotification } from '../../core/state.js';
import { can }             from '../../core/rbac.js';
import { formatDate, todayISO } from '../../utils/date.js';
import { formatNomComplet }     from '../../utils/format.js';

const TOURNEES_DEF = [
  { id: 'matinale',   label: 'Tournée Matinale',         heure: '07h30 – 09h00', icon: '🌅', sections: ['toilette','habillage','repas','elimination'] },
  { id: 'dejeuner',   label: 'Déjeuner & Sieste',        heure: '12h00 – 13h30', icon: '🍽️', sections: ['repas','elimination'] },
  { id: 'sieste',     label: 'Retour de Sieste',         heure: '14h30 – 15h15', icon: '😴', sections: ['elimination'] },
  { id: 'apres_midi', label: 'Après-Midi — Collation',   heure: '15h30 – 16h30', icon: '🍎', sections: ['collation'] },
  { id: 'soir',       label: 'Soir — Dîner & Coucher',   heure: '18h30 – 20h30', icon: '🌙', sections: ['repas','elimination'] },
  { id: 'nuit_1',     label: 'Ronde de Nuit N°1',        heure: '23h30 – 00h30', icon: '🌑', sections: ['nuit'] },
  { id: 'nuit_2',     label: 'Ronde de Nuit N°2',        heure: '04h30 – 05h30', icon: '🌒', sections: ['nuit_fin'] },
];

let _selectedPatientId = null;
let _selectedDate      = todayISO();
let _editingTournee    = null;

export async function mountTournee() {
  const main = document.getElementById('main-content');
  if (!main) return;

  const role     = getRole();
  const canWrite = can(role, 'tournee.write');

  main.innerHTML = `
    <div class="page-header">
      <div class="page-header__eyebrow">Traçabilité des soins</div>
      <h1 class="page-header__title">Tournées 24H</h1>
    </div>

    <div class="card mb-5">
      <div class="card__body">
        <div style="display:flex;gap:var(--space-4);flex-wrap:wrap;align-items:flex-end;">
          <div class="form-group" style="min-width:240px;margin:0;">
            <label class="label">Résident</label>
            <select class="select" id="tournee-patient" style="width:100%;"></select>
          </div>
          <div class="form-group" style="margin:0;">
            <label class="label">Date</label>
            <input class="input" type="date" id="tournee-date" value="${_selectedDate}" style="width:180px;" />
          </div>
          <button class="btn btn--primary" id="btn-charger-tournee">Charger</button>
        </div>
      </div>
    </div>

    <div id="hydratation-bar" style="display:none;" class="card mb-4">
      <div class="card__body" style="padding:var(--space-3) var(--space-5);">
        <div style="display:flex;align-items:center;gap:var(--space-4);flex-wrap:wrap;">
          <span style="font-size:.875rem;font-weight:600;">💧 Hydratation du jour :</span>
          <div id="hydratation-verres" style="display:flex;gap:.25rem;"></div>
          <span id="hydratation-total" style="font-size:.875rem;color:var(--color-text-muted);"></span>
        </div>
      </div>
    </div>

    <div id="tournee-content">
      <div style="text-align:center;padding:var(--space-8);color:var(--color-text-muted);">
        <div style="font-size:2.5rem;margin-bottom:var(--space-3);">🔄</div>
        <p>Sélectionnez un résident et une date pour afficher les tournées.</p>
      </div>
    </div>

    <!-- Modal saisie tournée -->
    <div class="modal-backdrop hidden" id="tournee-modal">
      <div class="modal" style="max-width:620px;">
        <div class="modal__header">
          <div class="modal__title" id="tournee-modal-title">Saisie tournée</div>
          <button class="modal__close" id="tournee-modal-close">✕</button>
        </div>
        <div class="modal__body" id="tournee-modal-body"></div>
        <div class="modal__footer">
          <button class="btn btn--outline" id="tournee-modal-cancel">Annuler</button>
          <button class="btn btn--primary" id="tournee-modal-save">Enregistrer</button>
        </div>
      </div>
    </div>
  `;

  await _loadPatientOptions();
  _bindMainEvents(canWrite);
}

async function _loadPatientOptions() {
  const sel = document.getElementById('tournee-patient');
  if (!sel) return;
  const { data } = await supabase.from('patients').select('id, nom, prenom').eq('actif', true).order('nom');
  sel.innerHTML = `<option value="">— Choisir un résident —</option>` +
    (data ?? []).map(p => `<option value="${p.id}">${formatNomComplet(p.nom, p.prenom)}</option>`).join('');
  if (_selectedPatientId) sel.value = _selectedPatientId;
}

function _bindMainEvents(canWrite) {
  document.getElementById('btn-charger-tournee')?.addEventListener('click', async () => {
    const pid   = document.getElementById('tournee-patient')?.value;
    const date  = document.getElementById('tournee-date')?.value;
    if (!pid) { addNotification({ type: 'warning', title: 'Sélectionnez un résident' }); return; }
    _selectedPatientId = pid;
    _selectedDate      = date;
    await _renderTournees(canWrite);
  });

  document.getElementById('tournee-modal-close')?.addEventListener('click',  () => document.getElementById('tournee-modal')?.classList.add('hidden'));
  document.getElementById('tournee-modal-cancel')?.addEventListener('click', () => document.getElementById('tournee-modal')?.classList.add('hidden'));
  document.getElementById('tournee-modal-save')?.addEventListener('click',   _saveTournee);
}

async function _renderTournees(canWrite) {
  const el = document.getElementById('tournee-content');
  if (!el || !_selectedPatientId) return;

  const { data: existing } = await supabase
    .from('tournees_soins')
    .select('*')
    .eq('patient_id', _selectedPatientId)
    .eq('date_soin', _selectedDate);

  const byType = {};
  (existing ?? []).forEach(t => { byType[t.type_tournee] = t; });

  // Calcul hydratation totale
  const totalVerres = (existing ?? []).reduce((sum, t) => sum + (t.nb_verres_eau ?? 0), 0);
  _renderHydratation(totalVerres);

  el.innerHTML = TOURNEES_DEF.map(def => {
    const saisie = byType[def.id];
    return `
      <div class="card mb-4 tournee-card" data-type="${def.id}">
        <div class="card__header" style="padding:var(--space-3) var(--space-5);">
          <div style="display:flex;align-items:center;gap:var(--space-3);">
            <span style="font-size:1.5rem;">${def.icon}</span>
            <div>
              <div class="card__title" style="font-size:.9375rem;">${def.label}</div>
              <div class="card__subtitle" style="font-size:.75rem;">${def.heure}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:var(--space-2);">
            ${saisie ? `<span class="badge badge--success">✓ Saisi</span>` : `<span class="badge badge--neutral">En attente</span>`}
            ${canWrite ? `
              <button class="btn btn--primary btn--sm btn-saisir-tournee" data-type="${def.id}"
                      style="white-space:nowrap;">
                ${saisie ? '✏️ Modifier' : '+ Saisir'}
              </button>` : ''}
          </div>
        </div>
        ${saisie ? `<div class="card__body" style="padding:var(--space-3) var(--space-5);border-top:1px solid var(--color-border);">${_renderSummary(def, saisie)}</div>` : ''}
      </div>`;
  }).join('');

  if (canWrite) {
    el.querySelectorAll('.btn-saisir-tournee').forEach(btn => {
      btn.addEventListener('click', () => _openModal(btn.dataset.type, byType[btn.dataset.type]));
    });
  }
}

function _renderHydratation(total) {
  const bar = document.getElementById('hydratation-bar');
  const verresEl = document.getElementById('hydratation-verres');
  const totalEl  = document.getElementById('hydratation-total');
  if (!bar || !verresEl || !totalEl) return;

  bar.style.display = '';
  const goal = 10;
  verresEl.innerHTML = Array.from({ length: goal }, (_, i) => `
    <span style="font-size:1.25rem;opacity:${i < total ? 1 : 0.2};" title="${i + 1} verre(s)">💧</span>
  `).join('');
  totalEl.textContent = `${total} / ${goal} verres`;
}

function _renderSummary(def, saisie) {
  const parts = [];

  if (def.sections.includes('toilette') && saisie.type_toilette) {
    const labels = { complete_lit: 'Toilette complète au lit', partielle_lit: 'Toilette partielle au lit', lavabo: 'Toilette au lavabo', douche: 'Douche', refus: 'Refus de toilette' };
    parts.push(`<span class="badge badge--neutral">${labels[saisie.type_toilette] ?? saisie.type_toilette}</span>`);
  }
  if (saisie.habillage) parts.push(`<span class="badge badge--success">✓ Habillage</span>`);
  if (saisie.prevention_escarres) parts.push(`<span class="badge badge--neutral">Prévention escarres</span>`);

  if (def.sections.includes('repas') && saisie.repas) {
    const labels = { pris: '✓ Repas pris', partiel: '½ Partiel', refus: '⚠️ Refus repas' };
    const cls    = { pris: 'badge--success', partiel: 'badge--warning', refus: 'badge--danger' };
    parts.push(`<span class="badge ${cls[saisie.repas] ?? 'badge--neutral'}">${labels[saisie.repas] ?? saisie.repas}</span>`);
  }
  if (saisie.nb_verres_eau > 0) parts.push(`<span class="badge badge--neutral">💧 ${saisie.nb_verres_eau} verre(s)</span>`);
  if (saisie.collation_prise) {
    parts.push(`<span class="badge ${saisie.collation_prise === 'prise' ? 'badge--success' : 'badge--warning'}">${saisie.collation_prise === 'prise' ? '✓ Collation prise' : 'Refus collation'}</span>`);
  }

  if (saisie.mode_elimination) {
    const labels = { change: 'Au change', toilettes: 'Toilettes', chaise_percee: 'Chaise percée', bassin: 'Bassin' };
    parts.push(`<span class="badge badge--neutral">${labels[saisie.mode_elimination] ?? saisie.mode_elimination}</span>`);
  }
  if (saisie.urines) {
    const labels = { ok: '💧 Urines OK', absentes: 'Urines absentes', saturees: '⚠️ Protection saturée', rien: 'Rien constaté' };
    const cls    = { ok: 'badge--success', saturees: 'badge--warning' };
    parts.push(`<span class="badge ${cls[saisie.urines] ?? 'badge--neutral'}">${labels[saisie.urines] ?? saisie.urines}</span>`);
  }
  if (saisie.selles) {
    const labels = { ok_moulees: '🟢 Selles normales', absentes: 'Selles absentes', liquides: '🔴 Diarrhée', rien: 'Rien' };
    const cls    = { ok_moulees: 'badge--success', liquides: 'badge--danger' };
    parts.push(`<span class="badge ${cls[saisie.selles] ?? 'badge--neutral'}">${labels[saisie.selles] ?? saisie.selles}</span>`);
  }
  if (saisie.protection_type) {
    const labels = { pull_up: 'Pull-Up', change_complet: 'Change Complet', anatomique: 'Anatomique', alese: 'Alèse', nuit: 'Change Nuit' };
    parts.push(`<span class="badge badge--neutral">${labels[saisie.protection_type] ?? saisie.protection_type}</span>`);
  }

  if (saisie.etat_sommeil) {
    const labels = { calme: '✓ Sommeil calme', agite: '⚠️ Agité', insomnie: '🔴 Insomnie' };
    const cls    = { calme: 'badge--success', agite: 'badge--warning', insomnie: 'badge--danger' };
    parts.push(`<span class="badge ${cls[saisie.etat_sommeil] ?? 'badge--neutral'}">${labels[saisie.etat_sommeil] ?? saisie.etat_sommeil}</span>`);
  }
  if (saisie.protection_etat) {
    const labels = { seche: '✓ Protection sèche', ok: '✓ Protection OK', saturee: '⚠️ Saturée' };
    const cls    = { seche: 'badge--success', ok: 'badge--success', saturee: 'badge--warning' };
    parts.push(`<span class="badge ${cls[saisie.protection_etat] ?? 'badge--neutral'}">${labels[saisie.protection_etat] ?? saisie.protection_etat}</span>`);
  }

  const badges = parts.length ? `<div style="display:flex;gap:.375rem;flex-wrap:wrap;margin-bottom:${saisie.transmission ? 'var(--space-2)' : '0'};">${parts.join('')}</div>` : '';
  const trans  = saisie.transmission
    ? `<div style="font-size:.8125rem;color:var(--color-text-secondary);font-style:italic;border-top:1px solid var(--color-border);margin-top:var(--space-2);padding-top:var(--space-2);">
         📝 ${saisie.transmission}
       </div>`
    : '';
  return badges + trans || '<span style="color:var(--color-text-muted);font-size:.875rem;">Aucun détail saisi</span>';
}

function _openModal(type, existing) {
  _editingTournee = { type, existing };
  const def = TOURNEES_DEF.find(d => d.id === type);
  const modal = document.getElementById('tournee-modal');
  const title = document.getElementById('tournee-modal-title');
  const body  = document.getElementById('tournee-modal-body');
  if (!modal || !def) return;

  title.textContent = `${def.icon} ${def.label} — ${def.heure}`;
  body.innerHTML    = _renderForm(def, existing);
  modal.classList.remove('hidden');
}

function _renderForm(def, d = {}) {
  let html = '';

  if (def.sections.includes('toilette')) {
    html += `
      <div class="form-group">
        <label class="label">Type de toilette</label>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
          ${_btnGroup('type_toilette', [
            { v: 'complete_lit',  l: 'Complète au lit' },
            { v: 'partielle_lit', l: 'Partielle au lit' },
            { v: 'lavabo',        l: 'Au lavabo' },
            { v: 'douche',        l: 'Douche' },
            { v: 'refus',         l: '⚠️ Refus' },
          ], d.type_toilette)}
        </div>
      </div>
      <div style="display:flex;gap:var(--space-4);flex-wrap:wrap;margin-bottom:var(--space-4);">
        ${_checkbox('habillage', 'Habillage fait', d.habillage)}
        ${_checkbox('prevention_escarres', 'Prévention escarres', d.prevention_escarres)}
      </div>`;
  }

  if (def.sections.includes('repas')) {
    html += `
      <div class="form-group">
        <label class="label">Repas</label>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
          ${_btnGroup('repas', [
            { v: 'pris',    l: '✓ Pris entièrement' },
            { v: 'partiel', l: '½ Partiel' },
            { v: 'refus',   l: '⚠️ Refus' },
          ], d.repas)}
        </div>
      </div>
      <div class="form-group">
        <label class="label">Verres d'eau bus</label>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
          ${_btnGroup('nb_verres_eau', [
            { v: '0', l: '0' }, { v: '1', l: '+1' }, { v: '2', l: '+2' }, { v: '3', l: '+3' }
          ], String(d.nb_verres_eau ?? '0'))}
        </div>
      </div>`;
  }

  if (def.sections.includes('collation')) {
    html += `
      <div class="form-group">
        <label class="label">Collation & Hydratation</label>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
          ${_btnGroup('collation_prise', [
            { v: 'prise', l: '✓ Collation prise' },
            { v: 'refus', l: '⚠️ Refus' },
          ], d.collation_prise)}
        </div>
      </div>
      <div class="form-group">
        <label class="label">Verres d'eau bus</label>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
          ${_btnGroup('nb_verres_eau', [
            { v: '0', l: '0' }, { v: '1', l: '+1' }, { v: '2', l: '+2' }, { v: '3', l: '+3' }
          ], String(d.nb_verres_eau ?? '0'))}
        </div>
      </div>`;
  }

  if (def.sections.includes('elimination')) {
    html += `
      <div class="form-group">
        <label class="label">Mode d'élimination</label>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
          ${_btnGroup('mode_elimination', [
            { v: 'change',        l: '🛡️ Au change' },
            { v: 'toilettes',     l: '🚽 Toilettes' },
            { v: 'chaise_percee', l: '🪑 Chaise percée' },
            { v: 'bassin',        l: 'Bassin' },
          ], d.mode_elimination)}
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">Urines</label>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
            ${_btnGroup('urines', [
              { v: 'ok',       l: '💧 OK' },
              { v: 'absentes', l: 'Absentes' },
              { v: 'saturees', l: '⚠️ Saturées' },
              { v: 'rien',     l: 'Rien / Incontinent' },
            ], d.urines)}
          </div>
        </div>
        <div class="form-group">
          <label class="label">Selles</label>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
            ${_btnGroup('selles', [
              { v: 'ok_moulees', l: '🟢 Normales' },
              { v: 'absentes',   l: 'Absentes' },
              { v: 'liquides',   l: '🔴 Diarrhée' },
              { v: 'rien',       l: 'Rien' },
            ], d.selles)}
          </div>
        </div>
      </div>
      <div class="form-group">
        <label class="label">Protection posée</label>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
          ${_btnGroup('protection_type', [
            { v: 'pull_up',        l: 'Pull-Up' },
            { v: 'change_complet', l: 'Change complet' },
            { v: 'anatomique',     l: 'Anatomique' },
            { v: 'alese',          l: 'Alèse seule' },
          ], d.protection_type)}
        </div>
      </div>`;
  }

  if (def.sections.includes('nuit')) {
    html += `
      <div class="form-group">
        <label class="label">Mode de contrôle</label>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
          ${_btnGroup('mode_elimination', [
            { v: 'change',   l: 'Au change au lit' },
            { v: 'bassin',   l: 'Bassin posé' },
          ], d.mode_elimination)}
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">Urines</label>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
            ${_btnGroup('urines', [
              { v: 'ok',       l: '💧 OK' },
              { v: 'saturees', l: '⚠️ Saturées' },
              { v: 'absentes', l: 'Absentes' },
            ], d.urines)}
          </div>
        </div>
        <div class="form-group">
          <label class="label">Selles</label>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
            ${_btnGroup('selles', [
              { v: 'ok_moulees', l: '🟢 Normales' },
              { v: 'absentes',   l: 'Absentes' },
              { v: 'liquides',   l: '🔴 Diarrhée' },
            ], d.selles)}
          </div>
        </div>
      </div>
      <div class="form-group">
        <label class="label">Protection posée</label>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
          ${_btnGroup('protection_type', [
            { v: 'nuit',           l: 'Change Nuit' },
            { v: 'change_complet', l: 'Change Complet' },
            { v: 'alese',          l: 'Alèse seule' },
          ], d.protection_type)}
        </div>
      </div>`;
  }

  if (def.sections.includes('nuit_fin')) {
    html += `
      <div class="form-group">
        <label class="label">État général</label>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
          ${_btnGroup('etat_sommeil', [
            { v: 'calme',    l: '✓ Sommeil calme' },
            { v: 'agite',    l: '⚠️ Agité' },
            { v: 'insomnie', l: '🔴 Insomnie' },
          ], d.etat_sommeil)}
        </div>
      </div>
      <div class="form-group">
        <label class="label">Protection</label>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
          ${_btnGroup('protection_etat', [
            { v: 'seche', l: '✓ Sèche / OK' },
            { v: 'ok',    l: '✓ OK' },
            { v: 'saturee', l: '⚠️ Saturée' },
          ], d.protection_etat)}
        </div>
      </div>`;
  }

  html += `
    <div class="form-group">
      <label class="label">Transmission ciblée (optionnel)</label>
      <textarea class="textarea" id="f-transmission" rows="2"
                placeholder="Observations, alertes à transmettre à l'équipe…">${d.transmission ?? ''}</textarea>
    </div>`;

  return html;
}

function _btnGroup(name, options, selected) {
  return options.map(o => `
    <button type="button"
            class="btn btn--sm btn-toggle-group ${o.v === selected ? 'btn--primary' : 'btn--outline'}"
            data-name="${name}" data-value="${o.v}">
      ${o.l}
    </button>`).join('');
}

function _checkbox(id, label, checked) {
  return `
    <label style="display:flex;align-items:center;gap:.5rem;font-size:.875rem;cursor:pointer;">
      <input type="checkbox" id="f-${id}" ${checked ? 'checked' : ''} />
      ${label}
    </label>`;
}

async function _saveTournee() {
  if (!_editingTournee || !_selectedPatientId) return;

  const { type, existing } = _editingTournee;
  const modal = document.getElementById('tournee-modal');

  // Lire les boutons toggle
  const values = {};
  modal?.querySelectorAll('.btn-toggle-group.btn--primary').forEach(btn => {
    const name = btn.dataset.name;
    if (name && !values[name]) values[name] = btn.dataset.value;
  });

  const payload = {
    patient_id:          _selectedPatientId,
    date_soin:           _selectedDate,
    type_tournee:        type,
    type_toilette:       values.type_toilette       ?? null,
    habillage:           document.getElementById('f-habillage')?.checked ?? false,
    prevention_escarres: document.getElementById('f-prevention_escarres')?.checked ?? false,
    repas:               values.repas               ?? null,
    nb_verres_eau:       parseInt(values.nb_verres_eau ?? '0'),
    collation_prise:     values.collation_prise      ?? null,
    mode_elimination:    values.mode_elimination     ?? null,
    urines:              values.urines               ?? null,
    selles:              values.selles               ?? null,
    protection_type:     values.protection_type      ?? null,
    etat_sommeil:        values.etat_sommeil         ?? null,
    protection_etat:     values.protection_etat      ?? null,
    transmission:        document.getElementById('f-transmission')?.value.trim() || null,
  };

  let error;
  if (existing?.id) {
    ({ error } = await supabase.from('tournees_soins').update(payload).eq('id', existing.id));
  } else {
    ({ error } = await supabase.from('tournees_soins').insert(payload));
  }

  if (error) { addNotification({ type: 'danger', title: 'Erreur', message: error.message }); return; }

  addNotification({ type: 'success', title: 'Tournée enregistrée' });
  modal?.classList.add('hidden');

  const canWrite = can(getRole(), 'tournee.write');
  await _renderTournees(canWrite);
}

// Délégation des clics sur les boutons toggle dans le modal
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-toggle-group');
  if (!btn) return;
  const name = btn.dataset.name;
  document.querySelectorAll(`.btn-toggle-group[data-name="${name}"]`).forEach(b => {
    b.classList.remove('btn--primary');
    b.classList.add('btn--outline');
  });
  btn.classList.remove('btn--outline');
  btn.classList.add('btn--primary');
});
