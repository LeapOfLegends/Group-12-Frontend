// Browser walkthrough of every page against the mock API.
//
//   npm run mock:api      (terminal 1)
//   npm run start:mock    (terminal 2)
//   npm run e2e:mock      (terminal 3)  -> screenshots in tools/e2e/shots/
//
// Requires Playwright's Chromium: `npx playwright install chromium` once.
// Set E2E_BASE_URL to target another dev-server address.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'shots');
fs.mkdirSync(OUT, { recursive: true });
for (const file of fs.readdirSync(OUT)) {
  if (file.endsWith('.png')) fs.unlinkSync(path.join(OUT, file));
}

const results = [];
const consoleErrors = [];
const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
const parseMoney = (text) => Number(String(text).replace(/[^0-9.-]/g, ''));

function check(name, condition, detail = '') {
  results.push({ name, ok: !!condition, detail });
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
}

async function login(page, email, password) {
  await page.waitForSelector('#login-email');
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.click('button[type="submit"]');
}

async function logout(page) {
  // Log out lives in the profile panel, opened from the navbar's profile card.
  await page.click('button[aria-label="Open profile"]');
  await page.click('app-account-panel button:has-text("Log out")');
  await page.waitForURL(/\/login$/);
}

/** Rounded heights of every element matching the selector (to compare cards in one row). */
async function heightsOf(page, selector) {
  return page.$$eval(selector, (elements) => elements.map((element) => Math.round(element.getBoundingClientRect().height)));
}

const sameHeight = (heights) => heights.length > 1 && heights.every((height) => Math.abs(height - heights[0]) <= 1);

/** Polls a page-side predicate: zoneless Angular renders a tick after the event, so instant reads can race it. */
async function eventually(page, predicate, timeout = 2000) {
  try {
    await page.waitForFunction(predicate, null, { timeout });
    return true;
  } catch {
    return false;
  }
}

/** Looks a symbol up through the dashboard search bar and returns the quote panel's text. */
async function lookUp(page, symbol) {
  const input = page.locator('app-instrument-search input');
  await input.fill(symbol);
  await input.press('Enter');
  await page.waitForSelector('app-instrument-search .search-result, app-instrument-search [role="alert"]');
  return (await page.textContent('app-instrument-search .search-panel')).replace(/\s+/g, ' ');
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => consoleErrors.push(String(error)));

const stamp = Date.now();
const newClient = {
  email: `nia.${stamp}@example.com`,
  password: 'ClientPassword123!',
  ssn: `9${String(stamp).slice(-8)}`.replace(/^(\d{3})(\d{2})(\d{4})$/, '$1-$2-$3'),
};

try {
  // --- Landing page, branding, guards and login ---------------------------------
  await page.goto(`${BASE}/`);
  await page.waitForSelector('#landing-login');
  const landingText = await page.textContent('body');
  check('landing page introduces the platform', landingText.includes('Direct trading platform') && landingText.includes('What you can do') && landingText.includes('How it works'));
  check('public navbar offers Log in and Sign up instead of a profile card', !!(await page.$('app-navbar a[href="/login"]')) && !!(await page.$('app-navbar a[href="/register"]')) && !(await page.$('app-navbar .navbar-account')));
  check('landing page invents no statistics', !/\d+(\.\d+)?\s?%|\$\s?[\d,]+/.test(landingText));
  check('browser title carries the JetZy Trading brand', (await page.title()).includes('JetZy Trading'));
  check('favicon is the JetZy mark', (await page.getAttribute('link[rel="icon"]', 'href')) === 'favicon.svg');
  await shot(page, '00-landing');

  await page.click('app-navbar a[href="/register"]');
  await page.waitForURL(/\/register$/);
  await page.waitForSelector('#register-first-name');
  check('navbar Sign up opens the registration page', page.url().endsWith('/register'));
  await page.goto(`${BASE}/does-not-exist`);
  await page.waitForSelector('#landing-login');
  check('unknown URLs show the landing page to visitors', new URL(page.url()).pathname === '/');
  await page.click('app-navbar a[href="/login"]');
  await page.waitForURL(/\/login$/);
  await page.waitForSelector('#login-email');
  check('navbar Log in opens the login page', page.url().endsWith('/login'));
  check('login page shows the JetZy wordmark', (await page.textContent('body')).includes('JetZy'));
  check('login offers a Create Account button', !!(await page.$('#create-account-link')));
  await shot(page, '01-login-desktop');

  await page.goto(`${BASE}/trade`);
  await page.waitForURL(/\/login\?returnUrl=%2Ftrade/);
  check('protected route redirects to login with returnUrl', page.url().includes('returnUrl=%2Ftrade'));

  await login(page, 'jane@example.com', 'wrong-password');
  const alert = await page.waitForSelector('[role="alert"]');
  check('wrong password shows error', (await alert.textContent())?.includes('incorrect'));
  await shot(page, '02-login-error');

  // --- Registration ---------------------------------------------------------------
  await page.click('#create-account-link');
  await page.waitForURL(/\/register$/);
  await page.waitForSelector('#register-first-name');
  check('Create Account navigates to /register', page.url().endsWith('/register'));
  await page.click('button:has-text("Create account")');
  await page.waitForSelector('#register-first-name-error');
  const registerText = await page.textContent('body');
  check('empty registration shows required-field errors', registerText.includes('Enter your first name.') && registerText.includes('Enter your Social Security number.'));
  check('SSN field is masked by default', (await page.getAttribute('#register-ssn', 'type')) === 'password');

  await page.fill('#register-first-name', 'Nia');
  await page.fill('#register-last-name', 'Newby');
  await page.fill('#register-email', 'jane@example.com');
  await page.fill('#register-phone', '3035550123');
  await page.fill('#register-dob', '1990-05-15');
  await page.fill('#register-ssn', newClient.ssn.replace(/-/g, ''));
  await page.fill('#register-password', newClient.password);
  await page.fill('#register-confirm-password', 'Different123!');
  await page.click('button:has-text("Create account")');
  await page.waitForSelector('#register-confirm-password-error');
  check('mismatched confirmation is caught client-side', (await page.textContent('#register-confirm-password-error')).includes('do not match'));
  check('phone number is auto-formatted', (await page.inputValue('#register-phone')) === '303-555-0123');
  await page.fill('#register-confirm-password', newClient.password);
  await page.click('button:has-text("Create account")');
  await page.waitForSelector('#register-email-error');
  check('duplicate email surfaces the backend 409', (await page.textContent('#register-email-error')).includes('already exists'));
  await shot(page, '03-register-duplicate');

  await page.fill('#register-email', newClient.email);
  await page.click('button:has-text("Create account")');
  await page.waitForURL(/\/login\?registered=1/);
  await page.waitForSelector('#login-email');
  const loginAfterRegister = await page.textContent('body');
  check('successful registration redirects to /login with a confirmation', loginAfterRegister.includes('Your account has been created'));
  check('login email is prefilled after registration', (await page.inputValue('#login-email')) === newClient.email);
  await shot(page, '04-login-after-registration');

  await page.fill('#login-password', newClient.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard$/);
  await page.waitForSelector('app-financial-summary-card .summary-value');
  const newClientDashboard = await page.textContent('body');
  check('new client lands on the dashboard with a zero balance', newClientDashboard.includes('$0.00'));
  check('dashboard shows the combined Buying Power & Asset Allocation card', newClientDashboard.includes('Buying Power & Asset Allocation'));
  check('dashboard no longer shows Quick actions', !newClientDashboard.includes('Quick actions'));
  check('empty allocation is explained instead of invented', newClientDashboard.includes('No holdings yet'));
  check('dashboard header offers Place Trade, not New Trade', newClientDashboard.includes('Place Trade') && !newClientDashboard.includes('New Trade'));
  check('the sidebar is gone and the navbar carries the navigation', !(await page.$('app-sidebar')) && !!(await page.$('app-navbar nav.navbar-links a[href="/trade"]')));
  const emptyRow = await heightsOf(page, '.dashboard-grid > *');
  check('empty chart card still matches the card beside it', sameHeight(emptyRow), emptyRow.join(' vs '));
  await shot(page, '05-dashboard-new-client');

  await page.click('a[href="/transfer"] >> nth=0');
  await page.waitForURL(/\/transfer$/);
  await page.waitForSelector('#transfer-amount');
  await page.fill('#transfer-amount', '500');
  await page.click('button:has-text("Review deposit")');
  await page.click('button:has-text("Confirm deposit")');
  await page.waitForURL(/\/transfer\/confirmation$/);
  await page.waitForSelector('text=Deposit completed');
  const firstDeposit = await page.textContent('body');
  check('deposit lands on /transfer/confirmation', page.url().endsWith('/transfer/confirmation'));
  check('transfer confirmation shows amount, status and updated balance', firstDeposit.includes('$500.00') && firstDeposit.includes('Completed') && firstDeposit.includes('Updated cash balance'));
  check('transfer confirmation is honest about the missing transaction id', firstDeposit.includes('Not provided'));
  await shot(page, '06-transfer-confirmation');
  await page.reload();
  await page.waitForSelector('text=Deposit completed');
  check('transfer confirmation survives a refresh', (await page.textContent('body')).includes('$500.00'));
  await page.click('#transfer-return-dashboard');
  await page.waitForURL(/\/dashboard$/);
  await page.waitForSelector('app-financial-summary-card .summary-value');
  check('dashboard reflects the deposited cash', (await page.textContent('app-financial-summary-card >> nth=0 >> .summary-value')).trim() === '$500.00');
  await logout(page);

  // --- Existing client: dashboard --------------------------------------------------
  await login(page, 'jane@example.com', 'ClientPassword123!');
  await page.waitForURL(/\/dashboard$/);
  await page.waitForSelector('app-holdings-table table');
  await page.waitForSelector('app-line-chart svg');
  const cashText = await page.textContent('app-financial-summary-card >> nth=0 >> .summary-value');
  const startingCash = parseMoney(cashText);
  check('dashboard shows a formatted cash balance', /^\$[\d,]+\.\d{2}$/.test(cashText.trim()), cashText.trim());
  const dashboardText = await page.textContent('body');
  check('dashboard shows AAPL holding', dashboardText.includes('AAPL'));
  check('dashboard shows filled order status', dashboardText.includes('Filled'));
  check('dashboard shows total return card', /Total return/.test(dashboardText));
  check('combined card shows buying power and allocation sections', dashboardText.includes('Buying power') && dashboardText.includes('Asset allocation') && dashboardText.includes('Equity'));
  check('navbar hides the admin link for clients', !(await page.$('a[href="/admin"]')));
  check('navbar keeps the theme toggle and profile card on the right', !!(await page.$('app-navbar .navbar-right button[aria-label="Switch to dark theme"]')) && (await page.textContent('app-navbar .navbar-account')).includes('Jane Doe'));
  const aaplRow = page.locator('app-holdings-table tbody tr', { hasText: 'AAPL' }).first();
  const startingAapl = Number((await aaplRow.locator('td').nth(1).textContent()).replace(/,/g, ''));
  const summaryRow = await heightsOf(page, '.grid-3 > *');
  check('summary cards in the same row share one height', sameHeight(summaryRow), summaryRow.join(', '));
  const chartRow = await heightsOf(page, '.dashboard-grid > *');
  check('portfolio performance card matches the height of the card beside it', sameHeight(chartRow), chartRow.join(' vs '));
  const searchBox = await (await page.$('app-instrument-search')).boundingBox();
  const dateBox = await (await page.$('.page-title .eyebrow')).boundingBox();
  check('search bar sits above the date, sharing its left edge', searchBox.y + searchBox.height <= dateBox.y && Math.abs(searchBox.x - dateBox.x) <= 1, `${searchBox.x},${searchBox.y} vs ${dateBox.x},${dateBox.y}`);
  await shot(page, '07-dashboard-desktop');

  // --- Instrument price search --------------------------------------------------
  const searchInput = page.locator('app-instrument-search input');
  await searchInput.fill('AAP');
  await page.waitForSelector('app-instrument-search [role="listbox"] [role="option"]');
  check('search bar suggests matching instruments while typing', (await page.textContent('app-instrument-search [role="listbox"]')).includes('Apple'));
  const aaplQuote = await lookUp(page, 'AAPL');
  check('search bar looks AAPL up by symbol and shows bid, ask and last trade', aaplQuote.includes('Apple') && aaplQuote.includes('$339.94') && aaplQuote.includes('$340.00') && aaplQuote.includes('fresh'));
  check('quote offers to trade the instrument', !!(await page.$('app-instrument-search a[href="/trade?symbol=AAPL"]')));
  await shot(page, '07a-dashboard-search');
  const haltQuote = await lookUp(page, 'halt');
  check('search handles instruments without a quote honestly', haltQuote.includes('Not tradable') && haltQuote.includes('No quote'));
  const unknownQuote = await lookUp(page, 'ZZZZ');
  check('unknown symbol explains the 404', unknownQuote.includes('No instrument with the symbol “ZZZZ”'));
  const fxQuote = await lookUp(page, 'EUR/USD');
  check('symbols with a slash resolve to a quote', fxQuote.includes('Euro / US Dollar'));
  await searchInput.press('Escape');
  check('Escape closes the search panel', await eventually(page, () => !document.querySelector('app-instrument-search .search-panel')));
  await page.click('app-instrument-search button[aria-label="Clear search"]');
  check('clearing the search empties the field', await eventually(page, () => document.querySelector('app-instrument-search input').value === ''));
  await page.keyboard.press('Escape');
  check('the cleared field keeps focus and closes its panel on Escape', await eventually(page, () => document.activeElement === document.querySelector('app-instrument-search input') && !document.querySelector('app-instrument-search .search-panel')));

  const svg = await page.$('app-line-chart svg');
  const box = await svg.boundingBox();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5);
  await page.waitForSelector('app-line-chart .tooltip');
  check('chart tooltip appears on hover', !!(await page.$('app-line-chart .tooltip')));
  await page.click('button:has-text("Show table")');
  await page.waitForSelector('app-portfolio-chart table');
  check('chart table view renders', !!(await page.$('app-portfolio-chart table')));
  await page.click('button:has-text("Hide table")');

  // --- Profile panel --------------------------------------------------------------
  await page.click('button[aria-label="Open profile"]');
  await page.waitForSelector('#account-panel-title');
  check('profile panel is titled "Profile"', (await page.textContent('#account-panel-title')).trim() === 'Profile');
  check('profile panel still offers Log out', !!(await page.$('app-account-panel button:has-text("Log out")')));
  await page.click('app-account-panel button[aria-label="Close profile"]');

  await page.click('button[aria-label="Switch to dark theme"]');
  await page.waitForTimeout(200);
  check('dark theme applied', (await page.getAttribute('html', 'data-theme')) === 'dark');
  await shot(page, '08-dashboard-dark');
  await page.click('button[aria-label="Switch to light theme"]');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check('no horizontal scroll on mobile dashboard', !hasHorizontalScroll);
  check('navbar links fold away on mobile', !(await page.isVisible('app-navbar nav.navbar-links')));
  await page.click('button[aria-label="Open navigation"]');
  await page.waitForSelector('#navbar-drawer a[href="/trade"]');
  await page.waitForTimeout(400); // let the menu finish expanding
  const openDrawer = await page.$eval('#navbar-drawer', (drawer) => ({ height: drawer.getBoundingClientRect().height, expanded: drawer.getAttribute('aria-hidden') === 'false' }));
  check('mobile menu expands with the navigation links, Profile and Log out', openDrawer.expanded && openDrawer.height > 200 && (await page.isVisible('#navbar-drawer a[href="/trade"]')) && (await page.isVisible('#navbar-drawer button:has-text("Log out")')), JSON.stringify(openDrawer));
  await shot(page, '09-dashboard-mobile-menu');
  await page.click('button[aria-label="Close navigation"]');
  await page.waitForTimeout(400);
  const closedDrawer = await page.$eval('#navbar-drawer', (drawer) => ({ height: drawer.getBoundingClientRect().height, hidden: drawer.getAttribute('aria-hidden'), inert: drawer.hasAttribute('inert') }));
  check('mobile menu collapses again and is hidden from assistive tech', closedDrawer.height === 0 && closedDrawer.hidden === 'true' && closedDrawer.inert, JSON.stringify(closedDrawer));
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.reload();
  await page.waitForSelector('app-holdings-table table');
  check('refresh keeps the session on /dashboard', page.url().endsWith('/dashboard'));

  // --- Transfer -----------------------------------------------------------------
  await page.click('app-navbar nav.navbar-links a[href="/transfer"]');
  await page.waitForURL(/\/transfer$/);
  await page.waitForSelector('#transfer-amount');
  check('navbar link opens the transfer page and is marked active', (await page.getAttribute('app-navbar nav.navbar-links a[href="/transfer"]', 'aria-current')) === 'page');
  await page.fill('#transfer-amount', '500');
  await page.click('button:has-text("Review deposit")');
  await page.waitForSelector('button:has-text("Confirm deposit")');
  await shot(page, '10-transfer-review');
  await page.click('button:has-text("Confirm deposit")');
  await page.waitForURL(/\/transfer\/confirmation$/);
  await page.waitForSelector('text=Deposit completed');
  const transferText = await page.textContent('body');
  check('deposit completed with backend-confirmed balance', transferText.includes(money(startingCash + 500)), money(startingCash + 500));
  await page.click('a:has-text("Make another transfer")');
  await page.waitForURL(/\/transfer\?mode=deposit$/);
  await page.click('#tab-withdraw');
  await page.fill('#transfer-amount', '999999');
  await page.click('button:has-text("Review withdrawal")');
  const withdrawError = await page.textContent('#transfer-amount-error');
  check('withdrawal above balance is blocked client-side', withdrawError.includes('available to withdraw'));
  await shot(page, '11-transfer-withdraw-error');

  // --- Trade --------------------------------------------------------------------
  await page.goto(`${BASE}/trade`);
  await page.waitForSelector('#instrument-search');
  await page.fill('#instrument-search', 'AAP');
  await page.waitForSelector('#instrument-listbox [role="option"]');
  await page.click('#instrument-listbox [role="option"] >> nth=0');
  await page.waitForSelector('.instrument-card');
  await page.fill('#order-quantity', '2');
  await page.waitForTimeout(200);
  const summaryBefore = await page.textContent('app-order-summary');
  check('order summary estimates value (2 x $340 ask)', summaryBefore.includes('$680.00'));
  await shot(page, '12-trade-entry');
  await page.click('button:has-text("Review order")');
  await page.waitForSelector('button:has-text("Place buy order")');
  await shot(page, '13-trade-review');
  await page.click('button:has-text("Place buy order")');
  await page.waitForURL(/\/trade\/confirmation\?orderId=\d+$/);
  await page.waitForSelector('text=Order accepted');
  const acceptedText = await page.textContent('body');
  check('accepted order lands on /trade/confirmation', /\/trade\/confirmation\?orderId=\d+$/.test(page.url()));
  check('accepted order is shown as executing, not executed', acceptedText.includes('Executing') && acceptedText.includes('Pending execution') && !acceptedText.includes('Trade executed'));
  check('confirmation shows stock, side, quantity and order id', acceptedText.includes('Apple') && acceptedText.includes('AAPL') && acceptedText.includes('Buy') && /Order ID\s*#\d+/.test(acceptedText.replace(/\s+/g, ' ')));
  await shot(page, '14-trade-confirmation-pending');
  await page.waitForSelector('text=Trade executed', { timeout: 15000 });
  const tradeText = await page.textContent('body');
  check('order filled with execution price and total', tradeText.includes('$340.00') && tradeText.includes('Total transaction amount') && tradeText.includes('$680.00'));
  check('confirmation lists fees and timestamps', tradeText.includes('No commission') && tradeText.includes('Executed'));
  await shot(page, '15-trade-confirmation-filled');
  await page.reload();
  await page.waitForSelector('text=Trade executed');
  check('trade confirmation reloads the order from the backend on refresh', (await page.textContent('body')).includes('$680.00'));

  await page.click('#trade-place-another');
  await page.waitForURL(/\/trade\?symbol=AAPL&side=BUY$/);
  await page.waitForSelector('.instrument-card');
  check('Place Another Trade returns to the trade page with the instrument preselected', (await page.textContent('.instrument-card')).includes('AAPL'));
  await page.fill('#order-quantity', '100000');
  await page.waitForTimeout(200);
  const summaryErrors = await page.textContent('app-order-summary');
  check('insufficient buying power blocks review', summaryErrors.includes('Insufficient buying power'));
  check('review button disabled when invalid', await page.isDisabled('button:has-text("Review order")'));

  await page.click('button.side-sell');
  await page.fill('#order-quantity', '500');
  await page.waitForTimeout(200);
  const sellErrors = await page.textContent('app-order-summary');
  check('insufficient holdings blocks sell', sellErrors.includes('You can sell up to'));

  await page.goto(`${BASE}/dashboard`);
  await page.waitForSelector('app-holdings-table table');
  const aaplAfter = Number((await page.locator('app-holdings-table tbody tr', { hasText: 'AAPL' }).first().locator('td').nth(1).textContent()).replace(/,/g, ''));
  check('dashboard holdings updated after fill (+2 AAPL)', aaplAfter === startingAapl + 2, `${startingAapl} -> ${aaplAfter}`);

  // --- Client restrictions, logout ----------------------------------------------
  await page.goto(`${BASE}/admin`);
  await page.waitForURL(/\/dashboard$/);
  check('client visiting /admin is redirected to /dashboard', page.url().endsWith('/dashboard'));
  await page.goto(`${BASE}/`);
  await page.waitForURL(/\/dashboard$/);
  check('signed-in users visiting the landing page continue to the dashboard', page.url().endsWith('/dashboard'));

  await logout(page);
  check('logout returns to /login', page.url().endsWith('/login'));
  check('session storage cleared on logout', (await page.evaluate(() => localStorage.getItem('jetzy.session'))) === null);
  await page.goto(`${BASE}/dashboard`);
  await page.waitForURL(/\/login/);
  check('dashboard after logout bounces to login', page.url().includes('/login'));
  await page.goto(`${BASE}/register`);
  await page.waitForSelector('#register-first-name');
  check('registration page is reachable directly when signed out', page.url().endsWith('/register'));
  await shot(page, '16-register-page');

  // --- Super admin --------------------------------------------------------------
  await page.goto(`${BASE}/login`);
  await login(page, 'super@admin.com', 'SuperAdmin123!');
  await page.waitForURL(/\/dashboard$/);
  await page.waitForSelector('text=Administrator account');
  check('admin lands on dashboard with administrator state', true);
  check('navbar shows the Admin Dashboard link for admins', !!(await page.$('app-navbar nav.navbar-links a[href="/admin"]')));
  check('navbar hides transfer/trade for admins', !(await page.$('a[href="/transfer"]')));
  check('administrator state keeps the price search above the date', !!(await page.$('app-dashboard-page app-instrument-search')));
  await page.goto(`${BASE}/register`);
  await page.waitForURL(/\/dashboard$/);
  check('signed-in users are kept away from /register', page.url().endsWith('/dashboard'));
  await shot(page, '17-admin-landing');
  await page.click('app-navbar nav.navbar-links a[href="/admin"]');
  await page.waitForURL(/\/admin$/);
  await page.waitForSelector('app-admin-management table');
  await page.waitForSelector('app-market-data-health table');
  const adminText = (await page.textContent('body')).replace(/\s+/g, ' ');
  check('admin KPIs show registered clients', /Registered clients\s*\d+/.test(adminText));
  check('admin shows administrators count', /Administrators\s*\d+/.test(adminText));
  check('admin lists unavailable metrics honestly', adminText.includes('not available yet'));
  check('admin dashboard has the price search above the date', !!(await page.$('app-admin-dashboard-page .page-title > app-instrument-search:first-child')));
  const kpiRow = await heightsOf(page, '.kpi-grid > *');
  check('admin KPI cards in the same row share one height', sameHeight(kpiRow), kpiRow.join(', '));
  const koQuote = await lookUp(page, 'KO');
  check('admin search looks KO up and shows the stored quote without a trade link', koQuote.includes('Coca-Cola') && koQuote.includes('$71.20') && !(await page.$('app-instrument-search a[href^="/trade"]')));
  await page.locator('app-instrument-search input').press('Escape');
  await shot(page, '18-admin-dashboard');

  await page.fill('#client-lookup-input', 'jane@example.com');
  await page.click('button:has-text("Look up")');
  await page.waitForSelector('app-client-lookup app-orders-table table');
  check('client lookup shows order history', (await page.textContent('app-client-lookup')).includes('Jane Doe'));

  await page.fill('#order-lookup-input', '47');
  await page.click('button:has-text("Trace")');
  await page.waitForSelector('app-order-lookup >> text=Order #47');
  check('order lookup traces an order', true);
  const opsRow = await heightsOf(page, '.ops-grid > *');
  check('client lookup and order lookup cards share one height after results load', sameHeight(opsRow), opsRow.join(' vs '));

  const newAdminEmail = `nia${Date.now()}@admin.com`;
  await page.click('button:has-text("New administrator")');
  await page.waitForSelector('#admin-first-name');
  await page.fill('#admin-first-name', 'Nia');
  await page.fill('#admin-last-name', 'Newby');
  await page.fill('#admin-email', newAdminEmail);
  await page.fill('#admin-password', 'weak');
  await page.click('button:has-text("Create administrator")');
  await page.waitForSelector('text=does not meet the policy');
  check('admin creation enforces password policy', true);
  await page.fill('#admin-password', 'StrongPassword123!');
  await page.selectOption('#admin-role', 'finance');
  await page.click('button:has-text("Create administrator")');
  await page.waitForSelector('text=can now sign in as Finance Admin');
  await page.waitForTimeout(300);
  check('new admin appears in table', (await page.textContent('app-admin-management')).includes(newAdminEmail));
  await shot(page, '19-admin-after-create');

  // --- Operations admin ---------------------------------------------------------
  await logout(page);
  await login(page, 'ops@admin.com', 'Operations123!');
  await page.waitForURL(/\/dashboard$/);
  await page.goto(`${BASE}/admin`);
  await page.waitForSelector('app-client-lookup');
  check('operations admin sees trading operations', !!(await page.$('app-client-lookup')));
  check('operations admin does not see admin management', !(await page.$('app-admin-management')));
  check('operations admin does not see cash positions', !(await page.$('app-cash-positions')));
  await shot(page, '20-admin-operations-view');

  // --- Finance admin ------------------------------------------------------------
  await logout(page);
  await login(page, 'finance@admin.com', 'Finance12345!');
  await page.waitForURL(/\/dashboard$/);
  await page.goto(`${BASE}/admin`);
  await page.waitForSelector('app-cash-positions table');
  check('finance admin sees cash positions', true);
  check('finance admin does not see client lookup', !(await page.$('app-client-lookup')));
  await shot(page, '21-admin-finance-view');

  // --- Token rejected by the backend (secret mismatch) -------------------------------
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('jetzy.session'));
    raw.accessToken = raw.accessToken.slice(0, -4) + 'xxxx';
    localStorage.setItem('jetzy.session', JSON.stringify(raw));
  });
  await page.goto(`${BASE}/admin`);
  await page.waitForSelector('text=rejected your sign-in token', { timeout: 10000 });
  check('backend 401 on an unexpired token keeps the session and explains the JWT_SECRET mismatch', page.url().endsWith('/admin'));
  await shot(page, '22-token-rejected');
} catch (error) {
  check('walkthrough completed without exceptions', false, String(error));
  await shot(page, '99-failure');
} finally {
  await browser.close();
}

// Browser-level resource logs (expected 401 on a wrong password, 404 on instrument-id probes and unknown symbols, 409 on a duplicate email) are not app errors.
const appErrors = consoleErrors.filter((text) => !/favicon|ERR_CONNECTION|net::ERR|Failed to load resource/.test(text));
check('no console errors during walkthrough', appErrors.length === 0, appErrors.slice(0, 5).join(' | '));

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots in ${OUT}`);
process.exit(failed.length ? 1 : 0);
