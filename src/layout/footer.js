/**
 * [ candy-e ] — FOOTER
 * Fichier : layout/footer.js
 */

export function mountFooter() {
  const el = document.getElementById('footer');
  if (!el) return;

  el.innerHTML = `
    <span>[ candy-e ] v1.0 &nbsp;·&nbsp; Infrastructure Supabase auto-hébergée &nbsp;·&nbsp; Réseau local interne</span>
    <span id="footer-time" aria-live="polite"></span>
  `;

  // Horloge en temps réel
  _updateClock();
  setInterval(_updateClock, 60_000);
}

function _updateClock() {
  const el = document.getElementById('footer-time');
  if (!el) return;
  el.textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
