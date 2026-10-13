# Backend integration analysis

This document records what the Angular client found when it inspected the two backend
services, which endpoints each page relies on, and which requested features have no
backend support yet. Nothing in the frontend invents data: a feature either calls a
real endpoint or is labelled as unavailable.

Sources inspected: `Group-12-Auth` (NestJS, `src/`), `Group-12-Backend` (Spring Boot,
`src/main/java/group12/`), `Database-Setup/createTables.sql`, and the LEAP Business
Requirements Specification (LEAP-BRS-2026-014 v0.9).

## Services and ports

| Service | Default port | Role |
| --- | --- | --- |
| Group-12-Auth (NestJS) | 3000 | `POST /auth/login` only; issues an HS256 JWT |
| Group-12-Backend (Spring Boot) | 8081 | Clients, holdings, instruments, orders, admins; verifies the JWT |
| PostgreSQL | 15432 | Only reached by the two backends, never by the browser |

The frontend talks to both through same-origin prefixes (`/auth-api`, `/trading-api`)
that the dev server (`proxy.conf.json`) or a production reverse proxy forwards. This is
required: the Spring backend has no CORS configuration, so a browser on another origin
would fail the pre-flight request.

## Authentication and roles

- One login endpoint for everyone. The email domain picks the table: domains in
  `ADMIN_EMAIL_DOMAINS` (default `admin.com,fmr.com`) are admins, everything else is a client.
- Admin tokens carry `role: super_admin | operations | finance`; client tokens carry
  `roles: ['CLIENT']`. The frontend derives the account kind and role from these claims
  (`AuthService`), which is exactly what the Spring backend trusts.
- The backend only restricts `/admins/**` (needs `super_admin`). Every other endpoint is
  open, and no endpoint checks that `clientId` in a request matches the token's `sub`.
  The UI therefore scopes operations/finance sections by convention, and BR-02
  ("a client may only act on their own data") is **not enforced server-side yet**.
- Tokens expire after `JWT_EXPIRATION` (3600s). The frontend stores the session in
  `localStorage`, re-validates expiry on startup, schedules an automatic sign-out at
  `exp`, and signs out on any 401 from the platform APIs.

## Endpoint map by page

| Page | Endpoint | Notes |
| --- | --- | --- |
| Login | `POST /auth/login` | 400 validation, 401 invalid credentials |
| Dashboard | `GET /api/clients/{id}/balance` | cash balance |
| | `GET /api/client/{id}/holdings` | **404 when the client has no holdings** - treated as empty |
| | `GET /api/orders/client/{id}` | full order history, newest first |
| | `GET /instruments/{id}` | names, prices and quote timestamps for holdings/orders |
| Transfer | `POST /api/clients/{id}/deposit` | body `{ amount }`, returns the confirmed balance |
| | `POST /api/clients/{id}/withdraw` | 409 `Insufficient funds` |
| Trade | `GET /instruments` | catalogue with stored bid/ask/last and `quoteAsOf` |
| | `GET /instruments/symbol/{symbol}` | quote refresh |
| | `POST /api/orders` | returns the order record: `ACCEPTED` or `REJECTED` (+ reason) |
| | `GET /api/orders/{id}` | polled every 1.5s (max 150s) until `FILLED`, `FAILED` or `REJECTED` |
| Admin | `GET /api/clients` | client list (all roles) |
| | `GET /api/clients/{id}` / `GET /api/clients/email/{email}` | client lookup |
| | `GET /admins`, `POST /admins`, `PUT /admins/{id}`, `DELETE /admins/{id}` | super admin only |

## Order lifecycle as the UI presents it

1. `POST /api/orders` validates synchronously: instrument exists and is tradable, a quote
   exists and is fresher than `order-lifecycle.quote.max-age` (30s), and the client has
   enough available cash (balance minus accepted buy reservations) or enough holdings
   (holding minus accepted sell quantity). The response is `ACCEPTED` or `REJECTED`.
2. Execution is asynchronous (Kafka consumer -> `OrderExecutionService`). The UI never
   assumes an accepted order executed; it polls the order record and shows the status the
   backend reports, including `FAILED` with its reason.
3. After the final state arrives, the UI reloads balance, holdings and orders.

If Kafka is not running, accepted orders stay `ACCEPTED`; the UI shows "still
executing" and points to the dashboard. Buying power already subtracts the reservation.

## Supported vs. missing functionality

### Fully supported

- Shared login, role-aware navigation, route guards, session persistence and expiry.
- Cash balance, holdings valued at the latest stored price, total return vs. cost basis,
  buying power (cash minus reserved cash), total account value (cash + holdings).
- Deposit and withdrawal with backend-confirmed balances.
- Buy/sell market orders with client-side pre-validation that mirrors the backend rules
  and display of the real backend outcome.
- Administrator management (list/create/edit/delete) for super admins.
- Client activity lookup and order tracing for operations/super admins.
- Client cash positions for finance/super admins.
- Market data health (fresh/stale/missing quotes, tradability) from `/instruments`.

### Supported with a workaround

- **Instrument ids.** `InstrumentDTO` (used by `GET /instruments` and
  `GET /instruments/symbol/{symbol}`) does not include `instrumentId`, but
  `POST /api/orders` requires it. `InstrumentCatalogService` resolves ids by reading
  `GET /instruments/{id}` in batches of 16 until a batch returns no instruments, then
  caches the symbol -> id map in `sessionStorage`. If `instrumentId` is ever added to
  the DTO the probe is skipped automatically. Recommended backend fix: add
  `instrumentId` to `InstrumentDTO`.
- **Portfolio chart.** There is no portfolio-valuation history endpoint, so the dashboard
  chart plots *net capital invested* from filled orders (buys add the executed trade
  value, sells subtract it). This is real order history, labelled as such. Time ranges
  are enabled only when a fill falls inside them. Recommended backend addition: a
  `GET /api/clients/{id}/portfolio/history` series.
- **Withdrawable cash.** The backend only checks `balance >= amount`; the UI limits
  withdrawals to cash not reserved by accepted buy orders so an in-flight buy cannot be
  starved.

### Not available (shown as "Not connected", never estimated)

| Requested metric | Why it is unavailable |
| --- | --- |
| Total orders, trading volume, order status breakdown, failed/rejected orders | Orders are only exposed per client; no platform-wide or aggregate endpoint |
| Total deposits / withdrawals, pending transfers, reconciliation | The `transactions` table is not exposed by any endpoint |
| Pending transactions | No platform-wide pending-order endpoint |
| Funding sources / withdrawal destinations | Not modelled (BRS 4.2 puts banking integration out of scope) |
| Order types other than market | `CreateOrderRequest` has no order-type field beyond BUY/SELL |
| Fees | The backend charges none |
| Role changes after creation | `AdminUpdateDTO` has no `role` field |
| Live status push (BR-07) | No WebSocket/SSE; the UI polls the order record instead |

## Security observations for the backend team

- `GET /api/clients`, `GET /api/clients/{id}` and `GET /api/clients/email/{email}` serialise
  `passwordHash` and `ssn`. The frontend strips both before they reach any component, but
  they still cross the wire to every caller.
- Apart from `/admins/**`, endpoints accept requests without a token and do not scope data
  to the caller. The frontend always sends the bearer token so this can be tightened
  without UI changes.
- Admin emails must use `ADMIN_EMAIL_DOMAINS`; the UI explains this but cannot read the
  configured list, so the backend's 400 message is surfaced verbatim.
