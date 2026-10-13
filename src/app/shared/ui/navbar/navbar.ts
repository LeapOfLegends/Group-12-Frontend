import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { BrandLogoComponent } from '../brand-logo/brand-logo';
import { IconComponent } from '../icon/icon';

/** Slim top bar: mobile menu, compact brand, theme toggle and the account button. */
@Component({
  selector: 'app-navbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BrandLogoComponent, IconComponent],
  template: `
    <header class="navbar">
      <div class="navbar-left">
        <button type="button" class="btn btn-ghost btn-icon navbar-menu" (click)="menu.emit()" aria-label="Open navigation">
          <app-icon name="menu" [size]="22" />
        </button>
        <span class="navbar-brand"><app-brand-logo [markSize]="30" /></span>
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
        <button type="button" class="navbar-account" (click)="openAccount.emit()" aria-haspopup="dialog" aria-label="Open account panel">
          <span class="avatar" aria-hidden="true">{{ initials() }}</span>
          <span class="navbar-account-name">{{ auth.user()?.displayName }}</span>
          <app-icon name="chevron-down" [size]="16" />
        </button>
      </div>
    </header>
  `,
  styles: `
    .navbar {
      position: sticky;
      top: 0;
      z-index: 30;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      min-height: var(--topbar-height);
      padding: 0 var(--space-8);
      background: color-mix(in srgb, var(--color-bg) 86%, transparent);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--color-border);
    }

    .navbar-left,
    .navbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .navbar-menu,
    .navbar-brand {
      display: none;
    }

    .navbar-account {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-height: 40px;
      padding: 4px 10px 4px 4px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text);
      font-weight: 600;
      font-size: var(--text-sm);
    }

    .navbar-account:hover {
      border-color: var(--color-brand);
    }

    .avatar {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--color-brand-soft);
      color: var(--color-on-brand-soft);
      font-weight: 700;
      font-size: var(--text-xs);
    }

    @media (max-width: 1024px) {
      .navbar {
        padding: 0 var(--space-4);
      }

      .navbar-menu,
      .navbar-brand {
        display: inline-flex;
      }
    }

    @media (max-width: 600px) {
      .navbar-account-name {
        display: none;
      }
    }
  `,
})
export class NavbarComponent {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);

  readonly menu = output<void>();
  readonly openAccount = output<void>();

  protected readonly initials = computed(() => {
    const user = this.auth.user();
    if (!user) {
      return '';
    }
    return `${user.firstName.charAt(0) || user.email.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  });
}
