import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Paginated, PublicDoctor, SessionCard } from '@opd/contracts';
import { useApi } from '../../../../lib/api';
import { LiveState, MoreNote, PAGE, QueryState, SessionCardView } from '../../../../lib/discovery';
import { useLiveSessions } from '../../../../lib/realtime';
import { bookingStateFor, useMyActiveEntries } from '../../../../lib/visits';
import { Avatar, Hairline, SectionLabel } from '../../../../lib/ui';
import { theme } from '../../../../theme';

/**
 * A doctor and the sessions they are running today.
 *
 * "Running", not "booked for": after a substitution (docs/PRD.md 8.11) the API
 * matches on the current provider, so a covering doctor's page shows the clinic they
 * are actually taking.
 *
 * The header borrows the place card from screen 2 - a name at card-title size over a
 * tracked eyebrow, with the facts as one quiet line - so a doctor and a hospital read
 * as the same kind of object at the top of a screen.
 */
export default function Doctor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // What this account already holds, for every card on the page at once.
  const myBookings = useMyActiveEntries();

  const doctor = useApi<PublicDoctor>(`/doctors/${id}`);
  const sessions = useApi<Paginated<SessionCard>>(`/doctors/${id}/sessions?limit=${PAGE}`);

  // Live for every session this doctor is running, not just the one a patient has
  // opened (P7-MOB-01). Without this the numbers sat frozen until the screen was
  // navigated away from and back.
  const items = sessions.data?.items ?? [];
  const { connected } = useLiveSessions(items.map((card) => card.id));

  const data = doctor.data;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: data?.name ?? 'Doctor' }} />

      <View style={styles.about}>
        {data ? (
          <>
            <Avatar name={data.name} size={56} />
            <Text style={styles.eyebrow}>
              {(data.specialization ?? data.departmentName).toUpperCase()}
            </Text>
            <Text style={styles.name}>{data.name}</Text>
            <Text style={styles.meta}>
              {data.hospitalName} · {data.hospitalCity}
            </Text>
            <Hairline style={styles.rule} />
            <Text style={styles.footnote}>
              About {data.defaultConsultMins} minutes per patient.
            </Text>
          </>
        ) : (
          <QueryState
            pending={doctor.isPending}
            error={doctor.error}
            onRetry={() => void doctor.refetch()}
            skeletonRows={1}
          />
        )}
      </View>

      <View style={styles.label}>
        <SectionLabel>Today&apos;s sessions</SectionLabel>
      </View>

      {!connected && items.length > 0 ? (
        <View style={styles.liveState}>
          <LiveState connected={connected} />
        </View>
      ) : null}

      <View style={styles.cards}>
        {items.map((item) => (
          <SessionCardView
            key={item.id}
            card={item}
            onPress={() => router.push({ pathname: '/session/[id]', params: { id: item.id } })}
            onJoin={() => router.push(`/join?sessionId=${item.id}`)}
            onOpenToken={(entryId) => router.push(`/visit/${entryId}`)}
            // One request for the whole list, sliced per card - never one per card.
            booking={bookingStateFor(myBookings.bySession.get(item.id))}
          />
        ))}
      </View>

      {items.length === 0 ? (
        <QueryState
          pending={sessions.isPending}
          error={sessions.error}
          isEmpty={sessions.isSuccess}
          emptyText="This doctor has no OPD today."
          onRetry={() => void sessions.refetch()}
        />
      ) : null}

      {sessions.data ? (
        <MoreNote shown={sessions.data.items.length} total={sessions.data.total} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: theme.color.canvas },
  content: { paddingHorizontal: theme.gutter, paddingTop: 22, paddingBottom: theme.space[8] },

  about: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.group,
    padding: theme.gutter,
    ...theme.elevation.card,
  },
  eyebrow: { ...theme.font.overline, color: theme.color.inkTertiary, marginTop: theme.space[4] },
  name: { ...theme.font.h1, color: theme.color.ink, marginTop: theme.space[2] },
  meta: {
    fontSize: 14,
    lineHeight: 19,
    letterSpacing: -0.2,
    fontFamily: theme.fontFamily.regular,
    color: theme.color.inkSecondary,
    marginTop: theme.space[2],
  },
  rule: { marginTop: 20 },
  footnote: { ...theme.font.caption, color: theme.color.inkTertiary, marginTop: theme.space[4] },

  label: { paddingTop: 30, paddingBottom: 10 },
  liveState: { flexDirection: 'row', marginBottom: theme.space[3] },
  cards: { gap: theme.space[4] },
});
