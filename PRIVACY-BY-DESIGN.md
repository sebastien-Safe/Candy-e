# Privacy by Design — C@NDY en hébergement local (Supabase self-hosted)

Contexte : bascule de Supabase Cloud (`dsfhvtkuwvaexybfqbsa`, eu-west-1) vers une instance
Supabase auto-hébergée en local, sans mode démo. Ce document liste les mesures à mettre en
place avant mise en production, issues de l'audit de l'état actuel du code.

## 1. Authentification forte (priorité — mode démo à supprimer)

- **Supprimer tout compte/rôle démo** (`medecin_demo`, flag `is_demo` sur `patients`, sélecteur
  de rôle démo côté frontend) avant toute mise en production réelle. Un mode démo qui contourne
  le vrai login n'a rien à faire sur une instance contenant des données de santé réelles.
- **Activer la protection mots de passe compromis** (HaveIBeenPwned) — actuellement désactivée
  sur le projet Cloud (`auth_leaked_password_protection` WARN). Sur Supabase self-hosted :
  `GOTRUE_PASSWORD_HIBP_ENABLED=true` + politique de complexité minimale (longueur ≥ 12,
  pas de mot de passe par défaut envoyé en clair par email).
- **Activer le MFA (TOTP)** pour tous les rôles à privilège élevé (`admin_crm`, `administrateur`,
  `medecin`, `cadre`) au minimum ; idéalement pour tous les rôles soignants.
- **Rotation des secrets à la migration** : nouveau `JWT secret` et nouvelle `anon key` /
  `service_role key` générés pour l'instance locale. L'ancienne clé `anon` exposée dans le
  code source Cloud doit être révoquée définitivement.
- **`service_role` key** : ne jamais l'exposer côté frontend (elle bypasse RLS). Vérifier
  qu'aucun bundle JS ne la contient.
- **Expiration de session** : réduire la durée de vie du JWT (ex. 1h avec refresh token) plutôt
  que les valeurs par défaut longues, vu la sensibilité des données.
- **Verrouillage de compte** après N échecs de connexion (rate limiting Auth), pertinent en
  hébergement local sans WAF externe.

## 2. Corriger les failles RLS actives (constat de l'audit `get_advisors`)

- `profiles` : la policy INSERT `profiles_insert_any` (`WITH CHECK (true)`) permet à tout
  utilisateur authentifié de créer/altérer une ligne de profil arbitraire → restreindre aux
  seuls `admin_crm` / trigger `handle_new_user`.
- `audit_logs` : la policy INSERT `audit_insert` (`WITH CHECK (true)`) permet de falsifier le
  journal d'audit → n'autoriser l'insertion que via la fonction `log_action()` (SECURITY DEFINER),
  jamais en INSERT direct depuis le rôle `authenticated`.
- `patients` : SELECT actuellement limité à `admin_crm`, `medecin`, `secretaire`,
  `medecin_demo` (patients démo) — alors que le RBAC frontend donne `patient.read` à
  `infirmiere`, `aide_soignante`, `cadre`, `kine`, `psycho`, `ergo`, `ash`. Il faut soit
  étendre la policy RLS à ces rôles soignants, soit accepter que ces rôles ne puissent
  pas ouvrir les fiches patients (à trancher avec l'établissement).
- Vue `v_stats_candy` en `SECURITY DEFINER` : repasser en vue standard (ou fonction avec
  vérification de rôle explicite) pour ne pas contourner la RLS de l'appelant.
- Fonctions `SECURITY DEFINER` exposées à `anon` (`delete_user_by_id`, `get_my_candy_role`,
  `get_my_profile_role`, `handle_new_user`, `log_action`) : révoquer `EXECUTE` pour `anon`
  quand l'appel non authentifié n'a pas de raison d'être (toutes sauf `handle_new_user`,
  qui est un trigger).

## 3. Traçabilité réelle (accountability, art. 5.2 RGPD)

- `log_action()` existe déjà en base mais **n'est appelée nulle part dans le frontend** —
  aujourd'hui aucune création/modification/suppression de donnée de santé n'est journalisée
  en usage réel. À câbler sur les opérations sensibles : création/modif patient, traitements,
  consultations, transmissions, accès à un dossier, suppression de compte.
- Conserver `ip_address` et horodatage (déjà prévus dans le schéma `audit_logs`) — utile en
  local pour détecter un accès depuis un poste inhabituel du réseau de l'établissement.
- Rétention des logs d'audit : définir une durée explicite (recommandation CNIL/ANS : plusieurs
  années) et un mécanisme de purge documenté plutôt qu'une conservation indéfinie.

## 4. Droits des personnes concernées

- Aujourd'hui : aucun export, aucune suppression/anonymisation réelle (seul un flag
  `actif`/`inactif` soft sur `patients`), aucun consentement tracé.
- À prévoir a minima :
  - une fonction d'export JSON/PDF du dossier d'un patient (droit d'accès / portabilité) ;
  - une procédure d'anonymisation (pas de suppression physique tant que l'obligation légale
    de conservation des dossiers médicaux n'est pas expirée — anonymiser les champs
    identifiants plutôt que `DELETE`) ;
  - un champ de traçage du consentement (recueil, date, retrait) si le traitement en dépend.

## 5. Spécificités de l'hébergement local (auto-hébergement)

- **Réseau** : l'instance Supabase locale ne doit pas être exposée directement sur Internet.
  Accès via VPN ou réseau interne de l'établissement uniquement, reverse proxy (Nginx/Caddy)
  avec TLS même en interne (le Wi-Fi local n'est pas un canal de confiance en soi).
- **Chiffrement au repos** : disque du serveur chiffré (LUKS ou équivalent), y compris les
  volumes Docker de Postgres et du storage.
- **Sauvegardes** : même en local, prévoir une copie chiffrée sur un support externe au poste
  de production (l'établissement doit décider où — hors périmètre technique de ce document,
  mais à ne pas laisser sans réponse : un poste local unique = perte de données irréversible
  en cas d'incident matériel).
- **Mises à jour** : Postgres/Supabase self-hosted ne reçoivent pas les correctifs de sécurité
  automatiquement comme Supabase Cloud — prévoir un process de patch régulier.
- **Accès physique au serveur** : à restreindre (salle serveur/armoire verrouillée), sujet
  souvent oublié en auto-hébergement EHPAD.

## 6. Priorisation suggérée

1. Authentification forte + suppression du mode démo (bloquant avant toute donnée réelle).
2. Correction des 2 policies RLS `WITH CHECK (true)` (`profiles`, `audit_logs`) — faille active
   exploitable dès aujourd'hui, indépendamment de l'hébergement.
3. Câblage réel de `log_action()` sur les opérations sensibles.
4. RLS `patients` alignée avec le RBAC frontend réel.
5. Droits des personnes (export / anonymisation / consentement).
6. Durcissement infra locale (réseau, chiffrement, sauvegardes, patch management).
