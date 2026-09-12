import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MeResponse, Patient } from '@opd/contracts';
import { useApi } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { useCity } from '../../../lib/city';
import { QueryState, Row } from '../../../lib/discovery';
import { Avatar, Button, ListGroup, Screen, SectionLabel } from '../../../lib/ui';
import { theme } from '../../../theme';

/** The account: who you are, who you book for, and the way out. */
export default function Profile() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { city } = useCity();

  const me = useApi<MeResponse>('/me');
  // Same cache key home uses, so this costs nothing on a warm app.
  const patients = useApi<Patient[]>('/patients');
  const self = patients.data?.find((p) => p.relation === 'SELF');
  const count = patients.data?.length ?? 0;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.identity}>
          <Avatar name={self?.name ?? me.data?.email ?? '?'} size={56} />
          <View style={styles.identityText}>
            {/* H3, not a title. This is a list screen with a person at the top of it,
                not a title page - at 28px the name outweighed every row beneath it. */}
            <Text style={styles.name}>{self?.name ?? 'Your account'}</Text>
            <Text style={styles.email}>{me.data?.email ?? ' '}</Text>
          </View>
        </View>

        <QueryState pending={me.isPending} error={me.error} onRetry={() => void me.refetch()} />

        <View style={styles.label}>
          <SectionLabel>Booking</SectionLabel>
        </View>
        <ListGroup inset={theme.gutter}>
          <Row
            title="Family profiles"
            subtitle={
              count === 0
                ? 'Add the people you book for'
                : `${count} ${count === 1 ? 'person' : 'people'}`
            }
            padH={theme.gutter}
            onPress={() => router.push('/profile/patients')}
          />
          <Row
            title="City"
            subtitle={city ?? 'Not set'}
            padH={theme.gutter}
            onPress={() => router.push('/location')}
          />
        </ListGroup>

        <View style={styles.label}>
          <SectionLabel>Your visits</SectionLabel>
        </View>
        <ListGroup inset={theme.gutter}>
          {/*
            This once said "your tokens and past visits will appear here once booking
            is switched on" - written in Phase 3, still on screen four phases after
            booking shipped and a Visits tab appeared next to this one. Stale copy
            that describes a product as unfinished is worse than no copy.
          */}
          <Row
            title="Tokens and past visits"
            subtitle="Open the Visits tab"
            padH={theme.gutter}
            onPress={() => router.push('/visits')}
          />
        </ListGroup>

        <View style={styles.signOut}>
          <Button title="Sign out" variant="secondary" icon="log-out" onPress={() => void signOut()} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: theme.gutter,
    paddingTop: theme.space[2],
    paddingBottom: theme.space[8],
  },
  title: { ...theme.font.display, color: theme.color.ink },

  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[4],
    marginTop: theme.space[6],
  },
  identityText: { flex: 1, gap: 3 },
  name: { ...theme.font.h3, fontSize: 19, color: theme.color.ink },
  email: { ...theme.font.caption, color: theme.color.inkTertiary },

  label: { paddingTop: 30, paddingBottom: 10 },
  signOut: { marginTop: theme.space[8] },
});
