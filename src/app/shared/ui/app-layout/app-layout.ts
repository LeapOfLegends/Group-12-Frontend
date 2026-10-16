import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AccountPanelComponent } from '../account-panel/account-panel';
import { NavbarComponent } from '../navbar/navbar';
import { SidebarComponent } from '../sidebar/sidebar';

/** Authenticated shell: sidebar on desktop, drawer on mobile, top bar and content area. */
@Component({
  selector: 'app-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SidebarComponent, NavbarComponent, AccountPanelComponent],
  template: `
    <a class="skip-link" href="#main-content">Skip to main content</a>
    <div class="shell">
      <app-sidebar [open]="drawerOpen()" (closed)="drawerOpen.set(false)" (openAccount)="openAccount()" />
      <div class="shell-main">
        <app-navbar (menu)="drawerOpen.set(true)" (openAccount)="openAccount()" />
        <main id="main-content" class="shell-content" tabindex="-1">
          <router-outlet />
        </main>
      </div>
    </div>
    <app-account-panel #accountPanel />
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
    }

    .skip-link {
      position: absolute;
      top: -100px;
      left: 16px;
      z-index: 2000;
      padding: 10px 14px;
      border-radius: var(--radius-sm);
      background: var(--color-brand);
      color: #fff;
      font-weight: 600;
    }

    .skip-link:focus {
      top: 12px;
    }

    .shell {
      display: flex;
      min-height: 100vh;
    }

    .shell-main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    .shell-content {
      flex: 1;
      padding: var(--space-6) var(--space-8) var(--space-12);
      outline: none;
    }

    @media (max-width: 1024px) {
      .shell-content {
        padding: var(--space-5) var(--space-4) var(--space-10);
      }
    }
  `,
})
export class AppLayoutComponent {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly accountPanel = viewChild.required(AccountPanelComponent);

  protected readonly drawerOpen = signal(false);

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.drawerOpen.set(false));
  }

  protected openAccount(): void {
    this.drawerOpen.set(false);
    this.accountPanel().open();
  }
}
