import { Routes } from '@angular/router';
import {
  adminGuard,
  authGuard,
  clientDashboardGuard,
  clientGuard,
  guestGuard,
} from './core/auth/auth.guards';

/**
 * | Route                   | Page                          | Access                    |
 * |-------------------------|-------------------------------|---------------------------|
 * | /                       | Public landing page           | Public                    |
 * | /login                  | Login                         | Public (signed-out only)  |
 * | /register               | Client registration           | Public (signed-out only)  |
 * | /dashboard              | Client dashboard              | Clients (admin -> /admin) |
 * | /admin                  | Administrator dashboard       | Authorised administrators |
 * | /transfer               | Transfer money                | Authorised clients        |
 * | /transfer/confirmation  | Transfer receipt              | Authorised clients        |
 * | /trade                  | Place trade                   | Authorised clients        |
 * | /trade/confirmation     | Trade receipt / order status  | Authorised clients        |
 *
 * Signed-in visitors can view the public landing page. `/login` and `/register` remain
 * guest-only and redirect signed-in visitors to their own dashboard. Everything else under
 * the authenticated layout shares the top navbar.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/landing/landing').then((m) => m.LandingPage),
    title: 'JetZy Trading · Direct trading for self-directed investors',
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/login/login').then((m) => m.LoginPage),
    title: 'Sign in · JetZy Trading',
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/register/register').then((m) => m.RegisterPage),
    title: 'Create account · JetZy Trading',
  },
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    loadComponent: () =>
      import('./shared/ui/app-layout/app-layout').then((m) => m.AppLayoutComponent),
    children: [
      {
        path: 'dashboard',
        canActivate: [clientDashboardGuard],
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.DashboardPage),
        title: 'Dashboard · JetZy Trading',
      },
      {
        path: 'instruments/:instrumentId',
        loadComponent: () =>
          import('./features/instrument-history/instrument-history').then(
            (m) => m.InstrumentHistoryPage,
          ),
        title: 'Price history · JetZy Trading',
      },
      {
        path: 'transfer',
        canActivate: [clientGuard],
        loadComponent: () => import('./features/transfer/transfer').then((m) => m.TransferPage),
        title: 'Transfer money · JetZy Trading',
      },
      {
        path: 'transfer/confirmation',
        canActivate: [clientGuard],
        loadComponent: () =>
          import('./features/transfer/transfer-confirmation').then(
            (m) => m.TransferConfirmationPage,
          ),
        title: 'Transfer confirmation · JetZy Trading',
      },
      {
        path: 'trade',
        canActivate: [clientGuard],
        loadComponent: () => import('./features/trade/trade').then((m) => m.TradePage),
        title: 'Place trade · JetZy Trading',
      },
      {
        path: 'trade/confirmation',
        canActivate: [clientGuard],
        loadComponent: () =>
          import('./features/trade/trade-confirmation').then((m) => m.TradeConfirmationPage),
        title: 'Trade confirmation · JetZy Trading',
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/admin/admin-dashboard').then((m) => m.AdminDashboardPage),
        title: 'Administration · JetZy Trading',
      },
    ],
  },
  // Unknown URLs return to the landing page.
  { path: '**', redirectTo: '' },
];
