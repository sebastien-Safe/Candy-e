/**
 * [ candy-e ] — VALIDATEURS DE FORMULAIRES
 * Fichier : utils/validators.js
 * Retournent { valid: boolean, error: string|null }.
 */

export function required(value, label = 'Ce champ') {
  const v = String(value ?? '').trim();
  return v.length > 0
    ? { valid: true, error: null }
    : { valid: false, error: `${label} est obligatoire.` };
}

export function minLength(value, min, label = 'Ce champ') {
  const v = String(value ?? '');
  return v.length >= min
    ? { valid: true, error: null }
    : { valid: false, error: `${label} doit contenir au moins ${min} caractères.` };
}

export function maxLength(value, max, label = 'Ce champ') {
  const v = String(value ?? '');
  return v.length <= max
    ? { valid: true, error: null }
    : { valid: false, error: `${label} ne doit pas dépasser ${max} caractères.` };
}

export function isEmail(value) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(value)
    ? { valid: true, error: null }
    : { valid: false, error: 'Adresse e-mail invalide.' };
}

export function isDate(value, label = 'La date') {
  const d = new Date(value);
  return !isNaN(d.getTime())
    ? { valid: true, error: null }
    : { valid: false, error: `${label} est invalide.` };
}

export function isInRange(value, min, max, label = 'La valeur') {
  const n = Number(value);
  if (isNaN(n)) return { valid: false, error: `${label} doit être un nombre.` };
  if (n < min || n > max) return { valid: false, error: `${label} doit être entre ${min} et ${max}.` };
  return { valid: true, error: null };
}

export function isNIR(value) {
  const n = String(value ?? '').replace(/\s/g, '');
  return /^\d{15}$/.test(n)
    ? { valid: true, error: null }
    : { valid: false, error: 'Le numéro de sécurité sociale doit contenir 15 chiffres.' };
}

/**
 * Valider un objet entier avec un schéma de règles.
 * @param {Object} data    - Données à valider
 * @param {Object} schema  - { champ: [fn1, fn2, ...] }
 * @returns {{ valid: boolean, errors: Object }}
 */
export function validate(data, schema) {
  const errors = {};
  for (const [field, rules] of Object.entries(schema)) {
    for (const rule of rules) {
      const result = rule(data[field]);
      if (!result.valid) {
        errors[field] = result.error;
        break;
      }
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/** Affiche les erreurs dans les champs du DOM. */
export function showFormErrors(errors, formEl) {
  formEl.querySelectorAll('.form-error').forEach(el => el.remove());
  formEl.querySelectorAll('.input--error').forEach(el => el.classList.remove('input--error'));

  for (const [field, msg] of Object.entries(errors)) {
    const input = formEl.querySelector(`[name="${field}"], #${field}`);
    if (input) {
      input.classList.add('input--error');
      const errEl = document.createElement('span');
      errEl.className = 'form-error';
      errEl.textContent = msg;
      input.parentElement.appendChild(errEl);
    }
  }
}

/** Efface tous les messages d'erreur d'un formulaire. */
export function clearFormErrors(formEl) {
  formEl.querySelectorAll('.form-error').forEach(el => el.remove());
  formEl.querySelectorAll('.input--error').forEach(el => el.classList.remove('input--error'));
}
