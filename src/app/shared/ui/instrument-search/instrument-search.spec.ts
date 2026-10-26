import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { FUTURE_EXP, adminToken, clientToken } from '../../../testing/jwt-fixtures';
import { InstrumentCatalogService } from '../../../core/services/instrument-catalog.service';
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
  let router: Router;
  let navigate: ReturnType<typeof vi.spyOn>;

  async function setup(kind: 'client' | 'admin' = 'client'): Promise<void> {
    localStorage.clear();
    sessionStorage.clear();
    seedSession(kind);
    await TestBed.configureTestingModule({
      imports: [InstrumentSearchComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
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

  async function choose(symbol: string): Promise<void> {
    const option = [...fixture.nativeElement.querySelectorAll('[role="option"]')].find(
      (item: HTMLElement) => item.textContent?.includes(symbol),
    ) as HTMLElement | undefined;
    expect(option).toBeDefined();
    option!.click();
    await settle();
  }

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('clicking a suggestion opens a compact, automatically updated three-price overview', async () => {
    await setup('client');
    await type('aap');
    expect(element('[role="listbox"]')?.textContent).toContain('AAPL');
    expect(element('[role="listbox"]')?.textContent).not.toContain('KO');
    await choose('AAPL');
    http.expectOne(`${API}/instruments/symbol/AAPL`).flush(AAPL);
    await settle();

    const result = element('.search-result');
    expect(result).not.toBeNull();
    expect(result?.textContent).toContain('Apple');
    expect(result?.textContent).toContain('$339.94'); // bid
    expect(result?.textContent).toContain('$340.00'); // ask / last
    expect(result?.textContent).toContain('Tradable');
    expect(result?.textContent).not.toContain('Quote age');
    expect(result?.textContent).not.toContain('Refresh');
    expect(result?.textContent).not.toContain('Price history');
    expect(
      element<HTMLAnchorElement>('.search-result a[href="/trade?symbol=AAPL"]'),
    ).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();

    const catalog = TestBed.inject(InstrumentCatalogService);
    const catalogLoading = catalog.load();
    await new Promise((resolve) => setTimeout(resolve, 0));
    http
      .expectOne(`${API}/instruments`)
      .flush(LIST.map((item, index) => ({ ...item, instrumentId: index + 1 })));
    await catalogLoading;
    catalog.refreshQuotes().subscribe();
    http
      .expectOne(`${API}/instruments`)
      .flush([{ ...AAPL, lastPrice: 345, lastTradeAsOf: new Date().toISOString() }, EURUSD, KO]);
    fixture.detectChanges();
    expect(element('.search-result')?.textContent).toContain('$345.00');
  });

  it('pressing Enter navigates an unambiguous match to price history', async () => {
    await setup('client');
    await type('aap');
    await submit();
    expect(navigate).toHaveBeenCalledWith(['/instruments', 'AAPL']);
    http.expectNone(`${API}/instruments/symbol/AAP`);
  });

  it('the arrow button uses the same navigation as Enter', async () => {
    await setup('client');
    await type('AAPL');
    element<HTMLButtonElement>('.search-submit')!.click();
    await settle();
    expect(navigate).toHaveBeenCalledWith(['/instruments', 'AAPL']);
  });

  it('advertises ticker and company-name searches accessibly', async () => {
    await setup('client');
    const input = element<HTMLInputElement>('input')!;
    expect(input.placeholder).toBe('Search by ticker or company name');
    expect(element('label')?.textContent).toBe('Search by ticker or company name');
    expect(element('label')?.getAttribute('for')).toBe(input.id);
  });

  it.each([
    ['  aPpLe  ', 'AAPL'],
    ['cOcA', 'KO'],
    ['aapl', 'AAPL'],
  ])('resolves ticker or company query %s', async (query, symbol) => {
    await setup('client');
    await type(query);
    expect(element('[role="listbox"]')?.textContent).toContain(symbol);
    await submit();
    expect(navigate).toHaveBeenCalledWith(['/instruments', symbol]);
    http.expectNone((request) => request.url.includes('/instruments/symbol/'));
  });

  it('requires a selection when multiple instruments share a company name', async () => {
    await setup('client');
    await type('Apple', [AAPL, { ...AAPL, symbol: 'APPL2' }]);
    await submit();
    expect(navigate).not.toHaveBeenCalled();
    expect(element('[role="alert"]')?.textContent).toContain('More than one instrument');
  });

  it('prioritizes an exact ticker over a company name', async () => {
    await setup('client');
    await type('KO', [KO, { ...AAPL, instrumentName: 'KO' }]);
    await submit();
    expect(navigate).toHaveBeenCalledWith(['/instruments', 'KO']);
  });

  it('waits for the shared list request before submitting a company name', async () => {
    await setup('client');
    await type('Apple', null);
    await submit();
    expect(navigate).not.toHaveBeenCalled();
    expect(element<HTMLButtonElement>('.search-submit')?.disabled).toBe(true);
    http.expectNone(`${API}/instruments/symbol/APPLE`);
    http.expectOne(`${API}/instruments`).flush(LIST);
    await settle();
    expect(navigate).toHaveBeenCalledWith(['/instruments', 'AAPL']);
    expect(element<HTMLButtonElement>('.search-submit')?.disabled).toBe(false);
  });

  it.each(['edit', 'clear', 'resubmit', 'destroy'])(
    'discards a pending company-name submission after %s',
    async (action) => {
      await setup('client');
      await type('Apple', null);
      await submit();
      const pending = http.expectOne(`${API}/instruments`);
      if (action === 'clear') {
        element<HTMLButtonElement>('.search-clear')!.click();
      } else if (action === 'destroy') {
        fixture.destroy();
      } else {
        await type('Coca', null);
        if (action === 'resubmit') await submit();
      }
      pending.flush(LIST);
      await settle();
      if (action === 'resubmit') {
        expect(navigate).toHaveBeenCalledExactlyOnceWith(['/instruments', 'KO']);
      } else {
        expect(navigate).not.toHaveBeenCalled();
      }
    },
  );

  it('falls back to ticker lookup when the pending instrument list fails', async () => {
    await setup('client');
    await type('AAPL', null);
    await submit();
    http.expectOne(`${API}/instruments`).flush('Unavailable', { status: 503, statusText: 'Unavailable' });
    await settle();
    http.expectOne(`${API}/instruments/symbol/AAPL`).flush(AAPL);
    await settle();
    expect(navigate).toHaveBeenCalledWith(['/instruments', 'AAPL']);
  });

  it('navigates the actively highlighted suggestion with the keyboard', async () => {
    await setup('client');
    await type('ko');
    await press('ArrowDown');
    expect(element('input')?.getAttribute('aria-activedescendant')).toContain('option-0');
    await press('Enter');
    expect(navigate).toHaveBeenCalledWith(['/instruments', 'KO']);
  });

  it('submits an already-previewed instrument without another lookup', async () => {
    await setup('client');
    await type('KO');
    await choose('KO');
    http.expectOne(`${API}/instruments/symbol/KO`).flush(KO);
    await settle();
    await submit();
    expect(navigate).toHaveBeenCalledWith(['/instruments', 'KO']);
    http.expectNone(`${API}/instruments/symbol/KO`);
  });

  it('does not navigate ambiguous text to an arbitrary first suggestion', async () => {
    await setup('client');
    await type('a');
    await submit();
    expect(navigate).not.toHaveBeenCalled();
    expect(element('[role="alert"]')?.textContent).toContain('More than one instrument');
  });

  it('does not navigate when an older asynchronous lookup completes late', async () => {
    await setup('client');
    await type('ZZZ', []);
    element<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    const stale = http.expectOne(`${API}/instruments/symbol/ZZZ`);

    await type('AAPL', null);
    element<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    const current = http.expectOne(`${API}/instruments/symbol/AAPL`);
    stale.flush(KO);
    await settle();
    expect(navigate).not.toHaveBeenCalled();

    current.flush(AAPL);
    await settle();
    expect(navigate).toHaveBeenCalledWith(['/instruments', 'AAPL']);
  });

  it('rejects arbitrary company-name text instead of treating it as a ticker', async () => {
    await setup('client');
    await type('Unknown Company', []);
    await submit();
    expect(navigate).not.toHaveBeenCalled();
    expect(element('[role="alert"]')?.textContent).toContain('No instrument matches');
    http.expectNone(`${API}/instruments/symbol/UNKNOWN%20COMPANY`);
  });

  it('does not put an unresolved slash-containing symbol into a route path', async () => {
    await setup('client');
    await type('EUR/USD');
    await submit();
    expect(navigate).not.toHaveBeenCalled();
    expect(element('[role="alert"]')?.textContent).toContain('instrument ID');
  });

  it('uses a numeric id for slash-containing symbols when the catalog provides one', async () => {
    await setup('client');
    await type('EUR/USD', [{ ...EURUSD, instrumentId: 8 }]);
    await submit();
    expect(navigate).toHaveBeenCalledWith(['/instruments', 8]);
  });

  it('does not offer to trade from an administrator account', async () => {
    await setup('admin');
    await type('KO');
    await choose('KO');
    http.expectOne(`${API}/instruments/symbol/KO`).flush(KO);
    await settle();
    expect(element('.search-result')?.textContent).toContain('Coca-Cola');
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
