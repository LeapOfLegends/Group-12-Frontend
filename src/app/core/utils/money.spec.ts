import { decimalPlaces, formatCompactMoney, formatMoney, formatPercent, formatPrice, formatQuantity, formatSignedMoney, parseAmount, roundTo, toNumber } from './money';

describe('money formatting', () => {
  it('formats currency with two decimals and grouping', () => {
    expect(formatMoney(1234.5)).toBe('$1,234.50');
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(12.3, 'GBP')).toBe('£12.30');
  });

  it('signs gains and losses explicitly', () => {
    expect(formatSignedMoney(120)).toBe('+$120.00');
    expect(formatSignedMoney(-45.1)).toBe('-$45.10');
    expect(formatSignedMoney(0)).toBe('$0.00');
  });

  it('keeps more precision for small prices', () => {
    expect(formatPrice(340)).toBe('$340.00');
    expect(formatPrice(0.08367)).toBe('$0.0837');
    expect(formatPrice(0.0012345)).toBe('$0.001235');
  });

  it('compacts large values', () => {
    expect(formatCompactMoney(2500)).toBe('$2,500.00');
    expect(formatCompactMoney(1_250_000)).toMatch(/^\$1\.[23]M$/);
  });

  it('formats percentages from ratios', () => {
    expect(formatPercent(0.0523)).toBe('5.23%');
    expect(formatPercent(0.0523, { signed: true })).toBe('+5.23%');
    expect(formatPercent(-0.1, { signed: true, digits: 1 })).toBe('-10.0%');
    expect(formatPercent(null)).toBe('—');
  });

  it('trims trailing zeros from quantities', () => {
    expect(formatQuantity(80)).toBe('80');
    expect(formatQuantity(0.01)).toBe('0.01');
    expect(formatQuantity(0.123456789)).toBe('0.12345679');
  });
});

describe('parseAmount', () => {
  it('accepts plain and formatted decimals', () => {
    expect(parseAmount('1,250.50')).toBe(1250.5);
    expect(parseAmount('$ 300')).toBe(300);
    expect(parseAmount('0.5')).toBe(0.5);
    expect(parseAmount(42)).toBe(42);
  });

  it('rejects anything that is not a non-negative number', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
    expect(parseAmount('1e5')).toBeNull();
    expect(parseAmount('.')).toBeNull();
    expect(parseAmount(null)).toBeNull();
  });
});

describe('number helpers', () => {
  it('counts decimal places and rounds safely', () => {
    expect(decimalPlaces('12.345')).toBe(3);
    expect(decimalPlaces('12')).toBe(0);
    expect(roundTo(0.1 + 0.2, 2)).toBe(0.3);
  });

  it('normalises backend numerics', () => {
    expect(toNumber('47595.09')).toBe(47595.09);
    expect(toNumber(12)).toBe(12);
    expect(toNumber(null)).toBeNull();
    expect(toNumber('abc')).toBeNull();
  });
});
