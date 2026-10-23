import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { FUTURE_EXP, adminToken, clientToken } from '../../../testing/jwt-fixtures';
import { InstrumentSearchComponent } from './instrument-search';

const API = environment.tradingApiUrl;

const AAPL = {
  symbol: 'AAPL',
  instrumentName: 'Apple',
  assetClass: 'EQUITY',
  currency: 'USD',
  tradable: true,
  bidPrice: 339.94,
  askPrice: 340,
  lastPrice: 340,
  quoteAsOf: new Date().toISOString(),
  lastTradeAsOf: new Date().toISOString(),
};

const EURUSD = {
  symbol: 'EUR/USD',
  instrumentName: 'Euro / US Dollar',
  assetClass: 'FOREX',
  currency: 'USD',
  tradable: true,
  bidPrice: 1.1158,
  askPrice: 1.11586,
  lastPrice: null,
  quoteAsOf: new Date().toISOString(),
  lastTradeAsOf: null,
};

const KO = {
  ...AAPL,
  symbol: 'KO',
  instrumentName: 'Coca-Cola',
  bidPrice: 71.2,
  askPrice: 71.3,
  lastPrice: 71.25,
};

const LIST = [AAPL, EURUSD, KO];

function seedSession(kind: 'client' | 'admin'): void {
  const admin = kind === 'admin';
  localStorage.setItem(
    environment.sessionStorageKey,
    JSON.stringify({
      accessToken: admin ? adminToken('operations') : clientToken(),
      user: {
        kind,
        id: admin ? 60 : 12,
        email: '',
        firstName: admin ? 'Olivia' : 'Jane',
        lastName: admin ? 'Ops' : 'Doe',
        displayName: '',
        role: admin ? 'operations' : null,
        createdAt: null,
      },
      expiresAt: FUTURE_EXP * 1000,
      issuedAt: 0,
    }),
  );
}

describe('InstrumentSearchComponent', () => {
  let fixture: ComponentFixture<InstrumentSearchComponent>;
  let http: HttpTestingController;

  async function setup(kind: 'client' | 'admin' = 'client'): Promise<void> {
    localStorage.clear();
    sessionStorage.clear();
    seedSession(kind);
    await TestBed.configureTestingModule({
      imports: [InstrumentSearchComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(InstrumentSearchComponent);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function element<T extends HTMLElement>(selector: string): T | null {
    return fixture.nativeElement.querySelector(selector) as T | null;
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    // A lookup that falls back to the list awaits a second promise before setting its result.
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  /** Types into the field; the first keystroke reads the instrument list for suggestions. */
  async function type(value: string, list: object[] | null = LIST): Promise<void> {
    const input = element<HTMLInputElement>('input')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    if (list) {
      http.expectOne(`${API}/instruments`).flush(list);
    }
    await settle();
  }

  async function press(key: string): Promise<void> {
    element<HTMLInputElement>('input')!.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true }),
    );
    await settle();
  }

  async function submit(): Promise<void> {
    element<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await settle();
  }

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('suggests instruments while typing and looks a symbol up on Enter, showing bid, ask and last trade', async () => {
    await setup('client');
    await type('aap');
    expect(element('[role="listbox"]')?.textContent).toContain('AAPL');
    expect(element('[role="listbox"]')?.textContent).not.toContain('KO');

    await submit();
    http
      .expectOne(`${API}/instruments/symbol/AAP`)
      .flush(
        {
          timestamp: '',
          status: 404,
          error: 'Not Found',
          message: 'Instrument not found',
          path: '',
        },
        { status: 404, statusText: 'Not Found' },
      );
    await settle();
    expect(element('[role="alert"]')?.textContent).toContain('No instrument with the symbol “AAP”');

    await type('AAPL', null);
    await submit();
    http.expectOne(`${API}/instruments/symbol/AAPL`).flush(AAPL);
    await settle();

    const result = element('.search-result');
    expect(result).not.toBeNull();
    expect(result?.textContent).toContain('Apple');
    expect(result?.textContent).toContain('$339.94'); // bid
    expect(result?.textContent).toContain('$340.00'); // ask / last
    expect(result?.textContent).toContain('fresh');
    expect(result?.textContent).toContain('Tradable');
    expect(element<HTMLAnchorElement>('.search-result a[href="/instruments/AAPL"]')).not.toBeNull();
    expect(
      element<HTMLAnchorElement>('.search-result a[href="/trade?symbol=AAPL"]'),
    ).not.toBeNull();
  });

  it('picks a highlighted suggestion with the keyboard', async () => {
    await setup('client');
    await type('ko');
    await press('ArrowDown');
    expect(element('input')?.getAttribute('aria-activedescendant')).toContain('option-0');
    await press('Enter');
    http.expectOne(`${API}/instruments/symbol/KO`).flush(KO);
    await settle();
    expect(element<HTMLInputElement>('input')?.value).toBe('KO');
    expect(element('.search-result')?.textContent).toContain('Coca-Cola');
  });

  it('falls back to the instrument list for symbols with a slash when the server rejects the encoded path', async () => {
    await setup('client');
    await type('EUR/USD');
    await submit();
    http
      .expectOne(`${API}/instruments/symbol/EUR%2FUSD`)
      .flush('The request contained an invalid character', {
        status: 400,
        statusText: 'Bad Request',
      });
    await settle();
    expect(element('[role="alert"]')).toBeNull();
    expect(element('.search-result')?.textContent).toContain('Euro / US Dollar');
    expect(element('.search-result')?.textContent).toContain('$1.12'); // bid 1.1158
    expect(element<HTMLAnchorElement>('.search-result a[href^="/instruments/"]')).toBeNull();
  });

  it('does not offer to trade from an administrator account', async () => {
    await setup('admin');
    await type('KO');
    await submit();
    http.expectOne(`${API}/instruments/symbol/KO`).flush(KO);
    await settle();
    expect(element('.search-result')?.textContent).toContain('Coca-Cola');
    expect(element<HTMLAnchorElement>('.search-result a[href="/instruments/KO"]')).not.toBeNull();
    expect(element<HTMLAnchorElement>('.search-result a[href^="/trade"]')).toBeNull();
    expect(text()).not.toContain('Trade KO');
  });

  it('closes the panel on Escape and reopens it when the field is used again', async () => {
    await setup('client');
    await type('a');
    expect(element('.search-panel')).not.toBeNull();
    await press('Escape');
    expect(element('.search-panel')).toBeNull();
    element<HTMLInputElement>('input')!.dispatchEvent(new Event('focus'));
    await settle();
    expect(element('.search-panel')).not.toBeNull();
  });

  it('makes no request until the field is used', async () => {
    await setup('client');
    http.expectNone(`${API}/instruments`);
    expect(element('.search-panel')).toBeNull();
  });
});
