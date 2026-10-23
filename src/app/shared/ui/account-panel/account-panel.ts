import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClientApiService } from '../../../core/api/client-api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ADMIN_ROLE_LABELS } from '../../../core/models/auth.models';
import { ThemePreference, ThemeService } from '../../../core/services/theme.service';
import { describeHttpError } from '../../../core/utils/http-error';
import { DateTimePipe, ShortDatePipe } from '../../pipes/format.pipes';
import { IconComponent } from '../icon/icon';

/** Profile: who is signed in, session expiry, theme preference and log out. */
@Component({
  selector: 'app-account-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, DateTimePipe, ShortDatePipe, ReactiveFormsModule],
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

          @if (user.kind === 'client') {
            <section class="contact-section" aria-labelledby="contact-title" aria-live="polite">
              <div class="spread">
                <h3 id="contact-title">Contact information</h3>
                @if (!editingContact() && clientProfile()) {
                  <button type="button" class="btn btn-secondary" (click)="startEditing()">Edit</button>
                }
              </div>

              @if (loadingProfile()) {
                <p class="field-hint">Loading contact information…</p>
              } @else if (profileError()) {
                <p class="field-error" role="alert">{{ profileError() }}</p>
                <button type="button" class="btn btn-secondary" (click)="loadContact()">Try again</button>
              } @else if (clientProfile(); as profile) {
                @if (editingContact()) {
                  <form [formGroup]="contactForm" (ngSubmit)="saveContact()" novalidate>
                    <label class="field-label" for="profile-email">Email</label>
                    <input id="profile-email" class="input" type="email" formControlName="email" autocomplete="email"
                      [attr.aria-invalid]="emailError() ? 'true' : null"
                      [attr.aria-describedby]="emailError() ? 'profile-email-error' : 'profile-email-hint'" />
                    @if (emailError(); as error) {
                      <p class="field-error" id="profile-email-error" role="alert">{{ error }}</p>
                    } @else {
                      <p class="field-hint" id="profile-email-hint">Email changes take effect immediately and are used to sign in.</p>
                    }

                    <label class="field-label" for="profile-phone">Phone number</label>
                    <input id="profile-phone" class="input" type="tel" formControlName="phoneNumber" autocomplete="tel"
                      placeholder="202-456-1111" [attr.aria-invalid]="phoneError() ? 'true' : null" />
                    @if (phoneError(); as error) {
                      <p class="field-error" role="alert">{{ error }}</p>
                    } @else {
                      <p class="field-hint">Enter a valid US phone number, such as 202-456-1111.</p>
                    }

                    @if (saveError()) {
                      <p class="field-error" role="alert">{{ saveError() }}</p>
                    }
                    @if (saveSuccess()) {
                      <p class="field-hint" role="status">{{ saveSuccess() }}</p>
                    }
                    <div class="contact-actions">
                      <button type="button" class="btn btn-secondary" (click)="cancelEditing()" [disabled]="saving()">Cancel</button>
                      <button type="submit" class="btn btn-primary" [disabled]="saving() || contactForm.invalid || !hasContactChanges()"
                        [attr.aria-busy]="saving()">{{ saving() ? 'Saving…' : 'Save changes' }}</button>
                    </div>
                  </form>
                } @else {
                  <dl class="summary-list contact-values">
                    <div><dt>Email</dt><dd>{{ profile.email }}</dd></div>
                    <div><dt>Phone</dt><dd>{{ profile.phoneNumber }}</dd></div>
                  </dl>
                  @if (saveSuccess()) {
                    <p class="field-hint" role="status">{{ saveSuccess() }}</p>
                  }
                }
              }
            </section>
          }
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

    .contact-section {
      display: grid;
      gap: 12px;
    }

    .contact-section h3 {
      margin: 0;
      font-size: var(--text-md);
    }

    .contact-section form {
      display: grid;
      gap: 8px;
    }

    .contact-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 8px;
    }

    .contact-values {
      margin: 0;
    }
  `,
})
export class AccountPanelComponent {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly clientApi = inject(ClientApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly clientProfile = signal<{ email: string; phoneNumber: string } | null>(null);
  protected readonly loadingProfile = signal(false);
  protected readonly profileError = signal('');
  protected readonly editingContact = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');
  protected readonly saveSuccess = signal('');
  protected readonly contactForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email, rejectAdminDomain]],
    phoneNumber: ['', [Validators.required, Validators.pattern(/^[2-9]\d{2}-[2-9]\d{2}-\d{4}$/)]],
  });

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
    if (this.auth.isClient()) {
      this.loadContact();
    }
  }

  close(): void {
    const dialog = this.dialogRef().nativeElement;
    if (dialog.open) {
      dialog.close();
    }
    this.editingContact.set(false);
  }

  protected loadContact(): void {
    const user = this.auth.user();
    if (!user || user.kind !== 'client') {
      return;
    }
    this.loadingProfile.set(true);
    this.profileError.set('');
    this.saveError.set('');
    this.saveSuccess.set('');
    this.clientApi.getMyClient().subscribe({
      next: (profile) => {
        this.clientProfile.set({ email: profile.email, phoneNumber: profile.phoneNumber });
        this.auth.updateClientContact(profile.email, profile.phoneNumber);
        this.loadingProfile.set(false);
      },
      error: (error: unknown) => {
        this.profileError.set(describeHttpError(error, 'Could not load your contact information.'));
        this.loadingProfile.set(false);
      },
    });
  }

  protected startEditing(): void {
    const profile = this.clientProfile();
    if (!profile) {
      return;
    }
    this.contactForm.setValue(profile);
    this.contactForm.markAsPristine();
    this.saveError.set('');
    this.saveSuccess.set('');
    this.editingContact.set(true);
  }

  protected cancelEditing(): void {
    this.editingContact.set(false);
    this.saveError.set('');
    this.saveSuccess.set('');
  }

  protected hasContactChanges(): boolean {
    const profile = this.clientProfile();
    const value = this.contactForm.getRawValue();
    return !!profile && (value.email.trim() !== profile.email || value.phoneNumber.trim() !== profile.phoneNumber);
  }

  protected emailError(): string {
    const control = this.contactForm.controls.email;
    if (!control.touched && !control.dirty) return '';
    if (control.hasError('required')) return 'Enter your email address.';
    if (control.hasError('email')) return 'Enter a valid email address.';
    if (control.hasError('adminDomain')) return 'This email domain is reserved for administrator accounts.';
    return '';
  }

  protected phoneError(): string {
    const control = this.contactForm.controls.phoneNumber;
    if (!control.touched && !control.dirty) return '';
    if (control.hasError('required')) return 'Enter your phone number.';
    if (control.hasError('pattern')) return 'Enter a valid US phone number, such as 202-456-1111.';
    return '';
  }

  protected saveContact(): void {
    this.contactForm.markAllAsTouched();
    if (this.contactForm.invalid || !this.hasContactChanges() || this.saving()) {
      return;
    }
    const current = this.clientProfile();
    if (!current) return;
    const value = this.contactForm.getRawValue();
    const email = value.email.trim();
    const phoneNumber = value.phoneNumber.trim();
    const update: { email?: string; phoneNumber?: string } = {};
    if (email !== current.email) update.email = email;
    if (phoneNumber !== current.phoneNumber) update.phoneNumber = phoneNumber;

    this.saving.set(true);
    this.saveError.set('');
    this.saveSuccess.set('');
    this.clientApi.updateMyContact(update).subscribe({
      next: (profile) => {
        this.clientProfile.set({ email: profile.email, phoneNumber: profile.phoneNumber });
        this.auth.updateClientContact(profile.email, profile.phoneNumber);
        this.contactForm.setValue({ email: profile.email, phoneNumber: profile.phoneNumber });
        this.editingContact.set(false);
        this.saveSuccess.set('Contact information updated.');
        this.saving.set(false);
      },
      error: (error: unknown) => {
        this.saveError.set(describeHttpError(error, 'Could not save your contact information. Please try again.'));
        this.saving.set(false);
      },
    });
  }

  protected logout(): void {
    this.close();
    this.auth.logout();
  }
}

function rejectAdminDomain(control: AbstractControl) {
  const email = String(control.value ?? '').trim().toLowerCase();
  return email.endsWith('@admin.com') ? { adminDomain: true } : null;
}
