import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MeResponse, Patient } from '@opd/contracts';
import { useApi } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { useCity } from '../../../lib/city';
import { QueryState, Row } from '../../../lib/discovery';
import { Avatar, ListGroup, Screen, SectionLabel, pressable } from '../../../lib/ui';
import { theme } from '../../../theme';

/**
 * The account: who you are, who you book for, and the way out.
 *
 * **Direction C, chosen from the mockups** - the quietest of the five, and the only
 * one with nothing decorative on it. There is no card and no stats trio: a 76pt
 * avatar, the name AS the screen title, the email under it, then grouped rows.
 *
 * The four rejected directions all differed only in the top quarter and kept an
 * identical list underneath, which is what finally showed that the header was never
 * the problem. What makes this version work where an earlier centred one did not is
 * the rows: each carries its value as a SECOND LINE rather than right-aligned against
 * the chevron, so "Family profiles / You, Aarav" answers the question the row asks
 * instead of just labelling it. A settings row that names the people is worth more
 * than one that counts them.
 */
export default function Profile() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { city } = useCity();

  const me = useApi<MeResponse>('/me');
  // Same cache key home uses, so this costs nothing on a warm app.
  const patients = useApi<Patient[]>('/patients');
  const people = patients.data ?? [];
  const self = people.find((p) => p.relation === 'SELF');

  // "You, Aarav" - the first names, with SELF spoken as "You". First names only
  // because the row is one line and a family shares a surname.
  const who = people
    .map((p) => (p.relation === 'SELF' ? 'You' : (p.name.split(' ')[0] ?? p.name)))
    .join(', ');

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.identity}>
          <Avatar name={self?.name ?? me.data?.email ?? '?'} size={76} />
          <Text style={styles.name} numberOfLines={1}>
            {self?.name ?? 'Your account'}
          </Text>
          <Text style={styles.email} numberOfLines={1}>
            {me.data?.email ?? ' '}
          </Text>
        </View>

        <QueryState pending={me.isPending} error={me.error} onRetry={() => void me.refetch()} />

        <View style={styles.label}>
          <SectionLabel>Booking</SectionLabel>
        </View>
        {/* 18 of row padding + a 36 glyph + the row's own 14 gap: the hairline starts
            where the text does, which is the whole point of an inset separator. */}
        <ListGroup inset={68}>
          <Row
            icon="users"
            title="Family profiles"
            subtitle={who === '' ? 'Add the people you book for' : who}
            padH={18}
            onPress={() => router.push('/profile/patients')}
          />
          <Row
            icon="map-pin"
            title="City"
            subtitle={city ?? 'Not set'}
            padH={18}
            // This tab's own copy of the picker, NOT `/location`. That route lives in
            // the Discover stack, so pushing it from here crossed tabs and dismissed
            // back onto the Discover home screen.
            onPress={() => router.push('/profile/city')}
          />
        </ListGroup>

        <View style={styles.label}>
          <SectionLabel>About</SectionLabel>
        </View>
        <ListGroup inset={68}>
          {/*
            A real version, from the manifest the running bundle was built from -
            expo-constants is already a dependency. It earns its row: it is the first
            thing any support conversation asks for, and an app with no way to answer
            makes the person guess.
          */}
          <Row
            icon="info"
            title="Version"
            meta={Constants.expoConfig?.version ?? '—'}
            padH={18}
            // Reports, does not navigate - so no chevron, and the tap does nothing.
            onPress={() => {}}
            trailing={<View />}
          />
        </ListGroup>

        <View style={styles.label}>
          <SectionLabel>Account</SectionLabel>
        </View>
        <ListGroup>
          {/* Centred, red, no chevron: iOS puts the destructive action in its own
              group and gives it no destination, because it has none. */}
          <Pressable
            onPress={() => void signOut()}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            {...pressable(0)}
          >
            <View style={styles.signOut}>
              <Text style={styles.signOutText}>Sign out</Text>
            </View>
          </Pressable>
        </ListGroup>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: theme.gutter,
    paddingTop: theme.space[6],
    paddingBottom: theme.space[8],
  },

  // No screen title. The name IS the title - a "Profile" heading above someone's own
  // name is the app narrating itself.
  identity: { alignItems: 'center', gap: 3 },
  name: { ...theme.font.h2, color: theme.color.ink, marginTop: theme.space[4] },
  email: { ...theme.font.caption, color: theme.color.inkTertiary },

  label: { paddingTop: 30, paddingBottom: 10 },

  signOut: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  signOutText: {
    fontSize: 16,
    letterSpacing: -0.4,
    fontFamily: theme.fontFamily.medium,
    fontWeight: '500',
    color: theme.color.danger.fg,
  },
});
