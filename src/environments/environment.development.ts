/**
 * Development configuration. `ng serve` uses proxy.conf.json to forward
 * `/auth-api` -> http://localhost:13000 and `/trading-api` -> http://localhost:18081
 * (SSH tunnels to the VM's 3000 and 8081), which keeps requests same-origin and avoids
 * CORS preflights against the Spring backend.
 */
export const environment = {
  production: false,
  appName: 'JetZy Trading',
  authApiUrl: '/auth-api',
  tradingApiUrl: '/trading-api',
  sessionStorageKey: 'jetzy.session',
  quoteMaxAgeSeconds: 30,
  quotePollIntervalMs: 5000,
  portfolioPollIntervalMs: 15000,
  historyPollIntervalMs: 60000,
  adminPollIntervalMs: 15000,
  orderPollIntervalMs: 1500,
  orderPollTimeoutMs: 150000,
};
