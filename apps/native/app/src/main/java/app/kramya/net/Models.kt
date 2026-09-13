package app.kramya.net

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Kotlin mirrors of packages/contracts - the shared API contract.
//
// **This file is a MIRROR, not a second definition.** packages/contracts is the
// authority (docs/CLAUDE.md 1.8: never break the shared contract silently); these types
// exist because Kotlin cannot import Zod schemas, and every field below is copied from
// the schema of the same name. When the contract changes, this changes second.
//
// Only what the PATIENT app reads is modelled. `Json { ignoreUnknownKeys = true }` in
// Api.kt drops the rest, which is deliberate: a field nothing renders is a field that
// silently rots, and the RN app is equally partial - it just does it by structural
// typing instead of by omission.
//
// Enums are real Kotlin enums rather than strings, which buys the thing the RN app most
// conspicuously lacks: a `when` over QueueEntryStatus with no `else` fails to COMPILE if
// a value is unhandled, where visits.tsx's `Record<QueueEntryStatus, ...>` map only
// fails at runtime, as `undefined`, on the one screen that hits it.
//
// The cost of that choice is stated plainly: an enum VALUE the server adds and this app
// has never heard of throws at parse time rather than rendering blank. Both contracts
// enums carry a comment saying additions are deliberate and removals break installed
// apps, so this is a coordinated change either way - see PARITY.md.

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** contracts/enums/config.ts - OPD session lifecycle. */
@Serializable
enum class SessionStatus {
    SCHEDULED, OPEN_FOR_REGISTRATION, ACTIVE, COMPLETED, CANCELLED, ENDED_EARLY
}

/**
 * contracts/enums/config.ts - where the doctor physically is.
 *
 * Deliberately INDEPENDENT of SessionStatus: a session reads ACTIVE while nobody is in
 * the room, every single day (docs/PRD.md 8.10).
 */
@Serializable
enum class DoctorPresence { NOT_PRESENT, PRESENT, ON_BREAK, LEFT }

/** contracts/enums/queue.ts - queue entry lifecycle. READY is reserved and unreachable in v1. */
@Serializable
enum class QueueEntryStatus {
    RESERVED, CONFIRMED, VIRTUAL_WAITING, CHECKED_IN, READY, CALLED,
    IN_CONSULTATION, COMPLETED, CANCELLED, NO_SHOW, SKIPPED, RESCHEDULED
}

/** contracts/enums/queue.ts - how an entry got into the queue. Immutable once set. */
@Serializable
enum class QueueEntryType { ONLINE, WALK_IN, FOLLOW_UP }

/** contracts/enums/payment.ts */
@Serializable
enum class PaymentStatus {
    CREATED, PENDING, SUCCESS, FAILED, REFUNDED, PARTIALLY_REFUNDED
}

/** contracts/enums/payment.ts */
@Serializable
enum class RefundStatus { PENDING, PROCESSED, FAILED }

/** contracts/enums/patient.ts */
@Serializable
enum class Gender { MALE, FEMALE, OTHER }

/** contracts/enums/patient.ts - who this profile is, relative to the account holder. */
@Serializable
enum class PatientRelation { SELF, SPOUSE, MOTHER, FATHER, CHILD, SIBLING, OTHER }

// ---------------------------------------------------------------------------
// Envelopes
// ---------------------------------------------------------------------------

/** contracts/common/pagination.ts - docs/Rules.md 6: every list endpoint paginates. */
@Serializable
data class Paginated<T>(
    val items: List<T>,
    val total: Int,
    val limit: Int,
    val offset: Int,
)

/**
 * contracts/common/error.ts - the ONLY error shape the API returns.
 *
 * `code` is a String rather than an enum here, and that is the one place this file
 * departs from the rule above. An error envelope is what the app receives when something
 * has ALREADY gone wrong; failing to parse it because the server grew a new code would
 * replace a readable server message with a JSON exception, at the worst possible moment.
 * Nothing branches on an unknown code, so nothing is lost.
 */
@Serializable
data class ApiErrorBody(val error: ApiErrorDetail)

@Serializable
data class ApiErrorDetail(
    val code: String,
    val message: String,
    val requestId: String? = null,
)

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** contracts/auth/dto.ts */
@Serializable
data class AuthTokens(
    val accessToken: String,
    val refreshToken: String,
    /** Seconds until the access token expires. */
    val expiresIn: Int = 0,
)

/**
 * contracts/auth/dto.ts - GET /me.
 *
 * The patient app reads `email` and nothing else; `memberships` is always empty for a
 * patient account. Modelled thin on purpose - see the header.
 */
@Serializable
data class MeResponse(
    val id: String,
    val email: String,
)

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------

/** contracts/patients/dto.ts */
@Serializable
data class Patient(
    val id: String,
    val name: String,
    val dob: String? = null,
    val gender: Gender? = null,
    val relation: PatientRelation,
    val createdAt: String,
)

/** contracts/patients/dto.ts - POST /patients. `relation` defaults to SELF server-side. */
@Serializable
data class CreatePatientRequest(
    val name: String,
    val relation: PatientRelation,
)

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/**
 * contracts/discovery/dto.ts - what is happening in a session's queue right now.
 *
 * The two counts are the honest two-number model from docs/PRD.md 4.2: how many people
 * are physically present ahead of you AND how many are booked but still at home.
 * Collapsing them into one number is what makes a queue app feel like it is lying.
 */
@Serializable
data class QueueSnapshot(
    /** The token label in consultation, e.g. "A018". Null when nobody has been called. */
    val nowServingToken: String? = null,
    /** Physically present and still waiting - CHECKED_IN, READY or CALLED. */
    val checkedInCount: Int,
    /** Booked but not yet arrived - CONFIRMED or VIRTUAL_WAITING. May not turn up. */
    val bookedNotArrivedCount: Int,
    /**
     * Whether the server would accept a join right now (docs/PRD.md 8.12).
     *
     * **Advisory only.** It exists so the client can disable the Join button with a
     * reason instead of reimplementing the rule - docs/Rules.md 1 still makes the server
     * the only thing that decides at join time, and the answer can change between this
     * read and that write.
     */
    val registrationOpen: Boolean,
    /** A window, never a point. Both null until the ETA engine has an opinion. */
    val joinNowEtaFrom: String? = null,
    val joinNowEtaTo: String? = null,
)

/** contracts/discovery/dto.ts - a city with at least one listable hospital. */
@Serializable
data class City(val name: String, val hospitalCount: Int)

@Serializable
data class HospitalCard(
    val id: String,
    val name: String,
    val city: String,
    val area: String? = null,
    /** Null is an ORDINARY state, never an error - most clinics have no photo at pilot. */
    val photoUrl: String? = null,
    /** Today's listable programme, finished sessions included. */
    val todaySessionCount: Int,
    /**
     * How many of today's sessions would accept a booking RIGHT NOW.
     *
     * Not the same fact as `todaySessionCount`, and the difference is why this field
     * exists: the hero card once advertised "8 OPD OPEN NOW" at a hospital where every
     * session had already ended.
     */
    val openSessionCount: Int,
)

@Serializable
data class HospitalDetail(
    val id: String,
    val name: String,
    val city: String,
    val area: String? = null,
    val photoUrl: String? = null,
    val todaySessionCount: Int,
    val openSessionCount: Int,
    val address: String? = null,
)

@Serializable
data class PublicDepartment(
    val id: String,
    val hospitalId: String,
    val name: String,
    val todaySessionCount: Int,
)

/** contracts/discovery/dto.ts - the secondary browse entry point (docs/PRD.md 5.1). */
@Serializable
data class PublicDoctor(
    val id: String,
    val name: String,
    val specialization: String? = null,
    val photoUrl: String? = null,
    /** Roughly how long this doctor spends per patient. */
    val defaultConsultMins: Int,
    val departmentId: String,
    val departmentName: String,
    val hospitalId: String,
    val hospitalName: String,
    val hospitalCity: String,
)

/**
 * contracts/discovery/dto.ts - the joinable unit is always a SESSION, never a doctor
 * (docs/PRD.md 5.1). A doctor running two blocks in a day is two cards.
 *
 * `SessionDetail` extends this in the contract. Kotlin data classes do not extend, so
 * the shared fields are repeated below rather than modelled through an interface - an
 * interface would buy one `SessionCardView` signature and cost a level of indirection on
 * every field access. The card component takes the small set it actually draws instead;
 * see ui/Discovery.kt.
 */
@Serializable
data class SessionCard(
    val id: String,
    val hospitalId: String,
    val hospitalName: String,
    val departmentId: String,
    val departmentName: String,
    /** The CURRENT provider - after a substitution, not the doctor who was booked. */
    val doctorId: String,
    val doctorName: String,
    val doctorSpecialization: String? = null,
    val doctorPhotoUrl: String? = null,
    /** True when this session has been handed to a covering doctor. */
    val isSubstitute: Boolean,
    /** IST calendar date; the two instants are UTC (docs/Rules.md 5). */
    val date: String,
    val scheduledStart: String,
    val scheduledEnd: String,
    val status: SessionStatus,
    /** Independent of `status` by design - open, but nobody in the room. */
    val doctorPresence: DoctorPresence,
    val feePaise: Int,
    val snapshot: QueueSnapshot,
)

/** The card plus what is worth a second screen but not worth sending per-card. */
@Serializable
data class SessionDetail(
    val id: String,
    val hospitalId: String,
    val hospitalName: String,
    val departmentId: String,
    val departmentName: String,
    val doctorId: String,
    val doctorName: String,
    val doctorSpecialization: String? = null,
    val doctorPhotoUrl: String? = null,
    val isSubstitute: Boolean,
    val date: String,
    val scheduledStart: String,
    val scheduledEnd: String,
    val status: SessionStatus,
    val doctorPresence: DoctorPresence,
    val feePaise: Int,
    val snapshot: QueueSnapshot,
    val hospitalArea: String? = null,
    val hospitalAddress: String? = null,
    val doctorDefaultConsultMins: Int,
)

/** The shared fields, so one component can draw a card from either shape. */
fun SessionDetail.asCard() = SessionCard(
    id = id,
    hospitalId = hospitalId,
    hospitalName = hospitalName,
    departmentId = departmentId,
    departmentName = departmentName,
    doctorId = doctorId,
    doctorName = doctorName,
    doctorSpecialization = doctorSpecialization,
    doctorPhotoUrl = doctorPhotoUrl,
    isSubstitute = isSubstitute,
    date = date,
    scheduledStart = scheduledStart,
    scheduledEnd = scheduledEnd,
    status = status,
    doctorPresence = doctorPresence,
    feePaise = feePaise,
    snapshot = snapshot,
)

// ---------------------------------------------------------------------------
// The patient's own visits
// ---------------------------------------------------------------------------

/**
 * contracts/payments/dto.ts - one visit, as its owner sees it.
 *
 * **This is the PATIENT's shape.** It describes one person's own entry and carries no
 * other patient's name, token or payment - unlike the staff console's view of a whole
 * queue. A patient screen must never be built from a staff shape (docs/Rules.md 8, DPDP).
 */
@Serializable
data class MyQueueEntry(
    val id: String,
    val sessionId: String,
    val status: QueueEntryStatus,
    val type: QueueEntryType,
    /** Null for an entry with no payment behind it - a walk-in registered at a desk. */
    val paymentStatus: PaymentStatus? = null,
    val tokenNumber: Int,
    val tokenLabel: String,
    /**
     * The signed, opaque QR reference reception scans (docs/Rules.md 10).
     *
     * **Render it verbatim into the QR. Never parse it.** It is `v1.<ref>.<hmac>`, it
     * carries no PII and no id, and it does not change between reads - a patient who
     * screenshotted their token last week can still be checked in. Null while an entry
     * is still RESERVED, because there is nothing to check in to yet.
     */
    val checkInCode: String? = null,
    val patientId: String,
    val patientName: String,
    val hospitalId: String,
    val hospitalName: String,
    val hospitalArea: String? = null,
    val departmentName: String,
    /** The doctor actually providing care - after a substitution, not who was booked. */
    val doctorName: String,
    val doctorPhotoUrl: String? = null,
    val scheduledStart: String,
    val scheduledEnd: String,
    val feePaise: Int,
    /**
     * When an unpaid hold lapses. Non-null only while RESERVED.
     *
     * The client counts down from THIS rather than from the moment it called join: a
     * phone that was backgrounded, or whose clock is wrong, would otherwise disagree
     * with the server about whether the slot is gone.
     */
    val reservationExpiresAt: String? = null,
    /** The token in consultation right now. Null before anyone has been called. */
    val nowServingToken: String? = null,
    /** Present, waiting, and ahead of THIS entry in call order. */
    val checkedInAheadCount: Int,
    /** Booked with an earlier token but not yet arrived - they may not turn up. */
    val bookedAheadCount: Int,
    /** A window, never a point. */
    val etaFrom: String? = null,
    val etaTo: String? = null,
    val joinedAt: String,
    val checkedInAt: String? = null,
    val calledAt: String? = null,
    val completedAt: String? = null,
    /**
     * Whether cancelling would be accepted right now, and what fraction comes back.
     *
     * Advisory, exactly like `registrationOpen`: it lets the app say "cancel now - full
     * refund" instead of reimplementing the policy, and the server still decides at
     * cancel time because the free window can close in between.
     */
    val cancellable: Boolean,
    val refundPctIfCancelledNow: Int,
)

// ---------------------------------------------------------------------------
// Join and cancel
// ---------------------------------------------------------------------------

/**
 * contracts/payments/dto.ts - POST /sessions/:id/join.
 *
 * The body names a patient and NOTHING else. No amount, no token number, no hospital:
 * the fee comes from the session, the token from the server. A client that could send an
 * amount is the single most exploitable payment bug there is (docs/Rules.md 9).
 */
@Serializable
data class JoinRequest(val patientId: String)

/**
 * Everything Razorpay Checkout needs, plus the entry now being held.
 *
 * `razorpayKeyId` is the publishable half of the key pair and is safe to hold - Checkout
 * needs it in the page. The secret never leaves the server, and the signature that
 * actually authorises anything is verified on the webhook.
 */
@Serializable
data class JoinResponse(
    val entry: MyQueueEntry,
    val razorpayOrderId: String,
    val razorpayKeyId: String,
    val amountPaise: Int,
    val currency: String,
    /**
     * Where Razorpay returns the browser once the payment finishes.
     *
     * **From the server, never built here.** It has to be a real, publicly reachable
     * address for the gateway to accept it, and only the server knows what that is. The
     * app intercepts this URL rather than loading it, and still reads the OUTCOME from
     * the server: it says "the gateway is done", never "the payment succeeded".
     */
    val callbackUrl: String,
)

@Serializable
data class CancelEntryRequest(val reason: String? = null)

/**
 * `refund` is null when there was nothing to refund. A refund that IS raised comes back
 * PENDING, because Razorpay settles it asynchronously - so the app says "refund on its
 * way", never "refunded".
 */
@Serializable
data class CancelEntryResponse(
    val entry: MyQueueEntry,
    val refund: RefundInfo? = null,
)

@Serializable
data class RefundInfo(val amountPaise: Int, val status: RefundStatus)

// ---------------------------------------------------------------------------
// Auth request bodies
// ---------------------------------------------------------------------------

@Serializable
data class LoginRequest(val email: String, val password: String)

@Serializable
data class SignupRequest(
    val email: String,
    val password: String,
    /** Optional: creates the account holder's own SELF patient profile in the same call. */
    val name: String? = null,
)

@Serializable
data class RefreshRequest(val refreshToken: String)

@Serializable
data class LogoutRequest(val refreshToken: String)

// ---------------------------------------------------------------------------
// Realtime - contracts/realtime/dto.ts
// ---------------------------------------------------------------------------

/**
 * Wire names, matching REALTIME_EVENT.
 *
 * Both events are DOORBELLS. They carry no queue state on purpose: the REST snapshot
 * stays the only description of the queue, which is the reconnect contract
 * (docs/Rules.md 8) applied all the time rather than only after a drop.
 */
object RealtimeEvent {
    const val SESSION_UPDATED = "session.updated"
    const val ENTRY_UPDATED = "entry.updated"
}

@Serializable
data class SessionUpdatedEvent(
    val sessionId: String,
    @SerialName("version") val version: Int = 0,
)
