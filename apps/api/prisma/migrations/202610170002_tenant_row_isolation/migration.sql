-- Activate only after the context-aware API is live and verified.
BEGIN;

-- Boolean-only historical relationship check avoids recursive session policies.
CREATE OR REPLACE FUNCTION kramya_private.patient_catalog(kind text,item text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $body$ SELECT kramya_private.ctx('account_id') IS NOT NULL AND EXISTS(
 SELECT 1 FROM public."QueueEntry" q JOIN public."OPDSession" s ON s.id=q."sessionId"
 WHERE q."accountId"=kramya_private.ctx('account_id') AND CASE kind
 WHEN 'hospital' THEN q."hospitalId"=item
 WHEN 'department' THEN s."departmentId"=item
 WHEN 'doctor' THEN s."currentProviderDoctorId"=item
 ELSE false END
) $body$;
REVOKE ALL ON FUNCTION kramya_private.patient_catalog(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION kramya_private.patient_catalog(text,text) TO kramya_runtime;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['Account','Patient','RefreshToken','Hospital','HospitalStaff','Department','Doctor','DoctorSchedule','QueuePolicy','OPDSession','QueueEntry','Payment','Refund','QueueEvent','AuditLog','Consultation','PushToken','Notification','_prisma_migrations'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
 END LOOP;
END $$;

CREATE POLICY account_read ON public."Account" FOR SELECT TO kramya_runtime USING (
 kramya_private.system_context() OR id=kramya_private.ctx('account_id')
 OR (kramya_private.ctx('purpose')='auth' AND email=kramya_private.ctx('email')) OR (kramya_private.ctx('purpose')='auth-google' AND (email=kramya_private.ctx('email') OR "googleId"=kramya_private.ctx('google_sub')))
 OR (kramya_private.staff(kramya_private.ctx('hospital_id'),ARRAY['ADMIN']) AND email=kramya_private.ctx('email'))
 OR (kramya_private.ctx('purpose')='refresh' AND EXISTS(SELECT 1 FROM public."RefreshToken" r WHERE r."accountId"="Account".id AND r."tokenHash"=kramya_private.ctx('refresh_hash')))
);
CREATE POLICY account_insert ON public."Account" FOR INSERT TO kramya_runtime WITH CHECK (
 (kramya_private.ctx('purpose') IN ('auth','auth-google') AND email=kramya_private.ctx('email'))
 OR (kramya_private.staff(kramya_private.ctx('hospital_id'),ARRAY['ADMIN']) AND email=kramya_private.ctx('email'))
);
CREATE POLICY account_update ON public."Account" FOR UPDATE TO kramya_runtime
 USING (id=kramya_private.ctx('account_id') OR (kramya_private.ctx('purpose')='auth-google' AND email=kramya_private.ctx('email')))
 WITH CHECK (id=kramya_private.ctx('account_id') OR (kramya_private.ctx('purpose')='auth-google' AND email=kramya_private.ctx('email')));
CREATE POLICY patient_read ON public."Patient" FOR SELECT TO kramya_runtime USING (
 kramya_private.system_context() OR "accountId"=kramya_private.ctx('account_id')
 OR (id=kramya_private.ctx('new_patient_id') AND kramya_private.staff(kramya_private.ctx('hospital_id')))
 OR (kramya_private.ctx('purpose')='auth' AND EXISTS(SELECT 1 FROM public."Account" a WHERE a.id="Patient"."accountId" AND a.email=kramya_private.ctx('email')))
 OR EXISTS(SELECT 1 FROM public."QueueEntry" q WHERE q."patientId"="Patient".id AND kramya_private.staff(q."hospitalId"))
);
CREATE POLICY patient_insert ON public."Patient" FOR INSERT TO kramya_runtime WITH CHECK (
 "accountId"=kramya_private.ctx('account_id')
 OR ("accountId" IS NULL AND id=kramya_private.ctx('new_patient_id') AND kramya_private.staff(kramya_private.ctx('hospital_id')))
 OR (kramya_private.ctx('purpose')='auth' AND EXISTS(SELECT 1 FROM public."Account" a WHERE a.id="Patient"."accountId" AND a.email=kramya_private.ctx('email')))
);
CREATE POLICY patient_update ON public."Patient" FOR UPDATE TO kramya_runtime USING ("accountId"=kramya_private.ctx('account_id')) WITH CHECK ("accountId"=kramya_private.ctx('account_id'));
CREATE POLICY patient_delete ON public."Patient" FOR DELETE TO kramya_runtime USING ("accountId"=kramya_private.ctx('account_id'));

CREATE POLICY refresh_read ON public."RefreshToken" FOR SELECT TO kramya_runtime USING ("accountId"=kramya_private.ctx('account_id') OR (kramya_private.ctx('purpose')='refresh' AND "tokenHash"=kramya_private.ctx('refresh_hash')));
CREATE POLICY refresh_insert ON public."RefreshToken" FOR INSERT TO kramya_runtime WITH CHECK ("accountId"=kramya_private.ctx('account_id'));
CREATE POLICY refresh_update ON public."RefreshToken" FOR UPDATE TO kramya_runtime USING ("accountId"=kramya_private.ctx('account_id')) WITH CHECK ("accountId"=kramya_private.ctx('account_id'));

CREATE POLICY hospital_read ON public."Hospital" FOR SELECT TO kramya_runtime USING (
 kramya_private.visible_hospital(id) OR EXISTS(SELECT 1 FROM public."QueueEntry" q WHERE q."hospitalId"="Hospital".id AND q."accountId"=kramya_private.ctx('account_id')) OR EXISTS(SELECT 1 FROM public."HospitalStaff" s WHERE s."hospitalId"="Hospital".id AND s."accountId"=kramya_private.ctx('account_id'))
);
CREATE POLICY hospital_update ON public."Hospital" FOR UPDATE TO kramya_runtime USING (kramya_private.staff(id,ARRAY['ADMIN'])) WITH CHECK (kramya_private.staff(id,ARRAY['ADMIN']));
CREATE POLICY membership_read ON public."HospitalStaff" FOR SELECT TO kramya_runtime USING (
 "accountId"=kramya_private.ctx('account_id') OR kramya_private.staff("hospitalId",ARRAY['ADMIN'])
 OR ("inviteTokenHash"=kramya_private.ctx('invite_hash') AND status='INVITED' AND "inviteExpiresAt">now())
);
CREATE POLICY membership_insert ON public."HospitalStaff" FOR INSERT TO kramya_runtime WITH CHECK (kramya_private.staff("hospitalId",ARRAY['ADMIN']));
CREATE POLICY membership_update ON public."HospitalStaff" FOR UPDATE TO kramya_runtime
 USING (kramya_private.staff("hospitalId",ARRAY['ADMIN']) OR (kramya_private.ctx('purpose')='invite' AND id=kramya_private.ctx('invitation_id') AND "accountId"=kramya_private.ctx('account_id') AND "inviteTokenHash"=kramya_private.ctx('invite_hash') AND status='INVITED' AND "inviteExpiresAt">now()))
 WITH CHECK (kramya_private.staff("hospitalId",ARRAY['ADMIN']) OR (kramya_private.ctx('purpose')='invite' AND id=kramya_private.ctx('invitation_id') AND "accountId"=kramya_private.ctx('account_id') AND status='ACTIVE' AND "inviteTokenHash" IS NULL AND "inviteExpiresAt" IS NULL));

CREATE POLICY department_read ON public."Department" FOR SELECT TO kramya_runtime USING (kramya_private.patient_catalog('department',id) OR kramya_private.system_context() OR kramya_private.staff("hospitalId") OR ("isActive" AND kramya_private.visible_hospital("hospitalId")));
CREATE POLICY department_write ON public."Department" FOR ALL TO kramya_runtime USING (kramya_private.staff("hospitalId",ARRAY['ADMIN'])) WITH CHECK (kramya_private.staff("hospitalId",ARRAY['ADMIN']));
CREATE POLICY doctor_read ON public."Doctor" FOR SELECT TO kramya_runtime USING (kramya_private.patient_catalog('doctor',id) OR kramya_private.system_context() OR "accountId"=kramya_private.ctx('account_id') OR kramya_private.staff("hospitalId") OR ("isActive" AND kramya_private.visible_hospital("hospitalId")));
CREATE POLICY doctor_write ON public."Doctor" FOR ALL TO kramya_runtime USING (kramya_private.staff("hospitalId",ARRAY['ADMIN'])) WITH CHECK (kramya_private.staff("hospitalId",ARRAY['ADMIN']) AND EXISTS(SELECT 1 FROM public."Department" d WHERE d.id="Doctor"."departmentId" AND d."hospitalId"="Doctor"."hospitalId"));
CREATE POLICY schedule_read ON public."DoctorSchedule" FOR SELECT TO kramya_runtime USING (kramya_private.staff("hospitalId"));
CREATE POLICY schedule_write ON public."DoctorSchedule" FOR ALL TO kramya_runtime USING (kramya_private.staff("hospitalId",ARRAY['ADMIN'])) WITH CHECK (kramya_private.staff("hospitalId",ARRAY['ADMIN']) AND EXISTS(SELECT 1 FROM public."Doctor" d WHERE d.id="DoctorSchedule"."doctorId" AND d."hospitalId"="DoctorSchedule"."hospitalId"));
CREATE POLICY policy_read ON public."QueuePolicy" FOR SELECT TO kramya_runtime USING (kramya_private.visible_hospital("hospitalId") OR EXISTS(SELECT 1 FROM public."QueueEntry" q WHERE q."hospitalId"="QueuePolicy"."hospitalId" AND q."accountId"=kramya_private.ctx('account_id')));
CREATE POLICY policy_insert ON public."QueuePolicy" FOR INSERT TO kramya_runtime WITH CHECK (kramya_private.staff("hospitalId") OR kramya_private.system_context());
CREATE POLICY policy_update ON public."QueuePolicy" FOR UPDATE TO kramya_runtime USING (kramya_private.staff("hospitalId",ARRAY['ADMIN'])) WITH CHECK (kramya_private.staff("hospitalId",ARRAY['ADMIN']));

CREATE POLICY session_read ON public."OPDSession" FOR SELECT TO kramya_runtime USING (
 kramya_private.system_context() OR kramya_private.staff("hospitalId")
 OR (kramya_private.ctx('account_id') IS NOT NULL AND status<>'CANCELLED' AND kramya_private.visible_hospital("hospitalId"))
 OR EXISTS(SELECT 1 FROM public."QueueEntry" q WHERE q."sessionId"="OPDSession".id AND q."accountId"=kramya_private.ctx('account_id'))
 OR (kramya_private.ctx('purpose')='resolve-session' AND id=kramya_private.ctx('session_id') AND EXISTS(SELECT 1 FROM public."HospitalStaff" s WHERE s."hospitalId"="OPDSession"."hospitalId" AND s."accountId"=kramya_private.ctx('account_id') AND s.status='ACTIVE'))
);
CREATE POLICY session_insert ON public."OPDSession" FOR INSERT TO kramya_runtime WITH CHECK (
 kramya_private.staff("hospitalId",ARRAY['ADMIN']) AND EXISTS(SELECT 1 FROM public."Department" d WHERE d.id="OPDSession"."departmentId" AND d."hospitalId"="OPDSession"."hospitalId")
 AND EXISTS(SELECT 1 FROM public."Doctor" d WHERE d.id="OPDSession"."originalDoctorId" AND d."hospitalId"="OPDSession"."hospitalId") AND EXISTS(SELECT 1 FROM public."Doctor" d WHERE d.id="OPDSession"."currentProviderDoctorId" AND d."hospitalId"="OPDSession"."hospitalId")
);
CREATE POLICY session_update ON public."OPDSession" FOR UPDATE TO kramya_runtime
 USING (kramya_private.system_context() OR kramya_private.staff("hospitalId") OR (kramya_private.ctx('purpose')='patient-command' AND id=kramya_private.ctx('session_id') AND (kramya_private.visible_hospital("hospitalId") OR EXISTS(SELECT 1 FROM public."QueueEntry" q WHERE q."sessionId"="OPDSession".id AND q."accountId"=kramya_private.ctx('account_id')))))
 WITH CHECK ((kramya_private.system_context() OR kramya_private.staff("hospitalId") OR (kramya_private.ctx('purpose')='patient-command' AND id=kramya_private.ctx('session_id') AND (kramya_private.visible_hospital("hospitalId") OR EXISTS(SELECT 1 FROM public."QueueEntry" q WHERE q."sessionId"="OPDSession".id AND q."accountId"=kramya_private.ctx('account_id'))))) AND EXISTS(SELECT 1 FROM public."Doctor" d WHERE d.id="OPDSession"."currentProviderDoctorId" AND d."hospitalId"="OPDSession"."hospitalId"));

CREATE POLICY entry_read ON public."QueueEntry" FOR SELECT TO kramya_runtime USING (kramya_private.system_context() OR kramya_private.staff("hospitalId") OR "accountId"=kramya_private.ctx('account_id'));
CREATE POLICY entry_insert ON public."QueueEntry" FOR INSERT TO kramya_runtime WITH CHECK (
 (kramya_private.system_context() OR kramya_private.staff("hospitalId") OR ("accountId"=kramya_private.ctx('account_id') AND type='ONLINE' AND EXISTS(SELECT 1 FROM public."OPDSession" s JOIN public."Hospital" h ON h.id=s."hospitalId" JOIN public."Department" d ON d.id=s."departmentId" JOIN public."Doctor" doc ON doc.id=s."currentProviderDoctorId" WHERE s.id="QueueEntry"."sessionId" AND h.status='VERIFIED' AND d."isActive" AND doc."isActive")))
 AND EXISTS(SELECT 1 FROM public."OPDSession" s WHERE s.id="QueueEntry"."sessionId" AND s."hospitalId"="QueueEntry"."hospitalId")
 AND EXISTS(SELECT 1 FROM public."Patient" p WHERE p.id="QueueEntry"."patientId" AND (("QueueEntry".type='WALK_IN' AND "QueueEntry"."accountId" IS NULL) OR p."accountId"="QueueEntry"."accountId"))
);
CREATE POLICY entry_update ON public."QueueEntry" FOR UPDATE TO kramya_runtime USING (kramya_private.system_context() OR kramya_private.staff("hospitalId") OR "accountId"=kramya_private.ctx('account_id')) WITH CHECK (
 (kramya_private.system_context() OR kramya_private.staff("hospitalId") OR "accountId"=kramya_private.ctx('account_id'))
 AND EXISTS(SELECT 1 FROM public."OPDSession" s WHERE s.id="QueueEntry"."sessionId" AND s."hospitalId"="QueueEntry"."hospitalId")
 AND EXISTS(SELECT 1 FROM public."Patient" p WHERE p.id="QueueEntry"."patientId" AND (("QueueEntry".type='WALK_IN' AND "QueueEntry"."accountId" IS NULL) OR p."accountId"="QueueEntry"."accountId"))
);

CREATE POLICY payment_read ON public."Payment" FOR SELECT TO kramya_runtime USING (kramya_private.system_context() OR kramya_private.staff("hospitalId") OR "accountId"=kramya_private.ctx('account_id'));
CREATE POLICY payment_insert ON public."Payment" FOR INSERT TO kramya_runtime WITH CHECK (
 "accountId"=kramya_private.ctx('account_id') AND EXISTS(SELECT 1 FROM public."QueueEntry" q WHERE q.id="Payment"."queueEntryId" AND q."hospitalId"="Payment"."hospitalId" AND q."accountId"="Payment"."accountId")
);
CREATE POLICY payment_update ON public."Payment" FOR UPDATE TO kramya_runtime USING (kramya_private.system_context() OR kramya_private.staff("hospitalId") OR "accountId"=kramya_private.ctx('account_id')) WITH CHECK (
 (kramya_private.system_context() OR kramya_private.staff("hospitalId") OR "accountId"=kramya_private.ctx('account_id')) AND EXISTS(SELECT 1 FROM public."QueueEntry" q WHERE q.id="Payment"."queueEntryId" AND q."hospitalId"="Payment"."hospitalId" AND q."accountId"="Payment"."accountId")
);
CREATE POLICY refund_read ON public."Refund" FOR SELECT TO kramya_runtime USING (kramya_private.system_context() OR kramya_private.staff("hospitalId") OR EXISTS(SELECT 1 FROM public."Payment" p WHERE p.id="Refund"."paymentId" AND p."accountId"=kramya_private.ctx('account_id')));
CREATE POLICY refund_insert ON public."Refund" FOR INSERT TO kramya_runtime WITH CHECK (EXISTS(SELECT 1 FROM public."Payment" p WHERE p.id="Refund"."paymentId" AND p."hospitalId"="Refund"."hospitalId") AND (kramya_private.system_context() OR kramya_private.staff("hospitalId") OR EXISTS(SELECT 1 FROM public."Payment" p WHERE p.id="Refund"."paymentId" AND p."accountId"=kramya_private.ctx('account_id'))));
CREATE POLICY refund_update ON public."Refund" FOR UPDATE TO kramya_runtime USING (kramya_private.system_context() OR kramya_private.staff("hospitalId") OR EXISTS(SELECT 1 FROM public."Payment" p WHERE p.id="Refund"."paymentId" AND p."accountId"=kramya_private.ctx('account_id'))) WITH CHECK ((kramya_private.system_context() OR kramya_private.staff("hospitalId") OR EXISTS(SELECT 1 FROM public."Payment" p WHERE p.id="Refund"."paymentId" AND p."accountId"=kramya_private.ctx('account_id'))) AND EXISTS(SELECT 1 FROM public."Payment" p WHERE p.id="Refund"."paymentId" AND p."hospitalId"="Refund"."hospitalId"));

CREATE POLICY event_read ON public."QueueEvent" FOR SELECT TO kramya_runtime USING (kramya_private.system_context() OR kramya_private.staff("hospitalId") OR EXISTS(SELECT 1 FROM public."QueueEntry" q WHERE q.id="QueueEvent"."entryId" AND q."accountId"=kramya_private.ctx('account_id')));
CREATE POLICY event_insert ON public."QueueEvent" FOR INSERT TO kramya_runtime WITH CHECK (
 (kramya_private.system_context() OR kramya_private.staff("hospitalId") OR (kramya_private.ctx('purpose')='patient-command' AND "sessionId"=kramya_private.ctx('session_id') AND "actorId"=kramya_private.ctx('account_id') AND EXISTS(SELECT 1 FROM public."QueueEntry" q WHERE q.id="QueueEvent"."entryId" AND q."accountId"=kramya_private.ctx('account_id'))))
 AND EXISTS(SELECT 1 FROM public."OPDSession" s WHERE s.id="QueueEvent"."sessionId" AND s."hospitalId"="QueueEvent"."hospitalId")
 AND ("entryId" IS NULL OR EXISTS(SELECT 1 FROM public."QueueEntry" q WHERE q.id="QueueEvent"."entryId" AND q."sessionId"="QueueEvent"."sessionId" AND q."hospitalId"="QueueEvent"."hospitalId"))
);
CREATE POLICY audit_read ON public."AuditLog" FOR SELECT TO kramya_runtime USING (kramya_private.system_context() OR kramya_private.staff("hospitalId"));
CREATE POLICY audit_insert ON public."AuditLog" FOR INSERT TO kramya_runtime WITH CHECK (kramya_private.system_context() OR kramya_private.staff("hospitalId") OR (kramya_private.ctx('purpose')='patient-command' AND "actorId"=kramya_private.ctx('account_id') AND EXISTS(SELECT 1 FROM public."OPDSession" s WHERE s.id=kramya_private.ctx('session_id') AND s."hospitalId"="AuditLog"."hospitalId")));
CREATE POLICY consultation_read ON public."Consultation" FOR SELECT TO kramya_runtime USING (kramya_private.system_context() OR kramya_private.staff("hospitalId") OR EXISTS(SELECT 1 FROM public."QueueEntry" q WHERE q.id="Consultation"."queueEntryId" AND q."accountId"=kramya_private.ctx('account_id')));
CREATE POLICY consultation_insert ON public."Consultation" FOR INSERT TO kramya_runtime WITH CHECK ((kramya_private.system_context() OR kramya_private.staff("hospitalId")) AND EXISTS(SELECT 1 FROM public."QueueEntry" q WHERE q.id="Consultation"."queueEntryId" AND q."patientId"="Consultation"."patientId" AND q."hospitalId"="Consultation"."hospitalId") AND EXISTS(SELECT 1 FROM public."Doctor" d WHERE d.id="Consultation"."doctorId" AND d."hospitalId"="Consultation"."hospitalId"));

CREATE POLICY push_read ON public."PushToken" FOR SELECT TO kramya_runtime USING (kramya_private.system_context() OR "accountId"=kramya_private.ctx('account_id') OR (kramya_private.ctx('account_id') IS NOT NULL AND token=kramya_private.ctx('device_token')));
CREATE POLICY push_insert ON public."PushToken" FOR INSERT TO kramya_runtime WITH CHECK ("accountId"=kramya_private.ctx('account_id'));
CREATE POLICY push_update ON public."PushToken" FOR UPDATE TO kramya_runtime USING (kramya_private.system_context() OR "accountId"=kramya_private.ctx('account_id') OR (kramya_private.ctx('account_id') IS NOT NULL AND token=kramya_private.ctx('device_token'))) WITH CHECK (kramya_private.system_context() OR "accountId"=kramya_private.ctx('account_id'));
CREATE POLICY push_delete ON public."PushToken" FOR DELETE TO kramya_runtime USING ("accountId"=kramya_private.ctx('account_id'));
CREATE POLICY notification_read ON public."Notification" FOR SELECT TO kramya_runtime USING (kramya_private.system_context() OR "accountId"=kramya_private.ctx('account_id'));
CREATE POLICY notification_insert ON public."Notification" FOR INSERT TO kramya_runtime WITH CHECK (kramya_private.system_context() OR EXISTS(SELECT 1 FROM public."QueueEntry" q WHERE q.id="Notification"."entryId" AND q."accountId"="Notification"."accountId" AND kramya_private.staff(q."hospitalId")));
CREATE POLICY notification_update ON public."Notification" FOR UPDATE TO kramya_runtime USING (kramya_private.system_context()) WITH CHECK (kramya_private.system_context());
-- Provenance cannot move to another clinic/account/visit through a runtime UPDATE.
CREATE FUNCTION kramya_private.freeze_provenance() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE key text;
BEGIN
 IF NOT (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) THEN
  FOREACH key IN ARRAY TG_ARGV LOOP
   IF (to_jsonb(NEW)->key) IS DISTINCT FROM (to_jsonb(OLD)->key) THEN
    RAISE EXCEPTION 'Runtime provenance is immutable' USING ERRCODE='23514';
   END IF;
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION kramya_private.freeze_provenance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION kramya_private.freeze_provenance() TO kramya_runtime;
CREATE TRIGGER freeze_entry_provenance BEFORE UPDATE ON public."QueueEntry" FOR EACH ROW EXECUTE FUNCTION kramya_private.freeze_provenance('hospitalId','sessionId','patientId','accountId','type','tokenNumber','tokenLabel');
CREATE TRIGGER freeze_payment_provenance BEFORE UPDATE ON public."Payment" FOR EACH ROW EXECUTE FUNCTION kramya_private.freeze_provenance('hospitalId','queueEntryId','accountId','amountPaise','currency','razorpayOrderId');
CREATE TRIGGER freeze_refund_provenance BEFORE UPDATE ON public."Refund" FOR EACH ROW EXECUTE FUNCTION kramya_private.freeze_provenance('hospitalId','paymentId','amountPaise');

COMMIT;
