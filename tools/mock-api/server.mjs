// Local stand-in for Group-12-Auth (NestJS: login + client registration) and Group-12-Backend (Spring Boot).
// It mirrors the real contracts (paths, bodies, status codes, error shapes) so the
// Angular app can be exercised end to end without touching the shared database.
import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.MOCK_PORT ?? 9099);
const SECRET = 'mock-secret-with-at-least-32-characters-in-it';
const QUOTE_FRESH_MS = 20_000; // keep quotes fresh unless STALE_QUOTES=1

const b64url = (input) => Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function sign(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${header}.${body}.${sig}`;
}
function verify(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(`${parts[0]}.${parts[1]}`).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  if (expected !== parts[2]) return null;
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
  if (payload.exp * 1000 < Date.now()) return null;
  return payload;
}

// ---------------------------------------------------------------- fixtures
const admins = [
  { adminId: 60, firstName: 'Super', lastName: 'Admin', email: 'super@admin.com', password: 'SuperAdmin123!', role: 'super_admin', createdAt: '2026-10-01T00:00:00' },
  { adminId: 61, firstName: 'Olivia', lastName: 'Ops', email: 'ops@admin.com', password: 'Operations123!', role: 'operations', createdAt: '2026-10-02T00:00:00' },
  { adminId: 62, firstName: 'Felix', lastName: 'Finance', email: 'finance@admin.com', password: 'Finance12345!', role: 'finance', createdAt: '2026-10-03T00:00:00' },
];
let nextAdminId = 63;
let nextClientId = 17;

const clients = [
  { clientId: 12, firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', password: 'ClientPassword123!', ssn: '123-45-6789', phoneNumber: '202-456-1111', accountBalance: 24974.8995, createdAt: '2025-03-04T12:00:00', dateOfBirth: '1990-05-15' },
  { clientId: 13, firstName: 'Ben', lastName: 'Whitfield', email: 'ben@example.com', password: 'ClientPassword123!', ssn: '583-14-7269', phoneNumber: '646-203-8174', accountBalance: 18500.5, createdAt: '2025-06-10T12:00:00', dateOfBirth: '1988-01-02' },
  { clientId: 14, firstName: 'Chidi', lastName: 'Nwosu', email: 'chidi@example.com', password: 'ClientPassword123!', ssn: '096-47-3815', phoneNumber: '718-394-2601', accountBalance: 0, createdAt: '2026-01-20T12:00:00', dateOfBirth: '1979-11-24' },
  { clientId: 15, firstName: 'Diane', lastName: 'Kowalski', email: 'diane@example.com', password: 'ClientPassword123!', ssn: '741-63-2058', phoneNumber: '925-681-4370', accountBalance: 157500.25, createdAt: '2024-02-09T12:00:00', dateOfBirth: '1971-07-07' },
  { clientId: 16, firstName: 'Elliot', lastName: 'Park', email: 'elliot@example.com', password: 'ClientPassword123!', ssn: '268-95-7140', phoneNumber: '503-817-2946', accountBalance: 3180, createdAt: '2026-09-14T12:00:00', dateOfBirth: '1996-09-14' },
];

const instrumentSeed = [
  [1, 'NVDA', 'NVIDIA', 'EQUITY', 'USD', 217.26, 240.24, 226.46],
  [2, 'AAPL', 'Apple', 'EQUITY', 'USD', 339.94, 340.0, 340.0],
  [3, 'MSFT', 'Microsoft', 'EQUITY', 'USD', 539.37, 539.73, 539.52],
  [4, 'AMZN', 'Amazon', 'EQUITY', 'USD', 249.3, 275.72, 259.62],
  [5, 'GOOGL', 'Alphabet Class A', 'EQUITY', 'USD', 334.0, 369.47, 352.77],
  [7, 'META', 'Meta Platforms', 'EQUITY', 'USD', 745.42, 749.71, 745.56],
  [9, 'TSLA', 'Tesla', 'EQUITY', 'USD', 363.42, 401.84, 378.05],
  [12, 'JPM', 'JPMorgan Chase', 'EQUITY', 'USD', 298.1, 298.4, 298.2],
  [20, 'KO', 'Coca-Cola', 'EQUITY', 'USD', 71.2, 71.3, 71.25],
  [33, 'HALT', 'Halted Holdings', 'EQUITY', 'USD', null, null, null],
  [67, 'EUR/USD', 'Euro / US Dollar', 'FOREX', 'USD', 1.1158, 1.11586, null],
  [73, 'BTC/USD', 'Bitcoin', 'CRYPTO', 'USD', 82538.408, 82558.3, 82505.8],
  [74, 'ETH/USD', 'Ethereum', 'CRYPTO', 'USD', 2487.95, 2488.61, 2487.53],
  [75, 'SOL/USD', 'Solana', 'CRYPTO', 'USD', 107.0, 107.061, 107.1],
];
const instruments = new Map(
  instrumentSeed.map(([instrumentId, symbol, instrumentName, assetClass, currency, bid, ask, last]) => [
    instrumentId,
    { instrumentId, symbol, instrumentName, assetClass, currency, tradable: symbol !== 'HALT', bidPrice: bid, askPrice: ask, lastPrice: last },
  ]),
);
const quoteTimes = () => {
  const stale = process.env.STALE_QUOTES === '1';
  const now = Date.now() - (stale ? 90_000 : Math.floor(Math.random() * QUOTE_FRESH_MS));
  return new Date(now).toISOString();
};
function instrumentDto(instrument) {
  const quoteAsOf = instrument.bidPrice === null ? null : quoteTimes();
  return {
    symbol: instrument.symbol,
    instrumentName: instrument.instrumentName,
    assetClass: instrument.assetClass,
    currency: instrument.currency,
    tradable: instrument.tradable,
    bidPrice: instrument.bidPrice,
    askPrice: instrument.askPrice,
    lastPrice: instrument.lastPrice,
    quoteAsOf,
    lastTradeAsOf: instrument.lastPrice === null ? null : quoteAsOf,
  };
}

const holdings = [
  { holdingId: 1, clientId: 12, instrumentId: 2, quantity: 80, averageCost: 185.32, updatedAt: '2026-10-12T15:26:48.848' },
  { holdingId: 31, clientId: 12, instrumentId: 74, quantity: 0.01, averageCost: 2510.045, updatedAt: '2026-10-12T18:25:25.707' },
  { holdingId: 2, clientId: 13, instrumentId: 3, quantity: 40, averageCost: 402.11, updatedAt: '2026-10-12T15:26:48.892' },
];
let nextHoldingId = 100;

const orders = [
  { orderId: 1, clientId: 12, instrumentId: 2, orderType: 'BUY', quantity: 120, status: 'FILLED', reservedCash: null, submittedAt: '2016-09-23T16:15:30Z', acceptedAt: '2016-09-23T16:15:31Z', rejectedAt: null, failedAt: null, filledAt: '2016-09-23T16:15:34Z', executionPrice: 185.32, executionQuoteAsOf: '2016-09-23T16:15:33Z', tradeValue: 22238.4, rejectionReason: null, failureReason: null },
  { orderId: 4, clientId: 12, instrumentId: 2, orderType: 'SELL', quantity: 40, status: 'FILLED', reservedCash: null, submittedAt: '2017-02-16T20:22:03Z', acceptedAt: '2017-02-16T20:22:04Z', rejectedAt: null, failedAt: null, filledAt: '2017-02-16T20:22:07Z', executionPrice: 186.1, executionQuoteAsOf: '2017-02-16T20:22:06Z', tradeValue: 7444, rejectionReason: null, failureReason: null },
  { orderId: 30, clientId: 12, instrumentId: 1, orderType: 'BUY', quantity: 500, status: 'REJECTED', reservedCash: null, submittedAt: '2026-10-06T14:02:00Z', acceptedAt: null, rejectedAt: '2026-10-06T14:02:00Z', failedAt: null, filledAt: null, executionPrice: null, executionQuoteAsOf: null, tradeValue: null, rejectionReason: 'INSUFFICIENT_FUNDS', failureReason: null },
  { orderId: 47, clientId: 12, instrumentId: 74, orderType: 'BUY', quantity: 0.01, status: 'FILLED', reservedCash: null, submittedAt: '2026-10-12T18:25:25.599Z', acceptedAt: '2026-10-12T18:25:25.620Z', rejectedAt: null, failedAt: null, filledAt: '2026-10-12T18:25:25.707Z', executionPrice: 2510.045, executionQuoteAsOf: '2026-10-12T18:25:20Z', tradeValue: 25.10045, rejectionReason: null, failureReason: null },
  { orderId: 2, clientId: 13, instrumentId: 3, orderType: 'BUY', quantity: 40, status: 'FILLED', reservedCash: null, submittedAt: '2016-11-08T15:42:11Z', acceptedAt: '2016-11-08T15:42:12Z', rejectedAt: null, failedAt: null, filledAt: '2016-11-08T15:42:16Z', executionPrice: 402.11, executionQuoteAsOf: '2016-11-08T15:42:15Z', tradeValue: 16084.4, rejectionReason: null, failureReason: null },
];
let nextOrderId = 100;

// ----------------------------------------------------------------- helpers
function apiError(res, status, error, message, path) {
  send(res, status, { timestamp: new Date().toISOString(), status, error, message, path });
}
function send(res, status, body) {
  const json = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) });
  res.end(json);
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve(null);
      }
    });
  });
}
function publicClient(client) {
  const { password, ...rest } = client;
  return { ...rest, passwordHash: '$2b$12$mockmockmockmockmockmockmockmockmockmockmockmock' };
}
function reserved(clientId) {
  return orders.filter((o) => o.clientId === clientId && o.orderType === 'BUY' && o.status === 'ACCEPTED').reduce((s, o) => s + (o.reservedCash ?? 0), 0);
}
function pendingSell(clientId, instrumentId) {
  return orders.filter((o) => o.clientId === clientId && o.instrumentId === instrumentId && o.orderType === 'SELL' && o.status === 'ACCEPTED').reduce((s, o) => s + o.quantity, 0);
}
function executeLater(order) {
  setTimeout(() => {
    if (order.status !== 'ACCEPTED') return;
    const client = clients.find((c) => c.clientId === order.clientId);
    const instrument = instruments.get(order.instrumentId);
    const now = new Date().toISOString();
    if (order.quantity === 13) {
      order.status = 'FAILED';
      order.failedAt = now;
      order.failureReason = 'MARKET_QUOTE_TIMEOUT';
      return;
    }
    const price = order.orderType === 'BUY' ? instrument.askPrice : instrument.bidPrice;
    const value = order.quantity * price;
    let holding = holdings.find((h) => h.clientId === order.clientId && h.instrumentId === order.instrumentId);
    if (order.orderType === 'BUY') {
      if (!holding) {
        holdings.push({ holdingId: nextHoldingId++, clientId: order.clientId, instrumentId: order.instrumentId, quantity: order.quantity, averageCost: price, updatedAt: now });
      } else {
        const total = holding.quantity * holding.averageCost + value;
        holding.quantity += order.quantity;
        holding.averageCost = total / holding.quantity;
        holding.updatedAt = now;
      }
      client.accountBalance -= value;
    } else {
      if (holding.quantity - order.quantity <= 1e-12) {
        holdings.splice(holdings.indexOf(holding), 1);
      } else {
        holding.quantity -= order.quantity;
        holding.updatedAt = now;
      }
      client.accountBalance += value;
    }
    order.status = 'FILLED';
    order.filledAt = now;
    order.executionPrice = price;
    order.executionQuoteAsOf = now;
    order.tradeValue = value;
  }, 3000);
}

// ------------------------------------------------------------------ server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method;
  console.log(`${new Date().toISOString()} ${method} ${path}`);

  // ---- Group-12-Auth -------------------------------------------------------
  if (path === '/auth/login' && method === 'POST') {
    const body = await readBody(req);
    if (!body || typeof body.email !== 'string' || typeof body.password !== 'string' || !body.email.includes('@')) {
      return send(res, 400, { statusCode: 400, message: ['email must be an email', 'password must be a string'], error: 'Bad Request' });
    }
    const email = body.email.trim();
    const domain = email.toLowerCase().split('@')[1];
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;
    if (domain === 'admin.com') {
      const admin = admins.find((a) => a.email === email.toLowerCase());
      if (!admin || admin.password !== body.password) return send(res, 401, { statusCode: 401, message: 'Invalid credentials', error: 'Unauthorized' });
      const { password, ...safe } = admin;
      return send(res, 200, { accessToken: sign({ sub: String(admin.adminId), email: admin.email, role: admin.role, iat, exp }), admin: { ...safe, adminId: String(admin.adminId) } });
    }
    const client = clients.find((c) => c.email === email);
    if (!client || client.password !== body.password) return send(res, 401, { statusCode: 401, message: 'Invalid credentials', error: 'Unauthorized' });
    const { password, ssn, ...safe } = client;
    return send(res, 200, { accessToken: sign({ sub: String(client.clientId), email: client.email, roles: ['CLIENT'], iat, exp }), client: { ...safe, clientId: String(client.clientId), accountBalance: String(client.accountBalance) } });
  }
  if (path === '/auth/register' && method === 'POST') {
    // Mirrors RegisterDto + ValidationPipe({ whitelist, forbidNonWhitelisted }) and AuthService.register.
    const body = await readBody(req);
    if (!body || typeof body !== 'object') return send(res, 400, { statusCode: 400, message: ['Malformed JSON body'], error: 'Bad Request' });
    const errors = [];
    const allowed = ['email', 'password', 'firstName', 'lastName', 'ssn', 'dateOfBirth', 'phoneNumber'];
    for (const key of Object.keys(body)) if (!allowed.includes(key)) errors.push(`property ${key} should not exist`);
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('email must be an email');
    if (email.length > 255) errors.push('email must be shorter than or equal to 255 characters');
    const password = typeof body.password === 'string' ? body.password : '';
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,}$/.test(password)) errors.push('Password must be at least 12 characters and include uppercase, lowercase, number, and special character.');
    if (password.length > 72) errors.push('password must be shorter than or equal to 72 characters');
    for (const field of ['firstName', 'lastName']) {
      const value = typeof body[field] === 'string' ? body[field] : '';
      if (!value) errors.push(`${field} should not be empty`);
      else if (value.length > 100) errors.push(`${field} must be shorter than or equal to 100 characters`);
    }
    if (!/^\d{3}-\d{2}-\d{4}$/.test(String(body.ssn ?? ''))) errors.push('SSN must use the format 123-45-6789.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.dateOfBirth ?? '')) || Number.isNaN(Date.parse(body.dateOfBirth))) errors.push('dateOfBirth must be a valid ISO 8601 date string');
    const phone = String(body.phoneNumber ?? '');
    if (phone.length > 12) errors.push('phoneNumber must be shorter than or equal to 12 characters');
    if (!/^(\+1)?[2-9]\d{2}-?[2-9]\d{2}-?\d{4}$/.test(phone)) errors.push('Phone number must be a valid US phone number.');
    if (errors.length) return send(res, 400, { message: errors, error: 'Bad Request', statusCode: 400 });
    const domain = email.toLowerCase().split('@').pop();
    if (domain === 'admin.com') {
      return send(res, 400, { message: `Client registration does not accept emails ending in @${domain}; this domain is reserved for admins.`, error: 'Bad Request', statusCode: 400 });
    }
    if (clients.some((c) => c.email === email)) return send(res, 409, { message: 'Client with this email already exists', error: 'Conflict', statusCode: 409 });
    if (clients.some((c) => c.ssn === body.ssn)) return send(res, 409, { message: 'Client with this SSN already exists', error: 'Conflict', statusCode: 409 });
    const client = { clientId: nextClientId++, firstName: body.firstName, lastName: body.lastName, email, password, ssn: body.ssn, phoneNumber: phone, accountBalance: 0, createdAt: new Date().toISOString(), dateOfBirth: body.dateOfBirth };
    clients.push(client);
    const { password: _password, ssn: _ssn, ...safe } = client;
    return send(res, 201, { ...safe, clientId: String(client.clientId), accountBalance: '0' });
  }
  if (path === '/users/health') return send(res, 200, { status: 'ok' });

  // ---- Group-12-Backend security -------------------------------------------
  let claims = null;
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    claims = verify(token);
    if (!claims) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      return apiError(res, 401, 'Unauthorized', 'Invalid or expired token', path);
    }
  }
  if (path.startsWith('/admins')) {
    if (!claims) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      return apiError(res, 401, 'Unauthorized', 'Bearer token required', path);
    }
    if (claims.role !== 'super_admin') return apiError(res, 403, 'Forbidden', 'Your role does not allow this action', path);
  }

  let match;
  // ---- clients ---------------------------------------------------------------
  if (path === '/api/clients' && method === 'GET') return send(res, 200, clients.map(publicClient));
  if ((match = path.match(/^\/api\/clients\/email\/(.+)$/)) && method === 'GET') {
    const client = clients.find((c) => c.email === decodeURIComponent(match[1]));
    return client ? send(res, 200, publicClient(client)) : apiError(res, 404, 'Not Found', 'Client not found with email', path);
  }
  if (path === '/api/clients/me/balance' && method === 'GET') {
    if (!claims) return apiError(res, 401, 'Unauthorized', 'Bearer token required', path);
    if (!Array.isArray(claims.roles) || !claims.roles.includes('CLIENT')) return apiError(res, 403, 'Forbidden', 'Your role does not allow this action', path);
    const client = clients.find((candidate) => candidate.clientId === Number(claims?.sub));
    return client ? send(res, 200, { clientId: client.clientId, accountBalance: client.accountBalance }) : apiError(res, 404, 'Not Found', 'Client not found', path);
  }
  if (path === '/api/clients/me/balance/transactions' && method === 'POST') {
    if (!claims) return apiError(res, 401, 'Unauthorized', 'Bearer token required', path);
    if (!Array.isArray(claims.roles) || !claims.roles.includes('CLIENT')) return apiError(res, 403, 'Forbidden', 'Your role does not allow this action', path);
    const client = clients.find((candidate) => candidate.clientId === Number(claims?.sub));
    if (!client) return apiError(res, 404, 'Not Found', 'Client not found', path);
    const body = await readBody(req);
    const amount = Number(body?.amount);
    if (!(amount > 0) || !Number.isFinite(amount)) return apiError(res, 400, 'Bad Request', 'Amount must be greater than zero', path);
    if (!['DEPOSIT', 'WITHDRAWAL'].includes(body?.type)) return apiError(res, 400, 'Bad Request', 'Transaction type must be DEPOSIT or WITHDRAWAL', path);
    if (body.type === 'WITHDRAWAL' && client.accountBalance < amount) return apiError(res, 409, 'Conflict', 'Insufficient funds', path);
    client.accountBalance += body.type === 'DEPOSIT' ? amount : -amount;
    return send(res, 200, { clientId: client.clientId, accountBalance: client.accountBalance });
  }
  if ((match = path.match(/^\/api\/clients\/(\d+)\/balance$/)) && method === 'GET') {
    const client = clients.find((c) => c.clientId === Number(match[1]));
    return client ? send(res, 200, { clientId: client.clientId, accountBalance: client.accountBalance }) : apiError(res, 404, 'Not Found', `Client not found with id: ${match[1]}`, path);
  }
  if ((match = path.match(/^\/api\/clients\/(\d+)\/(deposit|withdraw)$/)) && method === 'POST') {
    const client = clients.find((c) => c.clientId === Number(match[1]));
    if (!client) return apiError(res, 404, 'Not Found', `Client not found with id: ${match[1]}`, path);
    const body = await readBody(req);
    const amount = Number(body?.amount);
    if (!(amount > 0)) return apiError(res, 400, 'Bad Request', 'Amount must be greater than zero', path);
    if (match[2] === 'withdraw' && client.accountBalance < amount) return apiError(res, 409, 'Conflict', 'Insufficient funds', path);
    client.accountBalance = match[2] === 'deposit' ? client.accountBalance + amount : client.accountBalance - amount;
    return send(res, 200, { clientId: client.clientId, accountBalance: client.accountBalance });
  }
  if ((match = path.match(/^\/api\/clients\/(\d+)$/)) && method === 'GET') {
    const client = clients.find((c) => c.clientId === Number(match[1]));
    return client ? send(res, 200, publicClient(client)) : apiError(res, 404, 'Not Found', `Client not found with id: ${match[1]}`, path);
  }

  // ---- holdings --------------------------------------------------------------
  if ((match = path.match(/^\/api\/client\/(\d+)\/holdings$/)) && method === 'GET') {
    const clientId = Number(match[1]);
    if (!clients.some((c) => c.clientId === clientId)) return apiError(res, 404, 'Not Found', 'Client not found', path);
    const rows = holdings.filter((h) => h.clientId === clientId);
    return rows.length ? send(res, 200, rows) : apiError(res, 404, 'Not Found', 'No holdings found for this client', path);
  }

  // ---- instruments -----------------------------------------------------------
  if (path === '/instruments' && method === 'GET') return send(res, 200, [...instruments.values()].sort((a, b) => a.symbol.localeCompare(b.symbol)).map(instrumentDto));
  if ((match = path.match(/^\/instruments\/symbol\/(.+)$/)) && method === 'GET') {
    const instrument = [...instruments.values()].find((i) => i.symbol === decodeURIComponent(match[1]).toUpperCase());
    return instrument ? send(res, 200, instrumentDto(instrument)) : apiError(res, 404, 'Not Found', 'Instrument not found', path);
  }
  if ((match = path.match(/^\/instruments\/(\d+)$/)) && method === 'GET') {
    const instrument = instruments.get(Number(match[1]));
    return instrument ? send(res, 200, instrumentDto(instrument)) : apiError(res, 404, 'Not Found', 'Instrument not found', path);
  }

  // ---- orders ----------------------------------------------------------------
  if ((match = path.match(/^\/api\/orders\/client\/(\d+)$/)) && method === 'GET') {
    return send(res, 200, orders.filter((o) => o.clientId === Number(match[1])).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)));
  }
  if ((match = path.match(/^\/api\/orders\/(\d+)$/)) && method === 'GET') {
    const order = orders.find((o) => o.orderId === Number(match[1]));
    return order ? send(res, 200, order) : apiError(res, 404, 'Not Found', 'Order not found', path);
  }
  if (path === '/api/orders' && method === 'POST') {
    const body = await readBody(req);
    if (!body || !body.clientId || !body.instrumentId || !['BUY', 'SELL'].includes(body.orderType) || !(Number(body.quantity) > 0)) {
      return apiError(res, 400, 'Bad Request', 'Quantity must be greater than zero', path);
    }
    const client = clients.find((c) => c.clientId === Number(body.clientId));
    if (!client) return apiError(res, 400, 'Bad Request', 'Client not found', path);
    const now = new Date().toISOString();
    const order = { orderId: nextOrderId++, clientId: client.clientId, instrumentId: Number(body.instrumentId), orderType: body.orderType, quantity: Number(body.quantity), status: 'SUBMITTED', reservedCash: null, submittedAt: now, acceptedAt: null, rejectedAt: null, failedAt: null, filledAt: null, executionPrice: null, executionQuoteAsOf: null, tradeValue: null, rejectionReason: null, failureReason: null };
    orders.push(order);
    const instrument = instruments.get(order.instrumentId);
    const reject = (reason) => {
      order.status = 'REJECTED';
      order.rejectedAt = now;
      order.rejectionReason = reason;
      return send(res, 201, order);
    };
    if (!instrument) return reject('INSTRUMENT_NOT_FOUND');
    if (!instrument.tradable) return reject('INSTRUMENT_NOT_TRADABLE');
    if (instrument.bidPrice === null) return reject('MISSING_QUOTE');
    if (process.env.STALE_QUOTES === '1') return reject('STALE_QUOTE');
    if (order.orderType === 'BUY') {
      const needed = order.quantity * instrument.askPrice;
      if (client.accountBalance - reserved(client.clientId) < needed) return reject('INSUFFICIENT_FUNDS');
      order.reservedCash = needed;
    } else {
      const holding = holdings.find((h) => h.clientId === client.clientId && h.instrumentId === order.instrumentId);
      if (!holding || holding.quantity - pendingSell(client.clientId, order.instrumentId) < order.quantity) return reject('INSUFFICIENT_HOLDINGS');
    }
    order.status = 'ACCEPTED';
    order.acceptedAt = now;
    executeLater(order);
    res.setHeader('Location', `/api/orders/${order.orderId}`);
    return send(res, 201, order);
  }

  // ---- admins ----------------------------------------------------------------
  const adminDto = ({ password, ...rest }) => rest;
  if (path === '/admins' && method === 'GET') return send(res, 200, admins.map(adminDto));
  if (path === '/admins' && method === 'POST') {
    const body = await readBody(req);
    if (!body?.firstName || !body?.lastName || !body?.email || !body?.password || !body?.role) return apiError(res, 400, 'Bad Request', 'must not be blank', path);
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,}$/.test(body.password)) return apiError(res, 400, 'Bad Request', 'Password must be at least 12 characters and include uppercase, lowercase, number, and special character.', path);
    const email = String(body.email).trim().toLowerCase();
    if (email.split('@')[1] !== 'admin.com') return apiError(res, 400, 'Bad Request', 'Admin email must use the admin.com domain', path);
    if (admins.some((a) => a.email === email)) return apiError(res, 409, 'Conflict', `An admin already exists with email: ${email}`, path);
    const admin = { adminId: nextAdminId++, firstName: body.firstName, lastName: body.lastName, email, password: body.password, role: body.role, createdAt: new Date().toISOString().slice(0, 19) };
    admins.push(admin);
    return send(res, 201, adminDto(admin));
  }
  if ((match = path.match(/^\/admins\/(\d+)$/))) {
    const admin = admins.find((a) => a.adminId === Number(match[1]));
    if (!admin) return apiError(res, 404, 'Not Found', `Admin not found with id: ${match[1]}`, path);
    if (method === 'GET') return send(res, 200, adminDto(admin));
    if (method === 'PUT') {
      const body = await readBody(req);
      Object.assign(admin, { firstName: body.firstName, lastName: body.lastName, email: String(body.email).toLowerCase() });
      return send(res, 200, adminDto(admin));
    }
    if (method === 'DELETE') {
      admins.splice(admins.indexOf(admin), 1);
      res.writeHead(204);
      return res.end();
    }
  }

  return apiError(res, 404, 'Not Found', 'No static resource ' + path.slice(1) + '.', path);
});

server.listen(PORT, () => console.log(`Mock Auth + Trading API listening on http://localhost:${PORT}`));
