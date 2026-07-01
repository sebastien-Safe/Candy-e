/**
 * [ candy-e ] — LISTE PATIENTS
 */

import { supabase }             from '../../core/supabase.client.js';
import { getRole }              from '../../core/state.js';
import { can }                  from '../../core/rbac.js';
import { navigate }             from '../../core/router.js';
import { formatDate, calcAge }  from '../../utils/date.js';
import { formatNomComplet, orDash, formatGIR, girIcon } from '../../utils/format.js';
import { openGirCalculator } from './gir-calculator.js';
import { addNotification, setCurrentPatientId } from '../../core/state.js';

let _patients = [];
let _sortKey  = 'nom';
let _sortAsc  = true;
let _search   = '';
let _page     = 1;
const PAGE_SIZE = 20;

export async function mountPatientList() {
  const main = document.getElementById('main-content');
  if (!main) return;

  const role     = getRole();
  const canWrite = can(role, 'patient.write');

  main.innerHTML = `
    <div class="page-header">
      <div class="page-header__eyebrow">Dossiers patients</div>
      <h1 class="page-header__title">Patients</h1>
    </div>
    <div class="table-toolbar">
      <div class="table-toolbar__left">
        <div class="input-wrapper" style="width:280px;">
          <span class="input-wrapper__icon">🔍</span>
          <input class="input" type="search" id="search-patient"
                 placeholder="Nom, prénom, ville…" autocomplete="off" />
        </div>
        <select class="select" id="filter-statut" style="width:160px;">
          <option value="">Tous</option>
          <option value="true">Actifs</option>
          <option value="false">Inactifs</option>
        </select>
      </div>
      <div class="table-toolbar__right">
        ${canWrite ? `<button class="btn btn--primary" id="btn-add-patient">+ Nouveau patient</button>` : ''}
      </div>
    </div>
    <div class="table-wrapper" id="patient-table-wrapper">
      <div style="padding:var(--space-8);text-align:center;color:var(--color-text-muted);">Chargement…</div>
    </div>
    <div class="table-pagination" id="patient-pagination"></div>

    <div class="modal-backdrop hidden" id="patient-modal">
      <div class="modal">
        <div class="modal__header">
          <div class="modal__title" id="modal-title">Nouveau patient</div>
          <button class="modal__close" id="modal-close" aria-label="Fermer">✕</button>
        </div>
        <div class="modal__body">
          <form id="patient-form" novalidate>
            <div class="form-row">
              <div class="form-group">
                <label class="label label--required" for="f-nom">Nom</label>
                <input class="input" type="text" id="f-nom" required />
              </div>
              <div class="form-group">
                <label class="label label--required" for="f-prenom">Prénom</label>
                <input class="input" type="text" id="f-prenom" required />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="label label--required" for="f-ddn">Date de naissance</label>
                <input class="input" type="date" id="f-ddn" required />
              </div>
              <div class="form-group">
                <label class="label" for="f-sexe">Sexe</label>
                <select class="select" id="f-sexe">
                  <option value="">—</option>
                  <option value="M">Masculin</option>
                  <option value="F">Féminin</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="label" for="f-tel">Téléphone</label>
                <input class="input" type="tel" id="f-tel" />
              </div>
              <div class="form-group">
                <label class="label" for="f-email">E-mail</label>
                <input class="input" type="email" id="f-email" />
              </div>
            </div>
            <div class="form-group">
              <label class="label" for="f-adresse">Adresse</label>
              <input class="input" type="text" id="f-adresse" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="label" for="f-cp">Code postal</label>
                <input class="input" type="text" id="f-cp" maxlength="5" />
              </div>
              <div class="form-group">
                <label class="label" for="f-ville">Ville</label>
                <input class="input" type="text" id="f-ville" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="label" for="f-nir">N° Sécurité sociale</label>
                <input class="input" type="text" id="f-nir" maxlength="15" />
              </div>
              <div class="form-group">
                <label class="label" for="f-gs">Groupe sanguin</label>
                <select class="select" id="f-gs">
                  <option value="">—</option>
                  ${['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => `<option value="${g}">${g}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="label" for="f-gir">GIR (Groupe Iso-Ressources)</label>
              <div style="display:flex;gap:.5rem;align-items:center;">
                <select class="select" id="f-gir" style="flex:1;">
                  <option value="">— Non renseigné</option>
                  <option value="1">🔴 GIR 1 — Totalement dépendant</option>
                  <option value="2">🔴 GIR 2 — Très dépendant</option>
                  <option value="3">🟠 GIR 3 — Dépendant</option>
                  <option value="4">🟠 GIR 4 — Partiellement dépendant</option>
                  <option value="5">🟢 GIR 5 — Peu dépendant</option>
                  <option value="6">🟢 GIR 6 — Autonome</option>
                </select>
                <button type="button" class="btn btn--outline btn--sm" id="btn-gir-calc"
                        title="Calculer le GIR avec la grille AGGIR" style="white-space:nowrap;">
                  🧮 Calculer
                </button>
              </div>
            </div>
          </form>
        </div>
        <div class="modal__footer">
          <button class="btn btn--outline" id="btn-cancel">Annuler</button>
          <button class="btn btn--primary" id="btn-save">Enregistrer</button>
        </div>
      </div>
    </div>
  `;

  await _loadPatients();
  _bindEvents(canWrite);
}

async function _loadPatients() {
  const { data, error } = await supabase
    .from('patients')
    .select('id, nom, prenom, date_naissance, ville, telephone, actif, gir')
    .order('nom');

  if (error) { _renderError(error.message); return; }
  _patients = data ?? [];
  _renderTable();
}

function _renderTable() {
  const role     = getRole();
  const canWrite = can(role, 'patient.write');
  const wrapper  = document.getElementById('patient-table-wrapper');
  if (!wrapper) return;

  let data = [..._patients];

  if (_search) {
    const q = _search.toLowerCase();
    data = data.filter(p => `${p.nom} ${p.prenom} ${p.ville ?? ''}`.toLowerCase().includes(q));
  }

  const filtreStatut = document.getElementById('filter-statut')?.value;
  if (filtreStatut !== '' && filtreStatut != null) {
    data = data.filter(p => String(p.actif) === filtreStatut);
  }

  data.sort((a, b) => {
    const av = a[_sortKey] ?? '';
    const bv = b[_sortKey] ?? '';
    return _sortAsc
      ? String(av).localeCompare(String(bv), 'fr')
      : String(bv).localeCompare(String(av), 'fr');
  });

  const total = data.length;
  const pages = Math.ceil(total / PAGE_SIZE);
  _page = Math.min(_page, pages || 1);
  const slice = data.slice((_page - 1) * PAGE_SIZE, _page * PAGE_SIZE);

  if (!slice.length) {
    wrapper.innerHTML = `
      <table class="table"><thead><tr>${_thRow()}</tr></thead></table>
      <div class="table-empty"><div class="table-empty__icon">🔍</div>
      <div class="table-empty__text">Aucun patient trouvé</div></div>`;
    document.getElementById('patient-pagination').innerHTML = '';
    return;
  }

  wrapper.innerHTML = `
    <table class="table" role="grid">
      <thead><tr>${_thRow()}</tr></thead>
      <tbody>
        ${slice.map(p => `
          <tr style="cursor:pointer;" data-id="${p.id}" class="patient-row">
            <td style="font-weight:500;">${formatNomComplet(p.nom, p.prenom)}</td>
            <td>${formatDate(p.date_naissance)} <span style="color:var(--color-text-muted);font-size:.75rem;">(${calcAge(p.date_naissance)} ans)</span></td>
            <td>${p.gir ? `<span class="badge badge--neutral" title="${formatGIR(p.gir)}">${girIcon(p.gir)} GIR ${p.gir}</span>` : '—'}</td>
            <td>${orDash(p.ville)}</td>
            <td>${orDash(p.telephone)}</td>
            <td><span class="badge ${p.actif ? 'badge--success' : 'badge--neutral'}">${p.actif ? 'Actif' : 'Inactif'}</span></td>
            <td>
              <div class="table__actions">
                <button class="btn btn--ghost btn--sm btn-view" data-id="${p.id}" title="Ouvrir">📋</button>
                ${canWrite ? `<button class="btn btn--ghost btn--sm btn-edit" data-id="${p.id}" title="Modifier">✏️</button>` : ''}
              </div>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  _renderPagination(total, pages);

  wrapper.querySelectorAll('.patient-row').forEach(row => {
    row.addEventListener('dblclick', () => _openRecord(row.dataset.id));
  });
  wrapper.querySelectorAll('.btn-view').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); _openRecord(btn.dataset.id); });
  });
  if (canWrite) {
    wrapper.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); _openModal(btn.dataset.id); });
    });
  }
  wrapper.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      if (_sortKey === th.dataset.sort) _sortAsc = !_sortAsc;
      else { _sortKey = th.dataset.sort; _sortAsc = true; }
      _renderTable();
    });
  });
}

function _thRow() {
  const cols = [
    { key: 'nom',            label: 'Nom complet' },
    { key: 'date_naissance', label: 'Date de naissance' },
    { key: 'gir',            label: 'GIR' },
    { key: 'ville',          label: 'Ville' },
    { key: 'telephone',      label: 'Téléphone' },
    { key: null,             label: 'Statut' },
    { key: null,             label: 'Actions' },
  ];
  return cols.map(c => c.key
    ? `<th data-sort="${c.key}" class="${_sortKey === c.key ? (_sortAsc ? 'sort-asc' : 'sort-desc') : ''}">${c.label}</th>`
    : `<th>${c.label}</th>`
  ).join('');
}

function _renderPagination(total, pages) {
  const el = document.getElementById('patient-pagination');
  if (!el) return;
  el.innerHTML = `
    <span>${total} patient(s) · Page ${_page}/${pages}</span>
    <div class="pagination-controls">
      <button class="pagination-btn" id="pg-prev" ${_page <= 1 ? 'disabled' : ''}>← Préc.</button>
      <button class="pagination-btn" id="pg-next" ${_page >= pages ? 'disabled' : ''}>Suiv. →</button>
    </div>`;
  el.querySelector('#pg-prev')?.addEventListener('click', () => { _page--; _renderTable(); });
  el.querySelector('#pg-next')?.addEventListener('click', () => { _page++; _renderTable(); });
}

function _openRecord(id) {
  setCurrentPatientId(id);
  navigate('patient');
}

let _editingId = null;

async function _openModal(id = null) {
  if (!id) {
    window.alert(
      "ATTENTION, ce logiciel est une démo, ne renseignez aucune donnée personnelle réelle. " +
      "Vous pouvez créer un patient fictif."
    );
  }
  _editingId = id;
  const modal = document.getElementById('patient-modal');
  if (!modal) return;
  document.getElementById('modal-title').textContent = id ? 'Modifier le patient' : 'Nouveau patient';

  if (id) {
    const p = _patients.find(x => x.id === id);
    if (p) {
      document.getElementById('f-nom').value    = p.nom ?? '';
      document.getElementById('f-prenom').value = p.prenom ?? '';
      document.getElementById('f-ddn').value    = p.date_naissance ?? '';
      document.getElementById('f-ville').value  = p.ville ?? '';
      document.getElementById('f-tel').value    = p.telephone ?? '';
      document.getElementById('f-gir').value    = p.gir ?? '';
    }
  } else {
    document.getElementById('patient-form').reset();
  }
  modal.classList.remove('hidden');
}

async function _savePatient() {
  const payload = {
    nom:             document.getElementById('f-nom').value.trim().toUpperCase(),
    prenom:          document.getElementById('f-prenom').value.trim(),
    date_naissance:  document.getElementById('f-ddn').value || null,
    sexe:            document.getElementById('f-sexe').value || null,
    telephone:       document.getElementById('f-tel').value.trim() || null,
    email:           document.getElementById('f-email').value.trim() || null,
    adresse:         document.getElementById('f-adresse').value.trim() || null,
    code_postal:     document.getElementById('f-cp').value.trim() || null,
    ville:           document.getElementById('f-ville').value.trim() || null,
    numero_secu:     document.getElementById('f-nir').value.replace(/\s/g, '') || null,
    groupe_sanguin:  document.getElementById('f-gs').value || null,
    gir:             document.getElementById('f-gir').value ? parseInt(document.getElementById('f-gir').value) : null,
  };

  if (!payload.nom || !payload.prenom || !payload.date_naissance) {
    addNotification({ type: 'warning', title: 'Champs requis', message: 'Nom, prénom et date de naissance sont obligatoires.' });
    return;
  }

  let error;
  if (_editingId) {
    ({ error } = await supabase.from('patients').update(payload).eq('id', _editingId));
  } else {
    ({ error } = await supabase.from('patients').insert(payload));
  }

  if (error) { addNotification({ type: 'danger', title: 'Erreur', message: error.message }); return; }

  addNotification({ type: 'success', title: 'Enregistré', message: 'Dossier patient sauvegardé.' });
  document.getElementById('patient-modal')?.classList.add('hidden');
  await _loadPatients();
}

function _bindEvents(canWrite) {
  document.getElementById('search-patient')?.addEventListener('input', (e) => {
    _search = e.target.value; _page = 1; _renderTable();
  });
  document.getElementById('filter-statut')?.addEventListener('change', () => {
    _page = 1; _renderTable();
  });
  if (canWrite) {
    document.getElementById('btn-add-patient')?.addEventListener('click', () => _openModal());
  }
  document.getElementById('modal-close')?.addEventListener('click', () => {
    document.getElementById('patient-modal')?.classList.add('hidden');
  });
  document.getElementById('btn-cancel')?.addEventListener('click', () => {
    document.getElementById('patient-modal')?.classList.add('hidden');
  });
  document.getElementById('btn-save')?.addEventListener('click', _savePatient);

  document.getElementById('btn-gir-calc')?.addEventListener('click', () => {
    openGirCalculator(gir => {
      const sel = document.getElementById('f-gir');
      if (sel) sel.value = String(gir);
    });
  });
}

function _renderError(msg) {
  const w = document.getElementById('patient-table-wrapper');
  if (w) w.innerHTML = `<div class="table-empty"><div class="table-empty__icon">⚠️</div><div class="table-empty__text">${msg}</div></div>`;
}
