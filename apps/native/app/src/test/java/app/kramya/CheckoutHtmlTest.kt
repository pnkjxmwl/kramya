package app.kramya

import app.kramya.net.JoinResponse
import app.kramya.net.MyQueueEntry
import app.kramya.net.QueueEntryStatus
import app.kramya.net.QueueEntryType
import app.kramya.screens.checkoutHtml
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.json.JSONObject

/**
 * The payment page is the one piece of this app whose behaviour was established against
 * real money, and most of it is encoded in four lines of Checkout options. These assert
 * the ones that were learned the hard way - see the comments in join.tsx and Join.kt.
 */
class CheckoutHtmlTest {

    private val order = JoinResponse(
        entry = MyQueueEntry(
            id = "entry-1",
            sessionId = "session-1",
            status = QueueEntryStatus.RESERVED,
            type = QueueEntryType.ONLINE,
            tokenNumber = 12,
            tokenLabel = "A012",
            patientId = "p1",
            patientName = "Aarav Semwal",
            hospitalId = "h1",
            hospitalName = "Lotus Care",
            departmentName = "General Medicine",
            doctorName = "Dr. Sharma",
            scheduledStart = "2026-08-30T04:30:00.000Z",
            scheduledEnd = "2026-08-30T07:30:00.000Z",
            feePaise = 50_000,
            checkedInAheadCount = 0,
            bookedAheadCount = 0,
            joinedAt = "2026-08-30T04:00:00.000Z",
            cancellable = true,
            refundPctIfCancelledNow = 100,
        ),
        razorpayOrderId = "order_ABC123",
        razorpayKeyId = "rzp_test_key",
        amountPaise = 50_000,
        currency = "INR",
        callbackUrl = "https://api.example.com/webhooks/checkout-complete",
    )

    private fun options(): JSONObject {
        val html = checkoutHtml(order, "Lotus Care")
        val start = html.indexOf("var options = ") + "var options = ".length
        val end = html.indexOf("\n", start)
        return JSONObject(html.substring(start, end).trimEnd(';'))
    }

    @Test
    fun `redirect mode is on - the reason netbanking works at all`() {
        // By default Checkout sends the patient to their bank through window.open. A
        // WebView returns NULL from that call, Checkout reads null as "popup blocked", and
        // every netbanking and wallet attempt aborts with "please use another method" -
        // sitting at status `created` on Razorpay's side, never reaching the bank.
        assertEquals(true, options().getBoolean("redirect"))
    }

    @Test
    fun `the callback url comes from the server, verbatim`() {
        // It has to be a real, publicly reachable address for the gateway to accept it,
        // and only the server knows what that is. Hardcoding it on both sides is how the
        // two silently drift apart - the first attempt did exactly that and pointed at a
        // path that does not exist.
        assertEquals(order.callbackUrl, options().getString("callback_url"))
    }

    @Test
    fun `no amount is ever sent`() {
        // A client that could name an amount is the single most exploitable payment bug
        // there is (docs/Rules.md 9). Razorpay takes the amount from the ORDER, which the
        // server created from the session fee.
        val json = options().toString()
        assertFalse("amount must not appear in the checkout options", json.contains("amount"))
        assertFalse(json.contains("50000"))
        assertEquals(order.razorpayOrderId, options().getString("order_id"))
    }

    @Test
    fun `the publishable key is used, and it is the server's`() {
        assertEquals(order.razorpayKeyId, options().getString("key"))
    }

    @Test
    fun `the bridge is named the same as the RN app's`() {
        // The page is the contract. Keeping `ReactNativeWebView` means this HTML is
        // byte-identical to apps/mobile's, so the two clients cannot drift in how they
        // report a result - even though nothing here is React Native.
        val html = checkoutHtml(order, "Lotus Care")
        assertTrue(html.contains("window.ReactNativeWebView.postMessage"))
    }

    @Test
    fun `the description names the department and token`() {
        assertEquals(
            "General Medicine · Token A012",
            options().getString("description"),
        )
    }

    @Test
    fun `a hospital name with quotes cannot break out of the script`() {
        // The name is server data rendered into a <script> block. JSONObject escapes it;
        // string concatenation would not, and the page would simply fail to parse - on the
        // payment screen, after the patient has committed to paying.
        val html = checkoutHtml(order, """Lotus "Care" </script><script>alert(1)""")
        assertFalse(
            "a quote in the hospital name must not terminate the script tag",
            html.contains("</script><script>alert(1)"),
        )
    }
}
