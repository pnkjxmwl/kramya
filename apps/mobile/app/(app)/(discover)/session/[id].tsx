import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Patient, SessionDetail } from '@opd/contracts';
import { useApi } from '../../../../lib/api';
import { Icon } from '../../../../lib/icon';
import {
  LiveState,
  PresencePill,
  QueryState,
  SessionCardView,
} from '../../../../lib/discovery';
import { calendarDate, istRange, rupees } from '../../../../lib/format';
import { Card, KeyValue, SectionLabel, pressable } from '../../../../lib/ui';
import { bookingStateFor, useMyActiveEntries } from '../../../../lib/visits';
import { useLiveSession } from '../../../../lib/realtime';
import { theme } from '../../../../theme';

/**
 * One session in full.
 *
 * Everything shown here is decided by the server. `registrationOpen` in particular is
 * never recomputed on the phone (docs/Rules.md 1, docs/CLAUDE.md 9).
 *
 * This screen is a LEAF: it links nowhere. It briefly carried a "see this doctor's
 * other sessions" link back to /doctor/[id], which made session <-> doctor the only
 * cycle in the app - every round trip pushed two more screens. Deleted rather than
 * bounded, because the link was also redundant: a Doctor has exactly one
 * departmentId, so that doctor's sessions are always a SUBSET of the department list
 * the user came from. The navigation graph is a DAG.
 *
 * **The sticky bottom action bar is gone.** It existed because this screen's numbers
 * were a flat list of label/value rows with nothing to act on, so the action had to
 * be pinned somewhere. The head of the screen is now the handoff's primary card,
 * which carries its own join button exactly as it does on the department screen -
 * and two competing primary actions on one short screen is worse than one that is
 * three lines further up.
 */
/**
 * The safety net behind the socket, not the way this screen stays current.
 *
 * `useLiveSession` subscribes to this session's room and every command in it
 * invalidates this query, so the numbers move when the QUEUE moves rather than when a
 * timer fires. A slow poll stays because a phone's socket dies in ways a phone does
 * not notice - a lift, a hospital basement, an OS that suspended the app. Ninety
 * seconds is invisible when the socket is healthy and is the difference between
 * "briefly stale" and "silently wrong" when it is not.
 */
const FALLBACK_POLL_MS = 90_000;

export default function Session() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const session = useApi<SessionDetail>(`/sessions/${id}`, true, FALLBACK_POLL_MS);
  const data = session.data;

  // Live for as long as this screen is open (P7-MOB-01). Unsubscribes on unmount, so
  // a patient browsing ten doctors does not end up listening to ten queues.
  const { connected } = useLiveSession(id);

  // What this account already holds here, and whether anyone is left to book for.
  // Both are server data; joining them is rendering, not a queue decision.
  const myBookings = useMyActiveEntries();
  const patients = useApi<Patient[]>('/patients');
  const mine = myBookings.bySession.get(id);
  const booking = bookingStateFor(mine);
  const bookedPatientIds = new Set((mine ?? []).map((entry) => entry.patientId));
  const unbookedProfiles = (patients.data ?? []).filter(
    (person) => !bookedPatientIds.has(person.id),
  ).length;

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: data?.doctorName ?? 'Session',
          headerBackTitle: data ? (data.departmentName.split(' ')[0] ?? 'Back') : 'Back',
        }}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        // The socket covers the ordinary case; this is for the patient who wants to
        // know NOW, and it is the gesture they will try first regardless.
        refreshControl={
          <RefreshControl
            refreshing={session.isFetching && !session.isPending}
            onRefresh={() => void session.refetch()}
            tintColor={theme.color.inkTertiary}
            colors={[theme.color.ink]}
          />
        }
      >
        <QueryState
          pending={session.isPending}
          error={session.error}
          onRetry={() => void session.refetch()}
          skeletonRows={3}
        />

        {data ? (
          <>
            {/*
              Above the numbers it invalidates. A dropped socket freezes this card
              rather than clearing it, and a frozen queue position is
              indistinguishable from a true one.
            */}
            {!connected ? (
              <View style={styles.liveState}>
                <LiveState connected={connected} />
              </View>
            ) : null}

            <SessionCardView
              card={data}
              onJoin={() => router.push(`/join?sessionId=${id}`)}
              onOpenToken={(entryId) => router.push(`/visit/${entryId}`)}
              booking={booking}
            />

            {/*
              Booking a SECOND patient into a session you are already in is allowed -
              the server's check is scoped to (session, patient), not to the account -
              so a family can hold two tokens. Shown only when there is genuinely
              someone left to book for AND the server still says registration is open,
              because an action that leads to a refusal is worse than no action.

              Only on this screen, never on the cards: a list has no room to explain a
              second action, and the card is itself a tap target.
            */}
            {booking.kind === 'booked' && unbookedProfiles > 0 && data.snapshot.registrationOpen ? (
              <Pressable
                onPress={() => router.push(`/join?sessionId=${id}`)}
                accessibilityRole="button"
                accessibilityLabel="Book this session for another patient"
                {...pressable(theme.radius.full)}
              >
                {/* Feedback on the Pressable, visuals on the View (trap 24). */}
                <View style={styles.secondary}>
                  <Icon name="user-plus" size={16} color={theme.color.ink} />
                  <Text style={styles.secondaryText}>
                    Book for someone else · {rupees(data.feePaise)}
                  </Text>
                </View>
              </Pressable>
            ) : null}

            <View style={styles.label}>
              <SectionLabel>This session</SectionLabel>
            </View>
            <Card>
              <KeyValue label="Date" value={calendarDate(data.date)} />
              <KeyValue
                label="Hours"
                value={istRange(data.scheduledStart, data.scheduledEnd)}
              />
              {/* docs/PRD.md 7.3: two numbers, because "8 waiting" would be a
                  half-truth when five of them are still at home. */}
              <KeyValue
                label="Checked in and waiting"
                value={String(data.snapshot.checkedInCount)}
              />
              <KeyValue
                label="Booked, not arrived"
                value={String(data.snapshot.bookedNotArrivedCount)}
              />
              <KeyValue
                label="You would be seen"
                value={
                  data.snapshot.joinNowEtaFrom && data.snapshot.joinNowEtaTo
                    ? `~${istRange(data.snapshot.joinNowEtaFrom, data.snapshot.joinNowEtaTo)}`
                    : 'Not available yet'
                }
                emphasis
              />
              <KeyValue label="Consultation fee" value={rupees(data.feePaise)} />
              <View style={styles.pills}>
                <PresencePill presence={data.doctorPresence} />
              </View>
              {data.isSubstitute ? (
                <Text style={styles.footnote}>
                  Covering for the doctor this session was booked with.
                </Text>
              ) : null}
            </Card>

            <View style={styles.label}>
              <SectionLabel>Where</SectionLabel>
            </View>
            <Card>
              <Text style={styles.place}>{data.hospitalName}</Text>
              {data.hospitalAddress ? (
                <Text style={styles.muted}>{data.hospitalAddress}</Text>
              ) : null}
              {data.hospitalArea ? <Text style={styles.muted}>{data.hospitalArea}</Text> : null}
              <Text style={styles.footnote}>
                {data.doctorName} usually spends about {data.doctorDefaultConsultMins} minutes per
                patient.
              </Text>
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.canvas },
  content: {
    paddingHorizontal: theme.gutter,
    paddingTop: 22,
    paddingBottom: theme.space[8],
  },
  liveState: { flexDirection: 'row', marginBottom: theme.space[3] },

  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space[2],
    minHeight: 44,
    marginTop: theme.space[3],
    borderRadius: theme.radius.full,
    backgroundColor: theme.color.fillSecondary,
  },
  secondaryText: { ...theme.font.label, color: theme.color.ink },

  label: { paddingTop: 30, paddingBottom: 10 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2], paddingTop: theme.space[1] },
  place: { ...theme.font.h3, color: theme.color.ink },
  muted: { ...theme.font.caption, color: theme.color.inkSecondary },
  footnote: { ...theme.font.caption, color: theme.color.inkTertiary },
});
