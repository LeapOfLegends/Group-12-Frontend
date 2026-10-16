import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ADMIN_ROLE_LABELS } from '../../../core/models/auth.models';
import { BrandLogoComponent } from '../brand-logo/brand-logo';
import { IconComponent } from '../icon/icon';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  description: string;
}

/** Deep-green navigation rail. Items depend on the account kind, never on UI state alone. */
@Component({
  selector: 'app-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, BrandLogoComponent, IconComponent],
  host: { '[class.is-open]': 'open()' },
  template: `
    <div class="backdrop" [class.backdrop-visible]="open()" (click)="closed.emit()" aria-hidden="true"></div>
    <nav class="sidebar" [class.sidebar-open]="open()" aria-label="Primary">
      <div class="sidebar-top">
        <app-brand-logo [onDark]="true" />
        <button type="button" class="sidebar-close" (click)="closed.emit()" aria-label="Close navigation">
          <app-icon name="close" [size]="20" />
        </button>
      </div>

      <ul class="nav-list">
        @for (item of items(); track item.route) {
          <li>
            <a
              class="nav-link"
              [routerLink]="item.route"
              routerLinkActive="nav-link-active"
              #rla="routerLinkActive"
              [attr.aria-current]="rla.isActive ? 'page' : null"
              [attr.title]="item.description"
            >
              <app-icon [name]="item.icon" [size]="20" />
              <span>{{ item.label }}</span>
            </a>
          </li>
        }
      </ul>

      <div class="sidebar-bottom">
        <button type="button" class="user-card" (click)="openAccount.emit()" aria-haspopup="dialog">
          <span class="avatar" aria-hidden="true">{{ initials() }}</span>
          <span class="user-meta">
            <span class="user-name truncate">{{ auth.user()?.displayName }}</span>
            <span class="user-role truncate">{{ roleLabel() }}</span>
          </span>
          <app-icon name="chevron-right" [size]="16" />
        </button>
        <button type="button" class="nav-link nav-logout" (click)="auth.logout()">
          <app-icon name="logout" [size]="20" />
          <span>Log out</span>
        </button>
      </div>
    </nav>
  `,
  styles: `
    :host {
      display: contents;
    }

    .sidebar {
      position: sticky;
      top: 0;
      display: flex;
      flex-direction: column;
      width: var(--sidebar-width);
      height: 100vh;
      padding: 20px 16px;
      background: var(--color-nav);
      color: var(--color-nav-text);
      flex: none;
      z-index: 40;
    }

    .sidebar-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 8px 20px;
    }

    .sidebar-close {
      display: none;
      border: 0;
      background: transparent;
      color: var(--color-nav-text);
      width: 36px;
      height: 36px;
      border-radius: var(--radius-sm);
      place-items: center;
    }

    .nav-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      min-height: 46px;
      padding: 0 14px;
      border: 0;
      border-radius: var(--radius-md);
      background: transparent;
      color: var(--color-nav-text);
      font-weight: 500;
      font-size: var(--text-base);
      text-decoration: none;
      transition:
        background-color var(--transition-fast),
        color var(--transition-fast);
    }

    .nav-link:hover {
      background: var(--color-nav-hover);
      color: var(--color-nav-text-strong);
      text-decoration: none;
    }

    .nav-link:focus-visible {
      box-shadow: 0 0 0 3px rgba(200, 164, 107, 0.55);
    }

    .nav-link-active {
      background: var(--color-nav-active);
      color: var(--color-nav-text-strong);
      font-weight: 600;
      box-shadow: inset 3px 0 0 var(--color-accent);
    }

    .sidebar-bottom {
      margin-top: auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-top: 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .user-card {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 10px 12px;
      border: 0;
      border-radius: var(--radius-md);
      background: rgba(255, 255, 255, 0.06);
      color: var(--color-nav-text-strong);
      text-align: left;
    }

    .user-card:hover {
      background: rgba(255, 255, 255, 0.12);
    }

    .avatar {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--color-accent);
      color: #1d1607;
      font-weight: 700;
      font-size: var(--text-sm);
      flex: none;
    }

    .user-meta {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;
    }

    .user-name {
      font-weight: 600;
      font-size: var(--text-sm);
    }

    .user-role {
      font-size: var(--text-xs);
      color: var(--color-nav-text);
    }

    .nav-logout {
      cursor: pointer;
    }

    .backdrop {
      display: none;
    }

    @media (max-width: 1024px) {
      .sidebar {
        position: fixed;
        inset: 0 auto 0 0;
        transform: translateX(-100%);
        transition: transform 200ms ease;
        box-shadow: var(--shadow-lg);
        width: min(300px, 86vw);
      }

      .sidebar-open {
        transform: translateX(0);
      }

      .sidebar-close {
        display: grid;
      }

      .backdrop {
        display: block;
        position: fixed;
        inset: 0;
        background: rgba(7, 23, 17, 0.5);
        opacity: 0;
        pointer-events: none;
        transition: opacity 200ms ease;
        z-index: 39;
      }

      .backdrop-visible {
        opacity: 1;
        pointer-events: auto;
      }
    }
  `,
})
export class SidebarComponent {
  protected readonly auth = inject(AuthService);

  readonly open = input(false);
  readonly closed = output<void>();
  readonly openAccount = output<void>();

  protected readonly items = computed<NavItem[]>(() => {
    const items: NavItem[] = [{ label: 'Dashboard', route: '/dashboard', icon: 'dashboard', description: 'Your portfolio at a glance' }];
    if (this.auth.isClient()) {
      items.push(
        { label: 'Transfer Money', route: '/transfer', icon: 'transfer', description: 'Deposit or withdraw cash' },
        { label: 'Place Trade', route: '/trade', icon: 'trade', description: 'Buy or sell an instrument' },
      );
    }
    if (this.auth.isAdmin()) {
      items.push({ label: 'Admin Dashboard', route: '/admin', icon: 'shield', description: 'Platform operations and administration' });
    }
    return items;
  });

  protected readonly initials = computed(() => {
    const user = this.auth.user();
    if (!user) {
      return '';
    }
    const first = user.firstName.charAt(0) || user.email.charAt(0);
    const last = user.lastName.charAt(0);
    return `${first}${last}`.toUpperCase();
  });

  protected readonly roleLabel = computed(() => {
    const user = this.auth.user();
    if (!user) {
      return '';
    }
    return user.role ? ADMIN_ROLE_LABELS[user.role] : 'Client account';
  });
}
