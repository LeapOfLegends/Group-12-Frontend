# Leap Run 2 2026 - Capstone Project Group 12

A full-stack, production-grade enterprise trading platform.

## Team Members

- Zachary Disher
- Ethan Ma
- Toan (Thai) Nguyen
- Jennifer Ruiz
- Yatin Vajja

## Branching Strategy

We will be using the Gitflow-branching style. It allows for better structure, easier release versioning, and clear understanding.

---

## Frontend: Leap Trading (Angular 22)

The client application for the LEAP direct trading platform. It signs clients and
administrators in through **Group-12-Auth** (NestJS) and reads/writes trading data
through **Group-12-Backend** (Spring Boot). The browser never talks to PostgreSQL.

| Route | Page | Access |
| --- | --- | --- |
| `/login` | Sign in (clients and administrators) | Public |
| `/dashboard` | Client home: cash, portfolio value, return, chart, holdings, orders | Authenticated |
| `/transfer` | Deposit or withdraw cash | Clients |
| `/trade` | Buy or sell an instrument | Clients |
| `/admin` | Operations, financial and administrative views by role | Administrators |

Administrators land on `/dashboard` with an administrator state (they have no client
portfolio) and get an **Admin Dashboard** link; clients never see it and are redirected if
they try `/admin`. Route guards enforce this in the browser; the backend remains the
security boundary.

### Prerequisites

- Node.js 24 and npm 11 (`node --version`, `npm --version`)
- The two backends and PostgreSQL for real data (see their READMEs), or the bundled mock API

### Install, run, test, build

```bash
npm install
npm start          # http://localhost:4200, proxies /auth-api -> :3000 and /trading-api -> :8081
npm test           # vitest in watch mode
npm run test:ci    # single run
npm run build      # production bundle in dist/leap-trading
```

`npm start` uses [proxy.conf.json](proxy.conf.json) so API calls stay same-origin. Keep
that shape in production: serve `dist/leap-trading/browser` behind a reverse proxy that
forwards `/auth-api/*` to Group-12-Auth and `/trading-api/*` to Group-12-Backend (strip
the prefix). The Spring backend has no CORS configuration, so calling it from another
origin fails at the pre-flight.

### Configuration

[src/environments/environment.ts](src/environments/environment.ts) (production) and
[environment.development.ts](src/environments/environment.development.ts) hold the API
prefixes, the session storage key, the quote freshness window (30s, mirrors
`order-lifecycle.quote.max-age`) and the order polling interval/timeout. No credentials
live in the frontend.

### Signing in during development

Accounts are created by the backends, not by this app:

- Administrators: `POST /admins` on Group-12-Backend with a super admin token, or the
  seed in `Group-12-Backend/Database-Setup/seedAdmins.sql` (`super@admin.com` /
  `SuperAdmin123!` when that seed has been applied).
- Clients: any `clients` row whose `password_hash` is a bcrypt hash. The Group-12-Auth
  README shows how to generate one.

### Working without the backends (mock API)

[tools/mock-api/server.mjs](tools/mock-api/server.mjs) is a dependency-free Node server
that mirrors both backend contracts (paths, bodies, status codes, `ApiError` shape, JWT
claims, asynchronous order execution). It is useful for UI work and demos:

```bash
npm run mock:api     # terminal 1: mock Auth + Trading API on :9099
npm run start:mock   # terminal 2: ng serve proxied to the mock
```

Mock accounts: `jane@example.com` / `ClientPassword123!` (client), `super@admin.com` /
`SuperAdmin123!` (super admin), `ops@admin.com` / `Operations123!` (operations),
`finance@admin.com` / `Finance12345!` (finance). Set `STALE_QUOTES=1` when starting the
mock to see stale-quote rejections.

`npm run e2e:mock` runs a Playwright walkthrough of all five pages against the mock
(requires `npx playwright install chromium` once) and writes screenshots to
`tools/e2e/shots/`.

### Project structure

```text
src/app/
  core/
    api/        thin typed HttpClient services (clients, holdings, instruments, orders, admins)
    auth/       AuthService (session + roles), authInterceptor (bearer + 401), route guards
    models/     backend contracts (auth, trading) and derived view models (portfolio)
    services/   PortfolioService facade, InstrumentCatalogService, theme, notifications
    utils/      money/date formatting, portfolio maths, JWT decoding, error mapping
  shared/
    charts/     LineChart (SVG, crosshair, keyboard), PortfolioChart (ranges + table), BarList
    pipes/      money, price, pct, quantity, dateTime, relativeAge
    ui/         AppLayout, Sidebar, Navbar, AccountPanel, FinancialSummaryCard, StatusBadge,
                LoadingSkeleton, EmptyState, ConfirmationDialog, NotificationToast, tables
  features/
    login/ dashboard/ transfer/ trade/ admin/
```

Conventions: standalone components, signals for state, `OnPush` change detection,
zoneless runtime, reactive forms, lazy-loaded routes, design tokens in
[src/styles.scss](src/styles.scss) with a light default and a selected dark theme.

### Backend integration notes

See [docs/INTEGRATION.md](docs/INTEGRATION.md) for the endpoint map, the order
lifecycle as shown in the UI, the features that have no backend support yet (listed on
the admin dashboard as "Not connected"), and security observations for the backend team.
