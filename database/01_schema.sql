-- ==============================================================================
-- [ candy-e ] — SCRIPT DDL PRINCIPAL
-- Fichier        : 01_schema.sql
-- Description    : Création du schéma complet de la base de données PostgreSQL
--                  pour l'application de santé candy-e (EHPAD / SSR).
-- Environnement  : Supabase Self-Hosted — réseau local fermé (air-gapped)
-- Auteur         : candy-e Infrastructure Team
-- Version        : 1.0.0
-- ==============================================================================

-- Activer les extensions nécessaires (disponibles nativement dans Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- SECTION 1 : TYPE ÉNUMÉRÉ DES RÔLES MÉTIER (RBAC)
-- ==============================================================================

-- Suppression propre si re-déploiement (ordre important pour les dépendances)
DROP TYPE IF EXISTS public.custom_role CASCADE;

-- Création de l'ENUM regroupant l'ensemble des profils du personnel
CREATE TYPE public.custom_role AS ENUM (
    'administrateur',       -- 🟢 Accès infrastructure complet
    'cadre',                -- 🟠 Cadre de santé — accès clinique maximal
    'infirmiere',           -- 🔴 IDE — accès clinique et opérationnel
    'aide_soignante',       -- 🟡 AS — soins de confort et suivi quotidien
    'ash',                  -- 🔵 Agent de service hôtelier
    'medecin',              -- 🟣 Médecin intervenant — droits cliniques complets
    'kine',                 -- ⚫️ Kinésithérapeute — réhabilitation physique
    'psycho',               -- ⚪️ Psychologue — santé mentale et histoire de vie
    'ergo'                  -- ㉅  Ergothérapeute — suivi de l'autonomie
);

COMMENT ON TYPE public.custom_role IS
    'Rôles métier du personnel de l''établissement candy-e. Utilisé pour le contrôle d''accès RBAC via les politiques RLS.';


-- ==============================================================================
-- SECTION 2 : TABLE PROFILES — Miroir de auth.users
-- ==============================================================================

-- Suppression en cascade pour un redéploiement propre
DROP TABLE IF EXISTS public.profiles CASCADE;

CREATE TABLE public.profiles (
    id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role            public.custom_role  NOT NULL DEFAULT 'ash',
    nom             TEXT        NOT NULL CHECK (char_length(nom) BETWEEN 1 AND 100),
    prenom          TEXT        NOT NULL CHECK (char_length(prenom) BETWEEN 1 AND 100),
    service         TEXT,                           -- Service d'affectation (ex: "Soins", "Administration")
    telephone       TEXT,                           -- Numéro interne ou portable professionnel
    actif           BOOLEAN     NOT NULL DEFAULT TRUE,
    date_creation   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    derniere_connexion TIMESTAMPTZ                  -- Mise à jour par trigger à chaque authentification
);

COMMENT ON TABLE public.profiles IS
    'Profils du personnel soignant et administratif. Synchronisé automatiquement avec auth.users via trigger.';
COMMENT ON COLUMN public.profiles.role IS
    'Rôle RBAC déterminant les droits d''accès aux modules de l''application.';
COMMENT ON COLUMN public.profiles.actif IS
    'Permet de désactiver un compte sans le supprimer (départ du personnel, congé longue durée).';


-- ==============================================================================
-- SECTION 3 : FONCTION ET TRIGGER — Auto-création du profil
-- ==============================================================================

-- Fonction appelée automatiquement lors de la création d'un utilisateur Supabase
CREATE OR REPLACE FUNCTION public.fn_on_new_user_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER                          -- S'exécute avec les droits du propriétaire (postgres)
SET search_path = public                  -- Isolation explicite du search_path pour la sécurité
AS $$
BEGIN
    -- Insertion dans profiles en récupérant les métadonnées transmises lors de la création
    INSERT INTO public.profiles (id, nom, prenom, role, service)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nom',     'Non renseigné'),
        COALESCE(NEW.raw_user_meta_data->>'prenom',  'Non renseigné'),
        COALESCE(
            (NEW.raw_user_meta_data->>'role')::public.custom_role,
            'ash'           -- Rôle le plus restrictif par défaut (principe du moindre privilège)
        ),
        NEW.raw_user_meta_data->>'service'
    );
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_on_new_user_created() IS
    'Trigger function : clone automatiquement chaque nouvel utilisateur auth.users dans public.profiles.';

-- Dépose le trigger existant avant de le recréer
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;

CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_on_new_user_created();

COMMENT ON TRIGGER trg_on_auth_user_created ON auth.users IS
    'Déclenché après chaque INSERT dans auth.users pour synchroniser public.profiles.';


-- ==============================================================================
-- SECTION 4 : TABLE patients_etat_civil
-- Module : 🆔 État civil (dossier patient)
-- Accès  : Admin, Cadre, IDE, Médecin, Psycho
-- ==============================================================================

DROP TABLE IF EXISTS public.patients_etat_civil CASCADE;

CREATE TABLE public.patients_etat_civil (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Identité
    nom                     TEXT        NOT NULL,
    prenom                  TEXT        NOT NULL,
    nom_usage               TEXT,                           -- Nom de naissance ou nom marital
    date_naissance          DATE        NOT NULL,
    lieu_naissance          TEXT,
    nationalite             TEXT        DEFAULT 'Française',
    -- Sécurité sociale
    numero_secu             TEXT        UNIQUE,             -- NIR — sensible, chiffré en amont si besoin
    caisse_affiliation      TEXT,
    -- Situation
    situation_familiale     TEXT        CHECK (situation_familiale IN ('célibataire','marié(e)','divorcé(e)','veuf/veuve','pacsé(e)','union libre')),
    -- Adresse antérieure à l'admission
    adresse_anterieure      TEXT,
    code_postal             TEXT,
    ville                   TEXT,
    -- Contact en cas d'urgence
    contact_urgence_nom     TEXT,
    contact_urgence_lien    TEXT,                           -- Relation (fils, fille, tuteur, etc.)
    contact_urgence_tel     TEXT,
    -- Tutelle / Curatelle
    sous_protection         BOOLEAN     DEFAULT FALSE,
    type_protection         TEXT        CHECK (type_protection IN ('tutelle','curatelle simple','curatelle renforcée','sauvegarde de justice')),
    nom_representant        TEXT,
    tel_representant        TEXT,
    -- Séjour
    chambre                 TEXT,
    date_entree             DATE        NOT NULL DEFAULT CURRENT_DATE,
    date_sortie             DATE,
    motif_sortie            TEXT,
    actif                   BOOLEAN     NOT NULL DEFAULT TRUE,
    -- Traçabilité
    cree_par                UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    cree_le                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    modifie_par             UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    modifie_le              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.patients_etat_civil IS
    'Données d''identité et d''état civil des résidents/patients. Accès restreint aux rôles habilités.';


-- ==============================================================================
-- SECTION 5 : TABLE donnees_medicales_constantes
-- Module : 🩺 Constantes vitales
-- Accès  : Admin, Cadre, IDE, AS, Médecin, Kiné
-- ==============================================================================

DROP TABLE IF EXISTS public.donnees_medicales_constantes CASCADE;

CREATE TABLE public.donnees_medicales_constantes (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id          UUID        NOT NULL REFERENCES public.patients_etat_civil(id) ON DELETE CASCADE,
    date_mesure         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Hémodynamique
    tension_systolique  INTEGER     CHECK (tension_systolique BETWEEN 40 AND 300),
    tension_diastolique INTEGER     CHECK (tension_diastolique BETWEEN 20 AND 200),
    frequence_cardiaque INTEGER     CHECK (frequence_cardiaque BETWEEN 20 AND 300),
    -- Respiratoire
    frequence_respiratoire INTEGER  CHECK (frequence_respiratoire BETWEEN 4 AND 60),
    saturation_o2       INTEGER     CHECK (saturation_o2 BETWEEN 50 AND 100),
    -- Thermique
    temperature         NUMERIC(4,1) CHECK (temperature BETWEEN 30 AND 45),
    -- Métabolique
    glycemie_mmol       NUMERIC(5,2) CHECK (glycemie_mmol BETWEEN 0 AND 50),
    -- Anthropométrique
    poids_kg            NUMERIC(5,2) CHECK (poids_kg BETWEEN 1 AND 500),
    taille_cm           NUMERIC(5,2) CHECK (taille_cm BETWEEN 30 AND 280),
    imc                 NUMERIC(5,2) GENERATED ALWAYS AS (
                            CASE WHEN taille_cm > 0 AND poids_kg IS NOT NULL
                            THEN ROUND((poids_kg / POWER(taille_cm / 100.0, 2))::NUMERIC, 2)
                            ELSE NULL END
                        ) STORED,
    -- Douleur
    echelle_douleur     INTEGER     CHECK (echelle_douleur BETWEEN 0 AND 10),
    -- Observations libres
    observations        TEXT,
    -- Traçabilité
    saisie_par          UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    cree_le             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.donnees_medicales_constantes IS
    'Relevés des constantes vitales. L''IMC est calculé automatiquement par colonne générée.';
COMMENT ON COLUMN public.donnees_medicales_constantes.imc IS
    'Indice de Masse Corporelle — calculé automatiquement (colonne GENERATED ALWAYS).';


-- ==============================================================================
-- SECTION 6 : TABLE donnees_medicales_allergies
-- Module : ⚠️ Allergies
-- Accès  : Admin, Cadre, IDE, AS, Médecin, Kiné
-- ==============================================================================

DROP TABLE IF EXISTS public.donnees_medicales_allergies CASCADE;

CREATE TABLE public.donnees_medicales_allergies (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID        NOT NULL REFERENCES public.patients_etat_civil(id) ON DELETE CASCADE,
    type_allergie   TEXT        NOT NULL CHECK (type_allergie IN ('médicament','alimentaire','latex','environnementale','autre')),
    substance       TEXT        NOT NULL,
    severite        TEXT        NOT NULL CHECK (severite IN ('légère','modérée','sévère','anaphylaxie')),
    symptomes       TEXT,
    confirmee       BOOLEAN     NOT NULL DEFAULT FALSE,
    date_detection  DATE,
    -- Traçabilité
    saisie_par      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    cree_le         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    modifie_le      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.donnees_medicales_allergies IS
    'Allergies connues des résidents. Données critiques pour la sécurité médicamenteuse.';


-- ==============================================================================
-- SECTION 7 : TABLE donnees_medicales_antecedents
-- Module : 📜 Antécédents
-- Accès  : Admin, Cadre, IDE, AS, Médecin, Psycho
-- ==============================================================================

DROP TABLE IF EXISTS public.donnees_medicales_antecedents CASCADE;

CREATE TABLE public.donnees_medicales_antecedents (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID        NOT NULL REFERENCES public.patients_etat_civil(id) ON DELETE CASCADE,
    type_antecedent TEXT        NOT NULL CHECK (type_antecedent IN ('médical','chirurgical','familial','psychiatrique','obstétrical','traumatologique')),
    description     TEXT        NOT NULL,
    date_debut      DATE,
    date_fin        DATE,
    actif           BOOLEAN     NOT NULL DEFAULT TRUE,
    -- Traçabilité
    saisie_par      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    cree_le         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.donnees_medicales_antecedents IS
    'Antécédents médicaux, chirurgicaux et familiaux des résidents.';


-- ==============================================================================
-- SECTION 8 : TABLE donnees_medicales_gir
-- Module : 🧓 GIR — Grille d'évaluation de la dépendance (AGGIR)
-- Accès  : TOUS les rôles (Admin, Cadre, IDE, AS, ASH, Médecin, Kiné, Psycho, Ergo)
-- ==============================================================================

DROP TABLE IF EXISTS public.donnees_medicales_gir CASCADE;

CREATE TABLE public.donnees_medicales_gir (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id                  UUID        NOT NULL REFERENCES public.patients_etat_civil(id) ON DELETE CASCADE,
    date_evaluation             DATE        NOT NULL DEFAULT CURRENT_DATE,
    niveau_gir                  INTEGER     NOT NULL CHECK (niveau_gir BETWEEN 1 AND 6),
    -- Variables discriminantes AGGIR (A=Spontanément, B=Partiellement/Totalement, C=Pas du tout)
    coherence                   CHAR(1)     CHECK (coherence IN ('A','B','C')),
    orientation                 CHAR(1)     CHECK (orientation IN ('A','B','C')),
    toilette                    CHAR(1)     CHECK (toilette IN ('A','B','C')),
    habillage                   CHAR(1)     CHECK (habillage IN ('A','B','C')),
    alimentation                CHAR(1)     CHECK (alimentation IN ('A','B','C')),
    elimination_urinaire        CHAR(1)     CHECK (elimination_urinaire IN ('A','B','C')),
    elimination_fecale          CHAR(1)     CHECK (elimination_fecale IN ('A','B','C')),
    transferts                  CHAR(1)     CHECK (transferts IN ('A','B','C')),
    deplacement_interieur       CHAR(1)     CHECK (deplacement_interieur IN ('A','B','C')),
    deplacement_exterieur       CHAR(1)     CHECK (deplacement_exterieur IN ('A','B','C')),
    -- Observations
    observations                TEXT,
    -- Traçabilité
    evalue_par                  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    cree_le                     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.donnees_medicales_gir IS
    'Évaluations de la grille AGGIR (GIR 1-6). Accessible à l''ensemble du personnel.';
COMMENT ON COLUMN public.donnees_medicales_gir.niveau_gir IS
    'GIR 1 = dépendance totale, GIR 6 = autonomie complète.';


-- ==============================================================================
-- SECTION 9 : TABLE donnees_medicales_pathos
-- Module : 🧠 Pathos — Pathologies et diagnostics
-- Accès  : Admin, Cadre, IDE, Médecin, Psycho
-- ==============================================================================

DROP TABLE IF EXISTS public.donnees_medicales_pathos CASCADE;

CREATE TABLE public.donnees_medicales_pathos (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID        NOT NULL REFERENCES public.patients_etat_civil(id) ON DELETE CASCADE,
    code_cim10      TEXT,                               -- Code CIM-10 (ex: I10 = Hypertension)
    libelle         TEXT        NOT NULL,
    type_pathologie TEXT        NOT NULL CHECK (type_pathologie IN ('chronique','aiguë','psychiatrique','neurologique','infectieuse','oncologique','autre')),
    date_diagnostic DATE,
    statut          TEXT        NOT NULL CHECK (statut IN ('active','rémission','guérie','suspectée')),
    commentaire     TEXT,
    -- Traçabilité
    saisie_par      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    cree_le         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    modifie_le      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.donnees_medicales_pathos IS
    'Pathologies diagnostiquées des résidents. Le code CIM-10 permet une standardisation internationale.';


-- ==============================================================================
-- SECTION 10 : TABLE directives_anticipees
-- Module : ✍️ Directives anticipées
-- Accès  : Admin, Cadre, IDE, AS, Médecin, Psycho
-- ==============================================================================

DROP TABLE IF EXISTS public.directives_anticipees CASCADE;

CREATE TABLE public.directives_anticipees (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id              UUID        NOT NULL REFERENCES public.patients_etat_civil(id) ON DELETE CASCADE,
    type_directive          TEXT        NOT NULL CHECK (type_directive IN ('refus de soins','limitation thérapeutique','don d''organes','ressuscitation','autre')),
    contenu                 TEXT        NOT NULL,
    date_redaction          DATE        NOT NULL,
    date_validite           DATE,                       -- Nulle = valable indéfiniment
    -- Personne de confiance désignée
    personne_confiance_nom  TEXT,
    personne_confiance_tel  TEXT,
    personne_confiance_lien TEXT,
    -- Justificatif
    document_numerise       BOOLEAN     NOT NULL DEFAULT FALSE,
    chemin_document         TEXT,                       -- Chemin relatif local (stockage interne uniquement)
    -- Traçabilité
    saisie_par              UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    cree_le                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    modifie_le              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.directives_anticipees IS
    'Directives anticipées et personne de confiance. Documents légaux — modification tracée obligatoire.';


-- ==============================================================================
-- SECTION 11 : TABLE protocoles
-- Module : 📋 Protocoles de soins
-- Accès  : Admin, Cadre, IDE, Médecin
-- ==============================================================================

DROP TABLE IF EXISTS public.protocoles CASCADE;

CREATE TABLE public.protocoles (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID        NOT NULL REFERENCES public.patients_etat_civil(id) ON DELETE CASCADE,
    titre           TEXT        NOT NULL,
    type_protocole  TEXT        NOT NULL CHECK (type_protocole IN ('soins','alimentation','mobilisation','prévention escarres','douleur','chute','autre')),
    contenu         TEXT        NOT NULL,
    frequence       TEXT,                               -- Ex : "2x/jour", "tous les 48h"
    date_debut      DATE        NOT NULL DEFAULT CURRENT_DATE,
    date_fin        DATE,
    actif           BOOLEAN     NOT NULL DEFAULT TRUE,
    -- Traçabilité
    cree_par        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    cree_le         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    modifie_par     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    modifie_le      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.protocoles IS
    'Protocoles de soins individualisés. Référencés par les soins et pansements.';


-- ==============================================================================
-- SECTION 12 : TABLE transmissions
-- Module : 💬 Transmissions ciblées
-- Accès  : Admin, Cadre, IDE, AS, ASH, Médecin, Psycho
-- ==============================================================================

DROP TABLE IF EXISTS public.transmissions CASCADE;

CREATE TABLE public.transmissions (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id          UUID        NOT NULL REFERENCES public.patients_etat_civil(id) ON DELETE CASCADE,
    type_transmission   TEXT        NOT NULL CHECK (type_transmission IN ('observation','alerte','consigne','information','événement indésirable')),
    contenu             TEXT        NOT NULL,
    priorite            TEXT        NOT NULL DEFAULT 'normale' CHECK (priorite IN ('normale','urgente','critique')),
    cible_role          public.custom_role,             -- Rôle destinataire (optionnel, NULL = tous)
    lu                  BOOLEAN     NOT NULL DEFAULT FALSE,
    lu_le               TIMESTAMPTZ,
    -- Traçabilité
    saisie_par          UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    cree_le             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.transmissions IS
    'Journal de transmissions inter-équipes. Priorité "critique" = alerte immédiate.';


-- ==============================================================================
-- SECTION 13 : TABLE traitements
-- Module : 💊 Traitements médicamenteux
-- Accès  : Admin, Cadre, IDE, Médecin
-- ==============================================================================

DROP TABLE IF EXISTS public.traitements CASCADE;

CREATE TABLE public.traitements (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id          UUID        NOT NULL REFERENCES public.patients_etat_civil(id) ON DELETE CASCADE,
    -- Médicament
    dci                 TEXT        NOT NULL,            -- Dénomination Commune Internationale
    nom_commercial      TEXT,
    dose                TEXT        NOT NULL,            -- Ex : "500 mg", "1 comprimé"
    voie_administration TEXT        NOT NULL CHECK (voie_administration IN ('orale','IV','SC','IM','cutanée','inhalée','rectale','sublinguale','autre')),
    frequence           TEXT        NOT NULL,            -- Ex : "3x/jour", "Si besoin"
    -- Période
    date_debut          DATE        NOT NULL DEFAULT CURRENT_DATE,
    date_fin            DATE,
    actif               BOOLEAN     NOT NULL DEFAULT TRUE,
    -- Traçabilité médicale
    prescrit_par        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    observations        TEXT,
    cree_le             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    modifie_le          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.traitements IS
    'Prescriptions médicamenteuses en cours. Seuls les profils habilités peuvent créer/modifier.';


-- ==============================================================================
-- SECTION 14 : TABLE soins_pansement
-- Module : 🩹 Soins et pansements
-- Accès  : Admin, Cadre, IDE, Médecin
-- ==============================================================================

DROP TABLE IF EXISTS public.soins_pansement CASCADE;

CREATE TABLE public.soins_pansement (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID        NOT NULL REFERENCES public.patients_etat_civil(id) ON DELETE CASCADE,
    protocole_ref   UUID        REFERENCES public.protocoles(id) ON DELETE SET NULL,
    -- Description du soin
    type_soin       TEXT        NOT NULL CHECK (type_soin IN ('plaie aiguë','escarre','ulcère','stomie','cathéter','drain','autre')),
    localisation    TEXT,
    description     TEXT        NOT NULL,
    stade_escarre   TEXT        CHECK (stade_escarre IN ('I','II','III','IV','non-classifiable')),
    surface_cm2     NUMERIC(6,2),
    materiel_utilise TEXT,
    -- Planification
    date_soin       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    prochain_soin   DATE,
    -- Traçabilité
    saisie_par      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    cree_le         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.soins_pansement IS
    'Traçabilité des soins et pansements. Référence optionnelle vers un protocole.';


-- ==============================================================================
-- SECTION 15 : TABLE statistiques_soins
-- Module : 📊 Statistiques et pilotage
-- Accès  : Admin, Cadre, IDE, Médecin (SELECT uniquement pour non-admin)
-- ==============================================================================

DROP TABLE IF EXISTS public.statistiques_soins CASCADE;

CREATE TABLE public.statistiques_soins (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    periode_debut   DATE        NOT NULL,
    periode_fin     DATE        NOT NULL,
    indicateur      TEXT        NOT NULL,               -- Ex : "Taux d'escarres", "Taux de chutes"
    valeur          NUMERIC(10,4),
    unite           TEXT,                               -- Ex : "%", "incidents/mois"
    service         TEXT,
    commentaire     TEXT,
    genere_le       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    genere_par      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    -- Vérification de cohérence temporelle
    CONSTRAINT chk_periode_coherente CHECK (periode_fin >= periode_debut)
);

COMMENT ON TABLE public.statistiques_soins IS
    'Indicateurs de pilotage de l''établissement. Lecture seule pour les rôles non-administrateurs.';


-- ==============================================================================
-- SECTION 16 : TABLE logs_administration
-- Module : ⚙️ Journal d'audit (Administration)
-- Accès  : EXCLUSIVEMENT les administrateurs
-- ==============================================================================

DROP TABLE IF EXISTS public.logs_administration CASCADE;

CREATE TABLE public.logs_administration (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    utilisateur_id      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    action              TEXT        NOT NULL,           -- Ex : "INSERT", "UPDATE", "DELETE", "LOGIN"
    table_cible         TEXT,                           -- Nom de la table concernée
    enregistrement_id   UUID,                           -- PK de l'enregistrement impacté
    ancienne_valeur     JSONB,                          -- Snapshot avant modification
    nouvelle_valeur     JSONB,                          -- Snapshot après modification
    adresse_ip          INET,                           -- Adresse IP locale (réseau interne uniquement)
    user_agent          TEXT,
    timestamp_action    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.logs_administration IS
    'Journal d''audit complet des actions sensibles. Accessible uniquement aux administrateurs. Ne jamais supprimer ces entrées.';


-- ==============================================================================
-- SECTION 17 : TRIGGER AUTOMATIQUE — Mise à jour de modifie_le
-- ==============================================================================

-- Fonction générique pour mettre à jour le champ modifie_le sur UPDATE
CREATE OR REPLACE FUNCTION public.fn_set_modifie_le()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.modifie_le = NOW();
    RETURN NEW;
END;
$$;

-- Application du trigger sur chaque table concernée
CREATE TRIGGER trg_set_modifie_le_profiles
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_modifie_le();

CREATE TRIGGER trg_set_modifie_le_etat_civil
    BEFORE UPDATE ON public.patients_etat_civil
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_modifie_le();

CREATE TRIGGER trg_set_modifie_le_allergies
    BEFORE UPDATE ON public.donnees_medicales_allergies
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_modifie_le();

CREATE TRIGGER trg_set_modifie_le_pathos
    BEFORE UPDATE ON public.donnees_medicales_pathos
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_modifie_le();

CREATE TRIGGER trg_set_modifie_le_directives
    BEFORE UPDATE ON public.directives_anticipees
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_modifie_le();

CREATE TRIGGER trg_set_modifie_le_protocoles
    BEFORE UPDATE ON public.protocoles
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_modifie_le();

CREATE TRIGGER trg_set_modifie_le_traitements
    BEFORE UPDATE ON public.traitements
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_modifie_le();


-- ==============================================================================
-- SECTION 18 : TRIGGER AUDIT — Journalisation automatique dans logs_administration
-- ==============================================================================

-- Fonction générique d'audit : enregistre toute modification dans logs_administration
CREATE OR REPLACE FUNCTION public.fn_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.logs_administration (
        utilisateur_id,
        action,
        table_cible,
        enregistrement_id,
        ancienne_valeur,
        nouvelle_valeur,
        adresse_ip,
        timestamp_action
    ) VALUES (
        auth.uid(),
        TG_OP,                                          -- 'INSERT', 'UPDATE' ou 'DELETE'
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT','UPDATE')  THEN to_jsonb(NEW) ELSE NULL END,
        inet_client_addr(),
        NOW()
    );
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Audit sur les tables les plus sensibles
CREATE TRIGGER trg_audit_traitements
    AFTER INSERT OR UPDATE OR DELETE ON public.traitements
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

CREATE TRIGGER trg_audit_directives
    AFTER INSERT OR UPDATE OR DELETE ON public.directives_anticipees
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

CREATE TRIGGER trg_audit_profiles
    AFTER INSERT OR UPDATE OR DELETE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

CREATE TRIGGER trg_audit_allergies
    AFTER INSERT OR UPDATE OR DELETE ON public.donnees_medicales_allergies
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


-- ==============================================================================
-- SECTION 19 : INDEX DE PERFORMANCE
-- ==============================================================================

-- Index fréquents : recherche par patient
CREATE INDEX idx_constantes_patient      ON public.donnees_medicales_constantes(patient_id, date_mesure DESC);
CREATE INDEX idx_allergies_patient       ON public.donnees_medicales_allergies(patient_id);
CREATE INDEX idx_antecedents_patient     ON public.donnees_medicales_antecedents(patient_id);
CREATE INDEX idx_gir_patient             ON public.donnees_medicales_gir(patient_id, date_evaluation DESC);
CREATE INDEX idx_pathos_patient          ON public.donnees_medicales_pathos(patient_id);
CREATE INDEX idx_directives_patient      ON public.directives_anticipees(patient_id);
CREATE INDEX idx_protocoles_patient      ON public.protocoles(patient_id);
CREATE INDEX idx_transmissions_patient   ON public.transmissions(patient_id, cree_le DESC);
CREATE INDEX idx_transmissions_priorite  ON public.transmissions(priorite) WHERE priorite IN ('urgente','critique');
CREATE INDEX idx_traitements_patient     ON public.traitements(patient_id) WHERE actif = TRUE;
CREATE INDEX idx_soins_patient           ON public.soins_pansement(patient_id, date_soin DESC);
CREATE INDEX idx_logs_utilisateur        ON public.logs_administration(utilisateur_id, timestamp_action DESC);
CREATE INDEX idx_logs_table              ON public.logs_administration(table_cible, timestamp_action DESC);
CREATE INDEX idx_patients_actifs         ON public.patients_etat_civil(actif, date_entree DESC);
CREATE INDEX idx_statistiques_periode    ON public.statistiques_soins(periode_debut, periode_fin);


-- ==============================================================================
-- FIN DU SCRIPT 01_schema.sql
-- Exécuter ensuite : 02_rls_policies.sql
-- ==============================================================================
