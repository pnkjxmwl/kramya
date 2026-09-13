package app.kramya.net

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * The city the patient is browsing, remembered between launches.
 * Mirror of apps/mobile/lib/city.tsx.
 *
 * **A DISPLAY FILTER, never an authority.** docs/Rules.md 1 keeps the backend the only
 * source of truth: this value is passed as `?city=` and the server does the filtering,
 * exactly as it does for a caller who has never opened the app before. Nothing about
 * queue state, prices or permissions is decided here.
 *
 * Plain SharedPreferences, not the encrypted store.
 *
 * lib/city.tsx puts this in expo-secure-store and says why: SecureStore was the only
 * key-value store already in the project, AsyncStorage was not a dependency, and a city
 * is not a secret. Android has SharedPreferences built in, so the workaround is
 * unnecessary here - and keeping one city name out of the keystore means the encrypted
 * store holds nothing but credentials.
 */
class CityStore(context: Context) {

    private val prefs = context.getSharedPreferences("kramya.prefs", Context.MODE_PRIVATE)

    private val _city = MutableStateFlow(prefs.getString(CITY_KEY, null))

    /** Null once loaded and nothing is stored - the first-run case. */
    val city: StateFlow<String?> = _city.asStateFlow()

    /**
     * Always true, and kept for the shape.
     *
     * lib/city.tsx has to expose a `ready` flag because SecureStore reads asynchronously,
     * and a screen that decided before the read finished would show the first-run city
     * picker to somebody who had already chosen one. SharedPreferences is loaded
     * synchronously at construction, so that window does not exist here - but the screens
     * are ports of screens that check it, and removing the check would be a silent
     * behavioural edit rather than a simplification.
     */
    val ready: Boolean = true

    fun setCity(next: String) {
        _city.value = next
        prefs.edit().putString(CITY_KEY, next).apply()
    }

    private companion object {
        const val CITY_KEY = "opd.city"
    }
}
