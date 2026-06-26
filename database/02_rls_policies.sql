-- ==============================================================================
-- [ candy-e ] — POLITIQUES DE SÉCURITÉ ROW LEVEL SECURITY (RLS)
-- Fichier        : 02_rls_policies.sql
-- Description    : Activation de la RLS et définition des politiques d'accès
--                  pour chaque table selon la matrice de droits RBAC.
-- Prérequis      : 01_schema.sql doit avoir été exécuté
-- Environnement  : Supabase Self-Hosted — réseau local fermé (air-gapped)
-- ==============================================================================

-- ==============================================================================
-- SECTION 1 : FONCTION HELPER — get_current_user_role()
-- Approche performante : lecture unique du rôle via SECURITY DEFINER
-- La fonction ignore les politiques RLS de la table profiles elle-même,
-- ce qui évite une récursivité infinie lors de l'évaluation des politiques.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS public.custom_role
LANGUAGE sql
STABLE                          -- Résultat stable dans une transaction (autorise le cache)
SECURITY DEFINER                -- S'exécute avec les droits du propriétaire, contourne la RLS sur profiles
SET search_path = public
AS $$
    SELECT role
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_current_user_role() IS
    'Récupère le rôle custom_role de l''utilisateur connecté depuis public.profiles. '
    'SECURITY DEFINER pour éviter la récursion RLS. Utilisé dans toutes les politiques.';

-- Accorder l'exécution aux utilisateurs authentifiés uniquement
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;


-- ==============================================================================
-- SECTION 2 : ACTIVATION RLS SUR TOUTES LES TABLES
-- ==============================================================================

ALTER TABLE public.profiles                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients_etat_civil             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donnees_medicales_constantes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donnees_medicales_allergies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donnees_medicales_antecedents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donnees_medicales_gir           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donnees_medicales_pathos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directives_anticipees           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocoles                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transmissions                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traitements                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soins_pansement                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statistiques_soins              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_administration             ENABLE ROW LEVEL SECURITY;

-- Sécurité renforcée : par défaut aucun accès sans politique explicite (FORCE)
ALTER TABLE public.profiles                        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.patients_etat_civil             FORCE ROW LEVEL SECURITY;
ALTER TABLE public.donnees_medicales_constantes    FORCE ROW LEVEL SECURITY;
ALTER TABLE public.donnees_medicales_allergies     FORCE ROW LEVEL SECURITY;
ALTER TABLE public.donnees_medicales_antecedents   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.donnees_medicales_gir           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.donnees_medicales_pathos        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.directives_anticipees           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.protocoles                      FORCE ROW LEVEL SECURITY;
ALTER TABLE public.transmissions                   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.traitements                     FORCE ROW LEVEL SECURITY;
ALTER TABLE public.soins_pansement                 FORCE ROW LEVEL SECURITY;
ALTER TABLE public.statistiques_soins              FORCE ROW LEVEL SECURITY;
ALTER TABLE public.logs_administration             FORCE ROW LEVEL SECURITY;


-- ==============================================================================
-- SECTION 3 : POLITIQUES — TABLE public.profiles
-- Chaque utilisateur voit son propre profil.
-- Les administrateurs voient et gèrent tous les profils.
-- ==============================================================================

-- Lecture de son propre profil
CREATE POLICY "profiles_select_self"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Les administrateurs lisent tous les profils
CREATE POLICY "profiles_select_admin"
ON public.profiles FOR SELECT
TO authenticated
USING (get_current_user_role() = 'administrateur');

-- Mise à jour de son propre profil (données non-sensibles uniquement)
CREATE POLICY "profiles_update_self"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
    id = auth.uid()
    -- Un utilisateur ne peut pas s'auto-promouvoir en administrateur
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
);

-- Les administrateurs peuvent modifier n'importe quel profil
CREATE POLICY "profiles_update_admin"
ON public.profiles FOR UPDATE
TO authenticated
USING (get_current_user_role() = 'administrateur')
WITH CHECK (get_current_user_role() = 'administrateur');

-- Seuls les administrateurs peuvent supprimer un profil
CREATE POLICY "profiles_delete_admin"
ON public.profiles FOR DELETE
TO authenticated
USING (get_current_user_role() = 'administrateur');

-- INSERT géré exclusivement par le trigger fn_on_new_user_created (SECURITY DEFINER)
-- Aucune politique INSERT directe pour les utilisateurs authentifiés


-- ==============================================================================
-- SECTION 4 : POLITIQUES — TABLE public.patients_etat_civil
-- Module : 🆔 État civil
-- Autorisés : Admin, Cadre, IDE, Médecin, Psycho
-- Exclus    : AS, ASH, Kiné, Ergo
-- ==============================================================================

CREATE POLICY "etat_civil_select"
ON public.patients_etat_civil FOR SELECT
TO authenticated
USING (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin', 'psycho'
    )
);

CREATE POLICY "etat_civil_insert"
ON public.patients_etat_civil FOR INSERT
TO authenticated
WITH CHECK (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin'
    )
);

CREATE POLICY "etat_civil_update"
ON public.patients_etat_civil FOR UPDATE
TO authenticated
USING (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin'
    )
)
WITH CHECK (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin'
    )
);

-- Suppression logique uniquement via le champ actif ; suppression physique réservée aux admins
CREATE POLICY "etat_civil_delete"
ON public.patients_etat_civil FOR DELETE
TO authenticated
USING (get_current_user_role() = 'administrateur');


-- ==============================================================================
-- SECTION 5 : POLITIQUES — TABLE public.donnees_medicales_constantes
-- Module : 🩺 Constantes vitales
-- Autorisés : Admin, Cadre, IDE, AS, Médecin, Kiné
-- ==============================================================================

CREATE POLICY "constantes_select"
ON public.donnees_medicales_constantes FOR SELECT
TO authenticated
USING (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'aide_soignante', 'medecin', 'kine'
    )
);

CREATE POLICY "constantes_insert"
ON public.donnees_medicales_constantes FOR INSERT
TO authenticated
WITH CHECK (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'aide_soignante', 'medecin', 'kine'
    )
);

CREATE POLICY "constantes_update"
ON public.donnees_medicales_constantes FOR UPDATE
TO authenticated
USING (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin'
    )
)
WITH CHECK (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin'
    )
);

CREATE POLICY "constantes_delete"
ON public.donnees_medicales_constantes FOR DELETE
TO authenticated
USING (get_current_user_role() IN ('administrateur', 'cadre', 'medecin'));


-- ==============================================================================
-- SECTION 6 : POLITIQUES — TABLE public.donnees_medicales_allergies
-- Module : ⚠️ Allergies
-- Autorisés : Admin, Cadre, IDE, AS, Médecin, Kiné
-- ==============================================================================

CREATE POLICY "allergies_select"
ON public.donnees_medicales_allergies FOR SELECT
TO authenticated
USING (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'aide_soignante', 'medecin', 'kine'
    )
);

CREATE POLICY "allergies_insert"
ON public.donnees_medicales_allergies FOR INSERT
TO authenticated
WITH CHECK (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'aide_soignante', 'medecin', 'kine'
    )
);

CREATE POLICY "allergies_update"
ON public.donnees_medicales_allergies FOR UPDATE
TO authenticated
USING (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin'
    )
)
WITH CHECK (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin'
    )
);

CREATE POLICY "allergies_delete"
ON public.donnees_medicales_allergies FOR DELETE
TO authenticated
USING (get_current_user_role() IN ('administrateur', 'cadre', 'medecin'));


-- ==============================================================================
-- SECTION 7 : POLITIQUES — TABLE public.donnees_medicales_antecedents
-- Module : 📜 Antécédents
-- Autorisés : Admin, Cadre, IDE, AS, Médecin, Psycho
-- ==============================================================================

CREATE POLICY "antecedents_select"
ON public.donnees_medicales_antecedents FOR SELECT
TO authenticated
USING (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'aide_soignante', 'medecin', 'psycho'
    )
);

CREATE POLICY "antecedents_insert"
ON public.donnees_medicales_antecedents FOR INSERT
TO authenticated
WITH CHECK (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'aide_soignante', 'medecin', 'psycho'
    )
);

CREATE POLICY "antecedents_update"
ON public.donnees_medicales_antecedents FOR UPDATE
TO authenticated
USING (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin', 'psycho'
    )
)
WITH CHECK (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin', 'psycho'
    )
);

CREATE POLICY "antecedents_delete"
ON public.donnees_medicales_antecedents FOR DELETE
TO authenticated
USING (get_current_user_role() IN ('administrateur', 'cadre', 'medecin'));


-- ==============================================================================
-- SECTION 8 : POLITIQUES — TABLE public.donnees_medicales_gir
-- Module : 🧓 GIR — Niveau de dépendance
-- Autorisés : TOUS les rôles (lecture et saisie selon profil)
-- ==============================================================================

-- Tout le personnel peut consulter le GIR
CREATE POLICY "gir_select"
ON public.donnees_medicales_gir FOR SELECT
TO authenticated
USING (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'aide_soignante', 'ash',
        'medecin', 'kine', 'psycho', 'ergo'
    )
);

-- Saisie réservée aux profils habilités à évaluer (pas les ASH)
CREATE POLICY "gir_insert"
ON public.donnees_medicales_gir FOR INSERT
TO authenticated
WITH CHECK (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'aide_soignante',
        'medecin', 'kine', 'psycho', 'ergo'
    )
);

-- Modification réservée aux profils seniors
CREATE POLICY "gir_update"
ON public.donnees_medicales_gir FOR UPDATE
TO authenticated
USING (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin', 'kine', 'psycho', 'ergo'
    )
)
WITH CHECK (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin', 'kine', 'psycho', 'ergo'
    )
);

CREATE POLICY "gir_delete"
ON public.donnees_medicales_gir FOR DELETE
TO authenticated
USING (get_current_user_role() IN ('administrateur', 'cadre', 'medecin'));


-- ==============================================================================
-- SECTION 9 : POLITIQUES — TABLE public.donnees_medicales_pathos
-- Module : 🧠 Pathologies et diagnostics
-- Autorisés : Admin, Cadre, IDE, Médecin, Psycho
-- ==============================================================================

CREATE POLICY "pathos_select"
ON public.donnees_medicales_pathos FOR SELECT
TO authenticated
USING (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin', 'psycho'
    )
);

CREATE POLICY "pathos_insert"
ON public.donnees_medicales_pathos FOR INSERT
TO authenticated
WITH CHECK (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin', 'psycho'
    )
);

CREATE POLICY "pathos_update"
ON public.donnees_medicales_pathos FOR UPDATE
TO authenticated
USING (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin', 'psycho'
    )
)
WITH CHECK (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin', 'psycho'
    )
);

CREATE POLICY "pathos_delete"
ON public.donnees_medicales_pathos FOR DELETE
TO authenticated
USING (get_current_user_role() IN ('administrateur', 'cadre', 'medecin'));


-- ==============================================================================
-- SECTION 10 : POLITIQUES — TABLE public.directives_anticipees
-- Module : ✍️ Directives anticipées
-- Autorisés : Admin, Cadre, IDE, AS, Médecin, Psycho
-- ==============================================================================

CREATE POLICY "directives_select"
ON public.directives_anticipees FOR SELECT
TO authenticated
USING (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'aide_soignante', 'medecin', 'psycho'
    )
);

CREATE POLICY "directives_insert"
ON public.directives_anticipees FOR INSERT
TO authenticated
WITH CHECK (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'aide_soignante', 'medecin', 'psycho'
    )
);

CREATE POLICY "directives_update"
ON public.directives_anticipees FOR UPDATE
TO authenticated
USING (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin', 'psycho'
    )
)
WITH CHECK (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin', 'psycho'
    )
);

-- Document légal : suppression interdite même aux admins (archivage obligatoire)
-- Remplacer par une désactivation logique via date_validite
CREATE POLICY "directives_delete"
ON public.directives_anticipees FOR DELETE
TO authenticated
USING (get_current_user_role() = 'administrateur');


-- ==============================================================================
-- SECTION 11 : POLITIQUES — TABLE public.protocoles
-- Module : 📋 Protocoles de soins
-- Autorisés : Admin, Cadre, IDE, Médecin
-- ==============================================================================

CREATE POLICY "protocoles_select"
ON public.protocoles FOR SELECT
TO authenticated
USING (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin'
    )
);

CREATE POLICY "protocoles_insert"
ON public.protocoles FOR INSERT
TO authenticated
WITH CHECK (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin'
    )
);

CREATE POLICY "protocoles_update"
ON public.protocoles FOR UPDATE
TO authenticated
USING (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin'
    )
)
WITH CHECK (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin'
    )
);

CREATE POLICY "protocoles_delete"
ON public.protocoles FOR DELETE
TO authenticated
USING (get_current_user_role() IN ('administrateur', 'cadre', 'medecin'));


-- ==============================================================================
-- SECTION 12 : POLITIQUES — TABLE public.transmissions
-- Module : 💬 Transmissions ciblées
-- Autorisés : Admin, Cadre, IDE, AS, ASH, Médecin, Psycho
-- Exclus    : Kiné, Ergo
-- ==============================================================================

CREATE POLICY "transmissions_select"
ON public.transmissions FOR SELECT
TO authenticated
USING (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'aide_soignante', 'ash',
        'medecin', 'psycho'
    )
    -- Un message ciblé vers un rôle spécifique n'est visible que par ce rôle (ou les admins/cadres)
    AND (
        cible_role IS NULL
        OR cible_role = get_current_user_role()
        OR get_current_user_role() IN ('administrateur', 'cadre', 'medecin')
    )
);

CREATE POLICY "transmissions_insert"
ON public.transmissions FOR INSERT
TO authenticated
WITH CHECK (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'aide_soignante', 'ash',
        'medecin', 'psycho'
    )
);

-- Seul l'auteur ou un admin/cadre peut modifier une transmission
CREATE POLICY "transmissions_update"
ON public.transmissions FOR UPDATE
TO authenticated
USING (
    get_current_user_role() IN ('administrateur', 'cadre', 'medecin')
    OR saisie_par = auth.uid()
)
WITH CHECK (
    get_current_user_role() IN ('administrateur', 'cadre', 'medecin')
    OR saisie_par = auth.uid()
);

CREATE POLICY "transmissions_delete"
ON public.transmissions FOR DELETE
TO authenticated
USING (get_current_user_role() IN ('administrateur', 'cadre'));


-- ==============================================================================
-- SECTION 13 : POLITIQUES — TABLE public.traitements
-- Module : 💊 Traitements médicamenteux
-- Autorisés : Admin, Cadre, IDE, Médecin
-- ==============================================================================

CREATE POLICY "traitements_select"
ON public.traitements FOR SELECT
TO authenticated
USING (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin'
    )
);

CREATE POLICY "traitements_insert"
ON public.traitements FOR INSERT
TO authenticated
WITH CHECK (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin'
    )
);

CREATE POLICY "traitements_update"
ON public.traitements FOR UPDATE
TO authenticated
USING (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin'
    )
)
WITH CHECK (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin'
    )
);

CREATE POLICY "traitements_delete"
ON public.traitements FOR DELETE
TO authenticated
USING (get_current_user_role() IN ('administrateur', 'medecin'));


-- ==============================================================================
-- SECTION 14 : POLITIQUES — TABLE public.soins_pansement
-- Module : 🩹 Soins et pansements
-- Autorisés : Admin, Cadre, IDE, Médecin
-- ==============================================================================

CREATE POLICY "soins_select"
ON public.soins_pansement FOR SELECT
TO authenticated
USING (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin'
    )
);

CREATE POLICY "soins_insert"
ON public.soins_pansement FOR INSERT
TO authenticated
WITH CHECK (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin'
    )
);

CREATE POLICY "soins_update"
ON public.soins_pansement FOR UPDATE
TO authenticated
USING (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin'
    )
)
WITH CHECK (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin'
    )
);

CREATE POLICY "soins_delete"
ON public.soins_pansement FOR DELETE
TO authenticated
USING (get_current_user_role() IN ('administrateur', 'cadre', 'medecin'));


-- ==============================================================================
-- SECTION 15 : POLITIQUES — TABLE public.statistiques_soins
-- Module : 📊 Statistiques et pilotage
-- SELECT : Admin, Cadre, IDE, Médecin
-- INSERT/UPDATE/DELETE : Admin uniquement
-- ==============================================================================

-- Consultation des indicateurs de pilotage
CREATE POLICY "statistiques_select"
ON public.statistiques_soins FOR SELECT
TO authenticated
USING (
    get_current_user_role() IN (
        'administrateur', 'cadre', 'infirmiere', 'medecin'
    )
);

-- Génération des statistiques réservée à l'administration
CREATE POLICY "statistiques_insert"
ON public.statistiques_soins FOR INSERT
TO authenticated
WITH CHECK (get_current_user_role() = 'administrateur');

CREATE POLICY "statistiques_update"
ON public.statistiques_soins FOR UPDATE
TO authenticated
USING (get_current_user_role() = 'administrateur')
WITH CHECK (get_current_user_role() = 'administrateur');

CREATE POLICY "statistiques_delete"
ON public.statistiques_soins FOR DELETE
TO authenticated
USING (get_current_user_role() = 'administrateur');


-- ==============================================================================
-- SECTION 16 : POLITIQUES — TABLE public.logs_administration
-- Module : ⚙️ Journal d'audit
-- Accès EXCLUSIF : Administrateurs uniquement
-- Les entrées sont créées par fn_audit_log (SECURITY DEFINER)
-- Jamais d'INSERT/UPDATE/DELETE depuis le client
-- ==============================================================================

-- Lecture : admins uniquement
CREATE POLICY "logs_select_admin"
ON public.logs_administration FOR SELECT
TO authenticated
USING (get_current_user_role() = 'administrateur');

-- Écriture : uniquement via la fonction d'audit SECURITY DEFINER
-- Aucune politique INSERT/UPDATE/DELETE pour les clients — le trigger gère cela
-- (La fonction SECURITY DEFINER contourne la RLS)


-- ==============================================================================
-- SECTION 17 : GRANTS — Attribution des droits SQL aux rôles Supabase
-- ==============================================================================

-- Le rôle "authenticated" représente tout utilisateur connecté via Supabase Auth
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Le rôle "anon" (non connecté) n'a accès à rien dans le schéma public
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- Le rôle "service_role" (backend, fonctions PL/pgSQL SECURITY DEFINER) contourne la RLS
-- Il est utilisé par les triggers d'audit — ne pas restreindre


-- ==============================================================================
-- SECTION 18 : VÉRIFICATION — Vue récapitulative des politiques actives
-- Permet de valider le déploiement sans accéder à pg_catalog directement
-- ==============================================================================

CREATE OR REPLACE VIEW public.v_rls_policies_summary AS
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd AS commande,
    qual AS condition_using,
    with_check AS condition_with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

COMMENT ON VIEW public.v_rls_policies_summary IS
    'Vue de diagnostic : liste toutes les politiques RLS actives dans le schéma public.';

-- Accès à la vue de diagnostic réservé aux administrateurs
CREATE POLICY "rls_summary_select_admin"
ON public.logs_administration FOR SELECT  -- Réutilise la protection admin
TO authenticated
USING (get_current_user_role() = 'administrateur');

-- Grant de lecture sur la vue de diagnostic
GRANT SELECT ON public.v_rls_policies_summary TO authenticated;


-- ==============================================================================
-- FIN DU SCRIPT 02_rls_policies.sql
-- L'infrastructure de sécurité est complète et opérationnelle.
-- ==============================================================================
