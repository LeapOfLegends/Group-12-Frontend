/**
 * Number and currency formatting helpers shared by pipes and components.
 * All formatting goes through Intl so locale rules and currency symbols are correct.
 */

const DEFAULT_LOCALE = 'en-US';

const currencyFormatters = new Map<string, Intl.NumberFormat>();

function currencyFormatter(currency: string, minimumFractionDigits: number, maximumFractionDigits: number): Intl.NumberFormat {
  const key = `${currency}:${minimumFractionDigits}:${maximumFractionDigits}`;
  let formatter = currencyFormatters.get(key);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
        style: 'currency',
        currency,
        minimumFractionDigits,
        maximumFractionDigits,
      });
    } catch {
      formatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits,
        maximumFractionDigits,
      });
    }
    currencyFormatters.set(key, formatter);
  }
  return formatter;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Formats a currency amount, e.g. 1234.5 -> "$1,234.50". Non-numbers render as an em dash. */
export function formatMoney(value: number | null | undefined, currency = 'USD', fractionDigits = 2): string {
  if (!isFiniteNumber(value)) {
    return '—';
  }
  return currencyFormatter(currency, fractionDigits, fractionDigits).format(value);
}

/** Price formatting keeps more precision for small-priced instruments (crypto, FX). */
export function formatPrice(value: number | null | undefined, currency = 'USD'): string {
  if (!isFiniteNumber(value)) {
    return '—';
  }
  const abs = Math.abs(value);
  const digits = abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  return currencyFormatter(currency, 2, digits).format(value);
}

/** Signed money, e.g. +$120.00 / -$45.10. Zero is rendered without a sign. */
export function formatSignedMoney(value: number | null | undefined, currency = 'USD'): string {
  if (!isFiniteNumber(value)) {
    return '—';
  }
  const formatted = formatMoney(Math.abs(value), currency);
  if (value > 0) {
    return `+${formatted}`;
  }
  if (value < 0) {
    return `-${formatted}`;
  }
  return formatted;
}

/** Compact money for dense tiles, e.g. $1.2M, $48.3K. */
export function formatCompactMoney(value: number | null | undefined, currency = 'USD'): string {
  if (!isFiniteNumber(value)) {
    return '—';
  }
  if (Math.abs(value) < 10000) {
    return formatMoney(value, currency);
  }
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

/** Percent from a ratio (0.0523 -> "5.23%"); signed when requested. */
export function formatPercent(ratio: number | null | undefined, options: { signed?: boolean; digits?: number } = {}): string {
  if (!isFiniteNumber(ratio)) {
    return '—';
  }
  const digits = options.digits ?? 2;
  const value = new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(ratio));
  if (!options.signed) {
    return ratio < 0 ? `-${value}` : value;
  }
  if (ratio > 0) {
    return `+${value}`;
  }
  if (ratio < 0) {
    return `-${value}`;
  }
  return value;
}

/** Quantities keep up to 8 decimals (backend NUMERIC(20,8)) with trailing zeros trimmed. */
export function formatQuantity(value: number | null | undefined, maxDecimals = 8): string {
  if (!isFiniteNumber(value)) {
    return '—';
  }
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(value);
}

export function formatInteger(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) {
    return '—';
  }
  return new Intl.NumberFormat(DEFAULT_LOCALE, { maximumFractionDigits: 0 }).format(value);
}

/**
 * Parses user-entered amounts such as "1,250.50" or "$ 300". Returns null when the
 * text is not a plain non-negative decimal number.
 */
export function parseAmount(input: string | number | null | undefined): number | null {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? input : null;
  }
  if (typeof input !== 'string') {
    return null;
  }
  const cleaned = input.replace(/[$,\s]/g, '');
  if (!/^\d*(\.\d*)?$/.test(cleaned) || cleaned === '' || cleaned === '.') {
    return null;
  }
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Number of decimals in a decimal string ("12.345" -> 3). */
export function decimalPlaces(input: string | number): number {
  const text = String(input);
  const index = text.indexOf('.');
  return index === -1 ? 0 : text.length - index - 1;
}

/** Rounds to a number of decimals without binary-float surprises (0.1 + 0.2 style errors). */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Converts a backend numeric (number or decimal string) into a JS number, or null. */
export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Like toNumber, but returns 0 instead of null. */
export function toNumberOrZero(value: unknown): number {
  return toNumber(value) ?? 0;
}
