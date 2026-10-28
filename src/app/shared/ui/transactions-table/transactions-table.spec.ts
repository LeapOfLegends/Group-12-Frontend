import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AccountTransaction } from '../../../core/models/trading.models';
import { TransactionsTableComponent } from './transactions-table';

const TRANSACTIONS: AccountTransaction[] = [
  {
    transactionId: 7,
    clientId: 12,
    orderId: null,
    transactionType: 'DEPOSIT',
    amount: 500,
    balanceAfter: 1500,
    createdAt: '2026-10-24T14:00:00Z',
  },
  {
    transactionId: 8,
    clientId: 12,
    orderId: 47,
    transactionType: 'BUY',
    amount: -100,
    balanceAfter: 1400,
    createdAt: '2026-10-25T14:00:00Z',
  },
];

describe('TransactionsTableComponent', () => {
  let fixture: ComponentFixture<TransactionsTableComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TransactionsTableComponent] });
    fixture = TestBed.createComponent(TransactionsTableComponent);
  });

  it('puts actual formatted transaction IDs in the first column', () => {
    fixture.componentRef.setInput('rows', TRANSACTIONS);
    fixture.detectChanges();

    const headings = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('th')).map(
      (heading) => heading.textContent.trim(),
    );
    const identifiers = Array.from<HTMLElement>(
      fixture.nativeElement.querySelectorAll('tbody .transaction-id'),
    ).map((cell) => cell.textContent.trim());

    expect(headings).toEqual(['Transaction ID', 'Type', 'Amount', 'Balance after', 'Date']);
    expect(identifiers).toEqual(['TXN-7', 'TXN-8']);
    expect(fixture.nativeElement.textContent).toContain('ORD-47');
    expect(fixture.nativeElement.textContent).toContain('+$500.00');
    expect(fixture.nativeElement.textContent).toContain('-$100.00');
    expect(fixture.nativeElement.textContent).toContain('$1,500.00');
    expect(fixture.nativeElement.textContent).toContain('$1,400.00');
  });

  it('preserves the empty and loading states without inventing an ID', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No transactions yet');
    expect(fixture.nativeElement.textContent).not.toContain('TXN-');

    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('app-loading-skeleton').getAttribute('aria-label'),
    ).toBe('Loading transactions');
    expect(fixture.nativeElement.textContent).not.toContain('TXN-');
  });

  it('allows a full-history caption and filtered empty copy without changing defaults', () => {
    fixture.componentRef.setInput('caption', 'Transaction history');
    fixture.componentRef.setInput('emptyTitle', 'No transactions match your filters.');
    fixture.componentRef.setInput('emptyMessage', 'Reset the filters.');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No transactions match your filters.');
    fixture.componentRef.setInput('rows', TRANSACTIONS);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('caption')?.textContent.trim()).toBe(
      'Transaction history',
    );
  });
});
