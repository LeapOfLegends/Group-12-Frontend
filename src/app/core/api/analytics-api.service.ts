import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type MetricsRange = 'week' | 'month' | 'year' | 'all';

export interface PlatformMetrics {
  range: MetricsRange;
  from: string | null;
  to: string;
  totalOrders: number;
  filledOrders: number;
  pendingOrders: number;
  failedRejectedOrders: number;
  totalDeposits: number;
  totalWithdrawals: number;
  tradingValues: { currency: string; value: number }[];
}

@Injectable({ providedIn: 'root' })
export class AnalyticsApiService {
  private readonly http = inject(HttpClient);

  platformMetrics(range: MetricsRange): Observable<PlatformMetrics> {
    return this.http.get<PlatformMetrics>(`${environment.tradingApiUrl}/api/analytics/platform-metrics`, {
      params: { range },
    });
  }
}