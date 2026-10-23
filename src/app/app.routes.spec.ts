import { routes } from './app.routes';

describe('application routes', () => {
  it('allows signed-in users to open the public landing page', () => {
    const landingRoute = routes.find((route) => route.path === '' && route.pathMatch === 'full');

    expect(landingRoute).toBeDefined();
    expect(landingRoute?.canActivate).toBeUndefined();
  });

  it('keeps login and registration pages guest-only', () => {
    const loginRoute = routes.find((route) => route.path === 'login');
    const registerRoute = routes.find((route) => route.path === 'register');

    expect(loginRoute?.canActivate).toBeDefined();
    expect(registerRoute?.canActivate).toBeDefined();
  });
});
