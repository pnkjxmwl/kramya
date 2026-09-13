package app.kramya.screens

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import app.kramya.core.Icon
import app.kramya.core.Icons
import app.kramya.core.Theme
import app.kramya.core.calendarDate
import app.kramya.core.istRange
import app.kramya.core.rupees
import app.kramya.nav.NavBar
import app.kramya.net.JoinRequest
import app.kramya.net.JoinResponse
import app.kramya.net.MY_ACTIVE_ENTRIES
import app.kramya.net.MyQueueEntry
import app.kramya.net.Paginated
import app.kramya.net.Patient
import app.kramya.net.QueueEntryStatus
import app.kramya.net.SessionDetail
import app.kramya.net.useApi
import app.kramya.net.useApiPost
import app.kramya.ui.Button
import app.kramya.ui.Card
import app.kramya.ui.ErrorNote
import app.kramya.ui.Hairline
import app.kramya.ui.SectionLabel
import app.kramya.ui.QueryState
import app.kramya.ui.minTouchTarget
import app.kramya.ui.pressable
import app.kramya.ui.useMyActiveEntries
import kotlinx.coroutines.delay
import org.json.JSONObject

/**
 * Confirm who is visiting, pay, and wait for the server's token.
 * Mirror of apps/mobile/app/(app)/(visits)/join.tsx.
 *
 * **The client never creates the token, and never decides that a payment happened.** Only
 * the signature-verified webhook issues a token (docs/Rules.md 1.4), so this screen's job
 * is to open Checkout and then keep asking the SERVER whether the token exists yet.
 *
 * That is also why polling starts when checkout OPENS rather than when Checkout says
 * "paid". A card payment finishes inside the page and calls `handler`; **netbanking and
 * UPI-intent do not** - they navigate away to a bank, or hand off to another app, and the
 * callback that would have told us goes with the page that owned it. Waiting for a message
 * that never arrives is what made netbanking look like a failure when the money had
 * actually moved. Asking the server works for every method, including ones Razorpay adds
 * later.
 */

/** How often to ask the server whether the webhook has landed yet. */
private const val CONFIRM_POLL_MS = 2_000L

/**
 * How long to keep asking before sending them to My Visits.
 *
 * Giving up is not failure: if the payment succeeded the webhook will land, so the honest
 * message is "still confirming", never "payment failed".
 */
private const val CONFIRM_TIMEOUT_MS = 90_000L

/** Our own page's origin. Anything else means Checkout has gone off to a bank. */
private const val CHECKOUT_ORIGIN = "https://opd-queue.local"

private sealed interface Phase {
    data object Choosing : Phase
    data class Checkout(val order: JoinResponse) : Phase
    data class Confirming(val entryId: String) : Phase
}

@Composable
fun JoinScreen(
    sessionId: String,
    onBack: () -> Unit,
    onOpenToken: (String) -> Unit,
) {
    val session = useApi<SessionDetail>("/sessions/$sessionId")
    // A bare array, not a page: GET /patients is the ONE documented unpaginated endpoint.
    val patients = useApi<List<Patient>>("/patients")
    val join = useApiPost<JoinRequest, JoinResponse>("/sessions/$sessionId/join")
    // Same cache entry as the polling query below - one request, two readers.
    val myEntries = useMyActiveEntries()

    var patientId by remember { mutableStateOf<String?>(null) }
    var phase by remember { mutableStateOf<Phase>(Phase.Choosing) }
    var notice by remember { mutableStateOf<String?>(null) }

    /**
     * Whether Checkout ever left our page. If it did, a bank or a payment app was involved
     * and money may well have moved - so closing the sheet must wait for the server rather
     * than assume the patient changed their mind.
     */
    val leftOurPage = remember { BooleanHolder() }

    /*
      Who on this account already holds a place in THIS session.

      The server allows a second patient here - its check is scoped to (session, patient) -
      but it refuses the SAME patient twice with ALREADY_IN_QUEUE. Marking them
      unselectable makes that 409 unreachable rather than merely handled, which is the
      difference between a picker that teaches the rule and one that punishes you for not
      knowing it.
    */
    val bookedPatientIds = remember(myEntries, sessionId) {
        myEntries[sessionId].orEmpty()
            // A RESERVED hold is not a booking: re-picking that patient RESUMES their
            // unpaid checkout, which is exactly what they want.
            .filter { it.status != QueueEntryStatus.RESERVED }
            .map { it.patientId }
            .toSet()
    }

    val people = patients.data.orEmpty()
    val selectable = people.filter { it.id !in bookedPatientIds }

    /*
      Preselect the first bookable profile.

      It used to fire only when there was EXACTLY one, which left `patientId` null for an
      account with two - and `startPayment` begins with a null check, so the Pay button
      looked live and silently did nothing. Booking for yourself is the overwhelmingly
      common case, the choice is one tap to change, and the picker shows plainly who is
      selected.

      Counting only SELECTABLE profiles matters: preselecting someone already booked would
      dead-end the screen on a patient the server is going to refuse.
    */
    LaunchedEffect(selectable.firstOrNull()?.id, patientId) {
        if (patientId == null && selectable.isNotEmpty()) patientId = selectable.first().id
    }

    // ---------------------------------------------------------------------------
    // Watching the server, from the moment checkout opens
    // ---------------------------------------------------------------------------

    val watching = phase is Phase.Checkout || phase is Phase.Confirming
    val entryId = when (val current = phase) {
        is Phase.Checkout -> current.order.entry.id
        is Phase.Confirming -> current.entryId
        else -> null
    }

    val active = useApi<Paginated<MyQueueEntry>>(
        MY_ACTIVE_ENTRIES,
        enabled = watching,
        refetchMs = if (watching) CONFIRM_POLL_MS else null,
    )

    LaunchedEffect(watching, entryId, active.data) {
        if (!watching || entryId == null) return@LaunchedEffect
        val entry = active.data?.items?.firstOrNull { it.id == entryId } ?: return@LaunchedEffect
        // RESERVED means the hold exists but nothing is paid for yet. Anything else and the
        // server has decided - the only opinion that counts.
        if (entry.status != QueueEntryStatus.RESERVED) onOpenToken(entry.id)
    }

    LaunchedEffect(phase) {
        if (phase !is Phase.Confirming) return@LaunchedEffect
        delay(CONFIRM_TIMEOUT_MS)
        notice = "We are still confirming your payment. If it went through, your token will " +
            "appear in My Visits shortly."
        phase = Phase.Choosing
    }

    // ---------------------------------------------------------------------------

    /** Close the sheet. Keeps waiting on the server if a bank was ever involved. */
    fun closeCheckout(reason: String? = null) {
        val current = phase
        if (current !is Phase.Checkout) return
        phase = if (leftOurPage.value) {
            // They reached a bank or a payment app. Do NOT call this a cancellation - ask
            // the server, which is the only thing that knows.
            Phase.Confirming(current.order.entry.id)
        } else {
            if (reason != null) notice = reason
            Phase.Choosing
        }
    }

    val detail = session.data

    Column(Modifier.fillMaxSize().background(Theme.Colors.Canvas)) {
        NavBar("Confirm booking", onBack = onBack)

        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(
                    start = Theme.Gutter,
                    end = Theme.Gutter,
                    top = 22.dp,
                    bottom = Theme.Space.x10,
                ),
            verticalArrangement = Arrangement.spacedBy(Theme.Space.x4),
        ) {
            QueryState(
                pending = session.isPending || patients.isPending,
                error = session.error ?: patients.error,
                onRetry = session.refetch,
            )

            if (detail != null) {
                Card(title = "Appointment") {
                    BasicTextLine(detail.doctorName, Theme.Font.H3, Theme.Colors.Ink)
                    BasicTextLine(
                        "${detail.departmentName} · ${detail.hospitalName}",
                        Theme.Font.Caption,
                        Theme.Colors.InkTertiary,
                    )
                    BasicTextLine(
                        "${calendarDate(detail.date)} · " +
                            istRange(detail.scheduledStart, detail.scheduledEnd),
                        Theme.Font.Caption,
                        Theme.Colors.InkTertiary,
                    )
                }

                /*
                  Not a `Card`, because the picker has to run to the card's own edges.

                  The RN version pulls the grouped table out with a negative margin; Compose
                  rejects negative padding outright (it throws, at runtime, on a screen that
                  takes money). So the surface is drawn here with padding applied per-part
                  instead: the heading is inset, the rows are not. Same result, and it
                  cannot fail in a way only a payment can reveal.
                */
                Column(
                    Modifier
                        .fillMaxWidth()
                        .shadow(Theme.Elevation.Card, RoundedCornerShape(Theme.Radius.Group))
                        .clip(RoundedCornerShape(Theme.Radius.Group))
                        .background(Theme.Colors.Surface)
                        .padding(vertical = Theme.Space.x5),
                    verticalArrangement = Arrangement.spacedBy(Theme.Space.x3),
                ) {
                    Box(Modifier.padding(horizontal = Theme.Space.x5)) {
                        SectionLabel("Who is visiting")
                    }

                    when {
                        people.isEmpty() -> Box(Modifier.padding(horizontal = Theme.Space.x5)) {
                            BasicTextLine(
                                "Add a patient profile from the Profile tab before booking.",
                                Theme.Font.Caption,
                                Theme.Colors.InkTertiary,
                            )
                        }

                        selectable.isEmpty() -> Box(Modifier.padding(horizontal = Theme.Space.x5)) {
                            BasicTextLine(
                                "Everyone on this account already has a token for this session. " +
                                    "Add another patient profile from the Profile tab to book for " +
                                    "someone else.",
                                Theme.Font.Caption,
                                Theme.Colors.InkTertiary,
                            )
                        }

                        else -> Column(Modifier.fillMaxWidth()) {
                            people.forEachIndexed { index, person ->
                                if (index > 0) Hairline(Modifier.padding(start = Theme.Space.x5))
                                val alreadyBooked = person.id in bookedPatientIds
                                val selected = patientId == person.id
                                Row(
                                    Modifier
                                        .fillMaxWidth()
                                        .then(
                                            if (alreadyBooked) {
                                                Modifier
                                            } else {
                                                Modifier.pressable(radius = 0.dp) {
                                                    patientId = person.id
                                                }
                                            },
                                        )
                                        // docs/Design.md 9: 44x44 minimum.
                                        .heightIn(min = 48.dp)
                                        .padding(
                                            horizontal = Theme.Space.x5,
                                            vertical = Theme.Space.x3,
                                        ),
                                    horizontalArrangement = Arrangement.spacedBy(Theme.Space.x3),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Box(Modifier.weight(1f)) {
                                        BasicTextLine(
                                            person.name,
                                            Theme.Font.Body,
                                            if (alreadyBooked) Theme.Colors.InkTertiary
                                            else Theme.Colors.Ink,
                                        )
                                    }
                                    // Never colour alone (docs/Design.md 8) - say why it
                                    // is greyed.
                                    if (alreadyBooked) {
                                        BasicTextLine(
                                            "Already booked",
                                            Theme.Font.Caption,
                                            Theme.Colors.InkTertiary,
                                        )
                                    } else {
                                        Icon(
                                            if (selected) Icons.CHECK else Icons.CIRCLE,
                                            size = if (selected) 18.dp else 16.dp,
                                            tint = if (selected) Theme.Colors.Ink
                                            else Theme.Colors.Chevron,
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                Card {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        BasicTextLine(
                            "Consultation fee",
                            Theme.Font.Body,
                            Theme.Colors.InkTertiary,
                        )
                        // The server's number. The app never computes or sends an amount.
                        BasicTextLine(
                            rupees(detail.feePaise),
                            Theme.Font.Stat,
                            Theme.Colors.Ink,
                            tabular = true,
                        )
                    }
                    BasicTextLine(
                        "Your place is held for a few minutes while you pay. You will get a " +
                            "token with a QR code to check in at reception.",
                        Theme.Font.Caption,
                        Theme.Colors.InkTertiary,
                    )
                }

                notice?.let { ErrorNote(it) }
                join.error?.let { ErrorNote(it.message ?: "Could not start this booking") }

                Button(
                    title = when {
                        phase is Phase.Confirming -> "Confirming your payment..."
                        selectable.isEmpty() -> "Everyone here is already booked"
                        patientId == null -> "Choose who is visiting"
                        else -> "Pay ${rupees(detail.feePaise)}"
                    },
                    icon = Icons.CREDIT_CARD,
                    pending = join.isPending || phase is Phase.Confirming,
                    // Cannot pay without a patient. Saying so beats a live-looking button
                    // whose only behaviour is to ignore you.
                    enabled = patientId != null && selectable.isNotEmpty(),
                    onClick = {
                        val chosen = patientId ?: return@Button
                        notice = null
                        leftOurPage.value = false
                        join.mutate(JoinRequest(chosen)) { order ->
                            if (order.entry.status != QueueEntryStatus.RESERVED) {
                                // Already paid for - the server refuses a second booking,
                                // so this is the resume path after a crash rather than a
                                // new order.
                                onOpenToken(order.entry.id)
                            } else {
                                phase = Phase.Checkout(order)
                            }
                        }
                    },
                )
            }
        }
    }

    (phase as? Phase.Checkout)?.let { checkout ->
        CheckoutSheet(
            order = checkout.order,
            hospitalName = detail?.hospitalName ?: "Consultation",
            leftOurPage = leftOurPage,
            onLeftForGateway = {
                phase = Phase.Confirming(checkout.order.entry.id)
            },
            onClose = { reason -> closeCheckout(reason) },
        )
    }
}

/** A mutable flag shared with the WebView's callbacks, which run outside composition. */
private class BooleanHolder(var value: Boolean = false)

/**
 * Razorpay Checkout in a WebView.
 *
 * apps/mobile reaches for a WebView because the official `react-native-razorpay` SDK is a
 * native module that Expo Go cannot load. That constraint does not apply here - but the
 * WebView flow is kept anyway, and deliberately: it is the flow whose behaviour around
 * netbanking, UPI intent and redirect mode was established the hard way against real
 * payments. Swapping to the native SDK would be a different flow with its own callbacks,
 * and all of that would have to be re-earned.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun CheckoutSheet(
    order: JoinResponse,
    hospitalName: String,
    leftOurPage: BooleanHolder,
    onLeftForGateway: () -> Unit,
    onClose: (String?) -> Unit,
) {
    val context = LocalContext.current
    val html = remember(order, hospitalName) { checkoutHtml(order, hospitalName) }

    // The system back button closes the sheet, matching the RN Modal's onRequestClose.
    BackHandler { onClose(null) }

    Column(Modifier.fillMaxSize().background(Theme.Colors.Canvas)) {
        Box(
            Modifier
                .fillMaxWidth()
                .padding(Theme.Space.x4),
            contentAlignment = Alignment.CenterEnd,
        ) {
            Box(
                Modifier
                    .minTouchTarget()
                    .size(44.dp)
                    .pressable(
                        radius = Theme.Radius.Full,
                        label = "Close payment",
                        onClick = { onClose(null) },
                    ),
                contentAlignment = Alignment.Center,
            ) { Icon(Icons.X, size = 22.dp, tint = Theme.Colors.Ink) }
        }

        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                WebView(ctx).apply {
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    /*
                      Netbanking sends the patient to their bank through `window.open`.
                      With multiple windows supported, that creates a window nothing
                      displays - the sheet just sits there and the payment looks like it
                      failed. `false` loads the bank page in THIS WebView, which is the fix
                      for netbanking.
                    */
                    settings.setSupportMultipleWindows(false)
                    settings.javaScriptCanOpenWindowsAutomatically = true

                    /*
                      The bridge the checkout page posts to.

                      Named `ReactNativeWebView` so the HTML is byte-identical to the RN
                      app's - the page is the contract, and a second spelling of it is a
                      second thing to keep in step.

                      **Exposing this to every page the WebView loads is safe here, and
                      only because nothing trusts what comes through it.** After a redirect
                      the bank's own page can call it too; the worst it can claim is
                      `success`, which merely moves this screen to "confirming" and makes
                      it ask the server. The server is the only thing that issues a token.
                    */
                    addJavascriptInterface(
                        object {
                            @JavascriptInterface
                            fun postMessage(raw: String) {
                                // Called on a WebView worker thread.
                                post { handleCheckoutMessage(raw, onLeftForGateway, onClose) }
                            }
                        },
                        "ReactNativeWebView",
                    )

                    webViewClient = object : WebViewClient() {
                        override fun shouldOverrideUrlLoading(
                            view: WebView,
                            request: WebResourceRequest,
                        ): Boolean {
                            val url = request.url.toString()

                            // The gateway is finished and is handing the browser back. Stop
                            // the navigation - there is nothing at that address - and go
                            // ask the server what actually happened.
                            if (url.startsWith(order.callbackUrl)) {
                                leftOurPage.value = true
                                onLeftForGateway()
                                return true
                            }

                            // UPI-intent hands off to GPay/PhonePe through a custom scheme.
                            // A WebView cannot load those; the OS can. Without this the
                            // sheet dies on a URL it does not understand.
                            if (!url.matches(Regex("^https?:.*", RegexOption.IGNORE_CASE))) {
                                leftOurPage.value = true
                                openExternally(context, url)
                                return true
                            }

                            if (!url.startsWith(CHECKOUT_ORIGIN)) leftOurPage.value = true
                            return false
                        }

                        override fun onReceivedError(
                            view: WebView,
                            request: WebResourceRequest,
                            error: android.webkit.WebResourceError,
                        ) {
                            // Only the main document matters. A failed tracking pixel on
                            // the bank's page is not a failed payment.
                            if (!request.isForMainFrame) return
                            onClose("The payment page could not be opened. Please try again.")
                        }
                    }

                    // A real https origin: Checkout refuses to run from about:blank, which
                    // is what a bare HTML load gives it.
                    loadDataWithBaseURL(CHECKOUT_ORIGIN, html, "text/html", "utf-8", null)
                }
            },
        )
    }
}

private fun handleCheckoutMessage(
    raw: String,
    onSuccess: () -> Unit,
    onClose: (String?) -> Unit,
) {
    val message = runCatching { JSONObject(raw) }.getOrNull()
    when (message?.optString("type")) {
        // Deliberately not treated as "booked" - it only means Checkout believes it is
        // done. The server decides, and we are already asking it.
        "success" -> onSuccess()

        "failed" -> {
            val description = message.optString("description").ifEmpty { "the bank declined it" }
            onClose(
                "Payment failed: $description. Your place is still held - you can try again.",
            )
        }

        else -> onClose(
            "Payment was not completed. Your place is held for a few more minutes if you " +
                "want to try again.",
        )
    }
}

private fun openExternally(context: android.content.Context, url: String) {
    runCatching {
        val intent = if (url.startsWith("intent:")) {
            Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
        } else {
            Intent(Intent.ACTION_VIEW, Uri.parse(url))
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }
}

/**
 * The checkout page.
 *
 * `order_id` and `key` come from the server's join response - the app never names an
 * amount, and Razorpay takes the amount from the order itself, so there is nothing here a
 * tampered client could inflate or discount.
 */
internal fun checkoutHtml(order: JoinResponse, hospitalName: String): String {
    val options = JSONObject().apply {
        put("key", order.razorpayKeyId)
        put("order_id", order.razorpayOrderId)
        put("currency", order.currency)
        put("name", hospitalName)
        put("description", "${order.entry.departmentName} · Token ${order.entry.tokenLabel}")
        put("theme", JSONObject().put("color", "#0B0B0C"))
        /*
          REDIRECT MODE, and it is the whole reason netbanking works.

          By default Checkout sends the patient to their bank through `window.open`. A
          WebView returns NULL from that call even with multiple windows disabled - it
          navigates, but JavaScript gets null back - and Checkout reads null as "popup
          blocked" and aborts with "payment failed, please use another method". Razorpay's
          own API told us so: every netbanking and wallet attempt sat at status `created`,
          never reaching the bank, while card - the one method that completes in-page - was
          `captured`.

          `redirect: true` navigates the top window instead of opening one, so no popup is
          ever needed. It applies to cards too, which is fine: this screen has not depended
          on Checkout's `handler` since it started polling the server from the moment the
          sheet opens.
        */
        put("redirect", true)
        put("callback_url", order.callbackUrl)
    }

    return """<!doctype html>
<html>
  <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;background:#F7F7F8">
    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
    <script>
      function post(message) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
        }
      }
      var options = $options;
      // Only fires in non-redirect mode. Harmless, and a free fast path if Razorpay ever
      // decides a given method does not need the redirect.
      options.handler = function () { post({ type: 'success' }); };
      options.modal = { ondismiss: function () { post({ type: 'dismissed' }); }, escape: false };
      try {
        var rzp = new Razorpay(options);
        rzp.on('payment.failed', function (event) {
          post({ type: 'failed', description: event && event.error && event.error.description });
        });
        rzp.open();
      } catch (error) {
        post({ type: 'failed', description: String(error) });
      }
    </script>
  </body>
</html>"""
}

/** One line of text, at a given token. Saves repeating the BasicText boilerplate. */
@Composable
private fun BasicTextLine(
    text: String,
    style: androidx.compose.ui.text.TextStyle,
    color: androidx.compose.ui.graphics.Color,
    tabular: Boolean = false,
) {
    androidx.compose.foundation.text.BasicText(
        text = text,
        style = style.copy(
            color = color,
            fontFeatureSettings = if (tabular) "tnum" else null,
        ),
    )
}
