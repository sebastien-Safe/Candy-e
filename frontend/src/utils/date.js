/**
 * [ candy-e ] — UTILITAIRES DATE
 * Fichier : utils/date.js
 * Aucune dépendance externe — Date natif JS uniquement.
 */

const LOCALE = 'fr-FR';

/** Formater une date en format long lisible. Ex: "jeudi 26 juin 2026" */
export function formatDateLong(date) {
  return new Date(date).toLocaleDateString(LOCALE, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

/** Formater une date courte. Ex: "26/06/2026" */
export function formatDate(date) {
  return new Date(date).toLocaleDateString(LOCALE);
}

/** Formater date + heure. Ex: "26/06/2026 à 14:32" */
export function formatDateTime(date) {
  return new Date(date).toLocaleDateString(LOCALE, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Formater uniquement l'heure. Ex: "14:32" */
export function formatTime(date) {
  return new Date(date).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
}

/** Calculer l'âge en années depuis une date de naissance. */
export function calcAge(dateNaissance) {
  const today = new Date();
  const birth = new Date(dateNaissance);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/** Temps relatif humain. Ex: "il y a 3 heures" */
export function timeAgo(date) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60)    return 'à l\'instant';
  if (diff < 3600)  return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `il y a ${Math.floor(diff / 86400)} j`;
  return formatDate(date);
}

/** Date du jour au format ISO YYYY-MM-DD (pour les inputs type="date"). */
export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

/** Vérifie si une date est dans le passé. */
export function isPast(date) {
  return new Date(date) < new Date();
}

/** Vérifie si une date est aujourd'hui. */
export function isToday(date) {
  const d = new Date(date);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}
