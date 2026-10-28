const LOCALE = 'en-US';
export const EASTERN_TIME_ZONE = 'America/New_York';

const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: EASTERN_TIME_ZONE,
  timeZoneName: 'short',
});

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: EASTERN_TIME_ZONE,
});

const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  timeZone: EASTERN_TIME_ZONE,
  timeZoneName: 'short',
});

const easternDateKeyFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: EASTERN_TIME_ZONE,
});

export function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  return date ? dateTimeFormatter.format(date) : '—';
}

export function formatDate(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  return date ? dateFormatter.format(date) : '—';
}

export function formatTime(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  return date ? timeFormatter.format(date) : '—';
}

/** YYYY-MM-DD for the calendar day in Eastern Time, including daylight-saving changes. */
export function easternDateKey(value: string | number | Date | null | undefined): string | null {
  const date = toDate(value);
  if (!date) {
    return null;
  }
  const parts = easternDateKeyFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : null;
}

/** Age of a timestamp in whole seconds, or null when the value is missing. */
export function ageInSeconds(
  value: string | number | Date | null | undefined,
  nowMs: number = Date.now(),
): number | null {
  const date = toDate(value);
  if (!date) {
    return null;
  }
  return Math.max(0, Math.round((nowMs - date.getTime()) / 1000));
}

/** Human-friendly relative age: "just now", "45s ago", "3m ago", "2h ago", "5d ago". */
export function formatRelativeAge(
  value: string | number | Date | null | undefined,
  nowMs: number = Date.now(),
): string {
  const seconds = ageInSeconds(value, nowMs);
  if (seconds === null) {
    return 'unknown';
  }
  if (seconds < 5) {
    return 'just now';
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function greetingForHour(hour: number): string {
  if (hour < 12) {
    return 'Good morning';
  }
  if (hour < 18) {
    return 'Good afternoon';
  }
  return 'Good evening';
}
