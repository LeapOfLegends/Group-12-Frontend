import { Holding, Instrument, Order } from '../models/trading.models';
import {
  allocationByAssetClass,
  buildOrderRows,
  buildPositions,
  currentPriceOf,
  investedCapitalSeries,
  pendingSellQuantityOf,
  rangeHasData,
  reservedCashOf,
  sliceSeries,
  summarizePortfolio,
} from './portfolio-math';

const DAY = 86_400_000;

function instrument(overrides: Partial<Instrument>): Instrument {
  return {
    symbol: 'AAPL',
    instrumentName: 'Apple',
    assetClass: 'EQUITY',
    currency: 'USD',
    tradable: true,
    bidPrice: 339.94,
    askPrice: 340,
    lastPrice: 340,
    quoteAsOf: '2026-10-12T18:55:57Z',
    lastTradeAsOf: '2026-10-12T18:55:57Z',
    ...overrides,
  };
}

function order(overrides: Partial<Order>): Order {
  return {
    orderId: 1,
    clientId: 1,
    instrumentId: 2,
    orderType: 'BUY',
    quantity: 1,
    status: 'FILLED',
    reservedCash: null,
    submittedAt: '2026-01-01T00:00:00Z',
    acceptedAt: null,
    rejectedAt: null,
    failedAt: null,
    filledAt: null,
    executionPrice: null,
    executionQuoteAsOf: null,
    tradeValue: null,
    rejectionReason: null,
    failureReason: null,
    ...overrides,
  };
}

const holdings: Holding[] = [
  { holdingId: 1, clientId: 1, instrumentId: 2, quantity: 80, averageCost: 185.32, updatedAt: null },
  { holdingId: 2, clientId: 1, instrumentId: 74, quantity: 0.01, averageCost: 2510.045, updatedAt: null },
  { holdingId: 3, clientId: 1, instrumentId: 99, quantity: 5, averageCost: 10, updatedAt: null },
];

const instruments = new Map<number, Instrument>([
  [2, instrument({})],
  [74, instrument({ symbol: 'ETH/USD', instrumentName: 'Ethereum', assetClass: 'CRYPTO', lastPrice: 2487.53, bidPrice: 2487.95, askPrice: 2488.61 })],
]);

const orders: Order[] = [
  order({ orderId: 1, quantity: 120, filledAt: '2016-09-23T16:15:34Z', executionPrice: 185.32, tradeValue: 22238.4, submittedAt: '2016-09-23T16:15:30Z' }),
  order({ orderId: 4, orderType: 'SELL', quantity: 40, filledAt: '2017-02-16T20:22:07Z', executionPrice: 186.1, tradeValue: 7444, submittedAt: '2017-02-16T20:22:03Z' }),
  order({ orderId: 47, instrumentId: 74, quantity: 0.01, filledAt: '2026-10-12T18:25:25Z', executionPrice: 2510.045, tradeValue: 25.10045, submittedAt: '2026-10-12T18:25:25Z' }),
  order({ orderId: 50, status: 'ACCEPTED', quantity: 2, reservedCash: 680, submittedAt: '2026-10-13T10:00:00Z', acceptedAt: '2026-10-13T10:00:01Z' }),
  order({ orderId: 51, status: 'ACCEPTED', orderType: 'SELL', quantity: 10, submittedAt: '2026-10-13T10:05:00Z', acceptedAt: '2026-10-13T10:05:01Z' }),
  order({ orderId: 52, status: 'REJECTED', quantity: 500, rejectionReason: 'INSUFFICIENT_FUNDS', submittedAt: '2026-10-13T11:00:00Z' }),
];

describe('currentPriceOf', () => {
  it('prefers the last trade, then the quote midpoint, then either side', () => {
    expect(currentPriceOf(instrument({}))).toBe(340);
    expect(currentPriceOf(instrument({ lastPrice: null, bidPrice: 100, askPrice: 110 }))).toBe(105);
    expect(currentPriceOf(instrument({ lastPrice: null, bidPrice: null, askPrice: 110 }))).toBe(110);
    expect(currentPriceOf(instrument({ lastPrice: null, bidPrice: null, askPrice: null }))).toBeNull();
    expect(currentPriceOf(null)).toBeNull();
  });
});

describe('buildPositions', () => {
  it('values holdings at the current price and flags unknown instruments', () => {
    const positions = buildPositions(holdings, instruments);
    const apple = positions.find((position) => position.symbol === 'AAPL')!;
    expect(apple.marketValue).toBeCloseTo(27200, 6);
    expect(apple.costBasis).toBeCloseTo(14825.6, 6);
    expect(apple.gain).toBeCloseTo(12374.4, 6);
    expect(apple.gainPct).toBeCloseTo(12374.4 / 14825.6, 10);

    const unknown = positions.find((position) => position.instrumentId === 99)!;
    expect(unknown.symbol).toBe('#99');
    expect(unknown.marketValue).toBeNull();
    expect(unknown.gain).toBeNull();
  });

  it('sorts the largest position first', () => {
    const positions = buildPositions(holdings, instruments);
    expect(positions[0].symbol).toBe('AAPL');
  });
});

describe('summarizePortfolio', () => {
  it('never double-counts cash and subtracts reserved cash from buying power', () => {
    const positions = buildPositions(holdings, instruments);
    const summary = summarizePortfolio(1000, positions, orders);
    expect(summary.cash).toBe(1000);
    expect(summary.holdingsValue).toBeCloseTo(27200 + 24.8753, 6);
    expect(summary.costBasis).toBeCloseTo(14825.6 + 25.10045, 6);
    expect(summary.totalReturn).toBeCloseTo(summary.holdingsValue - summary.costBasis, 6);
    expect(summary.reservedCash).toBe(680);
    expect(summary.buyingPower).toBe(320);
    expect(summary.totalAccountValue).toBeCloseTo(1000 + summary.holdingsValue, 6);
    expect(summary.pricedHoldings).toBe(2);
    expect(summary.unpricedHoldings).toBe(1);
  });

  it('reports a null percentage when there is no cost basis', () => {
    expect(summarizePortfolio(50, [], []).totalReturnPct).toBeNull();
    expect(summarizePortfolio(50, [], [order({ status: 'ACCEPTED', reservedCash: 80 })]).buyingPower).toBe(0);
  });
});

describe('order helpers', () => {
  it('sums accepted buy reservations and accepted sell quantities', () => {
    expect(reservedCashOf(orders)).toBe(680);
    expect(pendingSellQuantityOf(orders, 2)).toBe(10);
    expect(pendingSellQuantityOf(orders, 74)).toBe(0);
  });

  it('builds newest-first rows with execution or reserved amounts', () => {
    const rows = buildOrderRows(orders, instruments);
    expect(rows[0].order.orderId).toBe(52);
    expect(rows.find((row) => row.order.orderId === 1)?.amount).toBe(22238.4);
    expect(rows.find((row) => row.order.orderId === 50)?.amount).toBe(680);
    expect(rows.find((row) => row.order.orderId === 51)?.amount).toBeNull();
    expect(rows.find((row) => row.order.orderId === 47)?.symbol).toBe('ETH/USD');
  });
});

describe('investedCapitalSeries', () => {
  it('accumulates buys and subtracts sells in fill order', () => {
    const series = investedCapitalSeries(orders, instruments);
    expect(series.map((point) => point.value.toFixed(2))).toEqual(['22238.40', '14794.40', '14819.50']);
    expect(series[0].note).toBe('Bought 120 AAPL');
    expect(series[1].note).toBe('Sold 40 AAPL');
    expect(series[2].note).toBe('Bought 0.01 ETH/USD');
  });

  it('ignores orders that were never filled', () => {
    expect(investedCapitalSeries([order({ status: 'REJECTED' }), order({ status: 'ACCEPTED' })])).toEqual([]);
  });
});

describe('ranges', () => {
  const now = new Date('2026-10-13T12:00:00Z').getTime();
  const series = investedCapitalSeries(orders, instruments);

  it('only offers ranges that contain a real data point', () => {
    expect(rangeHasData(series, '1D', now)).toBe(true);
    expect(rangeHasData(series, '1W', now)).toBe(true);
    expect(rangeHasData(series, 'ALL', now)).toBe(true);
    expect(rangeHasData([series[0]], '1Y', now)).toBe(false);
    expect(rangeHasData([], 'ALL', now)).toBe(false);
  });

  it('carries the prior value into the range and the last value to now', () => {
    const sliced = sliceSeries(series, '1W', now);
    expect(sliced[0].time).toBe(now - 7 * DAY);
    expect(sliced[0].value).toBeCloseTo(14794.4, 6);
    expect(sliced.at(-1)?.time).toBe(now);
    expect(sliced.at(-1)?.value).toBeCloseTo(14819.50045, 6);
    expect(sliced.length).toBe(3);
  });

  it('returns an empty slice for an empty series', () => {
    expect(sliceSeries([], 'ALL', now)).toEqual([]);
  });
});

describe('allocationByAssetClass', () => {
  it('groups by asset class with shares that sum to one', () => {
    const slices = allocationByAssetClass(buildPositions(holdings, instruments));
    expect(slices.map((slice) => slice.label)).toEqual(['Equity', 'Other', 'Crypto']);
    expect(slices.reduce((sum, slice) => sum + slice.share, 0)).toBeCloseTo(1, 10);
  });
});
