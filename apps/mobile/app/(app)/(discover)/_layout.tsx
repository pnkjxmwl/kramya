import { Stack } from 'expo-router';
import { theme } from '../../../theme';

/**
 * The Discover tab's stack, and the header treatment every other tab imports.
 *
 * A nested navigator inherits NOTHING from the root, so each tab must set its own -
 * which is why this is exported rather than copied: two copies of the same styling
 * drift the moment one is edited.
 *
 * This is the handoff's nav bar: a 44pt bar over the status inset, the title at
 * 16/600/-0.4 in ink, a back chevron in ink, and a 0.5px bottom hairline.
 *
 * **`headerShadowVisible` is now true, reversing the teal system.** That flag maps to
 * the iOS navigation bar's shadow image - the hairline - not to a drop shadow. It was
 * off because the old bar was white against a grey canvas and had its own edge. This
 * bar is the SAME colour as the content beneath it (both #F7F7F8, per the handoff),
 * so with the hairline off the bar simply dissolved and titles floated over scrolling
 * content with nothing between them.
 *
 * The back chevron's trailing label is left to the platform: iOS shows the previous
 * screen's title next to it, which is exactly the handoff's "‹ Sunrise".
 */
export const stackOptions = {
  headerStyle: { backgroundColor: theme.color.bar },
  headerTintColor: theme.color.ink,
  headerTitleStyle: {
    fontSize: 16,
    fontFamily: theme.fontFamily.semibold,
    fontWeight: '600' as const,
    letterSpacing: -0.4,
    color: theme.color.ink,
  },
  headerTitleAlign: 'center' as const,
  headerShadowVisible: true,
  contentStyle: { backgroundColor: theme.color.canvas },
} as const;

export default function DiscoverLayout() {
  return (
    <Stack screenOptions={stackOptions}>
      {/* Home draws its own header block, so the navigator's is off here only. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/*
        The hospital screen bleeds a photograph under the status bar and floats its
        own glass back button over it, the way the handoff does - so it has no nav
        bar at all. Set here rather than in the screen so the header never flashes
        in before the screen's own options apply.
      */}
      <Stack.Screen name="hospital/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
