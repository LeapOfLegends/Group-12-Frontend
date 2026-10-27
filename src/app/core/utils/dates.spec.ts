import { EASTERN_TIME_ZONE, formatDate, formatDateTime, formatTime } from './dates';

describe('Eastern Time formatting', () => {
  it('uses the America/New_York IANA timezone', () => {
    expect(EASTERN_TIME_ZONE).toBe('America/New_York');
  });

  it('formats timestamps with the correct daylight-saving abbreviation', () => {
    expect(formatDateTime('2026-07-15T14:30:00Z')).toMatch(/Jul 15, 2026.*10:30 AM.*EDT/);
    expect(formatDateTime('2026-01-15T14:30:00Z')).toMatch(/Jan 15, 2026.*9:30 AM.*EST/);
  });

  it('uses Eastern Time for date-only and time-only displays', () => {
    expect(formatDate('2026-01-01T02:00:00Z')).toBe('Dec 31, 2025');
    expect(formatTime('2026-07-15T14:30:15Z')).toMatch(/10:30:15 AM.*EDT/);
  });
});
