import { cookies } from 'next/headers';
import { getRefreshToken, QUEUE_NOTICE_COOKIE } from './session';
import { openQueueNotice, sealQueueNotice } from './queue-notice-codec';

export async function writeQueueNotice(sessionId: string, message: string): Promise<string> {
  const refresh = await getRefreshToken();
  if (refresh) (await cookies()).set(QUEUE_NOTICE_COOKIE, sealQueueNotice(refresh, sessionId, message), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/queue', maxAge: 30,
  });
  return 'notice=1';
}

export async function readQueueNotice(sessionId: string): Promise<string | undefined> {
  return openQueueNotice((await cookies()).get(QUEUE_NOTICE_COOKIE)?.value, await getRefreshToken(), sessionId);
}
