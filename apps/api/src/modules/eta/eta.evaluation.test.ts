import { describe, expect, it } from 'vitest';
import { evaluateForecasts, type RecordedForecast } from './eta.evaluation';

const at = (minute: number) => new Date(Date.UTC(2026, 0, 1, 9, minute));
const forecast = (changes: Partial<RecordedForecast> = {}): RecordedForecast => ({
  from: at(10),
  to: at(20),
  recordedAt: at(0),
  submittedAt: at(1),
  calledAt: at(15),
  startedAt: at(18),
  ...changes,
});

describe('frozen ETA scorecard', () => {
  it('reports no accuracy claim with zero evidence', () => {
    expect(evaluateForecasts([]).recorded.call).toMatchObject({
      samples: 0,
      coverageFraction: null,
      p90AbsoluteMidpointErrorMins: null,
    });
  });
  it('grades calls and actual consultation starts separately, including early and late misses', () => {
    const report = evaluateForecasts([
      forecast(),
      forecast({ calledAt: at(5) }),
      forecast({ calledAt: at(40) }),
    ]);
    expect(report.recorded.call).toMatchObject({
      samples: 3,
      coverageFraction: 1 / 3,
      actualBeforeWindow: 1,
      actualAfterWindow: 1,
      meanAbsoluteMidpointErrorMins: 35 / 3,
      medianAbsoluteMidpointErrorMins: 10,
      p90AbsoluteMidpointErrorMins: 25,
      signedMidpointBiasMins: 5,
      meanWindowWidthMins: 10,
    });
    expect(report.recorded.consultationStart).toMatchObject({
      samples: 3,
      coverageFraction: 1,
      meanAbsoluteMidpointErrorMins: 3,
    });
  });
  it('counts missing, invalid and hindsight forecasts instead of quietly scoring them', () => {
    const result = evaluateForecasts([
      forecast({ from: null }),
      forecast({ from: at(25) }),
      forecast({ calledAt: null }),
      forecast({ recordedAt: at(16) }),
    ]).recorded.call;
    expect(result).toMatchObject({
      samples: 0,
      excluded: {
        missingForecast: 1,
        invalidWindow: 1,
        missingOutcome: 1,
        lateForecast: 1,
      },
    });
  });

  it('averages the middle pair for an even sample median', () => {
    const report = evaluateForecasts([forecast(), forecast({ calledAt: at(25) })]);
    expect(report.recorded.call.medianAbsoluteMidpointErrorMins).toBe(5);
  });
  it('separates recorded predictions from provider submissions made before the event', () => {
    const result = evaluateForecasts([
      forecast(),
      forecast({ submittedAt: null }),
      forecast({ submittedAt: at(17) }),
    ]);
    expect(result.recorded.call.samples).toBe(3);
    expect(result.submittedBeforeOutcome.call).toMatchObject({
      samples: 1,
      excluded: { notSubmittedBeforeOutcome: 2 },
    });
    expect(result.submittedBeforeOutcome.consultationStart.samples).toBe(2);
  });
});
