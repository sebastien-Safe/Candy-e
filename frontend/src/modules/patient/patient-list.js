/**
 * [ candy-e ] — MODULE LISTE PATIENTS
 * Fichier : modules/patient/patient-list.js
 *
 * Liste paginée avec recherche, filtres, tri et CRUD complet.
 * Accès conditionné par la RLS Supabase ET par le RBAC frontend.
 */

import { supabase }                    from '../../core/supabase.client.js';
import { getRole }                     from '../../core/state.js';
import { can }                         from '../../core/rbac.js';
import { navigate }                    from '../../core/router.js';
import { formatDate, calcAge }         from '../../utils/date.js';
import { formatNomComplet, orDash }    from '../../utils/format.js';
import { addNotification }             from '../../core/state.js';
import { setCurrentPatientId }         from '../../core/state.js';

// ─── État local du module ─────────────────────────────────────────────────────
let _patients  = [];
let _sortKey   = 'nom';
let _sortAsc   = true;
let _search    = '';
let _page      = 1;
const PAGE_SIZE = 20;

// ─── Point d'entrée ───────────────────────────────────────────────────────────

export async function mountPatientList() {
  const main = document.getElementById('main-content');
  if (!main) return;

  const role    = getRole();
  const canWrite = can(role, 'patient.write');

  main.innerHTML = `
    <div class="page-header">
      <div class="page-header__eyebrow">Dossiers patients</div>
      <h1 class="page-header__title">Gestion des patients</h1>
    </div>

    <!-- Toolbar -->
    <div class="table-toolbar">
      <div class="table-toolbar__left">
        <div class="input-wrapper" style="width:280px;">
          <span class="input-wrapper__icon">🔍</span>
          <input class="input" type="search" id="search-patient"
                 placeholder="Rechercher nom, prénom, chambre..." autocomplete="off" />
        </div>
        <select class="select" id="filter-statut" style="width:160px;">
          <option value="">Tous les résidents</option>
          <option value="true">Actifs uniquement</option>
          <option value="false">Sortis</option>
        </select>
      </div>
      <div class="table-toolbar__right">
        ${canWrite ? `<button class="btn btn--primary" id="btn-add-patient">+ Nouveau patient</button>` : ''}
      </div>
    </div>

    <!-- Table -->
    <div class="table-wrapper" id="patient-table-wrapper">
      <div style="padding:var(--space-8);text-align:center;color:var(--color-text-muted);">
        Chargement…
      </div>
    </div>

    <!-- Pagination -->
    <div class="table-pagination" id="patient-pagination"></div>

    <!-- Modal création/édition -->
    <div class="modal-backdrop hidden" id="patient-modal">
      <div class="modal">
        <div class="modal__header">
          <div>
            <div class="modal__title" id="modal-title">Nouveau patient</div>
          </div>
          <button class="modal__close" id="modal-close" aria-label="Fermer">✕</button>
        </div>
        <div class="modal__body">
          <form id="patient-form" novalidate>
            <div class="form-row">
              <div class="form-group">
                <label class="label label--required" for="f-nom">Nom</label>
                <input class="input" type="text" id="f-nom" name="nom" required />
              </div>
              <div class="form-group">
                <label class="label label--required" for="f-prenom">Prénom</label>
                <input class="input" type="text" id="f-prenom" name="prenom" required />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="label label--required" for="f-ddn">Date de naissance</label>
                <input class="input" type="date" id="f-ddn" name="date_naissance" required />
              </div>
              <div class="form-group">
                <label class="label" for="f-chambre">Chambre</label>
                <input class="input" type="text" id="f-chambre" name="chambre" placeholder="ex: 12A" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="label" for="f-nir">N° Sécurité sociale</label>
                <input class="input" type="text" id="f-nir" name="numero_secu" placeholder="15 chiffres" maxlength="15" />
              </div>
              <div class="form-group">
                <label class="label" for="f-entree">Date d'entrée</label>
                <input class="input" type="date" id="f-entree" name="date_entree" />
              </div>
            </div>
            <div class="form-group">
              <label class="label" for="f-contact">Contact d'urgence</label>
              <input class="input" type="text" id="f-contact" name="contact_urgence_nom" placeholder="Nom — Relation — Téléphone" />
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

// ─── Chargement ───────────────────────────────────────────────────────────────

async function _loadPatients() {
  const { data, error } = await supabase
    .from('patients_etat_civil')
    .select('id, nom, prenom, date_naissance, chambre, date_entree, actif, numero_secu')
    .order('nom', { ascending: true });

  if (error) {
    _renderError(error.message);
    return;
  }

  _patients = data ?? [];
  _renderTable();
}

// ─── Rendu de la table ────────────────────────────────────────────────────────

function _renderTable() {
  const role = getRole();
  const canWrite = can(role, 'patient.write');
  const wrapper = document.getElementById('patient-table-wrapper');
  if (!wrapper) return;

  let data = [..._patients];

  // Recherche
  if (_search) {
    const q = _search.toLowerCase();
    data = data.filter(p =>
      `${p.nom} ${p.prenom} ${p.chambre ?? ''}`.toLowerCase().includes(q)
    );
  }

  // Filtre statut
  const filtreStatut = document.getElementById('filter-statut')?.value;
  if (filtreStatut !== '' && filtreStatut != null) {
    data = data.filter(p => String(p.actif) === filtreStatut);
  }

  // Tri
  data.sort((a, b) => {
    const av = (a[_sortKey] ?? '');
    const bv = (b[_sortKey] ?? '');
    return _sortAsc
      ? String(av).localeCompare(String(bv), 'fr')
      : String(bv).localeCompare(String(av), 'fr');
  });

  // Pagination
  const total = data.length;
  const pages = Math.ceil(total / PAGE_SIZE);
  _page = Math.min(_page, pages || 1);
  const slice = data.slice((_page - 1) * PAGE_SIZE, _page * PAGE_SIZE);

  if (!slice.length) {
    wrapper.innerHTML = `
      <table class="table"><thead><tr>${_thRow()}</tr></thead></table>
      <div class="table-empty">
        <div class="table-empty__icon">🔍</div>
        <div class="table-empty__text">Aucun patient trouvé</div>
      </div>`;
    document.getElementById('patient-pagination').innerHTML = '';
    return;
  }

  wrapper.innerHTML = `
    <table class="table" role="grid">
      <thead>
        <tr>${_thRow()}</tr>
      </thead>
      <tbody>
        ${slice.map(p => `
          <tr style="cursor:pointer;" data-id="${p.id}" class="patient-row">
            <td style="font-weight:500;">${formatNomComplet(p.nom, p.prenom)}</td>
            <td>${formatDate(p.date_naissance)} <span style="color:var(--color-text-muted);font-size:.75rem;">(${calcAge(p.date_naissance)} ans)</span></td>
            <td>${orDash(p.chambre)}</td>
            <td>${formatDate(p.date_entree)}</td>
            <td>
              <span class="badge ${p.actif ? 'badge--success' : 'badge--neutral'}">
                ${p.actif ? 'Actif' : 'Sorti'}
              </span>
            </td>
            <td>
              <div class="table__actions">
                <button class="btn btn--ghost btn--sm btn-view" data-id="${p.id}" title="Ouvrir la fiche">📋</button>
                ${canWrite ? `
                  <button class="btn btn--ghost btn--sm btn-edit" data-id="${p.id}" title="Modifier">✏️</button>
                ` : ''}
              </div>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  // Pagination
  _renderPagination(total, pages);

  // Re-attacher les événements de ligne
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

  // Tri au clic sur les en-têtes
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
    { key: 'nom',          label: 'Nom complet' },
    { key: 'date_naissance', label: 'Date de naissance' },
    { key: 'chambre',      label: 'Chambre' },
    { key: 'date_entree',  label: 'Entrée' },
    { key: null,           label: 'Statut' },
    { key: null,           label: 'Actions' },
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
    <span>${total} patient(s) · Page ${_page} / ${pages}</span>
    <div class="pagination-controls">
      <button class="pagination-btn" id="pg-prev" ${_page <= 1 ? 'disabled' : ''}>← Préc.</button>
      <button class="pagination-btn" id="pg-next" ${_page >= pages ? 'disabled' : ''}>Suiv. →</button>
    </div>`;
  el.querySelector('#pg-prev')?.addEventListener('click', () => { _page--; _renderTable(); });
  el.querySelector('#pg-next')?.addEventListener('click', () => { _page++; _renderTable(); });
}

// ─── Navigation vers la fiche ──────────────────────────────────────────────────

function _openRecord(id) {
  setCurrentPatientId(id);
  navigate('patient');
}

// ─── Modal CRUD ───────────────────────────────────────────────────────────────

let _editingId = null;

async function _openModal(id = null) {
  _editingId = id;
  const modal   = document.getElementById('patient-modal');
  const title   = document.getElementById('modal-title');
  if (!modal) return;

  title.textContent = id ? 'Modifier le patient' : 'Nouveau patient';

  if (id) {
    const p = _patients.find(x => x.id === id);
    if (p) {
      document.getElementById('f-nom').value      = p.nom ?? '';
      document.getElementById('f-prenom').value   = p.prenom ?? '';
      document.getElementById('f-ddn').value      = p.date_naissance ?? '';
      document.getElementById('f-chambre').value  = p.chambre ?? '';
      document.getElementById('f-nir').value      = p.numero_secu ?? '';
      document.getElementById('f-entree').value   = p.date_entree ?? '';
    }
  } else {
    document.getElementById('patient-form').reset();
  }

  modal.classList.remove('hidden');
}

async function _savePatient() {
  const payload = {
    nom:              document.getElementById('f-nom').value.trim().toUpperCase(),
    prenom:           document.getElementById('f-prenom').value.trim(),
    date_naissance:   document.getElementById('f-ddn').value || null,
    chambre:          document.getElementById('f-chambre').value.trim() || null,
    numero_secu:      document.getElementById('f-nir').value.replace(/\s/g,'') || null,
    date_entree:      document.getElementById('f-entree').value || null,
  };

  if (!payload.nom || !payload.prenom || !payload.date_naissance) {
    addNotification({ type: 'warning', title: 'Champs obligatoires', message: 'Nom, prénom et date de naissance sont requis.' });
    return;
  }

  let error;
  if (_editingId) {
    ({ error } = await supabase.from('patients_etat_civil').update(payload).eq('id', _editingId));
  } else {
    ({ error } = await supabase.from('patients_etat_civil').insert(payload));
  }

  if (error) {
    addNotification({ type: 'danger', title: 'Erreur', message: error.message });
    return;
  }

  addNotification({ type: 'success', title: 'Enregistré', message: 'Le dossier patient a été sauvegardé.' });
  document.getElementById('patient-modal')?.classList.add('hidden');
  await _loadPatients();
}

// ─── Événements globaux ───────────────────────────────────────────────────────

function _bindEvents(canWrite) {
  document.getElementById('search-patient')?.addEventListener('input', (e) => {
    _search = e.target.value;
    _page = 1;
    _renderTable();
  });

  document.getElementById('filter-statut')?.addEventListener('change', () => {
    _page = 1;
    _renderTable();
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
}

function _renderError(msg) {
  const wrapper = document.getElementById('patient-table-wrapper');
  if (wrapper) wrapper.innerHTML = `
    <div class="table-empty">
      <div class="table-empty__icon">⚠️</div>
      <div class="table-empty__text">${msg}</div>
    </div>`;
}
