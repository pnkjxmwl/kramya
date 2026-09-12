import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Paginated, SessionCard } from '@opd/contracts';
import { useApi } from '../../../../lib/api';
import {
  DoctorQueueRow,
  LiveState,
  MoreNote,
  PAGE,
  QueryState,
  SessionCardView,
} from '../../../../lib/discovery';
import { useLiveSessions } from '../../../../lib/realtime';
import { bookingStateFor, useMyActiveEntries } from '../../../../lib/visits';
import { ListGroup, SectionLabel } from '../../../../lib/ui';
import { theme } from '../../../../theme';

/**
 * Department queue - screen 3 of docs/design_handoff_opd_queue, and the screen the
 * whole browse path exists to reach.
 *
 * The handoff's shape: the first doctor gets the primary card - avatar, hours, the
 * live mark, both tokens, the queue strip and the join action - and everyone else in
 * the department is a compact row under an "ALSO IN CARDIOLOGY" heading.
 *
 * **The lead card is `SessionCardView`, the same component doctor/[id] lists.** They
 * were about to be two components with the same content at two sizes; the handoff's
 * primary card IS the session card, so there is one, and the compact form is the only
 * thing that needed writing.
 *
 * Tapping either still opens the session screen, which is where the address, the
 * doctor's presence and the second-patient booking live. The card's own button joins.
 * No date picker: "today" is the server's IST today. A phone's own clock is wrong for
 * the half hour after IST midnight, so the date is deliberately not sent.
 */
export default function DepartmentSessions() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // What this account already holds, for every card on the page at once.
  const myBookings = useMyActiveEntries();

  const sessions = useApi<Paginated<SessionCard>>(`/departments/${id}/sessions?limit=${PAGE}`);

  // Live for every session in this department, not just the one a patient has opened
  // (P7-MOB-01). Each card carries a queue that moves on its own; without this the
  // numbers sat frozen until the screen was navigated away from and back.
  const items = sessions.data?.items ?? [];
  const { connected } = useLiveSessions(items.map((card) => card.id));

  const lead = items[0];
  const others = items.slice(1);

  return (
    <>
      <Stack.Screen
        options={{
          title: lead?.departmentName ?? 'Today',
          // The handoff's "‹ Sunrise". The first word, because a back label competes
          // with the centred title for the same 44pt bar and "Sunrise
          // Multispeciality Hospital" wins that fight by truncating the title.
          headerBackTitle: lead ? (lead.hospitalName.split(' ')[0] ?? 'Back') : 'Back',
        }}
      />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={sessions.isFetching && !sessions.isPending}
            onRefresh={() => void sessions.refetch()}
            tintColor={theme.color.inkTertiary}
            colors={[theme.color.ink]}
          />
        }
      >
        {/*
          Above the numbers it invalidates, not below them. A dropped socket freezes
          this card rather than clearing it, and a frozen "3 ahead of you" is
          indistinguishable from a true one.
        */}
        {!connected && items.length > 0 ? (
          <View style={styles.liveState}>
            <LiveState connected={connected} />
          </View>
        ) : null}

        {lead ? (
          <SessionCardView
            card={lead}
            onPress={() => router.push({ pathname: '/session/[id]', params: { id: lead.id } })}
            onJoin={() => router.push(`/join?sessionId=${lead.id}`)}
            onOpenToken={(entryId) => router.push(`/visit/${entryId}`)}
            // One request for the whole list, sliced per card - never one per card.
            booking={bookingStateFor(myBookings.bySession.get(lead.id))}
          />
        ) : (
          <QueryState
            pending={sessions.isPending}
            error={sessions.error}
            isEmpty={sessions.isSuccess}
            emptyText="No OPD sessions here today. Try another department."
            onRetry={() => void sessions.refetch()}
          />
        )}

        {others.length > 0 ? (
          <>
            <View style={styles.alsoLabel}>
              <SectionLabel>{`Also in ${lead?.departmentName ?? ''}`}</SectionLabel>
            </View>
            <ListGroup inset={66}>
              {others.map((card) => (
                <DoctorQueueRow
                  key={card.id}
                  card={card}
                  onPress={() => router.push({ pathname: '/session/[id]', params: { id: card.id } })}
                  onJoin={() => router.push(`/join?sessionId=${card.id}`)}
                  onOpenToken={(entryId) => router.push(`/visit/${entryId}`)}
                  booking={bookingStateFor(myBookings.bySession.get(card.id))}
                />
              ))}
            </ListGroup>
          </>
        ) : null}

        {sessions.data ? (
          <MoreNote shown={sessions.data.items.length} total={sessions.data.total} />
        ) : null}

        {lead ? <Text style={styles.footnote}>Tap a doctor for the full session details.</Text> : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: theme.color.canvas },
  content: {
    paddingHorizontal: theme.gutter,
    paddingTop: 22,
    paddingBottom: theme.space[8],
  },
  liveState: { flexDirection: 'row', marginBottom: theme.space[3] },
  alsoLabel: { paddingTop: 30, paddingBottom: 10 },
  footnote: {
    ...theme.font.caption,
    fontSize: 12,
    color: theme.color.inkTertiary,
    textAlign: 'center',
    marginTop: theme.space[5],
  },
});
