import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { FUTURE_EXP, clientToken } from '../../testing/jwt-fixtures';
import { TransferConfirmationPage } from './transfer-confirmation';
import { TransferReceipt } from './transfer.models';

const RECEIPT: TransferReceipt = {
  clientId: 12,
  mode: 'deposit',
  amount: 500,
  status: 'completed',
  balanceBefore: 1000,
  balanceAfter: 1500,
  transactionId: null,
  confirmedAt: '2026-10-14T15:00:00Z',
};

function seedSession(): void {
  localStorage.setItem(
    environment.sessionStorageKey,
    JSON.stringify({
      accessToken: clientToken(),
      user: {
        kind: 'client',
        id: 12,
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        displayName: 'Jane Doe',
        role: null,
        createdAt: null,
      },
      expiresAt: FUTURE_EXP * 1000,
      issuedAt: 0,
    }),
  );
}

describe('TransferConfirmationPage', () => {
  let http: HttpTestingController;

  async function setup(state: unknown): Promise<ComponentFixture<TransferConfirmationPage>> {
    localStorage.clear();
    seedSession();
    window.history.replaceState(state, '');
    await TestBed.configureTestingModule({
      imports: [TransferConfirmationPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(TransferConfirmationPage);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    http.verify();
    localStorage.clear();
    window.history.replaceState(null, '');
  });

  it('renders the backend-confirmed receipt from navigation state', async () => {
    const fixture = await setup({ transfer: RECEIPT });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Deposit completed');
    expect(text).toContain('Completed');
    expect(text).toContain('$500.00');
    expect(text).toContain('Previous balance');
    expect(text).toContain('$1,000.00');
    expect(text).toContain('Updated cash balance');
    expect(text).toContain('$1,500.00');
    expect(text).toContain('Not provided');
    expect(text).toContain('Return to Dashboard');
    expect(text).not.toContain('Pending');
  });

  it('shows a pending withdrawal as pending, never as completed', async () => {
    const fixture = await setup({
      transfer: { ...RECEIPT, mode: 'withdraw', status: 'pending', balanceAfter: null },
    });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Withdrawal pending');
    expect(text).toContain('Pending');
    expect(text).toContain('unchanged until confirmed');
    expect(text).not.toContain('Completed');
  });

  it('formats a real transaction ID when one is supplied', async () => {
    const fixture = await setup({ transfer: { ...RECEIPT, transactionId: 7 } });
    expect(fixture.nativeElement.textContent).toContain('TXN-7');
  });

  it('explains when there is no transfer to show', async () => {
    const fixture = await setup(null);
    expect(fixture.nativeElement.textContent).toContain('No transfer to show');
  });

  it('ignores a receipt that belongs to another account', async () => {
    const fixture = await setup({ transfer: { ...RECEIPT, clientId: 99 } });
    expect(fixture.nativeElement.textContent).toContain('No transfer to show');
  });
});
