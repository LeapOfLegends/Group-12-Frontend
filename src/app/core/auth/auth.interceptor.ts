import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

function isPlatformApi(url: string): boolean {
  return url.startsWith(environment.authApiUrl) || url.startsWith(environment.tradingApiUrl);
}

function isLoginCall(url: string): boolean {
  return url.startsWith(`${environment.authApiUrl}/auth/login`);
}

/**
 * Adds the session's bearer token to every call to the platform APIs and signs the
 * user out when a backend answers 401 (the token was rejected or has expired).
 * The login call itself is excluded: a 401 there just means wrong credentials.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const platformCall = isPlatformApi(request.url) && !isLoginCall(request.url);
  const token = auth.accessToken();

  const outgoing = platformCall && token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;

  return next(outgoing).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && platformCall && auth.hasSession()) {
        auth.logout('expired');
      }
      return throwError(() => error);
    }),
  );
};
