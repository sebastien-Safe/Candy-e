/**
 * [ candy-e ] — DASHBOARD
 */

import { supabase }      from '../../core/supabase.client.js';
import { getRole }       from '../../core/state.js';
import { can }           from '../../core/rbac.js';
import { formatDateTime, formatDateLong, formatDate, timeAgo } from '../../utils/date.js';
import { formatNomComplet } from '../../utils/format.js';

export async function mountDashboard() {
  const main = document.getElementById('main-content');
  if (!main) return;

  const role = getRole();

  main.innerHTML = `
    <div class="page-header">
      <div class="page-header__eyebrow">Vue d'ensemble</div>
      <h1 class="page-header__title">Tableau de bord</h1>
      <p class="page-header__desc">${formatDateLong(new Date())} · Cabinet médical candy-e</p>
    </div>
    <div id="dash-kpi" class="grid-4 mb-6"></div>
    <div class="grid-2 mb-6">
      <div id="dash-agenda"></div>
      <div id="dash-notes"></div>
    </div>
    ${can(role, 'consultation.read') ? '<div id="dash-consultations" class="mb-6"></div>' : ''}
  `;

  await Promise.allSettled([
    _loadKPI(),
    _loadAgenda(),
    _loadNotes(),
    can(role, 'consultation.read') && _loadConsultations(),
  ]);
}

async function _loadKPI() {
  const el = document.getElementById('dash-kpi');
  if (!el) return;

  const [patientsRes, consultRes, agendaRes, ordoRes] = await Promise.all([
    supabase.from('patients').select('id', { count: 'exact', head: true }).eq('actif', true),
    supabase.from('consultations').select('id', { count: 'exact', head: true }),
    supabase.from('agenda').select('id', { count: 'exact', head: true }).eq('statut', 'planifie'),
    supabase.from('ordonnances').select('id', { count: 'exact', head: true }).eq('statut', 'active'),
  ]);

  const kpis = [
    { label: 'Patients actifs',      value: patientsRes.count ?? '—', icon: '👥', color: 'var(--color-primary)' },
    { label: 'Consultations',        value: consultRes.count ?? '—',  icon: '🩺', color: 'var(--color-secondary)' },
    { label: 'RDV à venir',          value: agendaRes.count ?? '—',   icon: '📅', color: 'var(--color-warning)' },
    { label: 'Ordonnances actives',  value: ordoRes.count ?? '—',     icon: '📋', color: 'var(--color-success)' },
  ];

  el.innerHTML = kpis.map(k => `
    <div class="card-kpi" style="--kpi-color:${k.color}">
      <div class="card-kpi__icon">${k.icon}</div>
      <div class="card-kpi__label">${k.label}</div>
      <div class="card-kpi__value">${k.value}</div>
    </div>`).join('');
}

async function _loadAgenda() {
  const el = document.getElementById('dash-agenda');
  if (!el) return;

  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('agenda')
    .select('id, date_rdv, type_rdv, titre, statut, patients(nom, prenom)')
    .gte('date_rdv', today + 'T00:00:00')
    .lte('date_rdv', today + 'T23:59:59')
    .order('date_rdv')
    .limit(8);

  const typeColors = { Consultation: 'var(--color-primary)', Bilan: 'var(--color-secondary)', Spécialiste: 'var(--color-warning)', Suivi: 'var(--color-success)', Autre: 'var(--color-border)' };

  el.innerHTML = `
    <div class="card" style="height:100%;">
      <div class="card__header"><div class="card__title">📅 Agenda du jour</div></div>
      <div class="card__body" style="padding:0;">
        ${!data?.length
          ? `<div class="table-empty"><div class="table-empty__text">Aucun rendez-vous aujourd'hui</div></div>`
          : data.map(e => `
            <div style="display:flex;align-items:flex-start;gap:var(--space-3);
                        padding:var(--space-3) var(--space-5);border-bottom:1px solid var(--color-border);">
              <div style="font-size:.75rem;font-weight:600;color:var(--color-text-muted);min-width:42px;padding-top:2px;">
                ${new Date(e.date_rdv).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div style="width:3px;align-self:stretch;min-height:32px;border-radius:2px;flex-shrink:0;
                          background:${typeColors[e.type_rdv] || 'var(--color-border)'}"></div>
              <div>
                <div style="font-size:.875rem;font-weight:500;">${e.titre}</div>
                ${e.patients ? `<div style="font-size:.75rem;color:var(--color-text-muted);">${formatNomComplet(e.patients.nom, e.patients.prenom)}</div>` : ''}
              </div>
            </div>`).join('')}
      </div>
    </div>`;
}

async function _loadNotes() {
  const el = document.getElementById('dash-notes');
  if (!el) return;

  const { data } = await supabase
    .from('notes_suivi')
    .select('id, contenu, updated_at, patients(nom, prenom)')
    .order('updated_at', { ascending: false })
    .limit(5);

  el.innerHTML = `
    <div class="card" style="height:100%;">
      <div class="card__header">
        <div class="card__title">💬 Notes récentes</div>
      </div>
      <div class="card__body" style="padding:0;">
        ${!data?.length
          ? `<div class="table-empty"><div class="table-empty__text">Aucune note</div></div>`
          : data.map(n => `
            <div style="padding:var(--space-3) var(--space-5);border-bottom:1px solid var(--color-border);">
              <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                <span style="font-size:.8125rem;font-weight:600;">
                  ${n.patients ? formatNomComplet(n.patients.nom, n.patients.prenom) : '—'}
                </span>
                <span style="font-size:.6875rem;color:var(--color-text-muted);">${timeAgo(n.updated_at)}</span>
              </div>
              <p style="font-size:.8125rem;color:var(--color-text-secondary);margin:0;">
                ${n.contenu ? n.contenu.slice(0, 100) + (n.contenu.length > 100 ? '…' : '') : '—'}
              </p>
            </div>`).join('')}
      </div>
    </div>`;
}

async function _loadConsultations() {
  const el = document.getElementById('dash-consultations');
  if (!el) return;

  const { data } = await supabase
    .from('consultations')
    .select('id, date_consult, type_acte, titre, patients(nom, prenom), profiles(prenom, nom)')
    .order('date_consult', { ascending: false })
    .limit(5);

  el.innerHTML = `
    <div class="card">
      <div class="card__header">
        <div class="card__title">🩺 Dernières consultations</div>
        <a href="#consultations" class="btn btn--ghost btn--sm">Voir tout</a>
      </div>
      <div class="table-wrapper" style="border:none;border-radius:0;box-shadow:none;">
        <table class="table">
          <thead>
            <tr><th>Date</th><th>Patient</th><th>Type</th><th>Titre</th><th>Médecin</th></tr>
          </thead>
          <tbody>
            ${!data?.length
              ? `<tr><td colspan="5" class="table-empty"><div class="table-empty__text">Aucune consultation</div></td></tr>`
              : data.map(c => `
                <tr>
                  <td style="white-space:nowrap;">${formatDate(c.date_consult)}</td>
                  <td style="font-weight:500;">${c.patients ? formatNomComplet(c.patients.nom, c.patients.prenom) : '—'}</td>
                  <td><span class="badge badge--neutral">${c.type_acte}</span></td>
                  <td>${c.titre}</td>
                  <td style="color:var(--color-text-muted);font-size:.8125rem;">
                    ${c.profiles ? `Dr ${c.profiles.prenom} ${c.profiles.nom}` : '—'}
                  </td>
                </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}
