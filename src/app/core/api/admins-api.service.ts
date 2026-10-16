import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminRole } from '../models/auth.models';
import { AdminRecord, CreateAdminRequest, UpdateAdminRequest } from '../models/trading.models';

/** Group-12-Backend `/admins` - every call requires a super_admin token. */
@Injectable({ providedIn: 'root' })
export class AdminsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.tradingApiUrl}/admins`;

  list(): Observable<AdminRecord[]> {
    return this.http.get<Record<string, unknown>[]>(this.baseUrl).pipe(map((rows) => rows.map(toAdmin)));
  }

  create(request: CreateAdminRequest): Observable<AdminRecord> {
    return this.http.post<Record<string, unknown>>(this.baseUrl, request).pipe(map(toAdmin));
  }

  update(adminId: number, request: UpdateAdminRequest): Observable<AdminRecord> {
    return this.http.put<Record<string, unknown>>(`${this.baseUrl}/${adminId}`, request).pipe(map(toAdmin));
  }

  delete(adminId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${adminId}`);
  }
}

function toAdmin(raw: Record<string, unknown>): AdminRecord {
  return {
    adminId: Number(raw['adminId']),
    firstName: String(raw['firstName'] ?? ''),
    lastName: String(raw['lastName'] ?? ''),
    email: String(raw['email'] ?? ''),
    role: String(raw['role'] ?? 'operations') as AdminRole,
    createdAt: typeof raw['createdAt'] === 'string' ? raw['createdAt'] : null,
  };
}
