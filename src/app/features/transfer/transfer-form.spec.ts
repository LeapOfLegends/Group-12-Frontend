import { FormControl } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransferFormComponent, TransferRequest, amountValidator } from './transfer-form';

describe('amountValidator', () => {
  const validate = (value: string, limit: number | null = null) => amountValidator(() => limit)(new FormControl(value));

  it('requires a positive amount with at most two decimals', () => {
    expect(validate('')).toEqual({ required: true });
    expect(validate('abc')).toEqual({ invalidNumber: true });
    expect(validate('0')).toEqual({ notPositive: true });
    expect(validate('10.123')).toEqual({ tooManyDecimals: true });
    expect(validate('250.50')).toBeNull();
    expect(validate('1,000')).toBeNull();
  });

  it('enforces the available balance and the per-request maximum', () => {
    expect(validate('150', 100)).toEqual({ insufficientFunds: { available: 100 } });
    expect(validate('100', 100)).toBeNull();
    expect(validate('5000000')).toEqual({ aboveMaximum: { max: 1_000_000 } });
  });
});

describe('TransferFormComponent', () => {
  let fixture: ComponentFixture<TransferFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TransferFormComponent] }).compileComponents();
    fixture = TestBed.createComponent(TransferFormComponent);
    fixture.componentRef.setInput('withdrawable', 100);
    fixture.componentRef.setInput('initialMode', 'withdraw');
    await fixture.whenStable();
  });

  function type(value: string): void {
    const input = fixture.nativeElement.querySelector('#transfer-amount') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
  }

  async function submit(): Promise<void> {
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('blocks a withdrawal above the available balance and explains why', async () => {
    const emitted: TransferRequest[] = [];
    fixture.componentInstance.submitted.subscribe((request) => emitted.push(request));
    type('150');
    await submit();
    expect(fixture.nativeElement.textContent).toContain('more than the $100.00 available');
    expect(emitted).toEqual([]);
  });

  it('emits a rounded request for a valid amount', async () => {
    const emitted: TransferRequest[] = [];
    fixture.componentInstance.submitted.subscribe((request) => emitted.push(request));
    type('75.5');
    await submit();
    expect(emitted).toEqual([{ mode: 'withdraw', amount: 75.5 }]);
  });

  it('switches to deposits and lifts the balance limit', async () => {
    const emitted: TransferRequest[] = [];
    fixture.componentInstance.submitted.subscribe((request) => emitted.push(request));
    (fixture.nativeElement.querySelector('#tab-deposit') as HTMLButtonElement).click();
    await fixture.whenStable();
    type('5000');
    await submit();
    expect(emitted).toEqual([{ mode: 'deposit', amount: 5000 }]);
  });
});
