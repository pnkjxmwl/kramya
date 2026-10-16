/** Frozen leave-now forecasts only. These aggregates do not measure every screen refresh. */
export interface RecordedForecast {
  from: Date | null;
  to: Date | null;
  recordedAt: Date | null;
  submittedAt: Date | null;
  calledAt: Date | null;
  startedAt: Date | null;
}

const minutes = (ms: number): number => ms / 60_000;
const mean = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const percentile = (xs: number[], fraction: number): number | null => {
  if (!xs.length) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(fraction * sorted.length) - 1)]!;
};
const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

function score(rows: RecordedForecast[], target: 'calledAt' | 'startedAt', submittedOnly: boolean) {
  const errors: number[] = [];
  const widths: number[] = [];
  let missingForecast = 0,
    missingOutcome = 0,
    invalidWindow = 0,
    lateForecast = 0,
    notSubmittedBeforeOutcome = 0;
  let early = 0,
    late = 0,
    inside = 0;
  for (const row of rows) {
    if (!row.from || !row.to || !row.recordedAt) {
      missingForecast++;
      continue;
    }
    if (
      !Number.isFinite(row.from.getTime()) ||
      !Number.isFinite(row.to.getTime()) ||
      !Number.isFinite(row.recordedAt.getTime()) ||
      row.from >= row.to
    ) {
      invalidWindow++;
      continue;
    }
    const actual = row[target];
    if (!actual || !Number.isFinite(actual.getTime())) {
      missingOutcome++;
      continue;
    }
    if (row.recordedAt >= actual) {
      lateForecast++;
      continue;
    }
    if (
      submittedOnly &&
      (!row.submittedAt || !Number.isFinite(row.submittedAt.getTime()) || row.submittedAt >= actual)
    ) {
      notSubmittedBeforeOutcome++;
      continue;
    }
    errors.push(minutes(actual.getTime() - (row.from.getTime() + row.to.getTime()) / 2));
    widths.push(minutes(row.to.getTime() - row.from.getTime()));
    if (actual < row.from) early++;
    else if (actual > row.to) late++;
    else inside++;
  }
  const absolute = errors.map(Math.abs);
  return {
    samples: errors.length,
    excluded: {
      missingForecast,
      invalidWindow,
      missingOutcome,
      lateForecast,
      notSubmittedBeforeOutcome,
    },
    coverageFraction: errors.length ? inside / errors.length : null,
    actualBeforeWindow: early,
    actualWithinWindow: inside,
    actualAfterWindow: late,
    meanAbsoluteMidpointErrorMins: mean(absolute),
    medianAbsoluteMidpointErrorMins: median(absolute),
    p90AbsoluteMidpointErrorMins: percentile(absolute, 0.9),
    // Positive: the actual event happened later than the forecast midpoint.
    signedMidpointBiasMins: mean(errors),
    meanWindowWidthMins: mean(widths),
  };
}

export function evaluateForecasts(rows: RecordedForecast[]) {
  return {
    entries: rows.length,
    recorded: {
      call: score(rows, 'calledAt', false),
      consultationStart: score(rows, 'startedAt', false),
    },
    submittedBeforeOutcome: {
      call: score(rows, 'calledAt', true),
      consultationStart: score(rows, 'startedAt', true),
    },
  };
}
