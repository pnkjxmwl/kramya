import { Stack } from 'expo-router';
import { stackOptions } from '../(discover)/_layout';

/** The Profile tab's stack. Same header treatment as Discover - one source. */
export default function ProfileLayout() {
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/* Adding a profile is a form, and a form is a task you finish - presented,
          not pushed, with Cancel and Save in the bar. Set here because
          `presentation` is a navigator option: from inside the screen it applies one
          render late and the push animation plays first. */}
      <Stack.Screen name="add" options={{ presentation: 'modal' }} />
      {/* The same picker Discover has, registered here too - see city.tsx for why a
          second route rather than a shared one. Modal for the same reason it is one
          there: choosing a city is a task you finish, not a place you go. */}
      <Stack.Screen name="city" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
