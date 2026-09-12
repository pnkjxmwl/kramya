import { Stack, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { City, Paginated } from '@opd/contracts';
import { useApi } from '../../../lib/api';
import { useCity } from '../../../lib/city';
import { Icon } from '../../../lib/icon';
import { MoreNote, PAGE, QueryState, Row } from '../../../lib/discovery';
import { ListGroup } from '../../../lib/ui';
import { theme } from '../../../theme';

/**
 * Pick the city to browse. Reached on first run and from the eyebrow on home.
 *
 * The list is server-derived (GET /cities counts only listable hospitals), so a city
 * with nothing to show never appears and the choice can never be a dead end.
 *
 * A grouped table, and the chosen city is marked with a tick rather than a leading
 * icon that changes shape - a list where the selected row has a different glyph in a
 * different place reads as two kinds of row rather than as one row that is on.
 */
export default function Location() {
  const router = useRouter();
  const { city, setCity } = useCity();
  const cities = useApi<Paginated<City>>(`/cities?limit=${PAGE}`);

  async function choose(name: string) {
    await setCity(name);
    // back(), not push('/'): home is already underneath, and pushing would leave a
    // second copy of it on the stack.
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  const items = cities.data?.items ?? [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Your city' }} />

      <Text style={styles.intro}>
        Pick where you want to be seen. You can change this any time from the home screen.
      </Text>

      {items.length > 0 ? (
        <ListGroup inset={theme.gutter}>
          {items.map((item) => (
            <Row
              key={item.name}
              title={item.name}
              subtitle={`${item.hospitalCount} hospital${item.hospitalCount === 1 ? '' : 's'}`}
              padH={theme.gutter}
              trailing={
                item.name === city ? (
                  <Icon name="check" size={18} color={theme.color.ink} />
                ) : (
                  <View style={styles.spacer} />
                )
              }
              onPress={() => void choose(item.name)}
            />
          ))}
        </ListGroup>
      ) : (
        <QueryState
          pending={cities.isPending}
          error={cities.error}
          isEmpty={cities.isSuccess}
          emptyText="No hospitals are listed yet. Please check back soon."
          onRetry={() => void cities.refetch()}
        />
      )}

      {cities.data ? <MoreNote shown={items.length} total={cities.data.total} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: theme.color.canvas },
  content: { paddingHorizontal: theme.gutter, paddingTop: 22, paddingBottom: theme.space[8] },
  intro: { ...theme.font.body, color: theme.color.inkTertiary, marginBottom: theme.space[5] },
  // Holds the tick's width so unselected rows do not sit 18pt wider than the one
  // above them - and so the whole list stops shifting when the choice changes.
  spacer: { width: 18 },
});
