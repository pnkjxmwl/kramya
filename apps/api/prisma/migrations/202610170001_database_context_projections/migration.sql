-- Deploy context-aware application code before the following RLS activation.
CREATE SCHEMA IF NOT EXISTS kramya_private;
REVOKE ALL ON SCHEMA kramya_private FROM PUBLIC;
GRANT USAGE ON SCHEMA kramya_private TO kramya_runtime;

CREATE OR REPLACE FUNCTION kramya_private.ctx(key text) RETURNS text
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog
AS $$ SELECT nullif(current_setting('kramya.' || key, true), '') $$;

CREATE OR REPLACE FUNCTION kramya_private.system_context() RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog
AS $$ SELECT coalesce(kramya_private.ctx('purpose') = ANY(ARRAY[
 'webhook:verified','worker:cutoff','worker:dispatch','worker:eta-tick',
 'worker:grace','worker:leave-now','worker:notify','worker:reconcile','worker:reservation'
]),false) $$;

-- This narrow lookup deliberately bypasses membership RLS to avoid recursion.
-- The verified backend identity is mandatory; neither supplied role nor hospital
-- alone authorizes access. Supabase Auth is not used by this product.
CREATE OR REPLACE FUNCTION kramya_private.staff(hospital text, roles text[] DEFAULT ARRAY['ADMIN','RECEPTION','DOCTOR']) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$ SELECT kramya_private.ctx('account_id') IS NOT NULL
 AND hospital = kramya_private.ctx('hospital_id')
 AND EXISTS (SELECT 1 FROM public."HospitalStaff" s
 WHERE s."hospitalId"=hospital AND s."accountId"=kramya_private.ctx('account_id')
 AND s.status='ACTIVE' AND s.role::text=ANY(roles)) $$;

CREATE OR REPLACE FUNCTION kramya_private.visible_hospital(hospital text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$ SELECT kramya_private.system_context() OR kramya_private.staff(hospital)
 OR (kramya_private.ctx('account_id') IS NOT NULL
 AND EXISTS (SELECT 1 FROM public."Hospital" h WHERE h.id=hospital AND h.status='VERIFIED')) $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA kramya_private FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA kramya_private TO kramya_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA kramya_private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Owner views intentionally expose timing/order projections across patients while
-- base-table policies protect their identities and visit/payment details. Fixed
-- columns, security barriers and explicit identity checks are essential here.
CREATE OR REPLACE VIEW public."QueueMetric" WITH (security_barrier=true) AS
 SELECT q.id, q."hospitalId",q."sessionId",q."tokenNumber",q."tokenLabel",q.type,q.status,
 q.priority,q."priorityAt",q."requeuedAt",q."reservationExpiresAt",
 q."consultStartedAt",q."calledAt",q."completedAt"
 FROM public."QueueEntry" q
 WHERE (SELECT rolsuper OR rolbypassrls FROM pg_catalog.pg_roles WHERE rolname=current_user)
 OR kramya_private.visible_hospital(q."hospitalId");

CREATE OR REPLACE VIEW public."ConsultationMetric" WITH (security_barrier=true) AS
 SELECT c.id,c."hospitalId",c."doctorId",c."endedAt",c."durationSec"
 FROM public."Consultation" c
 WHERE (SELECT rolsuper OR rolbypassrls FROM pg_catalog.pg_roles WHERE rolname=current_user)
 OR kramya_private.visible_hospital(c."hospitalId");

REVOKE ALL ON public."QueueMetric",public."ConsultationMetric" FROM PUBLIC;
GRANT SELECT ON public."QueueMetric",public."ConsultationMetric" TO kramya_runtime;
DO $$ DECLARE client text; BEGIN
 FOREACH client IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=client) THEN
   EXECUTE format('REVOKE ALL ON SCHEMA kramya_private FROM %I',client);
   EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA kramya_private FROM %I',client);
   EXECUTE format('REVOKE ALL ON public."QueueMetric",public."ConsultationMetric" FROM %I',client);
  END IF;
 END LOOP;
END $$;
