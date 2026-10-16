# Validate waiting time in a supervised clinic pilot

The patient app is Kotlin Android (`apps/native`). Start with one clinic and a trained receptionist who can correct presence, pauses, check-ins, calls and consultation timestamps. Expand to the other clinics after the first pilot meets agreed targets. Do not train or ship an unsupervised prediction model before collecting reliable outcomes.

## What changed

An ETA requires a present doctor, a running session and an unpaused queue. An absent doctor, a break or a pause returns no running estimate. Patient visits ask users to check clinic status before travelling when an estimate is unavailable. Leave-now nudges include the remaining consultation already in progress. Consultation and handover history used for an estimate is restricted to outcomes completed by the evaluation time.

These are correctness fixes. The current weighted pace, seed duration and uncertainty padding are heuristics, not calibrated confidence intervals. Travel time is not personalized. Other booked patients can arrive, emergencies can change priority, and an overrunning consultation remains uncertain. A displayed window cannot guarantee a consultation time.

## Measure before tuning

For a bounded clinic cohort, run the read-only aggregate report with an operator-controlled database connection:

```powershell
corepack pnpm --filter @opd/api eta:report -- --hospital-id HOSPITAL_UUID --from 2026-10-16T00:00:00+05:30 --to 2026-10-23T00:00:00+05:30
```

The interval selects sessions by scheduled start, including the lower bound and excluding the upper. Maximum 31 days and 10000 entries; narrow the interval if needed. No patient names, contacts, push tokens or individual results are printed. The report does not start API background workers or modify data. Use a read-only reporting credential when available.

The existing database freezes a window when a leave-now notification is recorded. This is the report's forecast cohort; estimates shown on every app refresh are **not** recorded. The report includes missing forecasts and outcomes as exclusions rather than silently treating them as successes. First calls and actual consultation starts are scored separately. Calls use the earliest immutable `ENTRY_CALLED` event, because requeue clears and later replaces the booking's `calledAt`; a later successful call must not hide a missed first call. Missing call events remain missing outcomes. It reports window coverage, early/late misses, midpoint absolute error (mean, median, p90), signed bias, and window width. Coverage must be assessed alongside width: a very wide window can hide poor precision.

Recorded forecasts and notifications submitted to FCM before the actual event have separate results. `sentAt` means provider submission, not delivery to the phone or patient acknowledgement. Missing/late submissions must be investigated. No completed samples means no accuracy evidence. Provider changes at forecast time are not captured, so this report does not support per-doctor attribution or a full historical replay.

Before the pilot, agree numeric targets with the clinic for p90 consultation-start error, window width and coverage, patient waiting after arrival, missed turns, and notification timeliness. Record a baseline from the clinic's existing process. During the pilot, review every early consultation, long wait, missed turn and missing push daily. Keep emergency-priority cases visible in the overall results; explain their contribution separately without deleting inconvenient observations.

The present report measures forecast timing. Arrival-to-consultation waiting, travel time, notification receipt, patient satisfaction and the baseline comparison still need supervised observation. Do not infer “time saved” or make accuracy claims from forecast error alone. Retune weights only after evaluating held-out clinic days, then repeat this process before adding clinics.

## Android phone check

Use the debug APK against the staging API. Connect the Android phone with USB debugging and approve the computer on the phone. Verify login, booking in payment test mode, visit refresh, absent/break/paused doctor states, reconnect after offline use, account switching, notification permission, foreground/background/killed-app FCM, and tap-to-visit navigation. Record results and Android version. Never mark FCM tested from a successful APK build alone.

The Firebase client file is local and ignored. Server FCM credentials, OAuth configuration, a private release signing key, Play distribution, production payments and clinic operating readiness are separate launch requirements. Never sign a production release using the debug key.
