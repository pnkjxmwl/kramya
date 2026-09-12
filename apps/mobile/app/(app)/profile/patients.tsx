import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CreatePatientRequest, Patient, PatientRelation } from '@opd/contracts';
import { useAuth } from '../../../lib/auth';
import { Icon } from '../../../lib/icon';
import { QueryState } from '../../../lib/discovery';
import {
  Avatar,
  Button,
  Card,
  ErrorNote,
  Field,
  Hairline,
  ListGroup,
  SectionLabel,
  pressable,
} from '../../../lib/ui';
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

/** The people this account books for (docs/PRD.md 6.1, family profiles). */
export default function Patients() {
  const { authedFetch } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [relation, setRelation] = useState<PatientRelation>('SELF');
  const [formError, setFormError] = useState<string | null>(null);

  // The key matches lib/api.ts's useApi('/patients'), so adding a profile here also
  // refreshes the greeting and avatar on home.
  const patients = useQuery({
    queryKey: ['/patients'],
    queryFn: async (): Promise<Patient[]> => {
      const res = await authedFetch('/patients');
      if (!res.ok) throw new Error('Could not load your profiles');
      return res.json() as Promise<Patient[]>;
    },
  });

  const addPatient = useMutation({
    mutationFn: async (body: CreatePatientRequest) => {
      const res = await authedFetch('/patients', { method: 'POST', body: JSON.stringify(body) });
      if (!res.ok) throw new Error('Could not add this profile');
      return res.json() as Promise<Patient>;
    },
    onSuccess: () => {
      setName('');
      setRelation('SELF');
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ['/patients'] });
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const removePatient = useMutation({
    mutationFn: async (id: string) => {
      const res = await authedFetch(`/patients/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not remove this profile');
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['/patients'] }),
    onError: (e: Error) => setFormError(e.message),
  });

  function onAdd() {
    if (!name.trim()) {
      setFormError('Enter a name');
      return;
    }
    addPatient.mutate({ name: name.trim(), relation });
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: 'Family profiles' }} />

      <Card title="Add a profile">
        <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />

        <Text style={styles.label}>Relation</Text>
        <View style={styles.chips}>
          {RELATIONS.map((r) => {
            const selected = r === relation;
            return (
              <Pressable
                key={r}
                onPress={() => setRelation(r)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                // 34pt tall by design; hitSlop carries it past the 44x44 floor.
                hitSlop={8}
                {...pressable(theme.radius.full)}
              >
                <View style={[styles.chip, selected && styles.chipSelected]}>
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {label(r)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {formError && <ErrorNote message={formError} />}

        <Button title="Add profile" onPress={onAdd} pending={addPatient.isPending} />
      </Card>

      <View style={styles.section}>
        <SectionLabel>Your profiles</SectionLabel>
      </View>

      {patients.data && patients.data.length > 0 ? (
        <ListGroup inset={66}>
          {patients.data.map((p) => (
            <View key={p.id} style={styles.row}>
              <Avatar name={p.name} size={36} />
              <View style={styles.rowText}>
                <Text style={styles.rowName}>{p.name}</Text>
                <Text style={styles.rowMeta}>{label(p.relation)}</Text>
              </View>
              <Pressable
                onPress={() => removePatient.mutate(p.id)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${p.name}`}
                hitSlop={8}
                {...pressable(theme.radius.full)}
              >
                <View style={styles.remove}>
                  <Icon name="trash-2" size={17} color={theme.color.danger.fg} />
                </View>
              </Pressable>
            </View>
          ))}
        </ListGroup>
      ) : (
        <QueryState
          pending={patients.isPending}
          error={patients.error}
          isEmpty={patients.isSuccess && patients.data.length === 0}
          emptyText="No profiles yet. Add yourself first."
          onRetry={() => void patients.refetch()}
        />
      )}

      <Hairline style={styles.footRule} />
      <Text style={styles.footnote}>
        A profile is who a booking is for. Every token you hold names one of these people.
      </Text>
    </ScrollView>
  );
}

/** SELF -> "Myself", MOTHER -> "Mother". */
function label(relation: PatientRelation): string {
  if (relation === 'SELF') return 'Myself';
  return relation.charAt(0) + relation.slice(1).toLowerCase();
}

const styles = StyleSheet.create({
  screen: { backgroundColor: theme.color.canvas },
  content: { paddingHorizontal: theme.gutter, paddingTop: 22, paddingBottom: theme.space[8] },

  label: { ...theme.font.overline, color: theme.color.inkTertiary, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] },
  chip: {
    // 34 tall inside a row that keeps 44pt of tappable area via the parent padding.
    height: 34,
    paddingHorizontal: 14,
    borderRadius: theme.radius.full,
    justifyContent: 'center',
    backgroundColor: theme.color.fillSecondary,
  },
  // Ink fill, white label - the same relationship the primary button has, at chip
  // size. A border-only selected state was invisible on a white card.
  chipSelected: { backgroundColor: theme.color.ink },
  chipText: {
    ...theme.font.caption,
    fontSize: 14,
    fontFamily: theme.fontFamily.medium,
    fontWeight: '500',
    color: theme.color.ink,
  },
  chipTextSelected: { color: '#FFFFFF' },

  section: { paddingTop: 30, paddingBottom: 10 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[3],
    minHeight: 60,
    paddingHorizontal: 18,
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
  remove: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
  },

  footRule: { marginTop: 30 },
  footnote: { ...theme.font.caption, color: theme.color.inkTertiary, marginTop: theme.space[4] },
});
