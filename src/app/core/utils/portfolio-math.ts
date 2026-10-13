/**
 * Pure portfolio calculations. Every number shown on the dashboard is derived here
 * from backend data so the rules live in one tested place.
 */
import { AllocationSlice, ChartRange, HoldingPosition, OrderRow, PortfolioSummary, SeriesPoint } from '../models/portfolio.models';
import { Holding, Instrument, Order } from '../models/trading.models';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The price used to value a position: the last trade when the platform has one,
 * otherwise the quote midpoint, otherwise whichever side of the quote exists.
 */
export function currentPriceOf(instrument: Instrument | null | undefined): number | null {
  if (!instrument) {
    return null;
  }
  if (isPositive(instrument.lastPrice)) {
    return instrument.lastPrice;
  }
  if (isPositive(instrument.bidPrice) && isPositive(instrument.askPrice)) {
    return (instrument.bidPrice + instrument.askPrice) / 2;
  }
  if (isPositive(instrument.bidPrice)) {
    return instrument.bidPrice;
  }
  if (isPositive(instrument.askPrice)) {
    return instrument.askPrice;
  }
  return null;
}

export function buildPositions(holdings: readonly Holding[], instrumentsById: ReadonlyMap<number, Instrument>): HoldingPosition[] {
  return holdings
    .map((holding) => {
      const instrument = instrumentsById.get(holding.instrumentId) ?? null;
      const currentPrice = currentPriceOf(instrument);
      const costBasis = holding.quantity * holding.averageCost;
      const marketValue = currentPrice === null ? null : holding.quantity * currentPrice;
      const gain = marketValue === null ? null : marketValue - costBasis;
      const gainPct = gain === null || costBasis <= 0 ? null : gain / costBasis;
      return {
        holding,
        instrument,
        instrumentId: holding.instrumentId,
        symbol: instrument?.symbol ?? `#${holding.instrumentId}`,
        name: instrument?.instrumentName ?? 'Unknown instrument',
        assetClass: instrument?.assetClass ?? 'Other',
        currency: instrument?.currency ?? 'USD',
        quantity: holding.quantity,
        averageCost: holding.averageCost,
        costBasis,
        currentPrice,
        marketValue,
        gain,
        gainPct,
        tradable: instrument?.tradable ?? false,
      };
    })
    .sort((a, b) => (b.marketValue ?? b.costBasis) - (a.marketValue ?? a.costBasis));
}

export function buildOrderRows(orders: readonly Order[], instrumentsById: ReadonlyMap<number, Instrument>): OrderRow[] {
  return [...orders]
    .sort((a, b) => timeOf(b.submittedAt) - timeOf(a.submittedAt))
    .map((order) => {
      const instrument = instrumentsById.get(order.instrumentId) ?? null;
      const amount = order.tradeValue ?? (order.orderType === 'BUY' ? order.reservedCash : null);
      return {
        order,
        symbol: instrument?.symbol ?? `#${order.instrumentId}`,
        name: instrument?.instrumentName ?? 'Unknown instrument',
        amount,
      };
    });
}

/** Cash committed to BUY orders the backend has accepted but not yet filled. */
export function reservedCashOf(orders: readonly Order[]): number {
  return orders
    .filter((order) => order.status === 'ACCEPTED' && order.orderType === 'BUY')
    .reduce((sum, order) => sum + (order.reservedCash ?? 0), 0);
}

/** Quantity of an instrument already promised to accepted SELL orders. */
export function pendingSellQuantityOf(orders: readonly Order[], instrumentId: number): number {
  return orders
    .filter((order) => order.status === 'ACCEPTED' && order.orderType === 'SELL' && order.instrumentId === instrumentId)
    .reduce((sum, order) => sum + order.quantity, 0);
}

export function summarizePortfolio(cash: number, positions: readonly HoldingPosition[], orders: readonly Order[]): PortfolioSummary {
  const priced = positions.filter((position) => position.marketValue !== null);
  const holdingsValue = priced.reduce((sum, position) => sum + (position.marketValue ?? 0), 0);
  const costBasis = priced.reduce((sum, position) => sum + position.costBasis, 0);
  const totalReturn = holdingsValue - costBasis;
  const reservedCash = reservedCashOf(orders);
  return {
    cash,
    holdingsValue,
    costBasis,
    totalReturn,
    totalReturnPct: costBasis > 0 ? totalReturn / costBasis : null,
    reservedCash,
    buyingPower: Math.max(0, cash - reservedCash),
    totalAccountValue: cash + holdingsValue,
    pricedHoldings: priced.length,
    unpricedHoldings: positions.length - priced.length,
  };
}

export function allocationByAssetClass(positions: readonly HoldingPosition[]): AllocationSlice[] {
  const totals = new Map<string, number>();
  for (const position of positions) {
    const value = position.marketValue ?? position.costBasis;
    const label = titleCase(position.assetClass);
    totals.set(label, (totals.get(label) ?? 0) + value);
  }
  const grand = [...totals.values()].reduce((sum, value) => sum + value, 0);
  return [...totals.entries()]
    .map(([label, value]) => ({ label, value, share: grand > 0 ? value / grand : 0 }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Net capital invested through filled orders over time: buys add the executed trade
 * value, sells remove it. This is real order history, not a modelled valuation.
 */
export function investedCapitalSeries(orders: readonly Order[], instrumentsById?: ReadonlyMap<number, Instrument>): SeriesPoint[] {
  const fills = orders
    .filter((order) => order.status === 'FILLED' && order.filledAt && order.tradeValue !== null)
    .sort((a, b) => timeOf(a.filledAt) - timeOf(b.filledAt));
  let running = 0;
  return fills.map((order) => {
    const value = order.tradeValue ?? 0;
    running += order.orderType === 'BUY' ? value : -value;
    const symbol = instrumentsById?.get(order.instrumentId)?.symbol ?? `#${order.instrumentId}`;
    return {
      time: timeOf(order.filledAt),
      value: Math.max(0, running),
      note: `${order.orderType === 'BUY' ? 'Bought' : 'Sold'} ${formatQuantityPlain(order.quantity)} ${symbol}`,
    };
  });
}

export function rangeStart(range: ChartRange, nowMs: number): number | null {
  switch (range) {
    case '1D':
      return nowMs - DAY_MS;
    case '1W':
      return nowMs - 7 * DAY_MS;
    case '1M':
      return nowMs - 30 * DAY_MS;
    case '3M':
      return nowMs - 91 * DAY_MS;
    case '1Y':
      return nowMs - 365 * DAY_MS;
    case 'ALL':
      return null;
  }
}

/** A range is offered only when at least one real data point falls inside it. */
export function rangeHasData(points: readonly SeriesPoint[], range: ChartRange, nowMs: number): boolean {
  const start = rangeStart(range, nowMs);
  return points.some((point) => start === null || point.time >= start);
}

/**
 * Slices a step series for a range. The value carried into the range appears as a
 * point at the range start, and the final value is carried forward to "now" so the
 * line always reaches the right edge of the chart.
 */
export function sliceSeries(points: readonly SeriesPoint[], range: ChartRange, nowMs: number): SeriesPoint[] {
  if (points.length === 0) {
    return [];
  }
  const sorted = [...points].sort((a, b) => a.time - b.time);
  const start = rangeStart(range, nowMs);
  const inside = sorted.filter((point) => start === null || point.time >= start);
  const result: SeriesPoint[] = [];
  if (start !== null) {
    const prior = sorted.filter((point) => point.time < start).at(-1);
    if (prior) {
      result.push({ time: start, value: prior.value });
    }
  }
  result.push(...inside);
  const last = result.at(-1);
  if (last && last.time < nowMs) {
    result.push({ time: nowMs, value: last.value });
  }
  return result;
}

function isPositive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function timeOf(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function titleCase(value: string): string {
  const text = value.trim();
  if (!text) {
    return 'Other';
  }
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

function formatQuantityPlain(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(Math.min(8, decimalsOf(value)));
}

function decimalsOf(value: number): number {
  const text = String(value);
  const index = text.indexOf('.');
  return index === -1 ? 0 : text.length - index - 1;
}
