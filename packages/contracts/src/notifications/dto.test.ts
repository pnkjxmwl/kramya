import { describe, expect, it } from 'vitest';
import { RegisterPushTokenRequest } from './dto';

describe('Kotlin device registration', () => {
  it('accepts bounded opaque FCM tokens', () => {
    expect(
      RegisterPushTokenRequest.safeParse({
        token: 'fcm-opaque-device-token',
        platform: 'android',
      }).success,
    ).toBe(true);
  });
  it.each([
    { token: 'ExponentPushToken[retired-token]' },
    { token: 'ExpoPushToken[retired-token]' },
    { token: 'fcm-opaque-device-token', platform: 'ios' },
  ])('rejects unsupported clients: %j', (input) => {
    expect(RegisterPushTokenRequest.safeParse(input).success).toBe(false);
  });
});
