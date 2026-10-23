import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { NotificationService } from '../services/notification.service';
import { AuthService } from './auth.service';

/** Protected routes require a live session; otherwise go to /login and come back afterwards. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    return true;
  }
  const expired = auth.hasSession();
  auth.clearSession();
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url, ...(expired ? { reason: 'expired' } : {}) },
  });
};

/** The login page is only for signed-out visitors; signed-in users go to their own dashboard. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? router.createUrlTree([auth.homeUrl()]) : true;
};

/** /admin is only for administrators. The backend still enforces roles on every API call. */
export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    auth.clearSession();
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
  if (auth.isAdmin()) {
    return true;
  }
  inject(NotificationService).warning('The administrator dashboard is only available to administrator accounts.');
  return router.createUrlTree([auth.homeUrl()]);
};

/** Transfers and trades need a client account; administrators have no portfolio. */
export const clientGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    auth.clearSession();
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
  if (auth.isClient()) {
    return true;
  }
  inject(NotificationService).warning('Administrator accounts cannot move money or place trades.');
  return router.createUrlTree([auth.homeUrl()]);
};
