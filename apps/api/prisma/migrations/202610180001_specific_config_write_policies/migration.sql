-- Keep one policy per action: FOR ALL also participates in SELECT and duplicated
-- the existing staff/catalog read policies. Preserve the reviewed write checks.
BEGIN;

DROP POLICY department_write ON public."Department";
CREATE POLICY department_insert ON public."Department" FOR INSERT TO kramya_runtime
 WITH CHECK (kramya_private.staff("hospitalId",ARRAY['ADMIN']));
CREATE POLICY department_update ON public."Department" FOR UPDATE TO kramya_runtime
 USING (kramya_private.staff("hospitalId",ARRAY['ADMIN']))
 WITH CHECK (kramya_private.staff("hospitalId",ARRAY['ADMIN']));
CREATE POLICY department_delete ON public."Department" FOR DELETE TO kramya_runtime
 USING (kramya_private.staff("hospitalId",ARRAY['ADMIN']));

DROP POLICY doctor_write ON public."Doctor";
CREATE POLICY doctor_insert ON public."Doctor" FOR INSERT TO kramya_runtime
 WITH CHECK (kramya_private.staff("hospitalId",ARRAY['ADMIN']) AND EXISTS(
  SELECT 1 FROM public."Department" d WHERE d.id="Doctor"."departmentId" AND d."hospitalId"="Doctor"."hospitalId"));
CREATE POLICY doctor_update ON public."Doctor" FOR UPDATE TO kramya_runtime
 USING (kramya_private.staff("hospitalId",ARRAY['ADMIN']))
 WITH CHECK (kramya_private.staff("hospitalId",ARRAY['ADMIN']) AND EXISTS(
  SELECT 1 FROM public."Department" d WHERE d.id="Doctor"."departmentId" AND d."hospitalId"="Doctor"."hospitalId"));
CREATE POLICY doctor_delete ON public."Doctor" FOR DELETE TO kramya_runtime
 USING (kramya_private.staff("hospitalId",ARRAY['ADMIN']));

DROP POLICY schedule_write ON public."DoctorSchedule";
CREATE POLICY schedule_insert ON public."DoctorSchedule" FOR INSERT TO kramya_runtime
 WITH CHECK (kramya_private.staff("hospitalId",ARRAY['ADMIN']) AND EXISTS(
  SELECT 1 FROM public."Doctor" d WHERE d.id="DoctorSchedule"."doctorId" AND d."hospitalId"="DoctorSchedule"."hospitalId"));
CREATE POLICY schedule_update ON public."DoctorSchedule" FOR UPDATE TO kramya_runtime
 USING (kramya_private.staff("hospitalId",ARRAY['ADMIN']))
 WITH CHECK (kramya_private.staff("hospitalId",ARRAY['ADMIN']) AND EXISTS(
  SELECT 1 FROM public."Doctor" d WHERE d.id="DoctorSchedule"."doctorId" AND d."hospitalId"="DoctorSchedule"."hospitalId"));
CREATE POLICY schedule_delete ON public."DoctorSchedule" FOR DELETE TO kramya_runtime
 USING (kramya_private.staff("hospitalId",ARRAY['ADMIN']));

COMMIT;
