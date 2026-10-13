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






PRompt:

# Build a Modern Fidelity-Inspired Digital Trading Platform UI

## 1. Project Overview

You are a senior UI/UX designer and Angular frontend engineer.

I am building a full-stack digital trading platform using:

- **Frontend:** Angular, TypeScript, HTML, SCSS/CSS
- **Authentication:** NestJS with JWT authentication
- **Backend:** Spring Boot REST APIs
- **Database:** PostgreSQL
- **API integration:** Angular HttpClient and OpenAPI-generated clients where supported

Your task is to design and implement a beautiful, functional, modern, and intuitive frontend for this trading platform.

**Important:** First inspect my existing frontend codebase, project structure, API interfaces, and the provided LEAP Project Business Requirements Specification PDF. Treat the business requirements as the source of truth. Preserve existing functionality and naming conventions.

Do not modify my NestJS authentication repository, Spring Boot backend, PostgreSQL schemas, or existing API contracts.

## 2. Overall Design Vision

Create a financial trading experience combining:

- Fidelity's trusted, professional financial appearance
- Robinhood's simplicity and approachable user experience
- Modern fintech dashboard design
- Apple's clean typography, whitespace, and visual refinement

The application must look like a legitimate, production-quality financial trading platform, not a generic college project, Bootstrap template, or overly complicated institutional trading terminal.

**Target audience: Adults ages 20–55.**

The experience must appeal to:

- Younger investors, ages 20–30, who prefer elegant, interactive, visually engaging interfaces.
- Working professionals, ages 30–45, who want quick access to their finances and investments.
- Experienced investors, ages 45–55, who value readability, reliability, accessibility, and straightforward navigation.

The main objective is to make trading and portfolio management feel **simple, intelligent, secure, and enjoyable**.

## 3. Color Palette and Branding

Use a Fidelity-inspired green, white, and neutral color system.

Suggested design tokens:

| Purpose                 | Color           | Hex       |
| ----------------------- | --------------- | --------- |
| Primary deep green      | Forest green    | `#073B2A` |
| Primary action          | Financial green | `#087E4A` |
| Hover / secondary green | Emerald green   | `#12945C` |
| Light accent            | Pale sage       | `#E7F5EC` |
| Main background         | Off-white       | `#F7F9F8` |
| Card surfaces           | White           | `#FFFFFF` |
| Primary typography      | Charcoal        | `#172B24` |
| Secondary typography    | Muted gray      | `#66756D` |
| Premium accent          | Subtle gold     | `#C8A46B` |

These are suggested Fidelity-inspired design colors, not a claim of official Fidelity brand specifications.

Design rules:

- Use green to establish brand identity without overwhelming the interface.
- Favor white and off-white backgrounds with generous whitespace.
- Use dark green for primary buttons, navigation accents, and important headings.
- Reserve brighter green and red for financial changes where appropriate, paired with text or icons so meaning never depends on color alone.
- Use gold sparingly for premium design details.
- Avoid overly bright neon colors, excessive gradients, or complicated backgrounds.
- Support light mode and dark mode, with light mode as the default.
- Do not use Fidelity's official logo or imply affiliation; create an original application identity.

## 4. Global Layout and Navigation

Create a responsive application shell.

### Desktop experience

Use a professional left sidebar with:

- Dashboard
- Markets / Explore
- My Portfolio
- Trade
- Orders & History
- Watchlist
- Notifications
- Settings

Only show pages and features supported by the project requirements.

The sidebar should have clear icons and text labels, an obvious selected-page indicator, and an option to collapse.

Use a modern top navigation bar containing:

- Application branding
- Global instrument search
- Notifications bell
- User profile dropdown
- Account-related navigation

### Mobile and tablet experience

Adapt the interface rather than simply shrinking desktop components.

Use a compact navigation system, mobile-friendly investment charts, properly spaced action buttons, and vertically stacked financial cards.

Avoid unnecessary horizontal scrolling.

## 5. Key Application Screens

Design the following screens where supported by the business requirements and existing APIs.

### A. Landing / Welcome Page

Create a premium financial technology landing page.

Include a strong hero section introducing the trading platform, a clear explanation of its value, prominent Log In and Get Started buttons, and a visual preview of the dashboard.

The design should feel trustworthy, sophisticated, modern, and welcoming.

Avoid exaggerated investment claims or guaranteed-return messaging.

### B. Login and Authentication

Create a clean authentication experience with:

- Username/email and password inputs, matching the existing API contract
- Show/hide password control
- Helpful inline validation
- Clear loading and error messages
- Accessible login buttons
- Responsive layout

Use the existing NestJS authentication endpoints and JWT contract.

Trader registration should be implemented only where supported.

For administrator accounts, **only a Super Admin can register other administrators**. Do not create a publicly available administrator sign-up screen.

### C. Trader Dashboard

This should be the visual centerpiece of the application.

Create a premium portfolio dashboard featuring, where data is available:

- Total portfolio value
- Portfolio gains and losses
- Daily portfolio performance
- Available cash / buying power
- Interactive portfolio-performance chart
- Top holdings
- Recent orders
- Watchlist preview
- Quick Buy and Sell actions

Use attractive, lightweight summary cards and clear financial typography.

Make the dashboard informative without feeling crowded.

The layout should communicate the most important financial information within the first few seconds.

### D. Markets / Explore

Create an intuitive market discovery screen.

Support available instrument data such as:

- Instrument name
- Symbol / ticker
- Current available price
- Asset class
- Currency
- Tradability status

Add searching, filtering, sorting, and instrument details as supported by the backend.

For data not supplied by the backend, do not invent live market feeds, price changes, charts, or trading availability.

### E. Instrument Details

Design a professional stock/instrument information page.

Where supported, show:

- Company or instrument name
- Ticker symbol
- Price
- Instrument information
- Available chart/history information
- Buy and Sell actions
- Watchlist controls

Make the most important actions easy to find.

### F. Trade Execution

Design an intuitive and trustworthy order-entry interface.

Include supported fields such as:

- Buy / Sell selection
- Selected instrument
- Order quantity
- Price and order-type fields where supported
- Estimated value
- Relevant fees
- Order review and confirmation

Use a clear trade progression:

**Select Instrument → Enter Order → Review → Confirm → View Result**

Display meaningful success, pending, rejected, and error states according to the backend response.

Never simulate a successful real trade when the API has not confirmed it.

### G. Portfolio and Order History

Create clean, sortable tables and responsive card layouts for holdings and orders.

Display relevant supported information such as symbol, quantity, valuation, transaction type, status, and dates.

Provide understandable empty states, helpful labels, and detail views.

Make tables easy to use for investors who are not highly technical.

### H. Notifications

Create a centralized notification interface for supported events, such as order status changes, account-related updates, and system alerts.

Provide a notification bell with unread count, notification list, read/unread visual states, and meaningful timestamps where supported.

If the backend does not yet provide notifications, build the reusable UI structure but clearly distinguish mock/demo content from live information.

### I. Administrator Dashboard

Create a separate professional administrative interface with role-based navigation.

The platform contains:

- Super Admin
- Operations Admin
- Finance Admin

Permissions must come from the existing backend authorization model.

**Super Admin:** Provide an interface to create and manage other administrator accounts where supported.

**Operations Admin:** Expose operational functionality authorized by the business requirements and APIs.

**Finance Admin:** Expose financial-management functionality authorized by the business requirements and APIs.

Do not invent permissions or give all administrators the same unrestricted interface.

Hide unauthorized actions for usability, while preserving backend enforcement as the actual security boundary.

## 6. User Experience Requirements

The interface must be comfortable for people aged 20–55.

Follow these principles:

1. **Readability:** Use professional typography such as Inter, with comfortable font sizes and excellent contrast.
2. **Simplicity:** Keep core tasks understandable with minimal clicks and obvious actions.
3. **Hierarchy:** Make account balances, holdings, and primary actions visually prominent.
4. **Consistency:** Use shared button, card, form, table, and navigation components.
5. **Feedback:** Provide loading skeletons, success messages, error states, and confirmation dialogs.
6. **Accessibility:** Target WCAG 2.2 AA, including keyboard navigation, visible focus states, and accessible form labels.
7. **Responsiveness:** Design for desktop, tablet, and mobile.
8. **Trust:** Use precise financial formatting, clear transaction states, and confirmation before consequential actions.
9. **Performance:** Avoid unnecessary animations, heavy components, and excessive API calls.
10. **Discoverability:** Make important features straightforward to locate without documentation.

Avoid excessive animations, confusing icons, tiny fonts, large empty dashboard areas, or overwhelming financial tables.

## 7. Design System

Create a reusable design system including:

- Primary, secondary, outline, and destructive buttons
- Financial summary cards
- Dashboard charts
- Data tables
- Input fields and dropdowns
- Search bars
- Tabs and filters
- Modal dialogs
- Toast notifications
- Status indicators
- Loading skeletons
- Empty states
- Responsive navigation components

Use consistent spacing, typically an 8px spacing scale, subtle shadows, and moderate border radii around 10–14px.

Animations should be subtle and purposeful, usually 150–250ms, and respect reduced-motion preferences.

Financial charts should have readable labels, tooltips, responsive resizing, and accessible alternatives where appropriate.

## 8. Angular Architecture

Use the existing Angular version and architecture, following the provided training materials where compatible.

Implement:

- Standalone Angular components
- Feature-based folder organization
- Angular Router
- Route guards
- Angular Reactive Forms
- Services and dependency injection
- Angular signals where appropriate
- Angular HttpClient
- OpenAPI-generated API clients where already available
- Reusable typed models and components
- Shared error-handling and loading patterns

Keep presentation logic in components and shared/API logic in services.

Maintain a clear separation between:

**Angular UI → NestJS Authentication / Spring Boot APIs → PostgreSQL through the backend**

The frontend must never access PostgreSQL directly.

Use the application's existing JWT handling and authenticated request patterns. Do not display or log tokens in the UI.

Use environment-based API configuration rather than hardcoded production URLs.

Do not rewrite working application architecture simply to introduce a new UI library.

## 9. Implementation Instructions

Follow this order:

**Phase 1: Inspect**

Analyze the existing Angular application, business requirements specification, routes, components, services, API contracts, and project conventions.

Identify which features are already implemented, which features are required, and which are not supported yet.

**Phase 2: Design**

Create the global design tokens, responsive application shell, navigation, typography, reusable components, and dashboard layout.

**Phase 3: Implement**

Build the supported pages using the design system. Connect existing authentication and trading flows without breaking their current functionality.

**Phase 4: Verify**

Confirm successful compilation, responsive behavior, accessibility, navigation, login behavior, API loading/error handling, and existing test compatibility.

Add appropriate component and interaction tests.

Do not introduce unrequested dependencies without justification.

## 10. Expected Final Result

The platform should feel:

**Modern, premium, trustworthy, sophisticated, intuitive, and accessible.**

It should look like a real financial technology product rather than an academic demonstration.

A 22-year-old investor should appreciate how modern and smooth it feels, while a 55-year-old investor should immediately understand how to navigate, review a portfolio, and execute a trade.

Prioritize a beautiful interface without sacrificing functionality, accessibility, accuracy, or maintainability.

**Start by inspecting the project and producing a brief implementation plan and page inventory. Then implement the design directly in my Angular frontend repository, beginning with the shared layout, theme, and trader dashboard. Preserve all working backend integrations.**
