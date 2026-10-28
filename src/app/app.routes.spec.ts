import { routes } from './app.routes';
import { clientGuard } from './core/auth/auth.guards';

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

  it('places instrument history under the authenticated layout', () => {
    const layout = routes.find((route) => route.path === '' && route.children);
    expect(layout?.canActivate).toBeDefined();
    expect(
      layout?.children?.find((route) => route.path === 'instruments/:instrumentId'),
    ).toBeDefined();
  });

  it('protects the activity page with the client guard', () => {
    const layout = routes.find((route) => route.path === '' && route.children);
    const activity = layout?.children?.find((route) => route.path === 'activity');

    expect(activity).toBeDefined();
    expect(activity?.canActivate).toContain(clientGuard);
  });
});
