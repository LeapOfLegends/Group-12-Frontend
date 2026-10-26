import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { AppDataSyncService } from './app-data-sync.service';
import { AppVisibilityService } from './app-visibility.service';
import { InstrumentCatalogService } from './instrument-catalog.service';
import { PortfolioService } from './portfolio.service';

describe('AppDataSyncService', () => {
  const session = signal<any>(null);
  const visible = signal(true);
  const resumeRevision = signal(0);
  const loadedAt = signal<number | null>(1);
  const catalog = {
    loadedAt,
    load: vi.fn(() => Promise.resolve([])),
    refreshQuotes: vi.fn(() => of([])),
  };
  const portfolio = {
    refreshSilently: vi.fn(() => Promise.resolve()),
    reset: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    session.set(null);
    visible.set(true);
    resumeRevision.set(0);
    loadedAt.set(1);
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        AppDataSyncService,
        { provide: AuthService, useValue: { session } },
        { provide: AppVisibilityService, useValue: { visible, resumeRevision } },
        { provide: InstrumentCatalogService, useValue: catalog },
        { provide: PortfolioService, useValue: portfolio },
      ],
    });
    TestBed.inject(AppDataSyncService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('starts one quote and account loop for a visible client and stops on logout', async () => {
    expect(catalog.refreshQuotes).not.toHaveBeenCalled();
    session.set({ user: { kind: 'client', id: 12 }, accessToken: 'client-a' });
    TestBed.flushEffects();
    await vi.advanceTimersByTimeAsync(0);
    expect(catalog.refreshQuotes).toHaveBeenCalledTimes(1);
    expect(portfolio.refreshSilently).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(environment.quotePollIntervalMs);
    expect(catalog.refreshQuotes).toHaveBeenCalledTimes(2);
    session.set(null);
    TestBed.flushEffects();
    await vi.advanceTimersByTimeAsync(environment.portfolioPollIntervalMs * 2);
    expect(catalog.refreshQuotes).toHaveBeenCalledTimes(2);
    expect(portfolio.reset).toHaveBeenCalled();
  });

  it('pauses while hidden and resumes immediately without duplicate loops', async () => {
    session.set({ user: { kind: 'admin', id: 60 }, accessToken: 'admin-a' });
    TestBed.flushEffects();
    await vi.advanceTimersByTimeAsync(0);
    expect(catalog.refreshQuotes).toHaveBeenCalledTimes(1);
    expect(portfolio.refreshSilently).not.toHaveBeenCalled();

    visible.set(false);
    TestBed.flushEffects();
    await vi.advanceTimersByTimeAsync(environment.quotePollIntervalMs * 2);
    expect(catalog.refreshQuotes).toHaveBeenCalledTimes(1);

    visible.set(true);
    resumeRevision.update((value) => value + 1);
    TestBed.flushEffects();
    await vi.advanceTimersByTimeAsync(0);
    expect(catalog.refreshQuotes).toHaveBeenCalledTimes(2);
  });
});
