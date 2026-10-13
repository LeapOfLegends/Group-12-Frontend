/**
 * Production configuration. The app is served behind a reverse proxy that forwards
 * `/auth-api` to Group-12-Auth (NestJS) and `/trading-api` to Group-12-Backend
 * (Spring Boot), so the browser only ever talks to one origin.
 */
export const environment = {
  production: true,
  appName: 'Leap Trading',
  /** Base URL of the NestJS authentication service (POST /auth/login). */
  authApiUrl: '/auth-api',
  /** Base URL of the Spring Boot trading API (clients, holdings, orders, instruments, admins). */
  tradingApiUrl: '/trading-api',
  /** Local storage key that holds the signed-in session. */
  sessionStorageKey: 'leap.session',
  /** How long the backend considers a market quote fresh (order-lifecycle.quote.max-age). */
  quoteMaxAgeSeconds: 30,
  /** Polling interval and ceiling used while an accepted order is being executed. */
  orderPollIntervalMs: 1500,
  orderPollTimeoutMs: 150000,
};
