import { afterEach, describe, expect, it, vi } from "vitest";
import {
  registerWorker,
  removeWorker,
  workerStatuses,
  type WorkerStatus,
} from "./worker-status";

describe("worker startup and recovery monitoring", () => {
  let worker: WorkerStatus;
  afterEach(() => {
    if (worker) removeWorker(worker);
    vi.useRealTimers();
  });
  it("allows the first scheduled sweeps before reporting a new worker as stale", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-18T03:00:00Z"));
    worker = registerWorker("monitor-test", 300_000, true);
    vi.advanceTimersByTime(300_000);
    expect(workerStatuses().find((w) => w.name === worker.name)?.stale).toBe(
      false,
    );
    vi.advanceTimersByTime(600_001);
    expect(workerStatuses().find((w) => w.name === worker.name)?.stale).toBe(
      true,
    );
  });
  it("measures recovery from the last success rather than failed attempts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-18T03:00:00Z"));
    worker = registerWorker("monitor-test", 15_000, true);
    worker.lastSuccessAt = new Date().toISOString();
    vi.advanceTimersByTime(90_001);
    worker.lastAttemptAt = new Date().toISOString();
    worker.lastFailed = true;
    expect(workerStatuses().find((w) => w.name === worker.name)).toMatchObject({
      stale: true,
      lastFailed: true,
    });
    worker.lastSuccessAt = new Date().toISOString();
    worker.lastFailed = false;
    expect(workerStatuses().find((w) => w.name === worker.name)?.stale).toBe(
      false,
    );
  });
  it("never treats intentionally disabled workers as stale", () => {
    vi.useFakeTimers();
    worker = registerWorker("monitor-test", 15_000, false);
    vi.advanceTimersByTime(3_600_000);
    expect(workerStatuses().find((w) => w.name === worker.name)?.stale).toBe(
      false,
    );
  });
});
