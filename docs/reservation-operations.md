# Reservation pilot operations

> **5 November payment decision:** Online Razorpay payment before token confirmation has been restored in local source. The former pay-at-clinic default below is superseded by [payment-restoration-plan.md](payment-restoration-plan.md). Existing confirmed clinic reservations are preserved. Independent privacy/ETA/environment/clinic acceptance gates still apply.


Engineering runbook, 1 November 2026. Clinic approval and the acceptance record in TESTING.md are still required. These defaults are not clinical or legal approval.

## Environments and free pilot access

| Setting | Fictional staging | Controlled real-clinic pilot |
|---|---|---|
| Database | Existing staging dataset | A separate, initially empty database; never rename staging |
| DEPLOYMENT_ENVIRONMENT | STAGING | PRODUCTION |
| REMOTE_BOOKING_ACCESS | OPEN_TEST | APPROVED_ONLY |
| BOOKING_PAYMENT_MODE | AT_CLINIC | AT_CLINIC |
| REQUIRE_VERIFIED_EMAIL_FOR_RESERVATIONS | false while delivery is disabled | false for operator-approved pilot access |
| Patient app | Staging-labelled build | Explicit production API/web hosts |

APPROVED_ONLY is an operational account approval, not a claim that a phone or email was verified. A founder/clinic confirms the pilot participant outside the app; only the migration-owner command can approve/revoke the account. Browsing and account management remain available to unapproved accounts. Existing reservations survive approval revocation. VERIFIED_EMAIL is a later alternative once verified sign-in/delivery and recovery are operational. Production refuses OPEN_TEST.

Use private environment configuration, never a password or connection string pasted into chat. After migrations on a NEW production database, the owner may run:

```text
corepack pnpm --filter @opd/api initialize-production --initialize-empty-production
corepack pnpm --filter @opd/api pilot-access --account <account-uuid> --approve --reason "Clinic pilot invitation and ownership reviewed"
corepack pnpm --filter @opd/api pilot-access --account <account-uuid> --revoke --reason "Operator reviewed remote booking access"
```

The initializer locks/checks every application table and refuses any populated dataset or restricted runtime credential. The API refuses a database-marker mismatch. Production must also use distinct secrets, an approved hosting arrangement and correct client environment tags. These commands have not provisioned or activated a hosted production environment.

## Clinic setup and public information

The operator bootstraps the tenant and first admin through the existing onboarding command. The admin uses Configuration → Clinic details to maintain name, city, area, reception address and public phone/email, then configures departments, doctors, schedules, session fees, staff and Queue policy. Profile edits are audited. Listing approval is owner-controlled; the profile API and database trigger prevent self-verification. Pending/suspended clinics remain hidden from patient discovery.

Confirm permission to publish the reception contact. Arrival instructions are public and must contain no patient details or medical advice. The native reservation/token screens show the address, clinic instructions and optional dialer/mail-composer actions. Tapping these actions opens another app; Kramya does not place a call or send a message automatically.

## Arrival and payment

1. The patient selects the correct family profile and session, reads the fee/arrival guidance and reserves. The server returns a confirmed token and signed QR without creating a Payment.
2. The estimate is a range. Plan arrival using the clinic's configured lead time and travel allowance; it can change with pauses, emergencies and consultations.
3. Reception verifies the patient/session, handles the clinic's fee and receipt directly, then confirms physical arrival using scan, token lookup or the staff queue. Repeating check-in does not change the original arrival timestamp. A token alone is not proof of presence.
4. Only checked-in patients may be called in reservation mode. Present walk-ins and remote reservations share one queue. Emergency priority must be a staff-reviewed action, not a patient-selected shortcut.
5. Explain grace/recall/requeue rules before booking. If someone misses a turn, reception reviews the circumstances and applies the configured command; the previous priority is not silently restored.
6. If the clinic closes early, unfinished reservations are cancelled. Do not label an absent patient a no-show merely because the clinic ended before its scheduled end. At normal closure, absent visits may be recorded as no-shows; that remains separate from deliberate misuse.

Clinic-collected payments are not gateway-verified and must not be written as successful Razorpay payments. Historical gateway captures/refunds retain their existing recovery paths. A clinic handles disputes about its own cash/UPI collection.

## Misuse review and appeal

Default: no automatic sanction. The account-wide active reservation limit, overlapping-session check, one usable reservation per patient/session, signup throttles and serialized profile ceiling limit cheap misuse. These do not prove a person's identity or eliminate all abuse. Controlled pilot approval limits account farming while delivery is undecided.

Reception/admin can open Review booking access from an online entry, including past entries. The report separates distinct staff-marked no-show visits from session-end absence during the last 30 days at that clinic. Neither count is proof of abuse. Review disruption, timestamps, duplicate booking history and the patient's explanation first.

If an operational pause is justified, record a brief, neutral reason and explain how reception will review an appeal. Do not include diagnoses, documents or unnecessary personal data. A pause applies only to new online reservations for that patient profile at that clinic; it expires within seven days and can be lifted immediately. Existing tokens, other family profiles, other clinics and direct/walk-in care remain available. Correct a mistaken decision promptly. No permanent medical-care ban exists in this feature.

## Freshness, outages and ETA evaluation

The token screen shows the age of the last successful REST refresh using a monotonic clock. A live socket alone is not proof of fresh information. After a failed refresh or two minutes without a successful refresh, the old estimate is replaced by a refresh instruction; the token/QR remains available. A disconnected socket can still have a recently refreshed REST snapshot. The polling fallback runs only while the screen/app is active.

Reception must have a clinic-approved manual fallback when the service is unavailable. Monitoring is not a guarantee that workers or notifications are running. Record actual events and outages; do not invent retrospective consultation times to make charts look complete. Missing/delayed data must be excluded or flagged in ETA validation.

Use pilot-eta-validation.md: one supervised clinic first, a baseline, held-out clinic days, prediction error, uncertainty coverage/width, early calls/missed turns and actual patient waiting. Improving forecast error alone does not prove time saved. No exact-time or zero-wait claim is justified before pilot evidence.

## Accounts and remaining gates

Password-based users can request deletion in Android or on the public deletion page without a sender service. The web route authenticates server-side, uses the same deletion command and does not expose tokens/cookies to the browser. Active clinical/staff handover remains recorded for operator follow-up; retry only a verified request with fulfil-deletion after resolving it. Limited pseudonymous historical records remain; final retention/legal review is required.

Automatic verification/recovery emails are disabled. Google-only/forgotten-password users still need a verified assistance/deletion/recovery path before public release. Do not claim this is solved by pilot booking approval. Do not enable paid SMS or another provider without the founder's choice.

Physical notification/logout/reconnect, TalkBack/large text, real reception acceptance, production provisioning, published disclosures, maintained review access, Play account verification/internal distribution and the supervised ETA pilot remain release gates. Scheduled backup/retention automation and failure alerts remain deferred by the founder; manual recovery readiness still needs an operational owner.
