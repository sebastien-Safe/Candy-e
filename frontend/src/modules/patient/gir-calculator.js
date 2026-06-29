/**
 * [ candy-e ] — CALCULATEUR GIR / GRILLE AGGIR
 *
 * Évalue le niveau de dépendance selon les 10 variables discriminantes
 * de la grille nationale AGGIR (Autonomie Gérontologie Groupes Iso-Ressources).
 *
 * Codes :
 *   A = Fait seul, spontanément, totalement, habituellement et correctement
 *   B = Fait partiellement, non spontanément, ou de façon incorrecte/irrégulière
 *   C = Ne fait pas
 */

import { girIcon } from '../../utils/format.js';

// ─── Grille AGGIR ─────────────────────────────────────────────────────────────

const VARIABLES = [
  {
    id: 'coherence',
    label: 'Cohérence',
    groupe: 'Fonctions mentales',
    description: 'Converser et/ou se comporter de façon sensée',
    options: {
      A: 'Toujours cohérent — se comporte et converse toujours de façon sensée',
      B: 'Parfois incohérent — comportement ou conversation parfois inadaptés',
      C: 'Jamais cohérent — ne se comporte jamais de façon sensée',
    },
  },
  {
    id: 'orientation',
    label: 'Orientation',
    groupe: 'Fonctions mentales',
    description: 'Se repérer dans le temps et dans les lieux',
    options: {
      A: 'Toujours orienté — se repère dans le temps (heure, jour, mois) et dans les lieux',
      B: 'Parfois désorienté — se repère partiellement dans le temps ou dans les lieux',
      C: 'Jamais orienté — ne se repère ni dans le temps ni dans les lieux',
    },
  },
  {
    id: 'toilette',
    label: 'Toilette',
    groupe: 'Soins corporels',
    description: 'Se laver (haut et bas du corps)',
    options: {
      A: 'Seul — réalise seul l\'ensemble de sa toilette, correctement',
      B: 'Partielle — réalise partiellement sa toilette ou a besoin d\'aide pour certaines parties',
      C: 'Aidé totalement — ne réalise aucune partie de sa toilette seul',
    },
  },
  {
    id: 'habillage',
    label: 'Habillage',
    groupe: 'Soins corporels',
    description: 'S\'habiller, se déshabiller, choisir ses vêtements',
    options: {
      A: 'Seul — s\'habille, se déshabille et choisit ses vêtements correctement',
      B: 'Partiel — s\'habille partiellement ou a besoin d\'aide pour certains vêtements',
      C: 'Aidé totalement — ne s\'habille et ne se déshabille pas seul',
    },
  },
  {
    id: 'alimentation',
    label: 'Alimentation',
    groupe: 'Soins corporels',
    description: 'Se servir et manger',
    options: {
      A: 'Seul — se sert et mange seul, correctement',
      B: 'Partielle — se sert ou mange partiellement seul, ou a besoin d\'aide pour se servir',
      C: 'Aidé totalement — ne se sert pas et ne mange pas seul (alimentation par sonde incluse)',
    },
  },
  {
    id: 'elimination',
    label: 'Élimination',
    groupe: 'Soins corporels',
    description: 'Gérer l\'hygiène urinaire et fécale',
    options: {
      A: 'Seul — assure seul l\'hygiène de l\'élimination, correctement',
      B: 'Partielle — incontinence partielle ou a besoin d\'aide pour l\'hygiène',
      C: 'Dépendant — incontinence totale ou aide totale nécessaire',
    },
  },
  {
    id: 'transferts',
    label: 'Transferts',
    groupe: 'Locomotion',
    description: 'Se lever, se coucher, s\'asseoir',
    options: {
      A: 'Seul — se lève, se couche et s\'assoit seul, correctement',
      B: 'Avec aide — réalise les transferts avec aide humaine ou technique',
      C: 'Confiné — ne peut pas se lever ni se coucher seul (alité ou en fauteuil)',
    },
  },
  {
    id: 'deplInt',
    label: 'Déplacements intérieurs',
    groupe: 'Locomotion',
    description: 'Se déplacer dans le logement ou l\'établissement',
    options: {
      A: 'Seul — se déplace seul dans le logement / l\'EHPAD',
      B: 'Avec aide — se déplace avec aide (canne, déambulateur, fauteuil roulant autonome…)',
      C: 'Non — ne se déplace pas dans le logement',
    },
  },
  {
    id: 'deplExt',
    label: 'Déplacements extérieurs',
    groupe: 'Locomotion',
    description: 'Se déplacer hors du logement',
    options: {
      A: 'Seul — se déplace seul à l\'extérieur',
      B: 'Avec aide — se déplace à l\'extérieur avec aide ou accompagnement',
      C: 'Non — ne se déplace pas seul à l\'extérieur',
    },
  },
  {
    id: 'communication',
    label: 'Communication à distance',
    groupe: 'Communication',
    description: 'Utiliser les moyens de communication (téléphone, sonnette, interphone…)',
    options: {
      A: 'Seul — utilise seul les moyens de communication',
      B: 'Avec aide — utilise avec aide ou difficulté les moyens de communication',
      C: 'Non — n\'utilise pas les moyens de communication à distance',
    },
  },
];

// ─── Algorithme AGGIR ─────────────────────────────────────────────────────────

function _computeGIR(v) {
  // GIR 1 : Confinement total + altération mentale totale
  if (v.coherence === 'C' && v.orientation === 'C' &&
      v.transferts === 'C' && v.deplInt === 'C') return 1;

  // GIR 2a : Confinement total (lit/fauteuil), dépendance corporelle majeure
  if (v.transferts === 'C' && v.deplInt === 'C') return 2;

  // GIR 2b : Confusion totale avec capacité de déambulation
  if (v.coherence === 'C' && v.orientation === 'C') return 2;

  // GIR 3 : Locomotion compromise + dépendance corporelle lourde (soins pluriquotidiens)
  const locoCompromise = v.transferts !== 'A' || v.deplInt !== 'A';
  const corporelLourd =
    [v.toilette, v.habillage, v.elimination].filter(x => x === 'C').length >= 2 ||
    [v.toilette, v.habillage, v.elimination].every(x => x !== 'A');
  if (locoCompromise && corporelLourd) return 3;

  // GIR 4 : Transferts non autonomes mais déplacements possibles,
  //         ou dépendance totale pour toilette ET habillage
  if ((v.transferts !== 'A' && v.deplInt !== 'C') ||
      (v.toilette === 'C' && v.habillage === 'C')) return 4;

  // GIR 5 : Aide ponctuelle sur quelques activités
  if ([v.toilette, v.habillage, v.alimentation, v.elimination, v.deplExt]
      .some(x => x !== 'A')) return 5;

  // GIR 6 : Autonome
  return 6;
}

// ─── Interface calculateur ────────────────────────────────────────────────────

export function openGirCalculator(onApply) {
  // Supprimer un éventuel calculateur déjà ouvert
  document.getElementById('gir-calc-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'gir-calc-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    background:rgba(0,0,0,.55);
    display:flex;align-items:center;justify-content:center;
    padding:1rem;
  `;

  overlay.innerHTML = `
    <div style="
      background:var(--color-surface);
      border-radius:var(--radius-xl,12px);
      width:100%;max-width:720px;
      max-height:90vh;display:flex;flex-direction:column;
      box-shadow:0 20px 60px rgba(0,0,0,.3);
    ">
      <!-- En-tête -->
      <div style="
        padding:1.25rem 1.5rem;
        border-bottom:1px solid var(--color-border);
        display:flex;align-items:center;justify-content:space-between;
        flex-shrink:0;
      ">
        <div>
          <div style="font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;
                      color:var(--color-text-muted);margin-bottom:.25rem;">
            Grille AGGIR
          </div>
          <div style="font-size:1.125rem;font-weight:700;">Calcul du Groupe Iso-Ressources</div>
        </div>
        <button id="gir-calc-close" style="
          background:none;border:none;cursor:pointer;font-size:1.25rem;
          color:var(--color-text-muted);padding:.25rem .5rem;
        ">✕</button>
      </div>

      <!-- Corps scrollable -->
      <div style="overflow-y:auto;padding:1.25rem 1.5rem;flex:1;" id="gir-calc-body">
        <p style="font-size:.8125rem;color:var(--color-text-muted);margin-bottom:1.25rem;">
          Évaluez chaque activité selon 3 niveaux :<br>
          <strong>A</strong> = Fait seul et correctement ·
          <strong>B</strong> = Fait partiellement ou avec aide ·
          <strong>C</strong> = Ne fait pas / nécessite une aide totale
        </p>
        ${_renderQuestions()}
      </div>

      <!-- Pied sticky -->
      <div id="gir-calc-footer" style="
        padding:1rem 1.5rem;
        border-top:1px solid var(--color-border);
        display:flex;align-items:center;justify-content:space-between;
        flex-shrink:0;gap:1rem;
        background:var(--color-surface);
      ">
        <div id="gir-result" style="font-size:1rem;font-weight:600;"></div>
        <div style="display:flex;gap:.5rem;">
          <button class="btn btn--outline btn--sm" id="gir-calc-reset">Réinitialiser</button>
          <button class="btn btn--outline btn--sm" id="gir-calc-cancel">Annuler</button>
          <button class="btn btn--primary btn--sm" id="gir-calc-apply" disabled>Appliquer</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Événements
  let currentGIR = null;

  function _close() { overlay.remove(); }

  overlay.addEventListener('click', e => { if (e.target === overlay) _close(); });
  document.getElementById('gir-calc-close').addEventListener('click', _close);
  document.getElementById('gir-calc-cancel').addEventListener('click', _close);

  document.getElementById('gir-calc-reset').addEventListener('click', () => {
    overlay.querySelectorAll('input[type=radio]').forEach(r => r.checked = false);
    currentGIR = null;
    document.getElementById('gir-result').innerHTML = '';
    document.getElementById('gir-calc-apply').disabled = true;
  });

  overlay.addEventListener('change', () => {
    const values = {};
    let allFilled = true;
    VARIABLES.forEach(variable => {
      const checked = overlay.querySelector(`input[name="${variable.id}"]:checked`);
      if (checked) values[variable.id] = checked.value;
      else allFilled = false;
    });

    if (allFilled) {
      currentGIR = _computeGIR(values);
      const icon = girIcon(currentGIR);
      const labels = {
        1: 'Totalement dépendant', 2: 'Très dépendant',
        3: 'Dépendant', 4: 'Partiellement dépendant',
        5: 'Peu dépendant', 6: 'Autonome',
      };
      document.getElementById('gir-result').innerHTML =
        `${icon} <span style="font-size:1.25rem;">GIR ${currentGIR}</span>
         <span style="font-size:.875rem;font-weight:400;color:var(--color-text-muted);margin-left:.5rem;">
           ${labels[currentGIR]}
         </span>`;
      document.getElementById('gir-calc-apply').disabled = false;
    } else {
      document.getElementById('gir-result').innerHTML =
        `<span style="font-size:.8125rem;color:var(--color-text-muted);">
          Complétez toutes les variables pour obtenir le GIR
        </span>`;
      document.getElementById('gir-calc-apply').disabled = true;
    }
  });

  document.getElementById('gir-calc-apply').addEventListener('click', () => {
    if (currentGIR) { onApply(currentGIR); _close(); }
  });
}

// ─── Rendu des questions ──────────────────────────────────────────────────────

function _renderQuestions() {
  const groupes = [...new Set(VARIABLES.map(v => v.groupe))];
  return groupes.map(groupe => {
    const vars = VARIABLES.filter(v => v.groupe === groupe);
    return `
      <div style="margin-bottom:1.5rem;">
        <div style="
          font-size:.6875rem;text-transform:uppercase;letter-spacing:.1em;
          color:var(--color-text-muted);font-weight:600;
          margin-bottom:.75rem;padding-bottom:.375rem;
          border-bottom:1px solid var(--color-border);
        ">${groupe}</div>
        ${vars.map(_renderQuestion).join('')}
      </div>`;
  }).join('');
}

function _renderQuestion(variable) {
  const colors = { A: '#276749', B: '#744210', C: '#742a2a' };
  const bg     = { A: '#f0fff4', B: '#fffaf0', C: '#fff5f5' };

  return `
    <div style="margin-bottom:1rem;">
      <div style="display:flex;align-items:baseline;gap:.5rem;margin-bottom:.375rem;">
        <span style="font-weight:600;font-size:.9375rem;">${variable.label}</span>
        <span style="font-size:.8125rem;color:var(--color-text-muted);">${variable.description}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;">
        ${['A','B','C'].map(code => `
          <label style="cursor:pointer;">
            <input type="radio" name="${variable.id}" value="${code}"
                   style="position:absolute;opacity:0;pointer-events:none;" />
            <div class="gir-option" data-name="${variable.id}" data-value="${code}" style="
              border:2px solid var(--color-border);
              border-radius:8px;padding:.625rem .75rem;
              font-size:.8125rem;line-height:1.4;
              transition:border-color .15s,background .15s;
            ">
              <div style="
                display:inline-block;
                font-weight:700;font-size:.875rem;
                width:20px;height:20px;line-height:20px;text-align:center;
                border-radius:50%;margin-bottom:.25rem;
                background:${bg[code]};color:${colors[code]};
              ">${code}</div>
              <div style="color:var(--color-text-muted);">${variable.options[code]}</div>
            </div>
          </label>`).join('')}
      </div>
    </div>`;
}

// Style sélection via JS (impossible en CSS pur avec input caché)
document.addEventListener('change', e => {
  if (!e.target.matches('input[type=radio]') || !document.getElementById('gir-calc-overlay')) return;
  const name = e.target.name;
  document.querySelectorAll(`[data-name="${name}"]`).forEach(el => {
    const selected = el.dataset.value === e.target.value;
    el.style.borderColor = selected ? 'var(--color-primary)' : 'var(--color-border)';
    el.style.background  = selected ? 'var(--color-primary-light, #ebf4ff)' : '';
  });
}, true);
