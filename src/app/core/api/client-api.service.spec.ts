import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ClientApiService } from './client-api.service';

const BASE = `${environment.tradingApiUrl}/api/clients`;
const TRANSACTION_URL = `${BASE}/me/balance/transactions`;

describe('ClientApiService', () => {
  let service: ClientApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ClientApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the authenticated client balance through /me', () => {
    let result: unknown = null;
    service.getBalance(554).subscribe((balance) => (result = balance));

    const request = http.expectOne(`${BASE}/me/balance`);
    expect(request.request.method).toBe('GET');
    request.flush({ clientId: '554', accountBalance: '1250.50' });

    expect(result).toEqual({ clientId: 554, accountBalance: 1250.5 });
  });

  it('reads and normalizes the authenticated client transaction history', () => {
    let result: unknown = null;
    service.listMyTransactions().subscribe((transactions) => (result = transactions));

    const request = http.expectOne(`${BASE}/me/transactions`);
    expect(request.request.method).toBe('GET');
    request.flush([
      {
        transactionId: '7',
        clientId: '554',
        orderId: null,
        transactionType: 'DEPOSIT',
        amount: '250.50',
        balanceAfter: '1500.50',
        createdAt: '2026-10-02T10:00:00Z',
      },
    ]);

    expect(result).toEqual([
      {
        transactionId: 7,
        clientId: 554,
        orderId: null,
        transactionType: 'DEPOSIT',
        amount: 250.5,
        balanceAfter: 1500.5,
        createdAt: '2026-10-02T10:00:00Z',
      },
    ]);
  });

  it('sends a deposit to the unified transaction endpoint', () => {
    let result: unknown = null;
    service.deposit(250).subscribe((balance) => (result = balance));

    const request = http.expectOne(TRANSACTION_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ amount: 250, type: 'DEPOSIT' });
    request.flush({ clientId: '554', accountBalance: '1500' });

    expect(result).toEqual({ clientId: 554, accountBalance: 1500 });
  });

  it('sends a withdrawal to the unified transaction endpoint', () => {
    let result: unknown = null;
    service.withdraw(75.25).subscribe((balance) => (result = balance));

    const request = http.expectOne(TRANSACTION_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ amount: 75.25, type: 'WITHDRAWAL' });
    request.flush({ clientId: '554', accountBalance: '1175.25' });

    expect(result).toEqual({ clientId: 554, accountBalance: 1175.25 });
  });
});
