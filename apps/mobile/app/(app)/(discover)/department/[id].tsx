import { useRef, useState } from 'react';
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
 * The handoff's shape: one doctor gets the primary card - avatar, hours, the live
 * mark, both tokens, the queue strip and the join action - and the whole department
 * is listed as compact rows beneath it, the current one tinted.
 *
 * **The lead card is `SessionCardView`, the same component doctor/[id] lists.** They
 * were about to be two components with the same content at two sizes; the handoff's
 * primary card IS the session card, so there is one, and the compact form is the only
 * thing that needed writing.
 *
 * **Tapping a row shows it on the card above**; it does not navigate, and it does not
 * remove the row from the list - the list is the department and it stays put.
 * Screen 1 selects a hospital the same way, and a screen where the big card is a fixed
 * first-of-list while identical rows beneath it jump elsewhere teaches two rules for
 * one layout. The lead card is the way out: tapping IT opens the session screen, where
 * the address, the doctor's presence and the second-patient booking live, and its own
 * button joins. The row's trailing pill still joins directly, which is the handoff's
 * design for it.
 *
 * No date picker: "today" is the server's IST today. A phone's own clock is wrong for
 * the half hour after IST midnight, so the date is deliberately not sent.
 */
export default function DepartmentSessions() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);
  // What this account already holds, for every card on the page at once.
  const myBookings = useMyActiveEntries();

  const sessions = useApi<Paginated<SessionCard>>(`/departments/${id}/sessions?limit=${PAGE}`);

  // Live for every session in this department, not just the one a patient has opened
  // (P7-MOB-01). Each card carries a queue that moves on its own; without this the
  // numbers sat frozen until the screen was navigated away from and back.
  const items = sessions.data?.items ?? [];
  const { connected } = useLiveSessions(items.map((card) => card.id));

  // Which session the lead card is showing. Falls back to the first, which also covers
  // the selected one leaving the list on a refetch - a session that ended, say.
  const lead = items.find((card) => card.id === selectedId) ?? items[0];
  /*
    EVERY session, including the one on the card above.

    It used to exclude the lead, so selecting the second doctor swapped the two: the
    one you tapped rose out of the list and the previous lead dropped into its place.
    The list you were reading reordered itself underneath your finger, and with six
    sessions it was impossible to keep track of which you had already looked at.

    A stable list with the current one tinted is what Discover already does with its
    VIEWING marker, and it is the handoff's own device on screen 2 - a selected
    department is marked in place, not lifted out.
  */
  const all = items;

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
        ref={scroll}
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

        {all.length > 1 ? (
          <>
            <View style={styles.alsoLabel}>
              {/* "Also in" was right when the lead was excluded. The list is now the
                  whole department, so it says so - and the count is worth stating,
                  because it is the thing the screen exists to answer. */}
              <SectionLabel>{`All ${all.length} today`}</SectionLabel>
            </View>
            <ListGroup inset={66}>
              {all.map((card) => (
                <DoctorQueueRow
                  key={card.id}
                  card={card}
                  selected={card.id === lead?.id}
                  // Same reason as Discover: the card this updates is above the fold
                  // by the time these rows are in reach, and silent feedback reads as
                  // a dead tap.
                  onPress={() => {
                    setSelectedId(card.id);
                    scroll.current?.scrollTo({ y: 0, animated: true });
                  }}
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

        {lead ? (
          <Text style={styles.footnote}>
            {all.length > 1
              ? 'Tap a doctor to see their queue. Tap the card above for full details.'
              : 'Tap the card above for full session details.'}
          </Text>
        ) : null}
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
