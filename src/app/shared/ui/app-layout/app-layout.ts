import { ChangeDetectionStrategy, Component, viewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AccountPanelComponent } from '../account-panel/account-panel';
import { NavbarComponent } from '../navbar/navbar';

/** Authenticated shell: the top navbar, the content area and the profile panel. */
@Component({
  selector: 'app-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, NavbarComponent, AccountPanelComponent],
  template: `
    <a class="skip-link" href="#main-content">Skip to main content</a>
    <div class="shell">
      <app-navbar (openAccount)="openAccount()" />
      <main id="main-content" class="shell-content" tabindex="-1">
        <router-outlet />
      </main>
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
      flex-direction: column;
      min-height: 100vh;
    }

    .shell-content {
      flex: 1;
      width: 100%;
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
  private readonly accountPanel = viewChild.required(AccountPanelComponent);

  protected openAccount(): void {
    this.accountPanel().open();
  }
}
