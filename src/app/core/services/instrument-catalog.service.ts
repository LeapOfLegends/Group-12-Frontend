import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, firstValueFrom, forkJoin, map, of, shareReplay, tap } from 'rxjs';
import { InstrumentsApiService } from '../api/instruments-api.service';
import { CatalogInstrument, Instrument } from '../models/trading.models';
import { describeHttpError } from '../utils/http-error';

const ID_CACHE_KEY = 'jetzy.instrumentIds';
const PROBE_BATCH_SIZE = 16;
const PROBE_MAX_ID = 400;

/**
 * The tradable instrument catalogue.
 *
 * Order submission needs an `instrumentId`, but the backend's InstrumentDTO (used by
 * `GET /instruments`) omits it. Until the DTO carries the id, this service resolves
 * ids through `GET /instruments/{id}`: it reads ids in small batches, stops after the
 * first batch with no hits, and caches the symbol -> id map for the session. If the
 * list endpoint ever starts returning `instrumentId`, the probe is skipped.
 */
@Injectable({ providedIn: 'root' })
export class InstrumentCatalogService {
  private readonly api = inject(InstrumentsApiService);
  private readonly byIdCache = new Map<number, Observable<Instrument | null>>();

  private readonly instrumentsState = signal<CatalogInstrument[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly loadedAtState = signal<number | null>(null);
  private loadPromise: Promise<CatalogInstrument[]> | null = null;

  readonly instruments = this.instrumentsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly loadedAt = this.loadedAtState.asReadonly();
  readonly tradable = computed(() =>
    this.instrumentsState().filter((instrument) => instrument.tradable),
  );
  readonly bySymbol = computed(
    () => new Map(this.instrumentsState().map((instrument) => [instrument.symbol, instrument])),
  );

  /** Loads the catalogue once per session unless `force` is set. */
  async load(force = false): Promise<CatalogInstrument[]> {
    if (!force && this.loadedAtState() !== null) {
      return this.instrumentsState();
    }
    if (this.loadPromise) {
      return this.loadPromise;
    }
    this.loadingState.set(true);
    this.errorState.set(null);
    this.loadPromise = this.loadCatalog()
      .then((instruments) => {
        this.instrumentsState.set(instruments);
        this.loadedAtState.set(Date.now());
        return instruments;
      })
      .catch((error: unknown) => {
        this.errorState.set(describeHttpError(error, 'Instruments could not be loaded.'));
        throw error;
      })
      .finally(() => {
        this.loadingState.set(false);
        this.loadPromise = null;
      });
    return this.loadPromise;
  }

  /** Fetches one instrument by id with a per-session cache (used to label holdings and orders). */
  getById(instrumentId: number): Observable<Instrument | null> {
    let cached = this.byIdCache.get(instrumentId);
    if (!cached) {
      cached = this.api.getById(instrumentId).pipe(
        catchError(() => of(null)),
        shareReplay(1),
      );
      this.byIdCache.set(instrumentId, cached);
    }
    return cached;
  }

  /** Resolves several instruments by id in one go. */
  getMany(instrumentIds: readonly number[]): Observable<Map<number, Instrument>> {
    const unique = [...new Set(instrumentIds)];
    if (unique.length === 0) {
      return of(new Map<number, Instrument>());
    }
    return forkJoin(
      unique.map((id) => this.getById(id).pipe(map((instrument) => [id, instrument] as const))),
    ).pipe(
      map((entries) => {
        const result = new Map<number, Instrument>();
        for (const [id, instrument] of entries) {
          if (instrument) {
            result.set(id, instrument);
          }
        }
        return result;
      }),
    );
  }

  /** Re-reads the latest quote for one symbol and patches it into the catalogue. */
  refreshQuote(symbol: string): Observable<CatalogInstrument | null> {
    const existing = this.bySymbol().get(symbol.trim().toUpperCase());
    if (!existing) {
      return of(null);
    }

    // A symbol can contain a slash (for example ADA/USD or EUR/USD). Even when
    // encoded as %2F, many HTTP servers reject it as an encoded path separator.
    // Refresh by the already-resolved numeric id so every asset class uses a safe URL.
    return this.api.getById(existing.instrumentId).pipe(
      map((fresh) => {
        const updated: CatalogInstrument = {
          ...existing,
          ...fresh,
          instrumentId: existing.instrumentId,
        };
        this.instrumentsState.update((instruments) =>
          instruments.map((item) => (item.symbol === updated.symbol ? updated : item)),
        );
        this.byIdCache.set(updated.instrumentId, of(updated));
        return updated;
      }),
      tap({ error: () => undefined }),
    );
  }

  private async loadCatalog(): Promise<CatalogInstrument[]> {
    const listed = await firstValueFrom(this.api.list());
    const withIds = listed.filter(
      (instrument): instrument is CatalogInstrument => typeof instrument.instrumentId === 'number',
    );
    if (withIds.length === listed.length) {
      return withIds;
    }

    const idBySymbol = await this.resolveIds(listed.map((instrument) => instrument.symbol));
    const resolved: CatalogInstrument[] = [];
    for (const instrument of listed) {
      const id = instrument.instrumentId ?? idBySymbol.get(instrument.symbol);
      if (typeof id === 'number') {
        resolved.push({ ...instrument, instrumentId: id });
      }
    }
    return resolved;
  }

  private async resolveIds(symbols: readonly string[]): Promise<Map<string, number>> {
    const cached = this.readIdCache();
    if (cached && symbols.every((symbol) => cached.has(symbol))) {
      return cached;
    }

    const idBySymbol = new Map<string, number>();
    const wanted = new Set(symbols);
    for (let start = 1; start <= PROBE_MAX_ID; start += PROBE_BATCH_SIZE) {
      const ids = Array.from({ length: PROBE_BATCH_SIZE }, (_, index) => start + index);
      const batch = await firstValueFrom(
        forkJoin(
          ids.map((id) =>
            this.api.getById(id).pipe(
              map((instrument) => ({ id, instrument: instrument as Instrument | null })),
              catchError((error: unknown) => {
                if (error instanceof HttpErrorResponse && error.status === 404) {
                  return of({ id, instrument: null });
                }
                throw error;
              }),
            ),
          ),
        ),
      );
      let hits = 0;
      for (const { id, instrument } of batch) {
        if (instrument) {
          hits++;
          this.byIdCache.set(id, of(instrument));
          if (!idBySymbol.has(instrument.symbol)) {
            idBySymbol.set(instrument.symbol, id);
          }
        }
      }
      const complete = [...wanted].every((symbol) => idBySymbol.has(symbol));
      if (hits === 0 || complete) {
        break;
      }
    }
    this.writeIdCache(idBySymbol);
    return idBySymbol;
  }

  private readIdCache(): Map<string, number> | null {
    try {
      const raw = sessionStorage.getItem(ID_CACHE_KEY);
      if (!raw) {
        return null;
      }
      const entries = JSON.parse(raw) as [string, number][];
      return new Map(
        entries.filter(([symbol, id]) => typeof symbol === 'string' && typeof id === 'number'),
      );
    } catch {
      return null;
    }
  }

  private writeIdCache(map: Map<string, number>): void {
    try {
      sessionStorage.setItem(ID_CACHE_KEY, JSON.stringify([...map.entries()]));
    } catch {
      /* storage unavailable */
    }
  }
}
