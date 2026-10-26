import { Injectable, effect, inject } from '@angular/core';
import { EMPTY, catchError, defer, exhaustMap, from, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { AppVisibilityService } from './app-visibility.service';
import { InstrumentCatalogService } from './instrument-catalog.service';
import { PortfolioService } from './portfolio.service';

/** One app-wide polling owner for mutable quotes and the signed-in client's account data. */
@Injectable({ providedIn: 'root' })
export class AppDataSyncService {
  private readonly auth = inject(AuthService);
  private readonly visibility = inject(AppVisibilityService);
  private readonly catalog = inject(InstrumentCatalogService);
  private readonly portfolio = inject(PortfolioService);

  constructor() {
    effect((onCleanup) => {
      const session = this.auth.session();
      const visible = this.visibility.visible();
      this.visibility.resumeRevision();
      if (!session || !visible) {
        if (!session) this.portfolio.reset();
        return;
      }

      const quotes = timer(0, environment.quotePollIntervalMs)
        .pipe(
          exhaustMap(() =>
            defer(() =>
              this.catalog.loadedAt() === null
                ? from(this.catalog.load())
                : this.catalog.refreshQuotes(),
            ).pipe(catchError(() => EMPTY)),
          ),
        )
        .subscribe();

      const account =
        session.user.kind === 'client'
          ? timer(0, environment.portfolioPollIntervalMs)
              .pipe(
                exhaustMap(() =>
                  from(this.portfolio.refreshSilently()).pipe(catchError(() => EMPTY)),
                ),
              )
              .subscribe()
          : null;

      onCleanup(() => {
        quotes.unsubscribe();
        account?.unsubscribe();
      });
    });
  }
}
