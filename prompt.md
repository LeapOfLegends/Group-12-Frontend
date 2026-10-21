create, update, or confirm all the necessary queries that mimic the server.mjs data to have this data or information filled and shown in the frontend of the client home page and the admin dashboard:

queries and information neede for a specific client's home page (uses the capstone2026 database):
- account cash balance
- total portfolio value
- total return
- line graph of portfolio performance (invested capital over time through filled orders)
- buying power, cash (same as buying power), holdings value (same as total portfolio value), total account value (cash + holdings value)
- current holdings (valued at the latest price the platform holds for each instrument)
- recent orders placed 

queries and information needed for admin's dashboard (some information will be shown or hidden based on which role has access):
- platform over (use data_warehouse as the database for this):
	- number of registered clients (client records on the platform)
	- number of accounts with cash (clients with a positive cash balance)
	- total client cash (sum of all client cash balances)
	- number of tradable instruments
	number of all total admins (separately, include how many admins there are based on each role)
- trading operations (use the capstone2026 database for this) (roles: super_admin, operations)
	- client activity lookup (search a client based on id or email)
	- order lookup (trace an order using order id)
	- list of market data health based on all, fresh, stale, no quote , and not tradable status (orders that are priced only against quotes under 30s old; shows number of fresh, stale, and without a quote states)
- financial operations (use capstone2026 database for this) (roles: super_admin, finance):
	- client cash positions (should be able to search up a name or email or filter based on highest balance, name from A-Z, and newest clients)
- administrative management (roles: super_admin)
	- shows list of administrators and their role
	- can search up based on name or email
	- can filter based on role
	- there should be the ability to add a new administrator (needs first name, last name, email address, temp password, and assigned role)




for the frontend clients dashboard page, add a search bar to the top of the main page above the date and aligned to the date and greeting. The serach bar should be used to lookup prices of current instruments. 
Remove the side bar from clients and admins, and move it to the top nav bar with the actions inside left justified, the dark/light mode button will be on this top nav bar along with the user card, these two items should stay right justified how they are right now. This nav bar should replace the side bar everywhere the side bar was previously. On the clients dashboard, "New Trade" should be replaced with "Place Trade" and in The profile pop up card, "Profile & Account should be replaced with "Profile". Adjust the height of the portfolio performance card
-----------------------------------------------------------------------------------------------------------------------------------------------------------------------
For the admin portal, All cards in the same row should match in height. 
Add a deafult landing page with the new nav bar at the top, instead of the user in the top right corner, have the login and the sign up buttom so for the users. When sign up is clicked the user will go to registeration page, when login is clicked the user woll go to login page. THe landing page should display our logo and have a description  of our trading polatform with snippets of the actions that can be done via our app. THe landing page should be an informative overview inviting users to use oit tradig platform.













# MASTER GITHUB COPILOT PROMPT
# COMPLETE TRADING PLATFORM INTEGRATION — ANGULAR, NESTJS, SPRING BOOT, POSTGRESQL, SSH AND AWS READINESS

## 1. PRIMARY OBJECTIVE

Act as a senior full-stack software engineer, backend engineer, database engineer, security engineer, and DevOps integration specialist.

I have three separate GitHub repositories forming one trading platform.

I need you to thoroughly analyze, connect, fix, and validate these existing applications so that they work together as one fully integrated trading application.

The final application should be accessible locally at:

**http://localhost:4200**

The frontend must communicate with the real authentication and trading backend services, retrieve actual PostgreSQL data, and display the correct information on the client and administrator dashboards.

### CRITICAL REQUIREMENTS

1. Preserve existing business logic and functionality.
2. Do not rewrite working code.
3. Reuse existing controllers, services, repositories, components, DTOs, queries, and naming conventions.
4. Make only necessary changes.
5. Use real PostgreSQL data rather than mock data for the integrated application.
6. Use REST APIs and SSH tunneling where required.
7. Do not implement WebSockets.
8. Preserve existing JWT authentication.
9. Enforce administrator permissions in Spring Boot and Angular.
10. Verify that all services work together locally.
11. Maintain compatibility with our future AWS deployment.
12. Do not modify files without first providing an analysis and receiving my approval.

**The goal is integration, not rebuilding the application.**

---

## 2. GITHUB REPOSITORIES

### Frontend — Angular

https://github.com/LeapOfLegends/Group-12-Frontend.git

### Authentication — NestJS

https://github.com/LeapOfLegends/Group-12-Auth.git

### Backend — Spring Boot

https://github.com/LeapOfLegends/Group-12-Backend.git

### Additional frontend requirements

https://github.com/LeapOfLegends/Group-12-Frontend/pull/5/changes

Analyze all three repositories together.

Use the actual files in the current working branches.

Inspect Git status before making modifications.

Do not overwrite uncommitted changes, change branches unnecessarily, or modify another developer's work.

All three repositories should be open in the same VS Code multi-root workspace.

If a repository cannot be accessed, identify the issue instead of assuming its contents.

---

## 3. APPLICATION ARCHITECTURE

Our application uses:

| Service | Technology | Intended local port |
|---|---|---|
| Group-12-Frontend | Angular | 4200 |
| Group-12-Auth | NestJS | 3000 |
| Group-12-Backend | Spring Boot | 8081 |

### Databases

**capstone2026**

Operational trading database containing existing client, account, portfolio, order, financial, administrative, and other application data as supported by its schema.

**data_warehouse**

Analytics database used for administrator platform overview metrics.

### Other technologies

- PostgreSQL
- Docker
- Jenkins
- Linux VM
- SSH tunneling
- AWS S3
- AWS CloudFront
- AWS ECR
- AWS ECS

### Expected authentication architecture

Angular → NestJS → PostgreSQL

NestJS handles:

- Client registration
- Client login
- Administrator login
- Password verification
- JWT generation
- Refresh tokens
- Logout

### Expected trading architecture

Angular → Spring Boot → PostgreSQL

Spring Boot handles:

- Trading functionality
- Orders
- Holdings
- Client account information
- Portfolio values
- Market data
- Administrator dashboard queries
- Financial operations
- Administrator management
- JWT verification
- Backend role authorization

### JWT integration

1. Angular sends login credentials to NestJS.
2. NestJS validates credentials using PostgreSQL.
3. NestJS issues a JWT containing the authenticated identity and role.
4. Angular sends the token when calling protected Spring Boot APIs.
5. Spring Boot validates the JWT.
6. Spring Boot determines whether the user has permission to access the requested endpoint.
7. Spring Boot retrieves authorized data and returns it to Angular.

Never connect Angular directly to PostgreSQL.

Do not introduce a new authentication system.

Do not move existing trading logic into NestJS.

---

# PHASE 1 — COMPLETE READ-ONLY ANALYSIS

**DO NOT MODIFY ANY CODE.**

Thoroughly analyze all three repositories before attempting integration.

## 4. FRONTEND ANALYSIS

Inspect:

- Application routing
- Angular configuration
- Environment files
- HTTP services
- Authentication services
- Route guards
- HTTP interceptors
- Login components
- Registration components
- Client dashboard
- Administrator dashboard
- Trading components
- Portfolio components
- Instrument search functionality
- Charts
- Sidebar
- Navbar
- Light/dark mode
- User profile dropdown
- Existing models and interfaces
- Existing tests
- `proxy.conf.json`
- `angular.json`
- `docs/INTEGRATION.md`
- `tools/mock-api/server.mjs`

Identify the actual endpoints called by each page.

Identify which frontend components currently rely on mock data.

Identify which backend responses they expect.

Do not create duplicate frontend services when appropriate ones already exist.

## 5. NESTJS AUTHENTICATION ANALYSIS

Inspect:

- NestJS modules
- Controllers
- Services
- DTOs
- Client entities
- Administrator entities
- Authentication guards
- JWT creation
- JWT payload structure
- Password hashing
- Client registration
- Client login
- Administrator login
- Refresh-token handling
- Cookie settings
- Logout functionality
- PostgreSQL connection settings
- Existing unit and E2E tests

Determine exactly what already works.

Confirm API request and response formats before changing Angular.

## 6. SPRING BOOT BACKEND ANALYSIS

Inspect:

- REST controllers
- Services
- Repositories
- Entity mappings
- DTOs
- SQL queries
- Database configuration
- Trading operations
- Orders and executions
- Account balances
- Holdings and portfolio calculations
- Market-data functionality
- Instrument data
- Administrator management
- JWT verification
- Spring Security
- Role-based access control
- Analytics queries
- Existing tests

Identify APIs that already provide the information required by Angular.

Preserve existing business rules.

### Required Phase 1 report

For every feature, classify it as:

- Already implemented and working
- Implemented but not connected
- Implemented but defective
- Missing endpoint
- Missing SQL query
- Missing database data
- Missing frontend connection
- Configuration issue
- Not yet verified

Provide the findings and proposed file changes before editing anything.

---

# PHASE 2 — LOCAL PORTS, SSH TUNNELING AND CONNECTIVITY

## 7. REQUIRED LOCAL PORTS

Use these intended service ports:

- Angular: 4200
- NestJS: 3000
- Spring Boot: 8081

Verify actual listening ports and Docker port mappings.

Do not change the service ports unnecessarily.

### Important network restriction

**WE CAN ONLY USE SSH TUNNELING AND REST APIs FOR REMOTE DEVELOPMENT.**

Do not implement:

- WebSockets
- Socket.IO
- STOMP
- WebSocket gateways
- Real-time persistent socket connections

Use REST APIs for communication between Angular and the backend services.

## 8. LINUX AND SSH CONFIGURATION

First determine where each service actually runs:

- Windows development machine
- Linux VM
- Docker container on Linux
- Docker container locally
- Another private host

Do not assume the location.

If services run on Linux, inspect SSH connectivity.

Verify:

- SSH hostname/IP
- SSH username
- SSH port
- SSH authentication configuration
- Required VPN or bastion access
- Remote listening ports
- Linux firewall/network restrictions
- Docker host-to-container port mappings

Use secure local SSH port forwarding when appropriate.

### Example tunnel mapping

If NestJS and Spring Boot are directly reachable on Linux localhost:

Windows localhost:3000 → Linux localhost:3000

Windows localhost:8081 → Linux localhost:8081

Example command:

ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:3000:127.0.0.1:3000 -L 127.0.0.1:8081:127.0.0.1:8081 <verified-linux-ssh-host>

This is an illustrative command.

Verify the actual SSH host and destination addresses before running it.

If a local port is already occupied, propose an alternative local tunnel port and adjust only the necessary proxy target.

If services run locally, connect directly rather than introducing an unnecessary tunnel.

If Docker is involved, connect through the correct Docker host port.

Do not expose internal application or database ports publicly.

## 9. ANGULAR PROXY CONFIGURATION

Inspect the existing frontend proxy.

Expected frontend prefixes:

- `/auth-api`
- `/trading-api`

Expected routing:

Angular `/auth-api/auth/login`

→ Angular development proxy

→ localhost:3000 or the configured SSH tunnel

→ NestJS `/auth/login`

Angular `/trading-api/...`

→ Angular development proxy

→ localhost:8081 or the configured SSH tunnel

→ Spring Boot's actual endpoint path

Verify:

- Correct targets
- Prefix rewriting
- Correct HTTP methods
- Request headers
- Authorization headers
- Refresh-token cookies
- Request credentials
- Supported Angular proxy syntax
- Existing environment configuration

Do not accidentally send requests to the mock API server.

Test both services independently before testing Angular.

Document the verified ports and routing.

---

# PHASE 3 — POSTGRESQL CONNECTIVITY

## 10. DATABASE REQUIREMENTS

Our databases are:

**capstone2026**

**data_warehouse**

Inspect existing database configurations.

Confirm:

- Host
- Port
- Database name
- Username configuration
- Authentication configuration
- Actual tables
- Actual columns
- Relationships
- Existing indexes
- Repository queries
- Existing entities
- Available records

Verify that NestJS and Spring Boot can reach their required databases.

Verify which application owns each database operation.

Do not guess column or table names.

Do not modify existing schemas unnecessarily.

Do not enable automatic schema synchronization.

Do not execute destructive migrations.

Do not overwrite production data.

Use parameterized SQL queries.

Preserve existing financial calculations and data relationships.

If a query requires a table or column that does not exist, report the issue and propose a solution before changing the schema.

---

# PHASE 4 — CONNECT ANGULAR AND NESTJS AUTHENTICATION

## 11. CLIENT REGISTRATION

Reuse the existing endpoint:

POST `/auth/register`

Verify the actual controller and DTO.

Expected behavior:

1. User opens Angular registration.
2. User enters registration information.
3. Angular sends the request to NestJS.
4. NestJS validates the request.
5. NestJS securely hashes the password.
6. Client information is saved to PostgreSQL.
7. The user can subsequently log in with the registered credentials.

Do not create a second registration implementation.

## 12. CLIENT LOGIN

Reuse:

POST `/auth/login`

Verify:

- Email/password validation
- Existing bcrypt hashes
- Correct client record retrieval
- Existing JWT generation
- Correct `accessToken` response field
- Angular session handling
- Correct navigation after login
- JWT expiration behavior
- Error messages
- Logout
- Refresh-token compatibility

## 13. ADMINISTRATOR LOGIN

Preserve existing administrator authentication.

Roles:

- super_admin
- operations
- finance

Verify that administrator credentials can be validated against the existing database records.

Verify the JWT contains the correct role information.

Verify Spring Boot accepts the JWT and enforces permissions.

Use the existing administrator login logic.

Do not allow ordinary users to choose an administrator role during public registration.

## 14. REFRESH TOKENS AND LOGOUT

Inspect existing implementations before changing anything.

Verify:

- Angular interceptor behavior
- JWT expiration
- Refresh-token rotation
- HttpOnly cookie behavior
- Cookie paths
- Credentials forwarding
- `/auth-api` proxy compatibility
- Browser refresh/session restoration
- Logout revocation

Only modify code when an actual incompatibility is identified.

Do not put refresh tokens into localStorage.

---

# PHASE 5 — REPLACE SERVER.MJS MOCK DATA WITH REAL BACKEND APIs

## 15. MOCK API ANALYSIS

The frontend contains:

`tools/mock-api/server.mjs`

Analyze the entire file.

Identify:

- Mock endpoints
- Mock responses
- Mock authentication behavior
- Mock client dashboard data
- Mock administrator dashboard data
- Expected request parameters
- Response JSON structures
- HTTP status codes

### Required implementation

**Create, update, or confirm all necessary queries and backend endpoints that provide the information currently simulated by server.mjs.**

For every mock endpoint:

1. Identify the Angular component using it.
2. Identify the expected request.
3. Identify the expected response.
4. Search Spring Boot for an existing matching endpoint.
5. Search repositories for an existing query.
6. Identify the correct PostgreSQL database.
7. Verify actual tables and columns.
8. Reuse the existing implementation if available.
9. Create or correct functionality only when necessary.
10. Connect the existing Angular service.
11. Test with actual database data.

Preserve `server.mjs` for isolated frontend testing.

Normal integrated operation must use real NestJS and Spring Boot APIs.

Do not generate fake database values.

---

# PHASE 6 — CLIENT HOME PAGE DATA

**DATABASE: capstone2026**

All client dashboard information must belong to the authenticated client.

Use identity obtained from the validated JWT.

## 16. ACCOUNT CASH BALANCE

Retrieve the client's current cash balance from the existing account information.

Use existing cash-management logic.

## 17. TOTAL PORTFOLIO VALUE

Calculate the value of all current holdings using the latest platform-held price for each instrument.

Preserve the existing portfolio valuation implementation.

## 18. TOTAL RETURN

Retrieve or calculate total investment return.

Inspect the existing financial formulas.

Do not confuse total return with:

- Total portfolio value
- Total account value
- Available cash

## 19. PORTFOLIO PERFORMANCE LINE GRAPH

Provide invested-capital-over-time data using filled orders.

Use actual:

- Buy fills
- Sell fills
- Executed quantities
- Executed prices
- Execution timestamps

Return chronological values.

Reuse existing order and portfolio logic.

Distinguish invested capital from historical market value and other performance metrics.

Do not invent historical prices or transactions.

## 20. ACCOUNT OVERVIEW

Display:

- Buying power
- Cash
- Holdings value
- Total account value

Requested relationships:

Cash = Buying Power

Holdings Value = Total Portfolio Value

Total Account Value = Cash + Holdings Value

Verify compatibility with existing trading rules.

Do not change financial business logic without identifying an actual problem.

## 21. CURRENT HOLDINGS

Retrieve:

- Instrument ID
- Instrument symbol
- Quantity held
- Latest platform price
- Holding value
- Existing additional fields required by Angular

Use the most recent price actually held by the platform.

Handle missing prices correctly.

## 22. RECENT ORDERS

Retrieve the authenticated client's recently placed orders.

Include:

- Order ID
- Instrument
- Buy/sell side
- Quantity
- Order status
- Applicable price
- Creation and execution timestamps

Preserve existing order statuses and processing logic.

### Client data isolation

Never allow a client to access another client's balances, holdings, or orders by manipulating a URL or request parameter.

Validate the JWT and associated account ownership on every protected endpoint.

---

# PHASE 7 — ADMIN DASHBOARD PLATFORM OVERVIEW

**DATABASE: data_warehouse**

Create, update, or confirm all necessary queries and APIs.

## 23. REGISTERED CLIENTS

Retrieve the number of registered client records.

Avoid double-counting through joined accounts.

## 24. ACCOUNTS WITH CASH

Retrieve the number of client accounts with a positive cash balance.

## 25. TOTAL CLIENT CASH

Retrieve the sum of all client cash balances.

Preserve existing aggregation rules.

## 26. TRADABLE INSTRUMENTS

Retrieve the total number of currently tradable instruments.

Use existing instrument tradability rules.

## 27. ADMINISTRATOR COUNTS

Retrieve:

- Total number of administrators
- Number of super_admin administrators
- Number of operations administrators
- Number of finance administrators

Verify whether these records and metrics exist in data_warehouse.

If a metric is unavailable in the warehouse, identify the authoritative source and propose a correction rather than generating an inaccurate number.

### Platform Overview RBAC

Some information may be shown or hidden according to administrator role.

Analyze existing platform overview permissions.

Propose a metric-level permission matrix if rules are not yet defined.

Do not assume all administrators can view all metrics.

Do not widen existing access without approval.

Enforce these permissions in Spring Boot as well as Angular.

---

# PHASE 8 — ADMIN TRADING OPERATIONS

**DATABASE: capstone2026**

**AUTHORIZED ROLES:**

- super_admin
- operations

**NOT AUTHORIZED:**

- finance

These permissions are explicit project requirements.

## 28. CLIENT ACTIVITY LOOKUP

Allow administrators to search for a client by:

- Client ID
- Email address

Retrieve relevant client activity through existing database records and application logic.

## 29. ORDER LOOKUP

Allow administrators to find and trace an order using:

- Order ID

Return the existing relevant order details and lifecycle information.

Do not create a duplicate order system.

## 30. MARKET DATA HEALTH

Provide a list of market-data health information.

Required filters:

- All
- Fresh
- Stale
- No quote
- Not tradable

Provide counts for:

- Fresh quotes
- Stale quotes
- Instruments without a quote
- Non-tradable instruments

### Quote freshness

Orders should be priced only using quotes less than 30 seconds old, according to the platform's existing validation rules.

Inspect the actual implementation and preserve it.

Distinguish between:

- Quote freshness
- Quote availability
- Instrument tradability

If these statuses overlap, preserve accurate counts and clearly document how filtering works.

Do not modify order execution or price-validation rules just to populate the dashboard.

### Trading Operations RBAC

Only super_admin and operations can access this section.

Angular must hide it from finance.

Angular route guards must block unauthorized navigation.

Spring Boot must independently reject unauthorized API requests.

Authenticated finance users must receive HTTP 403 for protected Trading Operations endpoints.

---

# PHASE 9 — ADMIN FINANCIAL OPERATIONS

**DATABASE: capstone2026**

**AUTHORIZED ROLES:**

- super_admin
- finance

**NOT AUTHORIZED:**

- operations

These permissions are explicit project requirements.

## 31. CLIENT CASH POSITIONS

Display authorized client cash-position information.

Required functionality:

- Search client by name
- Search client by email
- Sort by highest cash balance
- Sort names A–Z
- Sort by newest clients

Use the existing cash/account data model.

Preserve correct account aggregation.

Use pagination where appropriate.

Do not expose unnecessary sensitive client data.

### Financial Operations RBAC

Only super_admin and finance can access this section.

Angular must hide it from operations.

Spring Boot must return HTTP 403 when an unauthorized authenticated administrator directly requests the API.

Do not rely only on hiding the frontend tab.

---

# PHASE 10 — ADMINISTRATIVE MANAGEMENT

**AUTHORIZED ROLE: super_admin ONLY**

Do not allow operations or finance to access this section.

Use the existing administrator-management functionality.

## 32. ADMINISTRATOR LIST

Display:

- Administrator first and last name
- Email
- Assigned role

## 33. ADMINISTRATOR SEARCH

Allow searching by:

- Name
- Email

## 34. ADMINISTRATOR ROLE FILTER

Allow filtering by:

- super_admin
- operations
- finance

## 35. ADD NEW ADMINISTRATOR

An authorized super_admin must be able to create a new administrator.

Required fields:

- First name
- Last name
- Email address
- Temporary password
- Assigned role

Reuse the existing Spring Boot administrator creation controller, service, DTOs, and repository where available.

Preserve:

- Existing password hashing
- Duplicate-email validation
- Role validation
- Existing email-domain rules
- Existing administrative authorization policies
- Existing database structure

Do not expose administrator registration as part of public client signup.

Do not expose stored password hashes.

Verify that a newly created administrator can authenticate through NestJS using the temporary password.

### Administrative Management RBAC

Only super_admin can:

- View administrators
- Search administrators
- Filter administrators
- Create administrators

Unauthorized authenticated users must receive HTTP 403.

---

# PHASE 11 — ADMINISTRATOR ROLE ACCESS MATRIX

Apply the following requested role permissions.

| Feature | super_admin | operations | finance |
|---|---|---|---|
| Platform Overview | Per approved metric permissions | Per approved metric permissions | Per approved metric permissions |
| Client Activity Lookup | ALLOW | ALLOW | DENY |
| Order Lookup | ALLOW | ALLOW | DENY |
| Market Data Health | ALLOW | ALLOW | DENY |
| Client Cash Positions | ALLOW | DENY | ALLOW |
| Administrator List | ALLOW | DENY | DENY |
| Administrator Search | ALLOW | DENY | DENY |
| Administrator Role Filter | ALLOW | DENY | DENY |
| Create New Administrator | ALLOW | DENY | DENY |

### Security requirements

1. NestJS issues JWTs.
2. Spring Boot verifies JWTs.
3. Spring Boot enforces backend permissions.
4. Angular displays only authorized functionality.
5. Angular route guards protect navigation.
6. Protected backend APIs must never rely solely on frontend checks.
7. Return HTTP 401 for unauthenticated requests.
8. Return HTTP 403 for authenticated users lacking permission.
9. Preserve existing claim and role naming conventions.
10. Never trust a role provided by an editable frontend field.

If existing backend permissions conflict with this matrix, report the conflict and request approval before changing security policies.

---

# PHASE 12 — FRONTEND CLIENT UI CHANGES

These are explicitly requested modifications.

## 36. INSTRUMENT SEARCH BAR

On the client dashboard, add a search bar near the top of the main page.

Position:

- Above the date
- Aligned with the date/greeting area

Function:

Allow clients to search currently available trading instruments and retrieve the latest available platform price.

Connect to the existing Spring Boot instrument API where possible.

Do not hardcode prices or instruments.

Include loading, error, and no-results states.

## 37. REPLACE SIDEBAR WITH TOP NAVBAR

Remove the left sidebar from client and administrator layouts.

Move the previous sidebar navigation actions into a top navigation bar.

### Left side

Display the existing authorized navigation actions.

Examples:

- Dashboard
- Trading
- Portfolio
- Orders
- Role-appropriate administrator sections

Preserve existing routes and actions.

### Right side

Keep:

- Dark/light theme toggle
- User profile card

Right-align these elements.

Use shared components where appropriate.

Support responsive layouts.

Do not change navigation behavior unnecessarily.

## 38. CHANGE BUTTON LABELS

Client dashboard:

`New Trade` → `Place Trade`

Profile dropdown:

`Profile & Account` → `Profile`

Preserve the original functions and routes.

## 39. PORTFOLIO PERFORMANCE CARD

Adjust the portfolio performance card height to improve layout balance.

Preserve existing chart logic.

Ensure the chart is readable on desktop and mobile.

---

# PHASE 13 — FRONTEND ADMIN UI CHANGES

## 40. ADMIN TOP NAVBAR

Replace the administrator sidebar with the new shared top navbar.

Show navigation based on the authenticated administrator role.

### super_admin

Display authorized access to:

- Platform Overview
- Trading Operations
- Financial Operations
- Administrative Management

### operations

Display authorized access to:

- Platform Overview
- Trading Operations

Hide:

- Financial Operations
- Administrative Management

### finance

Display authorized access to:

- Platform Overview
- Financial Operations

Hide:

- Trading Operations
- Administrative Management

Use actual approved Platform Overview metric permissions.

## 41. EQUAL-HEIGHT CARDS

All cards in the same dashboard row should match in height.

Use existing CSS styling conventions.

Avoid content clipping.

Keep layouts responsive.

Do not redesign unrelated components.

---

# PHASE 14 — PUBLIC LANDING PAGE

## 42. CREATE DEFAULT LANDING PAGE

Create a public landing page at:

`/`

Use the existing trading platform branding and logo.

### Navbar

Show:

- Login
- Sign Up

Instead of the authenticated user's profile card.

Login button → `/login`

Sign Up button → `/register`

### Landing page content

Include:

- Existing platform logo
- Trading platform name
- Brief application introduction
- Portfolio tracking features
- Instrument search/trading features
- Holdings information
- Order history features
- Account management features
- Clear invitation to register or log in

Make the landing page:

- Professional
- Informative
- Responsive
- Accessible
- Compatible with light/dark mode

Reuse existing components and styles.

Do not invent fake live market statistics.

Preserve existing login, registration, client, and administrator routes.

---

# PHASE 15 — REST API DATA REFRESH

We cannot use WebSockets.

Use REST APIs exclusively.

### Client dashboard

Retrieve initial data using ordinary HTTP GET requests.

Refresh relevant information after:

- Login
- Trade submission
- Relevant account actions
- Navigation back to the dashboard
- Manual refresh

If time-sensitive updates are necessary, propose controlled HTTP polling.

Do not add continuous polling to every component.

### Market data

Retrieve latest available prices through existing Spring Boot REST endpoints.

### Orders

Retrieve updated order statuses using REST endpoints.

Preserve existing business logic.

Do not introduce WebSockets for prices, orders, portfolio values, or administrative data.

---

# PHASE 16 — COMPLETE LOCALHOST STARTUP

## 43. START THE FULL APPLICATION

The integration is not complete merely because the individual applications compile.

Verify that the complete system runs locally.

### Required development URLs and ports

Angular:

http://localhost:4200

NestJS:

http://localhost:3000

Spring Boot:

http://localhost:8081

These represent intended local entry points. Use SSH forwarding if the underlying services run on Linux.

### Startup order

Verify:

1. Required PostgreSQL databases are reachable.
2. NestJS connects to its database.
3. Spring Boot connects to its required databases.
4. SSH tunnels work if necessary.
5. NestJS authentication responds to API requests.
6. Spring Boot responds to backend requests.
7. Angular starts successfully.
8. Angular proxy routing works.
9. JWT verification works between NestJS and Spring Boot.
10. Angular displays real PostgreSQL data.
11. server.mjs is not supplying normal integrated data.

### Required startup documentation

Provide:

- Exact commands to start NestJS
- Exact commands to start Spring Boot
- Exact commands to start Angular
- Exact SSH tunneling command, if necessary
- Required environment variable names
- Database connection prerequisites
- Relevant ports
- How to verify services are listening
- How to check API connectivity
- How to stop all services

Do not print secrets.

### Optional simplified startup

Once the application works independently, evaluate whether an existing Docker Compose setup or local development script can start the services together.

Do not create new Docker or infrastructure configuration without approval.

---

# PHASE 17 — COMPLETE END-TO-END TESTING

## 44. AUTHENTICATION TESTS

Verify:

- Client registration
- Client login
- Administrator login
- Invalid credentials
- Duplicate registration
- JWT generation
- JWT verification
- Refresh tokens
- Logout
- Session restoration
- Correct client/admin routing

Use real services and appropriate development/test database data.

## 45. CLIENT DASHBOARD TESTS

Verify:

- Account cash balance
- Total portfolio value
- Total return
- Invested-capital chart
- Buying power
- Holdings value
- Total account value
- Current holdings
- Latest instrument prices
- Recent orders
- Instrument search
- Correct client-level data isolation

## 46. ADMIN DASHBOARD TESTS

Verify:

- Registered client count
- Accounts with positive cash
- Total client cash
- Tradable instrument count
- Administrator totals by role
- Client activity lookup
- Order lookup
- Market-data health
- Financial cash positions
- Name/email search
- Sorting/filtering
- Administrator list
- Administrator creation

## 47. ADMIN RBAC TESTS

Test all three roles.

### super_admin

Must access:

- Trading Operations
- Financial Operations
- Administrative Management
- Authorized Platform Overview metrics

### operations

Must access:

- Trading Operations
- Authorized Platform Overview metrics

Must be denied:

- Financial Operations
- Administrative Management

### finance

Must access:

- Financial Operations
- Authorized Platform Overview metrics

Must be denied:

- Trading Operations
- Administrative Management

Also test:

- Unauthenticated users
- Normal clients
- Expired JWTs
- Invalid JWTs
- Direct unauthorized API requests

Verify frontend visibility and backend enforcement independently.

## 48. UI TESTS

Verify:

- Landing page
- Login/Sign Up navigation
- Client dashboard
- Admin dashboard
- New top navbar
- Role-based navigation
- Theme switching
- Profile dropdown
- Instrument search
- Equal-height admin cards
- Portfolio chart layout
- Responsive screens

## 49. BUILD AND INTEGRATION VALIDATION

Run existing build and test commands for each repository.

Check browser network requests and application logs.

Report actual results.

Do not say a test passed unless it actually ran.

Do not modify production accounts or execute destructive trades during testing.

If database or infrastructure access is unavailable, report what remains unverified.

---

# PHASE 18 — AWS DEPLOYMENT READINESS

The intended eventual AWS architecture is:

Angular build → S3 → CloudFront

NestJS Docker image → ECR → ECS

Spring Boot Docker image → ECR → ECS

ECS → PostgreSQL

CloudFront / HTTPS → ALB → ECS backend services

### Requirements

Keep local and AWS configurations separate.

Local development may use SSH tunnels.

Production browser communication should use HTTPS API routing.

Do not rely on Angular's development proxy in production.

Consider production equivalents for `/auth-api` and `/trading-api` routing.

Preserve secure JWT handling.

Do not publicly expose PostgreSQL.

Do not deploy anything to AWS during this task.

Do not change AWS infrastructure without approval.

---

# PHASE 19 — STRICT CODE CHANGE RESTRICTIONS

**THIS IS ONE OF THE MOST IMPORTANT SECTIONS.**

Preserve original code and functionality.

Do not:

1. Rewrite working authentication logic.
2. Rewrite working trading logic.
3. Replace existing financial calculations.
4. Rebuild existing dashboards unnecessarily.
5. Create duplicate controllers or services.
6. Introduce unnecessary dependencies.
7. Rename files or classes unnecessarily.
8. Modify unrelated components.
9. Change database schemas without justification and approval.
10. Delete server.mjs.
11. Replace real data with mock data.
12. Introduce WebSockets.
13. Modify order execution rules unnecessarily.
14. Change JWT claims without analyzing compatibility.
15. Weaken existing security controls.
16. Modify unrelated Docker files.
17. Modify Jenkins pipelines.
18. Modify AWS infrastructure.
19. Overwrite uncommitted changes.
20. Automatically commit or push changes.
21. Modify production data.
22. Expose environment secrets.
23. Perform broad code formatting or refactoring.
24. Remove existing working functionality.

Before making a change, identify:

- Exact repository
- Exact file path
- Existing functionality
- Problem being fixed
- Proposed modification
- Reason the modification is necessary
- Risk to existing functionality
- How to verify the change

Prefer the smallest possible implementation.

The requested frontend redesign is authorized in scope, but only modify the components needed to implement those explicit requirements.

---

# PHASE 20 — REQUIRED INTERACTIVE DEVELOPMENT WORKFLOW

I do not want you to rush through all phases.

Work step by step.

### STEP 1 — READ-ONLY ANALYSIS

Analyze all three repositories thoroughly.

Do not change any code.

### STEP 2 — REPORT FINDINGS

Provide a detailed technical report.

For every functionality, identify:

| Feature | Repository | Current implementation | Database | Status | Required change |
|---|---|---|---|---|---|

Include:

- Current architecture
- Port mappings
- SSH requirements
- Existing API endpoints
- Missing APIs
- Existing SQL queries
- Missing queries
- JWT compatibility
- Role permissions
- Frontend integration gaps
- Existing working functionality
- Exact files that may require modifications

### STEP 3 — PROPOSE MINIMAL CHANGES

Show the file-by-file proposed modification plan.

Explain why each file must change.

Do not modify anything until approved.

### STEP 4 — IMPLEMENT ONE APPROVED STEP AT A TIME

Follow this implementation order:

1. Verify local/Linux networking and SSH.
2. Verify service ports.
3. Verify PostgreSQL connectivity.
4. Integrate Angular and NestJS authentication.
5. Verify Spring Boot connectivity.
6. Verify JWT compatibility and authorization.
7. Connect client dashboard data.
8. Connect data_warehouse Platform Overview.
9. Implement Trading Operations integration.
10. Implement Financial Operations integration.
11. Implement Administrative Management integration.
12. Implement client UI improvements.
13. Implement admin UI improvements.
14. Create the public landing page.
15. Complete REST-only data refresh behavior.
16. Run complete localhost integration.
17. Perform end-to-end tests.
18. Document AWS compatibility.

### STEP 5 — AFTER EACH APPROVED CHANGE

Show:

1. What was done.
2. Which exact files changed.
3. Why those files changed.
4. What functionality was preserved.
5. What commands were executed.
6. What tests passed.
7. What tests failed.
8. Any remaining blockers.

**STOP AND WAIT FOR MY APPROVAL BEFORE MOVING TO THE NEXT STEP.**

Do not make multiple unrelated changes in one step.

Do not silently continue to the next phase.

---

# FINAL ACCEPTANCE CRITERIA

The full application should work locally at:

**http://localhost:4200**

The final result must include:

### Angular

- Working landing page
- Working registration
- Working login
- Client dashboard
- Administrator dashboard
- Real database-backed data
- Top navbar
- Role-based navigation
- Theme controls
- Working instrument search
- Existing trading functionality

### NestJS

- Working authentication
- PostgreSQL connectivity
- Client registration
- Client login
- Administrator login
- JWT generation
- Refresh-token handling
- Logout

### Spring Boot

- Working REST APIs
- JWT verification
- Portfolio calculations
- Cash balances
- Holdings
- Recent orders
- Instrument prices
- Administrator analytics
- Trading Operations
- Financial Operations
- Administrative Management
- Correct role-based authorization

### PostgreSQL

- capstone2026 connected
- data_warehouse connected
- Existing schemas preserved
- Necessary SQL queries implemented or verified
- Accurate dashboard information

### Networking

- Angular port 4200
- NestJS port 3000
- Spring Boot port 8081
- Correct Angular proxy configuration
- SSH tunneling when required
- REST APIs only
- No WebSockets

### Code quality

- No unnecessary changes
- Existing logic preserved
- No duplicate functionality
- No fake data in integrated operation
- No unapproved infrastructure changes
- Verified startup instructions
- Actual test results

The task must not be marked fully complete unless the required functionality has been verified.

If a dependency cannot be tested, clearly identify it as unverified.

---

# START NOW — READ-ONLY ANALYSIS ONLY

Begin by thoroughly inspecting the actual source code of all three repositories.

Focus first on:

1. Ports 4200, 3000, and 8081.
2. Linux SSH tunneling.
3. Angular proxy configuration.
4. NestJS login and registration.
5. PostgreSQL connectivity.
6. Spring Boot JWT verification.
7. capstone2026 queries.
8. data_warehouse queries.
9. server.mjs mock API contracts.
10. Client dashboard data.
11. Trading Operations permissions: super_admin and operations.
12. Financial Operations permissions: super_admin and finance.
13. Administrative Management permissions: super_admin only.
14. Existing frontend components and requested UI changes.
15. The smallest set of changes necessary to run the complete application locally.

**DO NOT MODIFY ANY CODE YET.**

Present the technical analysis, integration gaps, proposed changes, and implementation order.

Wait for my approval before making changes.

The ultimate goal is a working, database-backed, three-repository trading platform accessible through localhost:4200, with secure SSH tunneling where necessary, REST-only communication, correct administrator role permissions, and all existing original business logic preserved.
