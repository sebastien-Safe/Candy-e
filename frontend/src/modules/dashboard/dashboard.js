/**
 * [ candy-e ] — MODULE DASHBOARD
 * Fichier : modules/dashboard/dashboard.js
 *
 * Tableau de bord principal : KPI, alertes, agenda, transmissions, traitements.
 * Chaque bloc est conditionné par les permissions RBAC du rôle connecté.
 */

import { supabase }        from '../../core/supabase.client.js';
import { getRole }         from '../../core/state.js';
import { can }             from '../../core/rbac.js';
import { formatDateTime, timeAgo, formatDateLong } from '../../utils/date.js';
import { formatNomComplet } from '../../utils/format.js';

// ─── Point d'entrée ───────────────────────────────────────────────────────────

export async function mountDashboard() {
  const main = document.getElementById('main-content');
  if (!main) return;

  const role = getRole();

  main.innerHTML = `
    <div class="page-header">
      <div class="page-header__eyebrow">Vue d'ensemble</div>
      <h1 class="page-header__title">Tableau de bord</h1>
      <p class="page-header__desc">${formatDateLong(new Date())} · Unité Soins de Suite et Réadaptation</p>
    </div>

    ${can(role, 'kpi')          ? '<div id="dash-kpi" class="grid-4 mb-6"></div>' : ''}
    ${can(role, 'alerts')       ? '<div id="dash-alerts" class="mb-6"></div>' : ''}
    <div class="grid-2 mb-6">
      ${can(role, 'agenda')         ? '<div id="dash-agenda"></div>'         : ''}
      ${can(role, 'transmissions')  ? '<div id="dash-transmissions"></div>'  : ''}
    </div>
    ${can(role, 'traitements')   ? '<div id="dash-traitements" class="mb-6"></div>' : ''}
    ${can(role, 'stats')         ? '<div id="dash-stats" class="mb-6"></div>' : ''}
  `;

  // Chargement parallèle des blocs autorisés
  await Promise.allSettled([
    can(role, 'kpi')         && _loadKPI(),
    can(role, 'alerts')      && _loadAlerts(),
    can(role, 'agenda')      && _loadAgenda(),
    can(role, 'transmissions') && _loadTransmissions(),
    can(role, 'traitements') && _loadTraitements(),
    can(role, 'stats')       && _loadStats(),
  ]);
}

// ─── KPI ──────────────────────────────────────────────────────────────────────

async function _loadKPI() {
  const el = document.getElementById('dash-kpi');
  if (!el) return;

  // Chargement des KPI depuis Supabase
  const [patientsRes, alertesRes, traitementsRes] = await Promise.all([
    supabase.from('patients_etat_civil').select('id', { count: 'exact', head: true }).eq('actif', true),
    supabase.from('transmissions').select('id', { count: 'exact', head: true }).eq('priorite', 'critique').eq('lu', false),
    supabase.from('traitements').select('id', { count: 'exact', head: true }).eq('actif', true),
  ]);

  const kpis = [
    { label: 'Résidents actifs', value: patientsRes.count ?? '—', delta: 'Stable', deltaType: 'flat', icon: '🧑‍⚕️', color: 'var(--color-primary)' },
    { label: 'Alertes critiques', value: alertesRes.count ?? '—', delta: 'À traiter', deltaType: 'down', icon: '🚨', color: 'var(--color-danger)' },
    { label: 'Traitements actifs', value: traitementsRes.count ?? '—', delta: 'En cours', deltaType: 'flat', icon: '💊', color: 'var(--color-secondary)' },
    { label: "Taux d'occupation", value: '94%', delta: '+1% ce mois', deltaType: 'up', icon: '🏥', color: 'var(--color-warning)' },
  ];

  el.innerHTML = kpis.map(k => `
    <div class="card-kpi" style="--kpi-color: ${k.color}">
      <div class="card-kpi__icon" aria-hidden="true">${k.icon}</div>
      <div class="card-kpi__label">${k.label}</div>
      <div class="card-kpi__value">${k.value}</div>
      <div class="card-kpi__delta card-kpi__delta--${k.deltaType}">${k.delta}</div>
    </div>`).join('');
}

// ─── Alertes ──────────────────────────────────────────────────────────────────

async function _loadAlerts() {
  const el = document.getElementById('dash-alerts');
  if (!el) return;

  const { data: alertes } = await supabase
    .from('transmissions')
    .select(`id, type_transmission, contenu, priorite, cree_le,
             patients_etat_civil(nom, prenom),
             profiles!transmissions_saisie_par_fkey(prenom, nom)`)
    .in('priorite', ['critique', 'urgente'])
    .eq('lu', false)
    .order('cree_le', { ascending: false })
    .limit(5);

  if (!alertes?.length) {
    el.innerHTML = `
      <div class="card">
        <div class="card__header"><div class="card__title">🚨 Alertes en cours</div></div>
        <div class="table-empty"><div class="table-empty__icon">✅</div><div class="table-empty__text">Aucune alerte active</div></div>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="card">
      <div class="card__header">
        <div>
          <div class="card__title">🚨 Alertes en cours</div>
          <div class="card__subtitle">${alertes.length} transmission(s) non lue(s)</div>
        </div>
        <a href="#transmissions" class="btn btn--ghost btn--sm">Voir tout</a>
      </div>
      <div>
        ${alertes.map(a => {
          const patient = a.patients_etat_civil;
          const auteur  = a.profiles;
          return `
            <div style="display:flex;align-items:flex-start;gap:var(--space-3);
                        padding:var(--space-3) var(--space-5);
                        border-bottom:1px solid var(--color-border);">
              <div style="width:4px;align-self:stretch;border-radius:2px;min-height:40px;flex-shrink:0;
                          background:${a.priorite === 'critique' ? 'var(--color-danger)' : 'var(--color-warning)'};">
              </div>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:2px;">
                  <span style="font-size:.875rem;font-weight:600;">
                    ${patient ? formatNomComplet(patient.nom, patient.prenom) : '—'}
                  </span>
                  <span class="badge badge--${a.priorite}">${a.priorite}</span>
                </div>
                <p style="font-size:.875rem;color:var(--color-text-secondary);margin:0;">${a.contenu}</p>
                <p style="font-size:.75rem;color:var(--color-text-muted);margin:.25rem 0 0;">
                  ${auteur ? `${auteur.prenom} ${auteur.nom}` : '—'} · ${timeAgo(a.cree_le)}
                </p>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

// ─── Agenda ───────────────────────────────────────────────────────────────────

async function _loadAgenda() {
  const el = document.getElementById('dash-agenda');
  if (!el) return;

  // Données simulées (à remplacer par une vraie table agenda)
  const events = [
    { time: '08:30', titre: 'Tournée IDE — Secteur A',         type: 'soin' },
    { time: '10:00', titre: 'Réunion transmission pluridisciplinaire', type: 'reunion' },
    { time: '14:00', titre: 'Visite médecin coordinateur',     type: 'visite' },
    { time: '16:30', titre: 'Réévaluation plan de soins (5 patients)', type: 'soin' },
  ];

  const typeColors = { soin: 'var(--color-primary)', reunion: 'var(--color-secondary)', visite: 'var(--color-warning)' };

  el.innerHTML = `
    <div class="card" style="height:100%;">
      <div class="card__header">
        <div class="card__title">📅 Agenda du jour</div>
      </div>
      <div class="card__body" style="padding:0;">
        ${events.map(e => `
          <div style="display:flex;align-items:flex-start;gap:var(--space-3);
                      padding:var(--space-3) var(--space-5);
                      border-bottom:1px solid var(--color-border);">
            <div style="font-size:.75rem;font-weight:600;color:var(--color-text-muted);
                        min-width:40px;padding-top:2px;">${e.time}</div>
            <div style="width:3px;align-self:stretch;min-height:32px;border-radius:2px;flex-shrink:0;
                        background:${typeColors[e.type] || 'var(--color-border)'}"></div>
            <div style="font-size:.875rem;font-weight:500;">${e.titre}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

// ─── Dernières transmissions ──────────────────────────────────────────────────

async function _loadTransmissions() {
  const el = document.getElementById('dash-transmissions');
  if (!el) return;

  const { data } = await supabase
    .from('transmissions')
    .select(`id, type_transmission, contenu, priorite, cree_le,
             patients_etat_civil(nom, prenom),
             profiles!transmissions_saisie_par_fkey(prenom, nom, role)`)
    .order('cree_le', { ascending: false })
    .limit(5);

  el.innerHTML = `
    <div class="card" style="height:100%;">
      <div class="card__header">
        <div class="card__title">💬 Dernières transmissions</div>
        <a href="#transmissions" class="btn btn--ghost btn--sm">Voir tout</a>
      </div>
      <div class="card__body" style="padding:0;">
        ${!data?.length
          ? `<div class="table-empty"><div class="table-empty__text">Aucune transmission</div></div>`
          : data.map(t => {
              const patient = t.patients_etat_civil;
              const auteur  = t.profiles;
              return `
                <div style="padding:var(--space-3) var(--space-5);border-bottom:1px solid var(--color-border);">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
                    <span style="font-size:.8125rem;font-weight:600;">
                      ${patient ? formatNomComplet(patient.nom, patient.prenom) : '—'}
                    </span>
                    <span style="font-size:.6875rem;color:var(--color-text-muted);">${timeAgo(t.cree_le)}</span>
                  </div>
                  <p style="font-size:.8125rem;color:var(--color-text-secondary);margin:0 0 3px;">
                    📌 ${t.contenu}
                  </p>
                  <span style="font-size:.6875rem;color:var(--color-text-muted);">
                    ${auteur ? `${auteur.prenom} ${auteur.nom}` : '—'}
                  </span>
                </div>`;
            }).join('')}
      </div>
    </div>`;
}

// ─── Traitements en cours ────────────────────────────────────────────────────

async function _loadTraitements() {
  const el = document.getElementById('dash-traitements');
  if (!el) return;

  const { data } = await supabase
    .from('traitements')
    .select(`id, dci, nom_commercial, dose, voie_administration, frequence,
             patients_etat_civil(nom, prenom)`)
    .eq('actif', true)
    .order('cree_le', { ascending: false })
    .limit(5);

  el.innerHTML = `
    <div class="card">
      <div class="card__header">
        <div class="card__title">💊 Traitements récents</div>
        <a href="#traitements" class="btn btn--ghost btn--sm">Voir tout</a>
      </div>
      <div class="table-wrapper" style="border:none;border-radius:0;box-shadow:none;">
        <table class="table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Médicament (DCI)</th>
              <th>Dose</th>
              <th>Voie</th>
              <th>Fréquence</th>
            </tr>
          </thead>
          <tbody>
            ${!data?.length
              ? `<tr><td colspan="5" class="table-empty"><div class="table-empty__text">Aucun traitement</div></td></tr>`
              : data.map(t => {
                  const patient = t.patients_etat_civil;
                  return `
                    <tr>
                      <td style="font-weight:500;">${patient ? formatNomComplet(patient.nom, patient.prenom) : '—'}</td>
                      <td>${t.dci}${t.nom_commercial ? ` <span style="color:var(--color-text-muted);font-size:.75rem;">(${t.nom_commercial})</span>` : ''}</td>
                      <td>${t.dose}</td>
                      <td><span class="badge badge--neutral">${t.voie_administration}</span></td>
                      <td style="color:var(--color-text-secondary);">${t.frequence}</td>
                    </tr>`;
                }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ─── Statistiques ─────────────────────────────────────────────────────────────

async function _loadStats() {
  const el = document.getElementById('dash-stats');
  if (!el) return;

  const { data } = await supabase
    .from('statistiques_soins')
    .select('indicateur, valeur, unite, periode_debut, periode_fin')
    .order('periode_debut', { ascending: false })
    .limit(6);

  el.innerHTML = `
    <div class="card">
      <div class="card__header">
        <div class="card__title">📊 Indicateurs de pilotage</div>
      </div>
      <div class="card__body">
        ${!data?.length
          ? `<p style="color:var(--color-text-muted);text-align:center;padding:var(--space-6) 0;">
               Aucune statistique disponible pour la période en cours.
             </p>`
          : `<div class="grid-3">
               ${data.map(s => `
                 <div style="padding:var(--space-3);background:var(--color-surface-raised);
                             border-radius:var(--radius-md);border:1px solid var(--color-border);">
                   <div class="section-label" style="margin-bottom:.25rem;">${s.indicateur}</div>
                   <div style="font-size:1.5rem;font-weight:700;color:var(--color-text);">
                     ${s.valeur != null ? s.valeur : '—'} <span style="font-size:.875rem;font-weight:400;color:var(--color-text-muted);">${s.unite ?? ''}</span>
                   </div>
                   <div style="font-size:.6875rem;color:var(--color-text-muted);margin-top:3px;">
                     ${formatDateTime(s.periode_debut)} → ${formatDateTime(s.periode_fin)}
                   </div>
                 </div>`).join('')}
             </div>`}
      </div>
    </div>`;
}
