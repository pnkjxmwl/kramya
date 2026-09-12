import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Patient, PatientRelation } from '@opd/contracts';
import { useAuth } from '../../../lib/auth';
import { Icon } from '../../../lib/icon';
import { QueryState } from '../../../lib/discovery';
import { Avatar, ErrorNote, Hairline, ListGroup, pressable } from '../../../lib/ui';
import { theme } from '../../../theme';

/**
 * The people this account books for (docs/PRD.md 6.1, family profiles).
 *
 * **This screen is now only the list.** It went through two shapes first: a
 * permanently expanded form above the list it added to, then the same form folded
 * behind a button at the bottom. Both kept a task and a record on one screen, so the
 * common case (who do I book for?) paid for the rare one (add someone), and the add
 * button sat below a list of unknown length where it could not be found.
 *
 * Adding is a `+` in the bar opening `add.tsx` as a modal - the iOS list-and-detail
 * shape, where the collection screen holds only the collection.
 *
 * **Deleting asks first.** It used to be one tap on a trash glyph, unconfirmed and
 * unrecoverable, on a row holding a family member's name - the only destructive
 * control in the patient app and the easiest to hit by accident. `Alert` is React
 * Native's own, so the confirmation costs no dependency.
 */
export default function Patients() {
  const router = useRouter();
  const { authedFetch } = useAuth();
  const queryClient = useQueryClient();

  const patients = useQuery({
    queryKey: ['/patients'],
    queryFn: async (): Promise<Patient[]> => {
      const res = await authedFetch('/patients');
      if (!res.ok) throw new Error('Could not load your profiles');
      return res.json() as Promise<Patient[]>;
    },
  });

  const removePatient = useMutation({
    mutationFn: async (id: string) => {
      const res = await authedFetch(`/patients/${id}`, { method: 'DELETE' });
      /*
        Say why, when the server says why.

        `QueueEntry.patient` and `Consultation.patient` are both `onDelete: Restrict`,
        so removing someone who has ever held a token is refused by the database. The
        old copy - "Could not remove this profile" - described that as a failure of
        the app. It is the record being protected, and the person deserves the reason.
      */
      if (!res.ok) {
        throw new Error(
          res.status === 409
            ? 'This person has a booking or a past visit, so their profile has to stay.'
            : 'Could not remove this profile',
        );
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['/patients'] }),
  });

  function confirmRemove(patient: Patient) {
    Alert.alert(
      `Remove ${patient.name}?`,
      'Their profile is deleted from your account. Tokens they already hold are not cancelled.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removePatient.mutate(patient.id) },
      ],
    );
  }

  const list = patients.data ?? [];

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Family profiles',
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/profile/add')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Add a profile"
              {...pressable(theme.radius.full)}
            >
              <Icon name="plus" size={22} color={theme.color.ink} />
            </Pressable>
          ),
        }}
      />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Every token names one of these people. Add anyone you book on behalf of.
        </Text>

        {list.length > 0 ? (
          <ListGroup inset={66}>
            {list.map((p) => (
              <View key={p.id} style={styles.row}>
                <Avatar name={p.name} size={38} />
                <View style={styles.rowText}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={styles.rowMeta}>{label(p.relation)}</Text>
                </View>
                <Pressable
                  onPress={() => confirmRemove(p)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${p.name}`}
                  hitSlop={8}
                  {...pressable(theme.radius.full)}
                >
                  <View style={styles.remove}>
                    <Icon name="trash-2" size={16} color={theme.color.inkTertiary} />
                  </View>
                </Pressable>
              </View>
            ))}
          </ListGroup>
        ) : (
          <QueryState
            pending={patients.isPending}
            error={patients.error}
            isEmpty={patients.isSuccess && list.length === 0}
            emptyText="No profiles yet. Tap + to add yourself first."
            onRetry={() => void patients.refetch()}
          />
        )}

        {removePatient.error && (
          <View style={styles.error}>
            <ErrorNote message={(removePatient.error as Error).message} />
          </View>
        )}

        <Hairline style={styles.footRule} />
        <Text style={styles.footnote}>
          A profile is who a booking is for — it is not a separate login. Everyone here
          books through this one account.
        </Text>
      </ScrollView>
    </>
  );
}

/** SELF -> "Myself", MOTHER -> "Mother". */
function label(relation: PatientRelation): string {
  if (relation === 'SELF') return 'Myself';
  return relation.charAt(0) + relation.slice(1).toLowerCase();
}

const styles = StyleSheet.create({
  screen: { backgroundColor: theme.color.canvas },
  content: {
    paddingHorizontal: theme.gutter,
    paddingTop: theme.space[5],
    paddingBottom: theme.space[8],
  },

  intro: { ...theme.font.body, color: theme.color.inkTertiary, marginBottom: theme.space[5] },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 62,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowText: { flex: 1, gap: 2 },
  rowName: {
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.4,
    fontFamily: theme.fontFamily.medium,
    fontWeight: '500',
    color: theme.color.ink,
  },
  rowMeta: { ...theme.font.caption, color: theme.color.inkTertiary },
  // Tertiary, not danger red. Seven red glyphs down the right edge of a list of your
  // own family reads as seven warnings; the confirm is where the stakes belong.
  remove: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
  },

  error: { marginTop: theme.space[5] },
  footRule: { marginTop: 30 },
  footnote: { ...theme.font.caption, color: theme.color.inkTertiary, marginTop: theme.space[4] },
});
