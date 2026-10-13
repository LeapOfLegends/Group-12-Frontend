import { Routes } from '@angular/router';
import { adminGuard, authGuard, clientGuard, guestGuard } from './core/auth/auth.guards';

/**
 * | Route        | Page                    | Access                    |
 * |--------------|-------------------------|---------------------------|
 * | /login       | Login                   | Public (signed-out only)  |
 * | /dashboard   | Client dashboard        | Authenticated             |
 * | /admin       | Administrator dashboard | Authorised administrators |
 * | /transfer    | Transfer money          | Authorised clients        |
 * | /trade       | Place trade             | Authorised clients        |
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/login/login').then((m) => m.LoginPage),
    title: 'Sign in · Leap Trading',
  },
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    loadComponent: () => import('./shared/ui/app-layout/app-layout').then((m) => m.AppLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.DashboardPage),
        title: 'Dashboard · Leap Trading',
      },
      {
        path: 'transfer',
        canActivate: [clientGuard],
        loadComponent: () => import('./features/transfer/transfer').then((m) => m.TransferPage),
        title: 'Transfer money · Leap Trading',
      },
      {
        path: 'trade',
        canActivate: [clientGuard],
        loadComponent: () => import('./features/trade/trade').then((m) => m.TradePage),
        title: 'Place trade · Leap Trading',
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/admin/admin-dashboard').then((m) => m.AdminDashboardPage),
        title: 'Administration · Leap Trading',
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
