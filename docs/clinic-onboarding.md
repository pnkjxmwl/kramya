# Clinic onboarding for the reservation pilot

> **5 November payment decision:** Online Razorpay payment before token confirmation has been restored in local source. The former pay-at-clinic default below is superseded by [payment-restoration-plan.md](payment-restoration-plan.md). Existing confirmed clinic reservations are preserved. Independent privacy/ETA/environment/clinic acceptance gates still apply.


Status: proposed operating checklist, 2026-11-01. Not evidence of clinic verification or a signed agreement. See reservation-release-plan.md step 9.

## Who enters the information

The clinic supplies and confirms its own information. For the first pilot, the Kramya operator bootstraps the tenant and invites its first administrator using the existing onboarding command; there is no public self-registration/super-admin product flow today. Local implementation now adds Configuration → Clinic details for admins to maintain name, city, area, reception address and public phone/email, with audited changes. Admins also manage departments, doctors, schedules, session fees, staff and arrival/queue policy. Listing approval remains operator-controlled; the API and database prevent an admin self-verifying a pending/suspended clinic. Deployment and clinic acceptance are still required. See reservation-operations.md for the pilot access and arrival workflow.

## Information to collect

| Area | Minimum information | Why |
|---|---|---|
| Clinic | Display name, responsible organization/person, address, city/area, public reception phone, support contact | Correct discovery and a real person to contact when plans change |
| Administrator | Authorized person's name and email, invitation acceptance | Tenant ownership and staff access; never collect their password |
| Departments/providers | Department names, provider names, clinic-verified credentials, active/inactive state | Patients choose the correct service and provider |
| Sessions | Days, start/end times in Asia/Kolkata, closure dates, provider, capacity and consultation fee | Server-generated availability and honest capacity limits |
| Arrival | Reception location, when to arrive, late-arrival/grace rules, check-in/identity confirmation, accessibility needs | A token alone is not proof that a patient is physically present |
| Walk-ins/priority | Who records walk-ins, emergency escalation authority, pause/absence/closure responsibility | One operational queue and accountable changes |
| Payment at clinic | Fee and who collects it; cash/external UPI/card options managed by the clinic; cancellation/refund contact | No gateway onboarding, bank credentials or fund settlement through Kramya for this model |
| Patient data | Agreed purposes, access roles, retention/deletion responsibilities, incident/support contact | Inputs to the actual privacy policy and clinic agreement |

Do not request patient records to establish a clinic listing. Collect only what is needed. Credential checks and contractual responsibilities must be reviewed by the operator; a completed form does not establish legitimacy.

## Before public visibility

1. Confirm the administrator is authorized to represent the clinic. Keep review evidence securely, outside public discovery and logs.
2. Check address/contact, services, provider details, schedule, fee and arrival policy with the clinic.
3. Complete the clinic agreement and patient-facing privacy/support/arrival information. Final legal operator identity remains a founder dependency.
4. Run a fictional patient reservation through reception lookup/QR check-in, walk-in entry, call/start/complete and cancellation.
5. Have reception and the doctor practice absence, late arrival, emergency, pause and session closure. App reservations must not be maintained separately from walk-ins.
6. Operator approves publication through a controlled process. Clinic admins must not self-assert VERIFIED from their own profile.
7. Start one supervised clinic session. Record data quality and ETA accuracy, interval coverage/width, missed turns and patient waiting against a baseline. Review held-out days before expanding to more clinics; forecast accuracy alone does not prove time saved.

## Daily operating responsibility

Reception owns arrival/check-in and walk-in entry. The clinic assigns who marks provider presence and consultation start/end. A cancellation/delay must be communicated promptly. If Kramya is unavailable, reception follows an agreed manual continuity process and reconciles events after recovery; a monitoring ping is not that process.

Clinic-collected payment is not independently verified by Kramya. If a staff payment acknowledgement is added later, label it as staff-recorded, audit actor/time and corrections, and keep it separate from gateway transactions. Clinical urgency must not be decided by a payment indicator.
