import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { ADMIN_ROLE_LABELS } from '../../../core/models/auth.models';
import { ThemeService } from '../../../core/services/theme.service';
import { BrandLogoComponent } from '../brand-logo/brand-logo';
import { IconComponent } from '../icon/icon';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  description: string;
}

/**
 * Top navigation bar shared by every page. Left: the brand and, once signed in, the links
 * the sidebar used to hold (they follow the account kind, never UI state alone). Right: the
 * theme toggle, then the profile card when signed in or Log in / Sign up when signed out.
 * Below the tablet breakpoint the links fold into a menu behind the hamburger button.
 */
@Component({
  selector: 'app-navbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, BrandLogoComponent, IconComponent],
  host: { '(document:keydown.escape)': 'closeMenu()' },
  template: `
    <header class="navbar" [class.navbar-menu-open]="menuOpen()">
      <div class="navbar-inner">
        <div class="navbar-left">
          <app-brand-logo [markSize]="32" [homeLink]="signedIn() ? auth.homeUrl() : '/'" />
          @if (signedIn()) {
            <nav class="navbar-links" aria-label="Primary">
              @for (item of items(); track item.route) {
                <a
                  class="navbar-link"
                  [routerLink]="item.route"
                  routerLinkActive="navbar-link-active"
                  #rla="routerLinkActive"
                  [attr.aria-current]="rla.isActive ? 'page' : null"
                  [attr.title]="item.description"
                >
                  <app-icon [name]="item.icon" [size]="18" />
                  <span>{{ item.label }}</span>
                </a>
              }
            </nav>
          }
        </div>

        <div class="navbar-right">
          <button
            type="button"
            class="btn btn-ghost btn-icon"
            (click)="theme.toggle()"
            [attr.aria-label]="theme.isDark() ? 'Switch to light theme' : 'Switch to dark theme'"
            [attr.aria-pressed]="theme.isDark()"
          >
            <app-icon [name]="theme.isDark() ? 'sun' : 'moon'" [size]="20" />
          </button>
          @if (signedIn()) {
            <button type="button" class="navbar-account" (click)="openProfile()" aria-haspopup="dialog" aria-label="Open profile">
              <span class="avatar" aria-hidden="true">{{ initials() }}</span>
              <span class="navbar-account-meta">
                <span class="navbar-account-name truncate">{{ auth.user()?.displayName }}</span>
                <span class="navbar-account-role truncate">{{ roleLabel() }}</span>
              </span>
              <app-icon name="chevron-down" [size]="16" />
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-icon navbar-menu"
              (click)="toggleMenu()"
              aria-controls="navbar-drawer"
              [attr.aria-expanded]="menuOpen()"
              [attr.aria-label]="menuOpen() ? 'Close navigation' : 'Open navigation'"
            >
              <app-icon [name]="menuOpen() ? 'close' : 'menu'" [size]="22" />
            </button>
          } @else {
            <a class="btn btn-ghost navbar-login" routerLink="/login">Log in</a>
            <a class="btn btn-primary navbar-signup" routerLink="/register">Sign up</a>
          }
        </div>
      </div>

      @if (signedIn()) {
        <!-- Mobile menu: the same links plus the profile and sign-out actions. -->
        <div class="navbar-backdrop" (click)="closeMenu()" aria-hidden="true"></div>
        <nav
          id="navbar-drawer"
          class="navbar-drawer"
          aria-label="Primary menu"
          [attr.aria-hidden]="!menuOpen()"
          [attr.inert]="menuOpen() ? null : ''"
        >
          @for (item of items(); track item.route) {
            <a class="navbar-drawer-link" [routerLink]="item.route" routerLinkActive="navbar-link-active" (click)="closeMenu()">
              <app-icon [name]="item.icon" [size]="18" />
              <span>{{ item.label }}</span>
            </a>
          }
          <hr class="divider" />
          <button type="button" class="navbar-drawer-link" (click)="openProfile()">
            <app-icon name="user" [size]="18" />
            <span>Profile</span>
          </button>
          <button type="button" class="navbar-drawer-link" (click)="logout()">
            <app-icon name="logout" [size]="18" />
            <span>Log out</span>
          </button>
        </nav>
      }
    </header>
  `,
  styles: `
    .navbar {
      position: sticky;
      top: 0;
      z-index: 30;
      background: color-mix(in srgb, var(--color-bg) 88%, transparent);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--color-border);
    }

    .navbar-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      min-height: var(--topbar-height);
      max-width: var(--content-max);
      margin: 0 auto;
      padding: 0 var(--space-8);
    }

    .navbar-left,
    .navbar-right {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-width: 0;
    }

    .navbar-left {
      flex: 1;
      gap: var(--space-6);
    }

    .navbar-links {
      display: flex;
      align-items: center;
      gap: 2px;
      min-width: 0;
    }

    .navbar-link,
    .navbar-drawer-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 40px;
      padding: 0 12px;
      border: 0;
      border-radius: var(--radius-md);
      background: transparent;
      color: var(--color-text-secondary);
      font: inherit;
      font-size: var(--text-sm);
      font-weight: 500;
      white-space: nowrap;
      text-decoration: none;
      cursor: pointer;
      transition:
        background-color var(--transition-fast),
        color var(--transition-fast);
    }

    .navbar-link:hover,
    .navbar-drawer-link:hover {
      background: var(--color-surface-2);
      color: var(--color-text);
      text-decoration: none;
    }

    .navbar-link-active {
      background: var(--color-brand-soft);
      color: var(--color-on-brand-soft);
      font-weight: 600;
    }

    .navbar-account {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      max-width: 260px;
      min-height: 44px;
      padding: 4px 10px 4px 4px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text);
      text-align: left;
    }

    .navbar-account:hover {
      border-color: var(--color-brand);
    }

    .navbar-account-meta {
      display: flex;
      flex-direction: column;
      min-width: 0;
      line-height: 1.2;
    }

    .navbar-account-name {
      font-weight: 600;
      font-size: var(--text-sm);
    }

    .navbar-account-role {
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
    }

    .avatar {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: var(--color-brand-soft);
      color: var(--color-on-brand-soft);
      font-weight: 700;
      font-size: var(--text-xs);
      flex: none;
    }

    .navbar-login {
      color: var(--color-text);
    }

    .navbar-menu,
    .navbar-drawer,
    .navbar-backdrop {
      display: none;
    }

    @media (max-width: 1024px) {
      .navbar-inner {
        padding: 0 var(--space-4);
      }

      .navbar-links,
      .navbar-account-meta,
      .navbar-account app-icon {
        display: none;
      }

      .navbar-account {
        padding: 3px;
      }

      .navbar-menu {
        display: inline-flex;
      }

      .navbar-backdrop {
        display: block;
        position: fixed;
        inset: 0;
        background: rgba(7, 23, 17, 0.4);
        opacity: 0;
        pointer-events: none;
        transition: opacity 200ms ease;
        z-index: -1;
      }

      .navbar-drawer {
        display: flex;
        flex-direction: column;
        gap: 2px;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        max-height: 0;
        overflow: hidden;
        padding: 0 var(--space-4);
        border-bottom: 0 solid var(--color-border);
        background: var(--color-surface);
        transition:
          max-height 200ms ease,
          padding 200ms ease;
      }

      .navbar-menu-open .navbar-backdrop {
        opacity: 1;
        pointer-events: auto;
      }

      .navbar-menu-open .navbar-drawer {
        max-height: calc(100vh - var(--topbar-height));
        overflow-y: auto;
        padding: var(--space-3) var(--space-4) var(--space-4);
        border-bottom-width: 1px;
        box-shadow: var(--shadow-lg);
      }

      .navbar-drawer-link {
        width: 100%;
        min-height: 46px;
        font-size: var(--text-base);
      }

      .navbar-drawer .divider {
        margin: var(--space-2) 0;
      }

      .navbar-signup {
        min-height: 40px;
        padding: 0 var(--space-4);
      }
    }

    @media (max-width: 480px) {
      .navbar-login {
        padding: 0 var(--space-3);
      }
    }
  `,
})
export class NavbarComponent {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Emitted by the profile card; the host layout opens the profile panel. */
  readonly openAccount = output<void>();

  protected readonly menuOpen = signal(false);
  protected readonly signedIn = computed(() => this.auth.user() !== null);

  /** The links the sidebar used to show: by account kind, with the backend enforcing every call. */
  protected readonly items = computed<NavItem[]>(() => {
    const items: NavItem[] = [
      { label: 'Dashboard', route: '/dashboard', icon: 'dashboard', description: 'Your portfolio at a glance' },
    ];
    if (this.auth.isClient()) {
      items.push(
        { label: 'Transfer Money', route: '/transfer', icon: 'transfer', description: 'Deposit or withdraw cash' },
        { label: 'Place Trade', route: '/trade', icon: 'trade', description: 'Buy or sell an instrument' },
      );
    }
    if (this.auth.isAdmin()) {
      items.push({
        label: 'Admin Dashboard',
        route: '/admin',
        icon: 'shield',
        description: 'Platform operations and administration',
      });
    }
    return items;
  });

  protected readonly initials = computed(() => {
    const user = this.auth.user();
    if (!user) {
      return '';
    }
    return `${user.firstName.charAt(0) || user.email.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  });

  protected readonly roleLabel = computed(() => {
    const user = this.auth.user();
    if (!user) {
      return '';
    }
    return user.role ? ADMIN_ROLE_LABELS[user.role] : 'Client account';
  });

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.closeMenu());
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    if (this.menuOpen()) {
      this.menuOpen.set(false);
    }
  }

  protected openProfile(): void {
    this.closeMenu();
    this.openAccount.emit();
  }

  protected logout(): void {
    this.closeMenu();
    this.auth.logout();
  }
}
