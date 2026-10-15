import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminRole,
  AuthSession,
  ClientProfile,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  SessionUser,
} from '../models/auth.models';
import { decodeJwt, isJwtExpired } from '../utils/jwt.util';

export type LogoutReason = 'user' | 'expired';

const MAX_TIMER_MS = 2_147_483_647;

/**
 * Owns the signed-in session: logs in (and registers clients) through Group-12-Auth, keeps the JWT in
 * local storage so a refresh does not sign the user out, and exposes role facts
 * derived from the token's claims (the same claims the Spring backend trusts).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly sessionState = signal<AuthSession | null>(this.restoreSession());
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  /** The current session, or null when signed out. */
  readonly session = this.sessionState.asReadonly();
  readonly user = computed(() => this.sessionState()?.user ?? null);
  readonly hasSession = computed(() => this.sessionState() !== null);
  readonly isAdmin = computed(() => this.user()?.kind === 'admin');
  readonly isClient = computed(() => this.user()?.kind === 'client');
  readonly role = computed<AdminRole | null>(() => this.user()?.role ?? null);
  readonly isSuperAdmin = computed(() => this.role() === 'super_admin');
  /** Operations and super admins see trading operations; finance and super admins see financial operations. */
  readonly canViewTradingOperations = computed(
    () => this.role() === 'super_admin' || this.role() === 'operations',
  );
  readonly canViewFinancialOperations = computed(
    () => this.role() === 'super_admin' || this.role() === 'finance',
  );
  /** Only the backend's super_admin role may call /admins. */
  readonly canManageAdmins = computed(() => this.role() === 'super_admin');

  constructor() {
    const session = this.sessionState();
    if (session) {
      this.scheduleExpiry(session);
    }
  }

  /** True when a session exists and its token has not expired yet. */
  isAuthenticated(nowMs: number = Date.now()): boolean {
    const session = this.sessionState();
    return session !== null && session.expiresAt > nowMs;
  }

  accessToken(): string | null {
    return this.sessionState()?.accessToken ?? null;
  }

  login(credentials: LoginRequest): Observable<AuthSession> {
    return this.http.post<LoginResponse>(`${environment.authApiUrl}/auth/login`, credentials).pipe(
      map((response) => this.toSession(response)),
      tap((session) => this.setSession(session)),
    );
  }

  /**
   * Creates a client account through Group-12-Auth (POST /auth/register). The service
   * hashes the password and answers 201 with the public client record; no session is
   * started, so the caller sends the new client to the login page.
   */
  register(request: RegisterRequest): Observable<ClientProfile> {
    return this.http.post<ClientProfile>(`${environment.authApiUrl}/auth/register`, request);
  }

  /** Clears the session and returns to the login page. */
  logout(reason: LogoutReason = 'user'): void {
    const hadSession = this.sessionState() !== null;
    this.clearSession();
    if (hadSession || reason === 'expired') {
      void this.router.navigate(
        ['/login'],
        reason === 'expired' ? { queryParams: { reason: 'expired' } } : {},
      );
    }
  }

  clearSession(): void {
    this.cancelExpiryTimer();
    this.sessionState.set(null);
    try {
      localStorage.removeItem(environment.sessionStorageKey);
    } catch {
      /* storage unavailable */
    }
  }

  private setSession(session: AuthSession): void {
    this.sessionState.set(session);
    try {
      localStorage.setItem(environment.sessionStorageKey, JSON.stringify(session));
    } catch {
      /* storage unavailable: the session lives in memory only */
    }
    this.scheduleExpiry(session);
  }

  private toSession(response: LoginResponse): AuthSession {
    const claims = decodeJwt(response.accessToken);
    if (!claims) {
      throw new Error('The sign-in service returned an unreadable token.');
    }
    if (isJwtExpired(claims)) {
      throw new Error('The sign-in service returned an expired token.');
    }

    const isAdminToken = typeof claims.role === 'string' && claims.role.length > 0;
    const profile = isAdminToken ? response.admin : response.client;
    const firstName = profile?.firstName ?? '';
    const lastName = profile?.lastName ?? '';
    const displayName = `${firstName} ${lastName}`.trim() || claims.email;

    const user: SessionUser = {
      kind: isAdminToken ? 'admin' : 'client',
      id: Number(claims.sub),
      email: claims.email || profile?.email || '',
      firstName,
      lastName,
      displayName,
      role: isAdminToken ? (claims.role as AdminRole) : null,
      createdAt: profile?.createdAt ?? null,
    };

    return {
      accessToken: response.accessToken,
      user,
      expiresAt: claims.exp * 1000,
      issuedAt: claims.iat ? claims.iat * 1000 : Date.now(),
    };
  }

  private restoreSession(): AuthSession | null {
    try {
      const raw = localStorage.getItem(environment.sessionStorageKey);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as Partial<AuthSession>;
      if (
        !parsed ||
        typeof parsed.accessToken !== 'string' ||
        !parsed.user ||
        typeof parsed.expiresAt !== 'number'
      ) {
        localStorage.removeItem(environment.sessionStorageKey);
        return null;
      }
      const claims = decodeJwt(parsed.accessToken);
      if (!claims || isJwtExpired(claims)) {
        localStorage.removeItem(environment.sessionStorageKey);
        return null;
      }
      return parsed as AuthSession;
    } catch {
      return null;
    }
  }

  private scheduleExpiry(session: AuthSession): void {
    this.cancelExpiryTimer();
    const delay = Math.min(MAX_TIMER_MS, Math.max(0, session.expiresAt - Date.now()));
    this.expiryTimer = setTimeout(() => {
      if (this.sessionState()?.accessToken === session.accessToken) {
        this.logout('expired');
      }
    }, delay);
  }

  private cancelExpiryTimer(): void {
    if (this.expiryTimer !== null) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }
}
