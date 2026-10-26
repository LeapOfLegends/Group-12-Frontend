import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Observable, catchError, firstValueFrom, interval, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { InstrumentsApiService } from '../../../core/api/instruments-api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Instrument } from '../../../core/models/trading.models';
import { InstrumentCatalogService } from '../../../core/services/instrument-catalog.service';
import { ageInSeconds, formatRelativeAge } from '../../../core/utils/dates';
import { describeHttpError, httpStatusOf } from '../../../core/utils/http-error';
import { DateTimePipe, PricePipe } from '../../pipes/format.pipes';
import { IconComponent } from '../icon/icon';
import { StatusBadgeComponent } from '../status-badge/status-badge';

const MAX_SUGGESTIONS = 8;

type PanelView = 'none' | 'suggestions' | 'no-match' | 'loading' | 'result' | 'error';

/**
 * Dashboard search bar that looks up an instrument's current price by symbol through
 * `GET /instruments/symbol/{symbol}` and shows the platform's stored quote (bid, ask, last
 * trade, quote age). While typing, matches from the instrument list are suggested; the list
 * is only read once the field is used, so the dashboards stay as light as before.
 */
@Component({
  selector: 'app-instrument-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, StatusBadgeComponent, PricePipe, DateTimePipe],
  template: `
    <form class="search" role="search" (submit)="onSubmit($event)" (focusout)="onFocusOut($event)">
      <label class="visually-hidden" [for]="inputId">Look up an instrument price by symbol</label>
      <div class="search-field">
        <span class="search-prefix" aria-hidden="true"><app-icon name="search" [size]="18" /></span>
        <input
          #input
          [id]="inputId"
          class="input"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          [attr.aria-expanded]="open() && view() === 'suggestions'"
          [attr.aria-controls]="open() && view() === 'suggestions' ? listboxId : null"
          [attr.aria-activedescendant]="activeOptionId()"
          [attr.aria-describedby]="hintId"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          enterkeyhint="search"
          placeholder="Look up a price, e.g. AAPL"
          [value]="query()"
          (input)="onInput($event)"
          (focus)="onFocus()"
          (click)="open.set(true)"
          (keydown)="onKeydown($event)"
        />
        <span class="search-suffix">
          @if (query()) {
            <button
              type="button"
              class="btn btn-ghost btn-icon search-clear"
              (click)="clear()"
              aria-label="Clear search"
            >
              <app-icon name="close" [size]="16" />
            </button>
          }
          <button
            type="submit"
            class="btn btn-soft btn-icon search-submit"
            [disabled]="!query().trim() || loading()"
            aria-label="Look up price"
          >
            @if (loading()) {
              <span class="spinner" aria-hidden="true"></span>
            } @else {
              <app-icon name="arrow-right" [size]="18" />
            }
          </button>
        </span>
      </div>
      <span [id]="hintId" class="visually-hidden">
        Type a symbol or company name, then press Enter to see the platform's latest stored quote.
      </span>

      @if (open() && view() !== 'none') {
        <div class="search-panel" (mousedown)="keepFocus($event)">
          @switch (view()) {
            @case ('suggestions') {
              <ul
                [id]="listboxId"
                class="search-list"
                role="listbox"
                aria-label="Matching instruments"
              >
                @for (item of suggestions(); track item.symbol; let index = $index) {
                  <li
                    [id]="optionId(index)"
                    role="option"
                    [attr.aria-selected]="index === activeIndex()"
                    [class.option-active]="index === activeIndex()"
                    (click)="choose(item)"
                  >
                    <span class="option-symbol">{{ item.symbol }}</span>
                    <span class="option-name truncate">{{ item.instrumentName }}</span>
                    <span class="option-class pill">{{ item.assetClass }}</span>
                    <span class="option-price tabular">{{
                      item.lastPrice ?? item.askPrice | price: item.currency
                    }}</span>
                  </li>
                }
              </ul>
              <p class="search-note search-hint">
                Choose an instrument, or press Enter to look up the symbol you typed.
              </p>
            }
            @case ('no-match') {
              <p class="search-note">
                No instrument in the list matches “{{ query().trim() }}”. Press Enter to look the
                symbol up anyway.
              </p>
            }
            @case ('loading') {
              <p class="search-note search-loading" role="status">
                <span class="spinner" aria-hidden="true"></span>
                Looking up {{ lookedUp() }}…
              </p>
            }
            @case ('error') {
              <div class="alert alert-error search-alert" role="alert">
                <app-icon name="alert-circle" />
                <span>{{ error() }}</span>
              </div>
            }
            @case ('result') {
              @if (result(); as found) {
                <div
                  class="search-result"
                  role="region"
                  aria-live="polite"
                  [attr.aria-label]="'Quote for ' + found.symbol"
                >
                  <div class="result-head">
                    <div class="result-identity">
                      <span class="result-symbol">{{ found.symbol }}</span>
                      <span class="result-name truncate">{{ found.instrumentName }}</span>
                    </div>
                    <div class="cluster result-tags">
                      <span class="pill">{{ found.assetClass }} · {{ found.currency }}</span>
                      @if (found.tradable) {
                        <app-status-badge tone="positive" icon="check" label="Tradable" />
                      } @else {
                        <app-status-badge tone="neutral" icon="lock" label="Not tradable" />
                      }
                    </div>
                  </div>
                  <dl class="quote-grid">
                    <div>
                      <dt>Bid</dt>
                      <dd>{{ found.bidPrice | price: found.currency }}</dd>
                    </div>
                    <div>
                      <dt>Ask</dt>
                      <dd>{{ found.askPrice | price: found.currency }}</dd>
                    </div>
                    <div>
                      <dt>Last trade</dt>
                      <dd>{{ found.lastPrice | price: found.currency }}</dd>
                    </div>
                    <div>
                      <dt>Quote age</dt>
                      <dd
                        [class.text-positive]="quoteFresh()"
                        [class.text-negative]="quoteAge() !== null && !quoteFresh()"
                      >
                        {{ quoteAgeLabel() }}
                      </dd>
                    </div>
                  </dl>
                  <div class="result-foot">
                    <span class="text-secondary text-xs">
                      @if (found.quoteAsOf) {
                        Stored platform quote as of {{ found.quoteAsOf | dateTime }}.
                      } @else {
                        The platform holds no quote for this instrument yet.
                      }
                    </span>
                    <div class="cluster result-actions">
                      @if (found.assetClass.toUpperCase() === 'EQUITY') {
                        <a
                          class="btn btn-soft btn-sm"
                          [routerLink]="['/instruments', found.instrumentId ?? found.symbol]"
                          >Price history</a
                        >
                      }
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm"
                        (click)="lookup(found.symbol)"
                      >
                        <app-icon name="refresh" [size]="16" />
                        Refresh
                      </button>
                      @if (auth.isClient() && found.tradable) {
                        <a
                          class="btn btn-soft btn-sm"
                          routerLink="/trade"
                          [queryParams]="{ symbol: found.symbol }"
                        >
                          Trade {{ found.symbol }}
                          <app-icon name="arrow-right" [size]="16" />
                        </a>
                      }
                    </div>
                  </div>
                </div>
              }
            }
          }
        </div>
      }
    </form>
  `,
  styles: `
    :host {
      display: block;
    }

    .search {
      position: relative;
    }

    .search-field {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-field .input {
      min-height: 44px;
      padding-left: 42px;
      padding-right: 84px;
      border-radius: var(--radius-pill);
    }

    .search-prefix {
      position: absolute;
      left: 15px;
      display: inline-flex;
      color: var(--color-text-muted);
      pointer-events: none;
    }

    .search-suffix {
      position: absolute;
      right: 5px;
      display: inline-flex;
      gap: 2px;
    }

    .search-clear,
    .search-submit {
      width: 34px;
      min-height: 34px;
      border-radius: var(--radius-pill);
    }

    .search-submit .spinner {
      width: 16px;
      height: 16px;
    }

    /* Wider than the field so a quote's four figures sit side by side; never wider than the viewport. */
    .search-panel {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      width: min(560px, calc(100vw - 2 * var(--page-gutter)));
      z-index: 20;
      overflow: hidden;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      box-shadow: var(--shadow-lg);
    }

    /* Suggestions ---------------------------------------------------------- */
    .search-list {
      list-style: none;
      margin: 0;
      padding: 6px;
      max-height: 320px;
      overflow-y: auto;
    }

    .search-list li {
      display: grid;
      grid-template-columns: 84px minmax(0, 1fr) auto auto;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: var(--text-sm);
    }

    .search-list li:hover,
    .search-list li.option-active {
      background: var(--color-brand-soft);
    }

    .option-symbol {
      font-weight: 700;
    }

    .option-name {
      color: var(--color-text-secondary);
    }

    .option-price {
      font-weight: 600;
      min-width: 72px;
      text-align: right;
    }

    .search-note {
      margin: 0;
      padding: 10px 12px;
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
    }

    .search-hint {
      border-top: 1px solid var(--color-border);
      font-size: var(--text-xs);
    }

    .search-loading {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .search-alert {
      border: 0;
      border-radius: 0;
    }

    /* Quote ---------------------------------------------------------------- */
    .search-result {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-4);
    }

    .result-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--space-3);
      flex-wrap: wrap;
    }

    .result-identity {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .result-symbol {
      font-size: var(--text-xl);
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .result-name {
      color: var(--color-text-secondary);
      font-size: var(--text-sm);
    }

    .result-tags {
      gap: 6px;
    }

    .quote-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
      margin: 0;
    }

    .quote-grid > div {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px 10px;
      border-radius: var(--radius-sm);
      background: var(--color-surface-2);
      border: 1px solid var(--color-border);
    }

    .quote-grid dt {
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-text-secondary);
      font-weight: 600;
    }

    .quote-grid dd {
      margin: 0;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .result-foot {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-3);
      flex-wrap: wrap;
    }

    .result-actions {
      gap: 6px;
      margin-left: auto;
    }

    @media (max-width: 520px) {
      .quote-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .search-list li {
        grid-template-columns: 72px minmax(0, 1fr) auto;
      }

      .option-class {
        display: none;
      }
    }
  `,
})
export class InstrumentSearchComponent {
  private static nextId = 0;

  private readonly api = inject(InstrumentsApiService);
  private readonly catalog = inject(InstrumentCatalogService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(AuthService);
  private readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('input');

  private readonly uid = InstrumentSearchComponent.nextId++;
  protected readonly inputId = `instrument-search-${this.uid}`;
  protected readonly listboxId = `instrument-search-${this.uid}-listbox`;
  protected readonly hintId = `instrument-search-${this.uid}-hint`;

  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly activeIndex = signal(-1);
  protected readonly loading = signal(false);
  private readonly resultState = signal<Instrument | null>(null);
  protected readonly result = computed<Instrument | null>(() => {
    const result = this.resultState();
    return result ? (this.catalog.bySymbol().get(result.symbol) ?? result) : null;
  });
  protected readonly error = signal<string | null>(null);
  /** The (upper-cased) symbol the current result or error refers to. */
  protected readonly lookedUp = signal('');
  private readonly listState = signal<Instrument[] | null>(null);
  private readonly now = signal(Date.now());
  private list$: Observable<Instrument[]> | null = null;
  private lookupSeq = 0;

  /** Instruments offered as suggestions: the catalogue when a page already loaded it, else the list read on first focus. */
  protected readonly instruments = computed<Instrument[]>(() => {
    const catalog = this.catalog.instruments();
    return catalog.length > 0 ? catalog : (this.listState() ?? []);
  });

  protected readonly suggestions = computed<Instrument[]>(() => {
    const term = this.query().trim().toUpperCase();
    const instruments = this.instruments();
    if (!term) {
      return instruments.slice(0, MAX_SUGGESTIONS);
    }
    const starts = instruments.filter((item) => item.symbol.toUpperCase().startsWith(term));
    const contains = instruments.filter(
      (item) =>
        !starts.includes(item) &&
        (item.symbol.toUpperCase().includes(term) ||
          item.instrumentName.toUpperCase().includes(term)),
    );
    return [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
  });

  /** What the panel shows: the quote just looked up for the typed symbol, otherwise suggestions. */
  protected readonly view = computed<PanelView>(() => {
    if (this.loading()) {
      return 'loading';
    }
    const term = this.query().trim().toUpperCase();
    if (term && term === this.lookedUp()) {
      if (this.result()) {
        return 'result';
      }
      if (this.error()) {
        return 'error';
      }
    }
    if (this.suggestions().length > 0) {
      return 'suggestions';
    }
    return term && this.instruments().length > 0 ? 'no-match' : 'none';
  });

  protected readonly activeOptionId = computed(() => {
    const index = this.activeIndex();
    return this.open() && this.view() === 'suggestions' && this.suggestions()[index]
      ? this.optionId(index)
      : null;
  });

  protected readonly quoteAge = computed(() =>
    ageInSeconds(this.result()?.quoteAsOf ?? null, this.now()),
  );
  protected readonly quoteFresh = computed(() => {
    const age = this.quoteAge();
    return age !== null && age <= environment.quoteMaxAgeSeconds;
  });
  protected readonly quoteAgeLabel = computed(() => {
    const found = this.result();
    if (!found?.quoteAsOf) {
      return 'No quote';
    }
    return `${formatRelativeAge(found.quoteAsOf, this.now())} · ${this.quoteFresh() ? 'fresh' : 'stale'}`;
  });

  constructor() {
    // Keeps the quote-age label honest while a result stays on screen.
    interval(10_000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.now.set(Date.now()));
  }

  protected optionId(index: number): string {
    return `instrument-search-${this.uid}-option-${index}`;
  }

  protected onFocus(): void {
    this.open.set(true);
    this.ensureSuggestions();
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    const root = event.currentTarget as HTMLElement;
    if (!next || !root.contains(next)) {
      this.open.set(false);
    }
  }

  /** Clicking inside the panel must not move focus away from the input (which would close it). */
  protected keepFocus(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('a, button')) {
      event.preventDefault();
    }
  }

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(-1);
    this.open.set(true);
    this.ensureSuggestions();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.suggestions().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.open.set(true);
        if (count > 0) {
          this.activeIndex.set(this.activeIndex() < 0 ? 0 : (this.activeIndex() + 1) % count);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (count > 0) {
          this.activeIndex.set(this.activeIndex() <= 0 ? count - 1 : this.activeIndex() - 1);
        }
        break;
      case 'Enter': {
        const highlighted =
          this.open() && this.view() === 'suggestions'
            ? this.suggestions()[this.activeIndex()]
            : undefined;
        if (highlighted) {
          event.preventDefault();
          this.choose(highlighted);
        }
        // Otherwise the form submits and looks up the typed symbol.
        break;
      }
      case 'Escape':
        if (this.open()) {
          event.preventDefault();
          this.open.set(false);
        }
        break;
    }
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    void this.lookup(this.query());
  }

  protected choose(item: Instrument): void {
    this.query.set(item.symbol);
    this.activeIndex.set(-1);
    this.inputRef().nativeElement.focus();
    void this.lookup(item.symbol);
  }

  protected clear(): void {
    this.lookupSeq++;
    this.query.set('');
    this.resultState.set(null);
    this.error.set(null);
    this.lookedUp.set('');
    this.activeIndex.set(-1);
    this.loading.set(false);
    this.open.set(true);
    this.inputRef().nativeElement.focus();
  }

  /** Reads the stored quote for one symbol through GET /instruments/symbol/{symbol}. */
  protected async lookup(raw: string): Promise<void> {
    const symbol = raw.trim().toUpperCase();
    if (!symbol) {
      return;
    }
    const seq = ++this.lookupSeq;
    this.loading.set(true);
    this.error.set(null);
    this.resultState.set(null);
    this.lookedUp.set(symbol);
    this.open.set(true);
    try {
      const instrument = await firstValueFrom(this.api.getBySymbol(symbol));
      if (seq === this.lookupSeq) {
        this.resultState.set(instrument);
        this.now.set(Date.now());
      }
    } catch (error: unknown) {
      if (seq !== this.lookupSeq) {
        return;
      }
      // Symbols with a slash (EUR/USD, BTC/USD) are rejected by many servers even when
      // encoded as %2F; the instrument list carries the same stored quote, so use that.
      const fallback = symbol.includes('/') ? await this.fromList(symbol) : null;
      if (seq !== this.lookupSeq) {
        return;
      }
      if (fallback) {
        this.resultState.set(fallback);
        this.now.set(Date.now());
      } else {
        this.error.set(
          httpStatusOf(error) === 404
            ? `No instrument with the symbol “${symbol}”. Try the exact ticker, for example AAPL.`
            : describeHttpError(error, 'The price could not be looked up right now.'),
        );
      }
    } finally {
      if (seq === this.lookupSeq) {
        this.loading.set(false);
      }
    }
  }

  private ensureSuggestions(): void {
    if (this.instruments().length === 0 && this.listState() === null) {
      this.loadList().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }
  }

  /** GET /instruments, read once per component and shared between suggestions and the slash fallback. */
  private loadList(): Observable<Instrument[]> {
    if (!this.list$) {
      this.list$ = this.api.list().pipe(
        tap((instruments) => this.listState.set(instruments)),
        catchError(() => {
          this.list$ = null; // allow another attempt on the next interaction
          return of([] as Instrument[]);
        }),
        shareReplay(1),
      );
    }
    return this.list$;
  }

  private async fromList(symbol: string): Promise<Instrument | null> {
    try {
      const listed =
        this.instruments().length > 0 ? this.instruments() : await firstValueFrom(this.loadList());
      return listed.find((item) => item.symbol.toUpperCase() === symbol) ?? null;
    } catch {
      return null;
    }
  }
}
