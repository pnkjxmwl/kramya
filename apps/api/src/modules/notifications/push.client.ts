/** Provider-independent push boundary used by the notification outbox and tests. */
export interface PushMessage {
  token: string;
  title: string;
  body: string;
  data: Record<string, string>;
}

export interface PushResult {
  token: string;
  ok: boolean;
  /** Only a confirmed invalid/expired device token should be disabled. */
  deviceGone: boolean;
  error?: string;
}

export interface PushApi {
  readonly configured: boolean;
  send(messages: PushMessage[]): Promise<PushResult[]>;
}
