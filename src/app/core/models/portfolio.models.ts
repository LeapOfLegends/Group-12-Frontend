/**
 * View models derived on the client from backend data. Nothing here is persisted;
 * everything is recomputed from balances, holdings, orders and instruments.
 */
import { Holding, Instrument, Order } from './trading.models';

export interface HoldingPosition {
  holding: Holding;
  instrument: Instrument | null;
  instrumentId: number;
  symbol: string;
  name: string;
  assetClass: string;
  currency: string;
  quantity: number;
  averageCost: number;
  costBasis: number;
  /** Latest price the platform holds for the instrument, or null when no quote exists. */
  currentPrice: number | null;
  marketValue: number | null;
  gain: number | null;
  gainPct: number | null;
  tradable: boolean;
}

export interface OrderRow {
  order: Order;
  symbol: string;
  name: string;
  /** Execution value for filled orders, otherwise the estimate implied by the reservation. */
  amount: number | null;
}

export interface PortfolioSummary {
  cash: number;
  holdingsValue: number;
  costBasis: number;
  totalReturn: number;
  /** Null when there is no cost basis to measure against. */
  totalReturnPct: number | null;
  reservedCash: number;
  buyingPower: number;
  totalAccountValue: number;
  pricedHoldings: number;
  unpricedHoldings: number;
}

export interface SeriesPoint {
  /** Epoch milliseconds. */
  time: number;
  value: number;
  /** Optional caption shown in tooltips (for example the order that moved the value). */
  note?: string;
  /** Starts a new SVG segment so an unavailable observation is rendered as a gap. */
  breakBefore?: boolean;
}

export type ChartRange = '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';

export const CHART_RANGES: readonly ChartRange[] = ['1D', '1W', '1M', '3M', '1Y', 'ALL'];

export interface AllocationSlice {
  label: string;
  value: number;
  share: number;
}
