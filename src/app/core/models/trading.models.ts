/**
 * Contracts of the Group-12-Backend trading API (Spring Boot). Field names mirror
 * the backend DTOs and entities exactly; numbers are normalised by the API services.
 */
import { AdminRole } from './auth.models';

/** Standard error body produced by GlobalExceptionHandler and SecurityErrorHandler. */
export interface ApiError {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
}

/** AccountBalanceDTO - returned by balance reads, deposits and withdrawals. */
export interface AccountBalance {
  clientId: number;
  accountBalance: number;
}

/** Request body for POST /api/clients/me/balance/transactions. */
export interface MoneyMovementRequest {
  type: 'DEPOSIT' | 'WITHDRAWAL';
  amount: number;
}

/**
 * ClientEntity as exposed by /api/clients. The backend also serialises `passwordHash`
 * and `ssn`; the API service strips them before they reach any component.
 */
export interface ClientRecord {
  clientId: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  accountBalance: number;
  createdAt: string | null;
}

/** HoldingEntity - a client's position in one instrument. */
export interface Holding {
  holdingId: number;
  clientId: number;
  instrumentId: number;
  quantity: number;
  averageCost: number;
  updatedAt: string | null;
}

/** InstrumentDTO. Note: the backend DTO does not include `instrumentId`. */
export interface Instrument {
  symbol: string;
  instrumentName: string;
  assetClass: string;
  currency: string;
  tradable: boolean;
  bidPrice: number | null;
  askPrice: number | null;
  lastPrice: number | null;
  quoteAsOf: string | null;
  lastTradeAsOf: string | null;
  /** Populated by the frontend catalogue (see InstrumentCatalogService). */
  instrumentId?: number;
}

/** InstrumentHistoryDTO and InstrumentHistoryPointDTO from GET /instruments/{id}/history. */
export type InstrumentHistoryRange = '1D' | '5D' | '1M' | '1Y' | '5Y';

export const INSTRUMENT_HISTORY_RANGES: readonly InstrumentHistoryRange[] = [
  '1D',
  '5D',
  '1M',
  '1Y',
  '5Y',
];

export interface InstrumentHistoryPoint {
  timestamp: string;
  /** JSON decimal; accept a string as well for lossless decimal serializers. */
  close: number | string;
}

export interface InstrumentHistory {
  instrumentId: number;
  symbol: string;
  range: InstrumentHistoryRange;
  timeframe: string;
  currency: string;
  availableFrom: string | null;
  availableTo: string | null;
  partial: boolean;
  points: InstrumentHistoryPoint[];
}

/** An instrument whose database id has been resolved, so it can be traded. */
export interface CatalogInstrument extends Instrument {
  instrumentId: number;
}

export type OrderType = 'BUY' | 'SELL';

export type OrderStatus = 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'FILLED' | 'FAILED';

export const ORDER_STATUSES: readonly OrderStatus[] = [
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED',
  'FILLED',
  'FAILED',
];

/** Reasons the backend records when it rejects a SUBMITTED order (OrderRejectionReason). */
export type OrderRejectionReason =
  | 'INSTRUMENT_NOT_FOUND'
  | 'INSTRUMENT_NOT_TRADABLE'
  | 'MISSING_QUOTE'
  | 'STALE_QUOTE'
  | 'INSUFFICIENT_FUNDS'
  | 'INSUFFICIENT_HOLDINGS';

/** Reasons the backend records when execution of an ACCEPTED order fails (OrderFailureReason). */
export type OrderFailureReason =
  | 'INSTRUMENT_NOT_FOUND'
  | 'INSTRUMENT_NOT_TRADABLE'
  | 'MARKET_QUOTE_TIMEOUT'
  | 'INVALID_RESERVED_CASH'
  | 'PRICE_EXCEEDS_RESERVED_CASH'
  | 'INSUFFICIENT_ACTUAL_CASH'
  | 'HOLDING_NOT_FOUND'
  | 'INSUFFICIENT_HOLDINGS';

/** OrderEntity - the permanent record of an order and its outcome. */
export interface Order {
  orderId: number;
  clientId: number;
  instrumentId: number;
  orderType: OrderType;
  quantity: number;
  status: OrderStatus;
  reservedCash: number | null;
  submittedAt: string;
  acceptedAt: string | null;
  rejectedAt: string | null;
  failedAt: string | null;
  filledAt: string | null;
  executionPrice: number | null;
  executionQuoteAsOf: string | null;
  tradeValue: number | null;
  rejectionReason: OrderRejectionReason | string | null;
  failureReason: OrderFailureReason | string | null;
}

/** CreateOrderRequest - POST /api/clients/me/orders. The authenticated client comes from the JWT. */
export interface CreateOrderRequest {
  instrumentId: number;
  orderType: OrderType;
  quantity: number;
}

/** AdminDTO - GET/POST/PUT /admins (super admin only). */
export interface AdminRecord {
  adminId: number;
  firstName: string;
  lastName: string;
  email: string;
  role: AdminRole;
  createdAt: string | null;
}

/** AdminCreateDTO. */
export interface CreateAdminRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: AdminRole;
}

/** AdminUpdateDTO - the role cannot be changed after creation. */
export interface UpdateAdminRequest {
  firstName: string;
  lastName: string;
  email: string;
}

/** Password policy enforced by the backend for new administrators. */
export const ADMIN_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,72}$/;
