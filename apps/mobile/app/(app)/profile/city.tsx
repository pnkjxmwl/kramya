/**
 * The city picker, as a route the PROFILE tab owns.
 *
 * The screen itself lives in `(discover)/location.tsx`; this file only puts a second
 * door on it.
 *
 * **Why a second route rather than one shared one.** Each tab owns its own Stack
 * (see `(app)/_layout.tsx`), and a route belongs to exactly one of them. `/location`
 * is inside the `(discover)` group, so pushing it from Profile switched to the
 * Discover tab, opened the picker there, and `router.back()` then popped to
 * Discover's own index - you chose a city from Settings and landed on the home
 * screen, in a different tab, with the Profile stack abandoned behind you.
 *
 * Registering the screen in both stacks is the standard React Navigation answer to a
 * destination two tabs both need, and it keeps each tab's back stack honest. The
 * component is imported, not copied, so there is exactly one city picker.
 */
export { default } from '../(discover)/location';
