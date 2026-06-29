/**
 * [ candy-e ] — MODULE STATISTIQUES EHPAD
 */

import { supabase } from '../../core/supabase.client.js';

export async function mountStats() {
  const main = document.getElementById('main-content');
  if (!main) return;

  main.innerHTML = `
    <div class="page-header">
      <div class="page-header__eyebrow">Pilotage</div>
      <h1 class="page-header__title">Statistiques</h1>
    </div>
    <div style="text-align:center;padding:var(--space-8);color:var(--color-text-muted);">Chargement…</div>
  `;

  const [patients, consultations, transmissions] = await Promise.all([
    supabase.from('patients').select('id, actif, gir'),
    supabase.from('consultations').select('id, date_consult, type_acte').gte('date_consult', _debutMois()),
    supabase.from('transmissions').select('id, urgence, lue').eq('lue', false),
  ]);

  const pData = patients.data ?? [];
  const cData = consultations.data ?? [];
  const tData = transmissions.data ?? [];

  const actifs   = pData.filter(p => p.actif).length;
  const inactifs = pData.filter(p => !p.actif).length;
  const girDist  = _girDistribution(pData.filter(p => p.actif));
  const typesDist = _typeDistribution(cData);

  main.innerHTML = `
    <div class="page-header">
      <div class="page-header__eyebrow">Pilotage</div>
      <h1 class="page-header__title">Statistiques</h1>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--space-4);margin-bottom:var(--space-6);">
      ${_kpi('👥', 'Patients actifs',         actifs,          'badge--success')}
      ${_kpi('💤', 'Patients inactifs',        inactifs,        'badge--neutral')}
      ${_kpi('🩺', 'Consultations ce mois',    cData.length,    'badge--neutral')}
      ${_kpi('💬', 'Transmissions non lues',   tData.length,    tData.length > 0 ? 'badge--danger' : 'badge--success')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);">

      <!-- Répartition GIR -->
      <div class="card">
        <div class="card__header">
          <div class="card__title">Répartition GIR — résidents actifs</div>
        </div>
        <div class="card__body">
          ${girDist.length
            ? girDist.map(({ niveau, label, count, pct }) => `
              <div style="margin-bottom:var(--space-3);">
                <div style="display:flex;justify-content:space-between;font-size:.8125rem;margin-bottom:4px;">
                  <span><strong>GIR ${niveau}</strong> — ${label}</span>
                  <span style="color:var(--color-text-muted);">${count} (${pct}%)</span>
                </div>
                <div style="height:8px;background:var(--color-border);border-radius:4px;overflow:hidden;">
                  <div style="height:100%;width:${pct}%;background:var(--color-primary);border-radius:4px;transition:width .4s;"></div>
                </div>
              </div>`).join('')
            : '<p style="color:var(--color-text-muted);font-size:.875rem;">Aucun GIR renseigné</p>'}
        </div>
      </div>

      <!-- Consultations par type ce mois -->
      <div class="card">
        <div class="card__header">
          <div class="card__title">Consultations par type — ${_libelleMois()}</div>
        </div>
        <div class="card__body">
          ${typesDist.length
            ? `<table class="table" style="font-size:.875rem;">
                <thead><tr><th>Type</th><th style="text-align:right;">Nb</th></tr></thead>
                <tbody>
                  ${typesDist.map(({ type, count }) => `
                    <tr>
                      <td>${type}</td>
                      <td style="text-align:right;font-weight:600;">${count}</td>
                    </tr>`).join('')}
                </tbody>
              </table>`
            : '<p style="color:var(--color-text-muted);font-size:.875rem;">Aucune consultation ce mois-ci</p>'}
        </div>
      </div>

    </div>
  `;
}

function _kpi(icon, label, value, badgeClass) {
  return `
    <div class="card" style="text-align:center;padding:var(--space-5);">
      <div style="font-size:2rem;margin-bottom:var(--space-2);">${icon}</div>
      <div style="font-size:1.75rem;font-weight:700;margin-bottom:var(--space-1);">
        <span class="badge ${badgeClass}" style="font-size:1.25rem;padding:.4rem .8rem;">${value}</span>
      </div>
      <div style="font-size:.8125rem;color:var(--color-text-muted);">${label}</div>
    </div>`;
}

function _girDistribution(patients) {
  const labels = { 1:'Totalement dépendant', 2:'Très dépendant', 3:'Dépendant',
                   4:'Partiellement dépendant', 5:'Peu dépendant', 6:'Autonome' };
  const counts = {};
  patients.forEach(p => { if (p.gir) counts[p.gir] = (counts[p.gir] ?? 0) + 1; });
  const total = patients.filter(p => p.gir).length;
  if (!total) return [];
  return Object.entries(counts)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([niveau, count]) => ({
      niveau, label: labels[niveau] ?? '', count,
      pct: Math.round(count / total * 100),
    }));
}

function _typeDistribution(consultations) {
  const counts = {};
  consultations.forEach(c => {
    const t = c.type_acte ?? 'Non renseigné';
    counts[t] = (counts[t] ?? 0) + 1;
  });
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([type, count]) => ({ type, count }));
}

function _debutMois() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}

function _libelleMois() {
  return new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}
