package app.kramya

import app.kramya.ui.queueFreshness
import org.junit.Assert.*
import org.junit.Test

class QueueFreshnessTest {
    @Test fun `connected socket does not make an old or failed snapshot current`() {
        assertFalse(queueFreshness(1_000, 121_000, true, false).current)
        assertFalse(queueFreshness(1_000, 2_000, true, true).current)
        assertFalse(queueFreshness(0, 2_000, true, false).current)
    }
    @Test fun `fresh REST receipt remains useful while socket reconnects`() {
        val state = queueFreshness(1_000, 61_000, false, false)
        assertTrue(state.current)
        assertTrue(state.message.contains("Live connection interrupted"))
        assertTrue(state.message.contains("1 minute ago"))
    }
}
