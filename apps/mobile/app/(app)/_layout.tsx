import { Tabs, router } from 'expo-router';
import { Platform, StyleSheet, Text } from 'react-native';
import { Icon, type IconName } from '../../lib/icon';
import { theme } from '../../theme';

/**
 * The signed-in shell: a bottom tab bar.
 *
 * Each tab owns its own Stack, so the tab bar stays visible while a detail screen is
 * pushed. That is the whole point: without it, a patient five screens deep into
 * city -> hospital -> department -> session has no way back to the top but to press
 * back five times.
 *
 * Redrawn to the handoff's bar: 82pt tall on iOS (a 49pt bar plus the home-indicator
 * inset), 22pt line glyphs, 10pt labels, ink for the active item and #8A8A8E for the
 * rest, over a 0.5px top hairline.
 *
 * **No blur.** The handoff specifies `rgba(247,247,248,0.86)` over `blur(24px)`;
 * expo-blur is a native module we do not have and docs/CLAUDE.md 2 forbids adding
 * one for a decoration. A translucent bar with nothing blurring behind it is worse
 * than an opaque one - content shows through at full sharpness - so the bar is
 * opaque canvas and the hairline does the separating. See theme.color.bar.
 */

/**
 * The label, rendered rather than styled.
 *
 * `tabBarLabelStyle` is one style for both states, so it cannot carry the handoff's
 * weight change - 600 when active, 400 when not. Three lines here beats three
 * near-identical copies in the options below.
 */
const label = (text: string) =>
  function TabLabel({ focused, color }: { focused: boolean; color: string }) {
    return <Text style={[styles.label, { color }, focused && styles.labelActive]}>{text}</Text>;
  };

const icon = (name: IconName) =>
  function TabIcon({ color }: { color: string }) {
    return <Icon name={name} size={22} color={color} />;
  };

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.color.ink,
        tabBarInactiveTintColor: theme.color.inkTertiary,
        tabBarStyle: {
          backgroundColor: theme.color.bar,
          borderTopColor: theme.color.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === 'ios' ? 82 : 64,
          paddingTop: 10,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
        },
        tabBarItemStyle: { paddingVertical: 0 },
      }}
    >
      <Tabs.Screen
        name="(discover)"
        options={{ tabBarLabel: label('Discover'), tabBarIcon: icon('compass') }}
      />
      <Tabs.Screen
        name="(visits)"
        // "Visits", the handoff's word. The SCREEN is still titled "My Visits" - a
        // tab label has ten pixels of height and no room for a possessive.
        options={{ tabBarLabel: label('Visits'), tabBarIcon: icon('clipboard') }}
        /*
          Always open on the list.

          Booking pushes `join` onto THIS tab's stack and then replaces it with the
          token, so after paying the tab was left parked on a single token card -
          tapping My Visits showed that one token instead of the list, and with two
          bookings there was no way to the second without pressing back.

          `navigate` pops back to the list if it is already in the stack rather than
          stacking another copy. Deliberately NOT preventDefault: the default tab
          switch still runs, so if this ever stops working the tab still opens.
        */
        listeners={{ tabPress: () => router.navigate('/visits') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ tabBarLabel: label('Profile'), tabBarIcon: icon('user') }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: {
    ...theme.font.tab,
    fontFamily: theme.fontFamily.regular,
    fontWeight: '400',
    marginTop: 4,
  },
  labelActive: { fontFamily: theme.fontFamily.semibold, fontWeight: '600' },
});
