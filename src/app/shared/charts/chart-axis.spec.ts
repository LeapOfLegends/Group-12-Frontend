import { SeriesPoint } from '../../core/models/portfolio.models';
import { buildChartXAxis } from './chart-axis';

const point = (timestamp: string, value = 100): SeriesPoint => ({
  time: Date.parse(timestamp),
  value,
});

describe('range-aware chart axes', () => {
  it('uses the complete regular equity session after close and honors daylight saving time', () => {
    const summer = buildChartXAxis(
      [point('2026-07-06T13:30:00Z'), point('2026-07-06T20:00:00Z')],
      '1D',
      { assetClass: 'EQUITY', nowMs: Date.parse('2026-07-07T12:00:00Z') },
    );
    expect(new Date(summer.domain!.min).toISOString()).toBe('2026-07-06T13:30:00.000Z');
    expect(new Date(summer.domain!.max).toISOString()).toBe('2026-07-06T20:00:00.000Z');
    expect(summer.tickFormatter(summer.domain!.min)).toBe('9:30 AM');
    expect(summer.tickFormatter(summer.domain!.max)).toBe('4:00 PM');

    const winter = buildChartXAxis(
      [point('2026-11-02T14:30:00Z'), point('2026-11-02T21:00:00Z')],
      '1D',
      { assetClass: 'EQUITY', nowMs: Date.parse('2026-11-03T12:00:00Z') },
    );
    expect(new Date(winter.domain!.min).toISOString()).toBe('2026-11-02T14:30:00.000Z');
    expect(new Date(winter.domain!.max).toISOString()).toBe('2026-11-02T21:00:00.000Z');
  });

  it('ends an in-progress equity session at the latest real observation', () => {
    const axis = buildChartXAxis(
      [point('2026-10-27T13:30:00Z'), point('2026-10-27T16:15:00Z')],
      '1D',
      { assetClass: 'EQUITY', nowMs: Date.parse('2026-10-27T16:30:00Z') },
    );
    expect(axis.domain?.max).toBe(Date.parse('2026-10-27T16:15:00Z'));
    expect(axis.tickValues.at(-1)).toBe(Date.parse('2026-10-27T16:15:00Z'));
  });

  it('derives five-day ticks from available sessions without inventing weekends or holidays', () => {
    const observations = [
      '2026-10-20T14:30:00Z',
      '2026-10-21T14:30:00Z',
      '2026-10-22T14:30:00Z',
      '2026-10-23T14:30:00Z',
      '2026-10-26T14:30:00Z',
      '2026-10-27T14:30:00Z',
    ].map((time) => point(time));
    const axis = buildChartXAxis(observations, '5D', {
      assetClass: 'EQUITY',
      compressGaps: true,
    });
    expect(axis.scale).toBe('index');
    expect(axis.tickValues.map(axis.tickFormatter)).toEqual([
      'Oct 21',
      'Oct 22',
      'Oct 23',
      'Oct 26',
      'Oct 27',
    ]);
  });

  it('uses dates, months, and years for the longer ranges', () => {
    const month = buildChartXAxis(
      [point('2026-09-28T14:30:00Z'), point('2026-10-27T14:30:00Z')],
      '1M',
      { compressGaps: true },
    );
    expect(month.tickValues.map(month.tickFormatter)).toEqual(['Sep 28', 'Oct 27']);

    const year = buildChartXAxis(
      [point('2025-11-03T15:30:00Z'), point('2026-01-05T15:30:00Z')],
      '1Y',
      { compressGaps: true },
    );
    expect(year.tickValues.map(year.tickFormatter)).toEqual(['Nov', 'Jan']);

    const fiveYears = buildChartXAxis(
      [point('2022-01-03T15:30:00Z'), point('2024-01-02T15:30:00Z'), point('2026-01-02T15:30:00Z')],
      '5Y',
      { compressGaps: true },
    );
    expect(fiveYears.tickValues.map(fiveYears.tickFormatter)).toEqual(['2022', '2024', '2026']);
  });

  it.each(['CRYPTO', 'FOREX'])('does not impose equity hours on %s intraday data', (assetClass) => {
    const observations = [point('2026-10-25T04:00:00Z'), point('2026-10-25T22:00:00Z')];
    const axis = buildChartXAxis(observations, '1D', { assetClass, compressGaps: true });
    expect(axis.domain).toBeNull();
    expect(axis.scale).toBe('time');
    expect(axis.tickValues).toEqual(observations.map((item) => item.time));
  });
});
