-- Cover the two remaining foreign keys reported by Supabase's database advisor.
CREATE INDEX "OPDSession_currentProviderDoctorId_idx"
  ON "OPDSession"("currentProviderDoctorId");

CREATE INDEX "Notification_entryId_idx"
  ON "Notification"("entryId");
