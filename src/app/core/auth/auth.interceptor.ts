import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

/** A token this close to its expiry is treated as expired when a backend rejects it (clock skew). */
const EXPIRY_TOLERANCE_MS = 60_000;

export const TOKEN_REJECTED_MESSAGE =
  'The trading service rejected your sign-in token even though it has not expired. This usually means ' +
  'Group-12-Backend is running with a different JWT_SECRET than Group-12-Auth. Once both services share ' +
  'the same secret, log out and sign in again.';

function isPlatformApi(url: string): boolean {
  return url.startsWith(environment.authApiUrl) || url.startsWith(environment.tradingApiUrl);
}

/** Sign-in and registration are anonymous: no token is sent, and a 401 there is not a session problem. */
function isPublicAuthCall(url: string): boolean {
  return (
    url.startsWith(`${environment.authApiUrl}/auth/login`) ||
    url.startsWith(`${environment.authApiUrl}/auth/register`)
  );
}

/**
 * Adds the session's bearer token to every call to the platform APIs. When a backend
 * answers 401 the interceptor distinguishes two cases: a token that has (nearly) expired
 * ends the session, while a token that is still valid here is reported as rejected by
 * the backend - usually a JWT_SECRET mismatch between the two services - without
 * bouncing the user to a misleading "session expired" screen.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const platformCall = isPlatformApi(request.url) && !isPublicAuthCall(request.url);
  const token = auth.accessToken();

  const outgoing =
    platformCall && token
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : request;

  return next(outgoing).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        platformCall &&
        auth.hasSession()
      ) {
        if (!auth.isAuthenticated(Date.now() + EXPIRY_TOLERANCE_MS)) {
          auth.logout('expired');
        } else {
          return throwError(() => withMessage(error, TOKEN_REJECTED_MESSAGE));
        }
      }
      return throwError(() => error);
    }),
  );
};

function withMessage(error: HttpErrorResponse, message: string): HttpErrorResponse {
  const body =
    error.error && typeof error.error === 'object'
      ? { ...(error.error as Record<string, unknown>), message }
      : { message };
  return new HttpErrorResponse({
    error: body,
    headers: error.headers,
    status: error.status,
    statusText: error.statusText,
    url: error.url ?? undefined,
  });
}
