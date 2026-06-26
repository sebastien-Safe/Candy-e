/**
 * [ candy-e ] — CLIENT SUPABASE LOCAL
 * Fichier : core/supabase.client.js
 *
 * IMPORTANT — Infrastructure air-gapped (réseau local fermé) :
 * La bibliothèque Supabase JS doit être disponible localement.
 *
 * ÉTAPE D'INSTALLATION (une seule fois) :
 *   1. Sur une machine avec accès internet, télécharger :
 *      https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js
 *   2. Copier le fichier dans : frontend/public/assets/vendor/supabase.min.js
 *   3. Ce fichier est chargé via <script> dans index.html avant les modules ES.
 *
 * La variable globale `window.supabase` est alors disponible.
 */

// ─── Configuration du serveur Supabase self-hosted ───────────────────────────
// Adapter l'IP et le port selon votre configuration Docker Compose locale.
const SUPABASE_URL  = 'https://dsfhvtkuwvaexybfqbsa.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzZmh2dGt1d3ZhZXh5YmZxYnNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3OTk2OTcsImV4cCI6MjA5NzM3NTY5N30.S2aMlgj9YeYxdX5IsSPEZhbBjRCeUfxPbhO-Xkis2Qk';

// ─── Création du client ───────────────────────────────────────────────────────
// window.supabase est exposé par le bundle UMD chargé en <script> dans index.html
if (!window.supabase) {
  throw new Error(
    '[candy-e] Le bundle Supabase JS est introuvable.\n' +
    'Vérifiez que /assets/vendor/supabase.min.js est présent et chargé dans index.html.'
  );
}

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    // Persistance de session dans localStorage (réseau local sécurisé)
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,   // Pas de magic-link via URL en self-hosted
  },
  realtime: {
    // Désactiver le realtime si non nécessaire (économise les ressources)
    params: { eventsPerSecond: 2 },
  },
  global: {
    headers: {
      // En-tête personnalisé pour l'identification interne
      'X-App-Name': 'candy-e',
    },
  },
});

export default supabase;
