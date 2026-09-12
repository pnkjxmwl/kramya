import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CreatePatientRequest, Patient, PatientRelation } from '@opd/contracts';
import { useAuth } from '../../../lib/auth';
import { Icon } from '../../../lib/icon';
import { Row } from '../../../lib/discovery';
import { Avatar, ErrorNote, Field, ListGroup, SectionLabel, pressable } from '../../../lib/ui';
import { theme } from '../../../theme';

const RELATIONS: PatientRelation[] = [
  'SELF',
  'SPOUSE',
  'MOTHER',
  'FATHER',
  'CHILD',
  'SIBLING',
  'OTHER',
];

/**
 * Add one person to the account's family profiles.
 *
 * **This used to be a card wedged above the list, and the relation was seven pills.**
 * Both were wrong for the same reason: a form is a task, and a task gets a screen.
 * Pills made a single-choice field look like multi-select tags, wrapped to three
 * ragged rows at seven options, and put a row of small targets where iOS puts a
 * labelled row you tap. The choice is now a checkmark list - the same control iOS
 * uses everywhere for "pick exactly one of a short set" - and the whole thing is a
 * modal with Cancel and Save in the bar, which is where a form's verbs belong.
 *
 * No Add button in the content, either. `Save` in the header is the single commit
 * point, disabled until there is a name, so the screen cannot be submitted empty.
 */
export default function AddPatient() {
  const router = useRouter();
  const { authedFetch } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [relation, setRelation] = useState<PatientRelation>('CHILD');
  const [error, setError] = useState<string | null>(null);

  const addPatient = useMutation({
    mutationFn: async (body: CreatePatientRequest) => {
      const res = await authedFetch('/patients', { method: 'POST', body: JSON.stringify(body) });
      if (!res.ok) throw new Error('Could not add this profile');
      return res.json() as Promise<Patient>;
    },
    onSuccess: () => {
      // Same key as useApi('/patients'), so the list, the greeting and the home
      // avatar all refresh from this one invalidation.
      void queryClient.invalidateQueries({ queryKey: ['/patients'] });
      router.back();
    },
    onError: (e: Error) => setError(e.message),
  });

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && !addPatient.isPending;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'New profile',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={12} {...pressable(theme.radius.sm)}>
              <Text style={styles.headerAction}>Cancel</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={() => canSave && addPatient.mutate({ name: trimmed, relation })}
              disabled={!canSave}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSave }}
              {...pressable(theme.radius.sm)}
            >
              <Text style={[styles.headerAction, styles.save, !canSave && styles.saveOff]}>
                {addPatient.isPending ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* The avatar the list will show, built from what has been typed so far. It
            is the one piece of feedback this form can give before it is submitted. */}
        <View style={styles.preview}>
          <Avatar name={trimmed === '' ? '?' : trimmed} size={64} />
          <Text style={styles.previewName} numberOfLines={1}>
            {trimmed === '' ? 'New profile' : trimmed}
          </Text>
          <Text style={styles.previewMeta}>{label(relation)}</Text>
        </View>

        <Field
          label="Full name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoComplete="name"
          placeholder="e.g. Aarav Semwal"
        />

        <View style={styles.label}>
          <SectionLabel>Relation to you</SectionLabel>
        </View>
        <ListGroup inset={theme.gutter}>
          {RELATIONS.map((r) => (
            <Row
              key={r}
              title={label(r)}
              padH={theme.gutter}
              trailing={
                <View style={styles.tick}>
                  {r === relation ? (
                    <Icon name="check" size={18} color={theme.color.ink} />
                  ) : null}
                </View>
              }
              onPress={() => setRelation(r)}
            />
          ))}
        </ListGroup>

        {error && (
          <View style={styles.error}>
            <ErrorNote message={error} />
          </View>
        )}

        <Text style={styles.footnote}>
          A profile is who a booking is for — it is not a separate login. Everyone here
          books through your account.
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
    paddingBottom: theme.space[10],
  },

  headerAction: {
    fontSize: 16,
    letterSpacing: -0.3,
    fontFamily: theme.fontFamily.regular,
    color: theme.color.ink,
  },
  save: { fontFamily: theme.fontFamily.semibold, fontWeight: '600' },
  saveOff: { color: theme.color.inkTertiary },

  preview: { alignItems: 'center', gap: 2, marginBottom: theme.space[8] },
  previewName: { ...theme.font.h2, color: theme.color.ink, marginTop: theme.space[4] },
  previewMeta: { ...theme.font.caption, color: theme.color.inkTertiary },

  label: { paddingTop: 26, paddingBottom: 10 },
  tick: { width: 18, alignItems: 'flex-end' },

  error: { marginTop: theme.space[5] },
  footnote: {
    ...theme.font.caption,
    fontSize: 12,
    color: theme.color.inkTertiary,
    marginTop: theme.space[6],
    paddingHorizontal: 4,
  },
});
