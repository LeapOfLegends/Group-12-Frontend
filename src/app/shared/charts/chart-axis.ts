import { SeriesPoint } from '../../core/models/portfolio.models';
import { EASTERN_TIME_ZONE } from '../../core/utils/dates';

export type ChartAxisRange = '1D' | '5D' | '1W' | '1M' | '3M' | '1Y' | '5Y' | 'ALL';

export interface ChartXDomain {
  min: number;
  max: number;
}

export interface ChartXAxisConfig {
  scale: 'time' | 'index';
  tickValues: readonly number[];
  domain: ChartXDomain | null;
  tickFormatter: (time: number) => string;
  tooltipFormatter: (time: number) => string;
}

interface AxisOptions {
  assetClass?: string;
  compressGaps?: boolean;
  nowMs?: number;
  timeZone?: string;
}

/**
 * Plans the time axis from real observations. Exchange-session gaps may be compressed with an
 * index scale, but ticks always remain attached to timestamps supplied by the backend.
 */
export function buildChartXAxis(
  points: readonly SeriesPoint[],
  range: ChartAxisRange,
  options: AxisOptions = {},
): ChartXAxisConfig {
  const timeZone = options.timeZone ?? EASTERN_TIME_ZONE;
  const sorted = points
    .filter((point) => Number.isFinite(point.time))
    .slice()
    .sort((a, b) => a.time - b.time);
  const assetClass = options.assetClass?.trim().toUpperCase() ?? '';
  const isEquity = assetClass === 'EQUITY';
  const scale = options.compressGaps && range !== '1D' ? 'index' : 'time';

  let domain: ChartXDomain | null = null;
  let tickValues: readonly number[] = sorted.map((point) => point.time);

  if (range === '1D' && isEquity && sorted.length > 0) {
    const session = equitySessionDomain(sorted, options.nowMs ?? Date.now(), timeZone);
    domain = session.domain;
    tickValues = session.ticks;
  } else if (range === '5D') {
    tickValues = groupedRepresentatives(sorted, (time) => dateKey(time, timeZone)).slice(-5);
  } else if (range === '1M' || range === '1W') {
    tickValues = groupedRepresentatives(sorted, (time) => dateKey(time, timeZone));
  } else if (range === '1Y' || range === '3M') {
    tickValues = groupedRepresentatives(sorted, (time) => monthKey(time, timeZone));
  } else if (range === '5Y') {
    tickValues = groupedRepresentatives(sorted, (time) => yearKey(time, timeZone));
  }

  const showYearForMonths = hasDuplicateMonthNames(tickValues, timeZone);
  const tickFormatter = (time: number): string =>
    formatRangeTick(time, range, timeZone, showYearForMonths);

  return {
    scale,
    tickValues,
    domain,
    tickFormatter,
    tooltipFormatter: (time) => formatChartTooltipTime(time, range, timeZone),
  };
}

export function formatRangeTick(
  time: number,
  range: ChartAxisRange,
  timeZone = EASTERN_TIME_ZONE,
  showYearForMonths = false,
): string {
  let options: Intl.DateTimeFormatOptions;
  switch (range) {
    case '1D':
      options = { hour: 'numeric', minute: '2-digit' };
      break;
    case '1Y':
      options = showYearForMonths ? { month: 'short', year: '2-digit' } : { month: 'short' };
      break;
    case '5Y':
      options = { year: 'numeric' };
      break;
    case '3M':
      options = { month: 'short', day: 'numeric' };
      break;
    default:
      options = { month: 'short', day: 'numeric' };
  }
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone }).format(new Date(time));
}

export function formatChartTooltipTime(
  time: number,
  range: ChartAxisRange,
  timeZone = EASTERN_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(range === '1D' || range === '5D' ? { hour: 'numeric', minute: '2-digit' } : {}),
    timeZone,
    timeZoneName: 'short',
  }).format(new Date(time));
}

function equitySessionDomain(
  points: readonly SeriesPoint[],
  nowMs: number,
  timeZone: string,
): { domain: ChartXDomain; ticks: readonly number[] } {
  const latest = points.at(-1)!.time;
  const date = zonedParts(latest, timeZone);
  const start = zonedDateTimeToEpoch(date.year, date.month, date.day, 9, 30, timeZone);
  const close = zonedDateTimeToEpoch(date.year, date.month, date.day, 16, 0, timeZone);
  const now = zonedParts(nowMs, timeZone);
  const sessionIsInProgress =
    now.year === date.year &&
    now.month === date.month &&
    now.day === date.day &&
    nowMs >= start &&
    nowMs < close;
  const max = sessionIsInProgress
    ? Math.max(start + 60_000, Math.min(latest, nowMs, close))
    : close;
  const candidates = [
    start,
    zonedDateTimeToEpoch(date.year, date.month, date.day, 11, 0, timeZone),
    zonedDateTimeToEpoch(date.year, date.month, date.day, 12, 30, timeZone),
    zonedDateTimeToEpoch(date.year, date.month, date.day, 14, 0, timeZone),
    close,
  ].filter((time) => time >= start && time <= max);
  if (candidates.at(-1) !== max) candidates.push(max);
  return { domain: { min: start, max }, ticks: candidates };
}

function groupedRepresentatives(
  points: readonly SeriesPoint[],
  keyFor: (time: number) => string,
): number[] {
  const groups = new Map<string, number[]>();
  for (const point of points) {
    const key = keyFor(point.time);
    const group = groups.get(key) ?? [];
    group.push(point.time);
    groups.set(key, group);
  }
  return [...groups.values()].map((times) => times[Math.floor((times.length - 1) / 2)]);
}

function hasDuplicateMonthNames(times: readonly number[], timeZone: string): boolean {
  const months = new Set<string>();
  for (const time of times) {
    const month = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone }).format(time);
    if (months.has(month)) return true;
    months.add(month);
  }
  return false;
}

function dateKey(time: number, timeZone: string): string {
  const parts = zonedParts(time, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function monthKey(time: number, timeZone: string): string {
  const parts = zonedParts(time, timeZone);
  return `${parts.year}-${parts.month}`;
}

function yearKey(time: number, timeZone: string): string {
  return String(zonedParts(time, timeZone).year);
}

function zonedParts(time: number, timeZone: string): Record<'year' | 'month' | 'day', number> {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone,
  }).formatToParts(time);
  const value = (type: 'year' | 'month' | 'day') =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day') };
}

/** Converts a wall-clock time in an IANA zone without assuming a fixed UTC offset. */
function zonedDateTimeToEpoch(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): number {
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
      timeZone,
    }).formatToParts(guess);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((item) => item.type === type)?.value);
    const represented = Date.UTC(
      part('year'),
      part('month') - 1,
      part('day'),
      part('hour'),
      part('minute'),
    );
    guess += target - represented;
  }
  return guess;
}

