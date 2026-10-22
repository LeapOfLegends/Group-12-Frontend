import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, viewChild } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { ADMIN_ROLE_LABELS } from '../../../core/models/auth.models';
import { ThemePreference, ThemeService } from '../../../core/services/theme.service';
import { DateTimePipe, ShortDatePipe } from '../../pipes/format.pipes';
import { IconComponent } from '../icon/icon';

/** Profile: who is signed in, session expiry, theme preference and log out. */
@Component({
  selector: 'app-account-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, DateTimePipe, ShortDatePipe],
  template: `
    <dialog #dialog class="dialog" aria-labelledby="account-panel-title">
      <div class="dialog-body">
        <div class="spread">
          <h2 id="account-panel-title">Profile</h2>
          <button type="button" class="btn btn-ghost btn-icon" (click)="close()" aria-label="Close profile">
            <app-icon name="close" [size]="20" />
          </button>
        </div>

        @if (auth.user(); as user) {
          <div class="profile">
            <span class="avatar" aria-hidden="true">{{ initials() }}</span>
            <div class="profile-meta">
              <strong>{{ user.displayName }}</strong>
              <span class="text-secondary text-sm">{{ user.email }}</span>
              <span class="pill" [class.pill-brand]="user.kind === 'client'" [class.pill-accent]="user.kind === 'admin'">
                <app-icon [name]="user.kind === 'admin' ? 'shield' : 'user'" [size]="14" />
                {{ accountType() }}
              </span>
            </div>
          </div>

          <dl class="summary-list">
            <div>
              <dt>{{ user.kind === 'admin' ? 'Administrator ID' : 'Client ID' }}</dt>
              <dd>{{ user.id }}</dd>
            </div>
            @if (user.createdAt) {
              <div>
                <dt>Member since</dt>
                <dd>{{ user.createdAt | shortDate }}</dd>
              </div>
            }
            <div>
              <dt>Session expires</dt>
              <dd>{{ auth.session()?.expiresAt | dateTime }}</dd>
            </div>
          </dl>
        }

        <fieldset class="theme-field">
          <legend class="field-label">Appearance</legend>
          <div class="segmented segmented-block" role="group" aria-label="Theme">
            @for (option of themeOptions; track option.value) {
              <button type="button" [attr.aria-pressed]="theme.preference() === option.value" (click)="theme.setPreference(option.value)">
                {{ option.label }}
              </button>
            }
          </div>
        </fieldset>

        <div class="dialog-actions">
          <button type="button" class="btn btn-secondary" (click)="close()">Close</button>
          <button type="button" class="btn btn-primary" (click)="logout()">
            <app-icon name="logout" [size]="18" />
            Log out
          </button>
        </div>
      </div>
    </dialog>
  `,
  styles: `
    .profile {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .profile-meta {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .profile-meta .pill {
      width: fit-content;
      margin-top: 2px;
    }

    .avatar {
      display: grid;
      place-items: center;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: var(--color-brand-soft);
      color: var(--color-on-brand-soft);
      font-weight: 700;
      font-size: var(--text-lg);
      flex: none;
    }

    .theme-field {
      border: 0;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
  `,
})
export class AccountPanelComponent {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly themeOptions: { value: ThemePreference; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];

  protected readonly initials = computed(() => {
    const user = this.auth.user();
    if (!user) {
      return '';
    }
    return `${user.firstName.charAt(0) || user.email.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  });

  protected readonly accountType = computed(() => {
    const user = this.auth.user();
    if (!user) {
      return '';
    }
    return user.role ? ADMIN_ROLE_LABELS[user.role] : 'Client account';
  });

  open(): void {
    const dialog = this.dialogRef().nativeElement;
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    }
  }

  close(): void {
    const dialog = this.dialogRef().nativeElement;
    if (dialog.open) {
      dialog.close();
    }
  }

  protected logout(): void {
    this.close();
    this.auth.logout();
  }
}
