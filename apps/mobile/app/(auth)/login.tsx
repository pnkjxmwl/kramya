import { Link, Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../lib/auth';
import { Icon } from '../../lib/icon';
import { Button, ErrorNote, Field } from '../../lib/ui';
import { theme } from '../../theme';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit() {
    setPending(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      // No navigation here - the gate in _layout redirects once signedIn flips.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed');
      setPending(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ headerShown: false }} />

      {/*
        Brand mark, then the greeting - both left-aligned, at the handoff's large
        title size. A centred wordmark over a centred subtitle is a splash screen;
        this is a form, and a form starts at the left margin like every other screen
        in the app.
      */}
      <View style={styles.brand}>
        <View style={styles.mark}>
          <Icon name="activity" size={22} color="#FFFFFF" />
        </View>
        <Text style={styles.wordmark}>OPD QUEUE</Text>
      </View>

      <View style={styles.intro}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>
          Join a doctor&apos;s queue from home and arrive when it is nearly your turn.
        </Text>
      </View>

      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        icon="mail"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
        icon="lock"
      />

      {error && <ErrorNote message={error} />}

      <Button title="Sign in" onPress={onSubmit} pending={pending} />

      <Link href="/(auth)/signup" style={styles.link}>
        New here? Create an account
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.gutter,
    paddingVertical: theme.space[8],
    gap: theme.space[4],
    // White, not canvas. The fields are recessed wells; a grey ground makes a
    // recessed well look like a card sitting on something, which is one surface too
    // many for a page with four elements on it.
    backgroundColor: theme.color.surface,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: theme.space[3] },
  mark: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.full,
    backgroundColor: theme.color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: { ...theme.font.overline, color: theme.color.inkTertiary },
  intro: { gap: 6, marginTop: theme.space[6], marginBottom: theme.space[4] },
  title: { ...theme.font.display, color: theme.color.ink },
  subtitle: { ...theme.font.body, color: theme.color.inkTertiary },
  link: {
    ...theme.font.body,
    fontFamily: theme.fontFamily.medium,
    fontWeight: '500',
    color: theme.color.ink,
    textAlign: 'center',
    marginTop: theme.space[3],
  },
});
