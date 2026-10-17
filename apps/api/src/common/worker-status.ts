export interface WorkerStatus {
  name: string;
  intervalMs: number;
  enabled: boolean;
  registeredAt: string;
  running: boolean;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastFailed: boolean;
}
const statuses = new Map<string, WorkerStatus>();
export function registerWorker(
  name: string,
  intervalMs: number,
  enabled: boolean,
): WorkerStatus {
  const status = {
    name,
    intervalMs,
    enabled,
    registeredAt: new Date().toISOString(),
    running: false,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastFailed: false,
  };
  statuses.set(name, status);
  return status;
}
export function removeWorker(status: WorkerStatus): void {
  if (statuses.get(status.name) === status) statuses.delete(status.name);
}
export function workerStatuses(now = Date.now()) {
  return [...statuses.values()].map((status) => ({
    ...status,
    stale:
      status.enabled &&
      now - Date.parse(status.lastSuccessAt ?? status.registeredAt) >
        Math.max(status.intervalMs * 3, 90_000),
  }));
}
