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
| Group-12-Auth (NestJS) | 3000 | `POST /auth/login` (issues an HS256 JWT) and `POST /auth/register` (client accounts) |
| Group-12-Backend (Spring Boot) | 8081 | Clients, holdings, instruments, orders, admins; verifies the JWT |
| PostgreSQL | 15432 | Only reached by the two backends, never by the browser |

The frontend talks to both through same-origin prefixes (`/auth-api`, `/trading-api`)
that the dev server (`proxy.conf.json`) or a production reverse proxy forwards. This is
required: the Spring backend has no CORS configuration, so a browser on another origin
would fail the pre-flight request.

## Authentication and roles

- Clients register on `/register`, which posts `RegisterDto` to `POST /auth/register`:
  `firstName`, `lastName`, `email`, `password`, `ssn` (`123-45-6789`), `phoneNumber`
  (valid US number, at most 12 characters) and `dateOfBirth` (ISO date). The service's
  `ValidationPipe` runs with `forbidNonWhitelisted`, so the confirm-password field is never
  sent. The service hashes the password (bcrypt, 12 rounds) and answers 201 with the public
  client, 400 with a `message[]` of field errors or a reserved-domain message, and 409 when
  the email or SSN already exists. The frontend maps each message back onto its field.
  `date_of_birth` is `NOT NULL` in the `clients` table, which is why the form asks for it
  even though the brief did not list it.
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
  `localStorage`, re-validates expiry on startup and schedules an automatic sign-out at
  `exp`. A 401 from the trading API ends the session only when the token is (within a
  minute of) expiring; a 401 on a token that is still valid is reported as *rejected by
  the backend*, which in practice means the two services were started with different
  `JWT_SECRET` values, and the session is kept so the message can be read.

## Endpoint map by page

| Page | Endpoint | Notes |
| --- | --- | --- |
| Login | `POST /auth/login` | 400 validation, 401 invalid credentials |
| Register | `POST /auth/register` | 201 created client, 400 validation / reserved domain, 409 duplicate email or SSN |
| Dashboard | `GET /api/clients/{id}/balance` | cash balance |
| | `GET /api/client/{id}/holdings` | **404 when the client has no holdings** - treated as empty |
| | `GET /api/orders/client/{id}` | full order history, newest first |
| | `GET /instruments/{id}` | names, prices and quote timestamps for holdings/orders |
| Transfer | `POST /api/clients/{id}/deposit` | body `{ amount }`, returns the confirmed balance |
| | `POST /api/clients/{id}/withdraw` | 409 `Insufficient funds` |
| Transfer confirmation | (none) | Receipt built from the backend's `AccountBalanceDTO`; no endpoint reads a transfer back and no transaction id is issued, so the page says so |
| Trade | `GET /instruments` | catalogue with stored bid/ask/last and `quoteAsOf` |
| | `GET /instruments/symbol/{symbol}` | quote refresh |
| | `POST /api/orders` | returns the order record: `ACCEPTED` or `REJECTED` (+ reason) |
| Trade confirmation | `GET /api/orders/{id}` | polled every 1.5s (max 150s) until `FILLED`, `FAILED` or `REJECTED`; also used to reload `/trade/confirmation?orderId=` after a refresh |
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
3. The trade page keeps a `REJECTED` answer on screen with its reason so the order can be
   edited. Anything else continues on `/trade/confirmation`, which shows the record as
   *accepted / executing* with the estimate it was placed at, and only switches to
   *Trade executed* with the execution price and trade value once the record says
   `FILLED`. After the final state arrives, the UI reloads balance, holdings and orders.

If Kafka is not running, accepted orders stay `ACCEPTED`; the UI shows "still
executing" and points to the dashboard. Buying power already subtracts the reservation.

## Supported vs. missing functionality

### Fully supported

- Shared login, role-aware navigation, route guards, session persistence and expiry.
- Cash balance, holdings valued at the latest stored price, total return vs. cost basis,
  buying power (cash minus reserved cash), total account value (cash + holdings).
- Client self-registration through Group-12-Auth, including duplicate-email handling.
- Deposit and withdrawal with backend-confirmed balances, each followed by a receipt page.
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
| Fees | The backend charges none; receipts show "No commission" rather than a fabricated amount |
| Transfer ids / pending transfers | Deposits and withdrawals settle synchronously and return only the balance; the receipt shows the status the backend implied (completed) and marks the transaction id as not provided |
| Role changes after creation | `AdminUpdateDTO` has no `role` field |
| Live status push (BR-07) | No WebSocket/SSE; the UI polls the order record instead |

## Sign-in connectivity findings (2026-10-14)

Both client and administrator logins were reported as failing. The frontend contract was
verified against the running services and the database:

| Check | Result |
| --- | --- |
| Endpoint | Angular posts to `/auth-api/auth/login`; `proxy.conf.json` rewrites it to `http://localhost:3000/auth/login`, which is the NestJS route. |
| Body | `{ "email", "password" }` - exactly `LoginDto`. The service expects `email`, not `username`, and rejects extra properties. |
| Response / roles | `accessToken` + `admin` or `client`; the JWT `role` claim (admins) or `roles: ['CLIENT']` (clients) drives the frontend's guards and the backend's `@PreAuthorize`. |
| CORS | Not involved: the dev server proxy keeps every call same-origin (NestJS also enables CORS, Spring does not). |
| Guards | `/login` and `/register` are guest-only; everything else needs an unexpired token. No guard blocks a successful login. |

Root causes found outside the Angular code:

1. **The services were not running.** Only PostgreSQL (15432) was listening; nothing was on
   3000 or 8081. Without Group-12-Auth every login fails with a proxy 504, which the login
   page now reports as "sign-in service not reachable" instead of a generic error. Start
   Group-12-Auth (`npm start` in its repo) and Group-12-Backend (needs `JWT_SECRET` in its
   environment, the same value as Group-12-Auth's `.env`).
2. **Seeded accounts cannot sign in.** `Database-Setup/seedTables.sql` inserts
   `password_hash` values such as `seed-hash-client-001` (not bcrypt), so
   `bcrypt.compare` fails for all 50 seeded clients and all 36 seeded admins, and
   `seedAdmins.sql` (`super@admin.com`) has never been applied to this database. Accounts
   created through `/auth/register`, `POST /admins`, or a manual bcrypt insert work; with
   Group-12-Auth running, `leap.test.client@example.com` and `leap.test.admin@admin.com`
   (inserted on 2026-10-13) both return HTTP 200 with a valid token.
3. **Group-12-Backend is required after login.** The dashboard, transfer, trade and admin
   pages read from port 8081. Its `.env` has no `JWT_SECRET`, and `application.yml` has no
   default for it, so the service does not start until the variable is exported. If it is
   started with a different secret than Group-12-Auth, every call answers 401 "Invalid or
   expired token"; the frontend now keeps the session and names the mismatch.

Changes made on the frontend side: unreachable-service messages on the login and
registration pages, the 401 handling described above, and registration itself.

Recommended backend follow-ups (not changed here): ship real bcrypt hashes in the seed
data or document the registration route as the only way to create test clients; add
`JWT_SECRET` to Group-12-Backend's `.env.example`; consider matching client emails
case-insensitively in Group-12-Auth (`findByEmail` is exact, so `Jane@Example.com` and
`jane@example.com` are different accounts).

## Security observations for the backend team

- `GET /api/clients`, `GET /api/clients/{id}` and `GET /api/clients/email/{email}` serialise
  `passwordHash` and `ssn`. The frontend strips both before they reach any component, but
  they still cross the wire to every caller.
- Apart from `/admins/**`, endpoints accept requests without a token and do not scope data
  to the caller. The frontend always sends the bearer token so this can be tightened
  without UI changes.
- Admin emails must use `ADMIN_EMAIL_DOMAINS`; the UI explains this but cannot read the
  configured list, so the backend's 400 message is surfaced verbatim.
