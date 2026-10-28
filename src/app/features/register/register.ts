import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { CLIENT_PASSWORD_PATTERN, RegisterRequest } from '../../core/models/auth.models';
import { ThemeService } from '../../core/services/theme.service';
import { describeHttpError, extractServerMessages, httpStatusOf, isUnreachable } from '../../core/utils/http-error';
import { BrandLogoComponent } from '../../shared/ui/brand-logo/brand-logo';
import { IconComponent } from '../../shared/ui/icon/icon';
import { MarketBackdropComponent } from '../../shared/ui/market-backdrop/market-backdrop';

export type RegisterField = 'firstName' | 'lastName' | 'email' | 'password' | 'confirmPassword' | 'ssn' | 'phoneNumber' | 'dateOfBirth';

const FIELDS: readonly RegisterField[] = ['firstName', 'lastName', 'email', 'password', 'confirmPassword', 'ssn', 'phoneNumber', 'dateOfBirth'];
const MIN_AGE_YEARS = 18;
const MAX_AGE_YEARS = 120;
const SSN_PATTERN = /^\d{3}-\d{2}-\d{4}$/;
/** North American numbering plan: the area code and the exchange start with 2-9. */
const US_PHONE_PATTERN = /^[2-9]\d{2}-[2-9]\d{2}-\d{4}$/;

const REQUIRED_MESSAGES: Record<RegisterField, string> = {
  firstName: 'Enter your first name.',
  lastName: 'Enter your last name.',
  email: 'Enter your email address.',
  password: 'Choose a password.',
  confirmPassword: 'Re-enter your password.',
  ssn: 'Enter your Social Security number.',
  phoneNumber: 'Enter your phone number.',
  dateOfBirth: 'Enter your date of birth.',
};

/** Keeps the digits and inserts the dashes of the 123-45-6789 format as the user types. */
export function formatSsn(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 9);
  return [digits.slice(0, 3), digits.slice(3, 5), digits.slice(5, 9)].filter(Boolean).join('-');
}

/** Keeps the ten national digits (dropping a leading country code 1) and formats them as 202-456-1111. */
export function formatPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  digits = digits.slice(0, 10);
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean).join('-');
}

/** Rejects values that are only whitespace, which Validators.required accepts. */
export const notBlankValidator: ValidatorFn = (control) => (String(control.value ?? '').trim() ? null : { blank: true });

export const ssnValidator: ValidatorFn = (control) => {
  const value = String(control.value ?? '');
  return !value || SSN_PATTERN.test(value) ? null : { ssn: true };
};

export const usPhoneValidator: ValidatorFn = (control) => {
  const value = String(control.value ?? '');
  return !value || US_PHONE_PATTERN.test(value) ? null : { phone: true };
};

/** A real calendar date in the past, for someone between 18 and 120 years old. */
export function dateOfBirthValidator(today: () => Date = () => new Date()): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '');
    if (!value) {
      return null;
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      return { date: true };
    }
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return { date: true };
    }
    const now = today();
    if (date.getTime() > now.getTime()) {
      return { future: true };
    }
    const age = ageInYears(date, now);
    if (age < MIN_AGE_YEARS) {
      return { tooYoung: { min: MIN_AGE_YEARS } };
    }
    return age > MAX_AGE_YEARS ? { date: true } : null;
  };
}

/** Group-level check: both password fields must agree once both are filled in. */
export const passwordsMatchValidator: ValidatorFn = (group) => {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password && confirm && password !== confirm ? { passwordMismatch: true } : null;
};

function ageInYears(birth: Date, now: Date): number {
  const age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday = now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  return beforeBirthday ? age - 1 : age;
}

/** ISO calendar date `years` years before today, for the date input's min/max attributes. */
function isoDateYearsAgo(years: number, now = new Date()): string {
  const date = new Date(now.getFullYear() - years, now.getMonth(), now.getDate());
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Maps a Group-12-Auth validation message (class-validator or business rule) to the field it concerns. */
function fieldForServerMessage(message: string): RegisterField | null {
  const text = message.toLowerCase();
  if (text.startsWith('email') || text.includes('emails ending in') || text.includes('reserved for admins')) {
    return 'email';
  }
  if (text.startsWith('password')) {
    return 'password';
  }
  if (text.startsWith('firstname')) {
    return 'firstName';
  }
  if (text.startsWith('lastname')) {
    return 'lastName';
  }
  if (text.startsWith('ssn')) {
    return 'ssn';
  }
  if (text.startsWith('phone')) {
    return 'phoneNumber';
  }
  if (text.startsWith('dateofbirth')) {
    return 'dateOfBirth';
  }
  return null;
}

function friendlyServerMessage(field: RegisterField, message: string): string {
  switch (field) {
    case 'email':
      if (/reserved for admins|emails ending in/i.test(message)) {
        return 'This email domain is reserved for administrator accounts. Use a personal or work email address instead.';
      }
      return /shorter/i.test(message) ? 'Email addresses are limited to 255 characters.' : 'Enter a valid email address, such as name@example.com.';
    case 'password':
      return /shorter/i.test(message) ? 'Passwords are limited to 72 characters.' : 'Choose a password that meets every requirement below.';
    case 'firstName':
      return 'Enter your first name (up to 100 characters).';
    case 'lastName':
      return 'Enter your last name (up to 100 characters).';
    case 'ssn':
      return 'Enter your Social Security number as 123-45-6789.';
    case 'phoneNumber':
      return 'Enter a valid US phone number of at most 12 characters, such as 202-456-1111.';
    case 'dateOfBirth':
      return 'Enter a valid date of birth.';
    default:
      return message;
  }
}

/**
 * Client self-registration through Group-12-Auth (POST /auth/register). The plain
 * password travels once over the API; the service hashes it before storing it.
 * Administrator accounts are created by the platform team, never here.
 */
@Component({
  selector: 'app-register-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, BrandLogoComponent, IconComponent, MarketBackdropComponent],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class RegisterPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  protected readonly theme = inject(ThemeService);

  protected readonly form = this.fb.nonNullable.group(
    {
      firstName: ['', [Validators.required, notBlankValidator, Validators.maxLength(100)]],
      lastName: ['', [Validators.required, notBlankValidator, Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
      password: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(72), Validators.pattern(CLIENT_PASSWORD_PATTERN)]],
      confirmPassword: ['', [Validators.required]],
      ssn: ['', [Validators.required, ssnValidator]],
      phoneNumber: ['', [Validators.required, usPhoneValidator]],
      dateOfBirth: ['', [Validators.required, dateOfBirthValidator()]],
    },
    { validators: [passwordsMatchValidator] },
  );

  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly showPassword = signal(false);
  protected readonly showConfirmPassword = signal(false);
  protected readonly showSsn = signal(false);
  protected readonly year = new Date().getFullYear();
  protected readonly minAge = MIN_AGE_YEARS;
  protected readonly maxDateOfBirth = isoDateYearsAgo(MIN_AGE_YEARS);
  protected readonly minDateOfBirth = isoDateYearsAgo(MAX_AGE_YEARS);

  /** Field messages returned by the backend (validation or conflicts); cleared when the field changes. */
  private readonly serverErrors = signal<Partial<Record<RegisterField, string>>>({});
  /** Mirrors the password control so the checklist re-renders under OnPush. */
  private readonly passwordValue = signal('');

  protected readonly passwordChecks = computed(() => {
    const value = this.passwordValue();
    return [
      { label: 'At least 12 characters', ok: value.length >= 12 },
      { label: 'An uppercase letter', ok: /[A-Z]/.test(value) },
      { label: 'A lowercase letter', ok: /[a-z]/.test(value) },
      { label: 'A number', ok: /\d/.test(value) },
      { label: 'A special character', ok: /[^A-Za-z\d]/.test(value) },
    ];
  });

  constructor() {
    this.form.controls.password.valueChanges.subscribe((value) => this.passwordValue.set(value));
    for (const field of FIELDS) {
      this.form.controls[field].valueChanges.subscribe(() => {
        if (this.serverErrors()[field]) {
          this.serverErrors.update((errors) => {
            const next = { ...errors };
            delete next[field];
            return next;
          });
        }
      });
    }
  }

  protected fieldError(field: RegisterField): string | null {
    const server = this.serverErrors()[field];
    if (server) {
      return server;
    }
    const control = this.form.controls[field];
    if (!(control.touched || this.submitted())) {
      return null;
    }
    if (field === 'confirmPassword') {
      if (control.hasError('required')) {
        return REQUIRED_MESSAGES.confirmPassword;
      }
      return this.form.hasError('passwordMismatch') ? 'The passwords do not match.' : null;
    }
    if (control.valid) {
      return null;
    }
    if (control.hasError('required') || control.hasError('blank')) {
      return REQUIRED_MESSAGES[field];
    }
    switch (field) {
      case 'firstName':
      case 'lastName':
        return 'Names are limited to 100 characters.';
      case 'email':
        return control.hasError('maxlength') ? 'Email addresses are limited to 255 characters.' : 'Enter a valid email address, such as name@example.com.';
      case 'password':
        return control.hasError('maxlength') ? 'Passwords are limited to 72 characters.' : 'Choose a password that meets every requirement below.';
      case 'ssn':
        return 'Enter your Social Security number as 123-45-6789.';
      case 'phoneNumber':
        return 'Enter a valid 10-digit US phone number, such as 202-456-1111.';
      case 'dateOfBirth':
        if (control.hasError('future')) {
          return 'The date of birth cannot be in the future.';
        }
        if (control.hasError('tooYoung')) {
          return `You must be at least ${MIN_AGE_YEARS} years old to open an account.`;
        }
        return 'Enter a valid date of birth.';
      default:
        return 'Check this field.';
    }
  }

  protected onSsnInput(event: Event): void {
    this.form.controls.ssn.setValue(formatSsn((event.target as HTMLInputElement).value));
  }

  protected onPhoneInput(event: Event): void {
    this.form.controls.phoneNumber.setValue(formatPhone((event.target as HTMLInputElement).value));
  }

  protected togglePassword(): void {
    this.showPassword.update((value) => !value);
  }

  protected toggleConfirmPassword(): void {
    this.showConfirmPassword.update((value) => !value);
  }

  protected toggleSsn(): void {
    this.showSsn.update((value) => !value);
  }

  protected submit(): void {
    this.submitted.set(true);
    this.formError.set(null);
    if (this.submitting()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }
    const value = this.form.getRawValue();
    // Exactly the RegisterDto fields: the service rejects unknown properties such as confirmPassword.
    const request: RegisterRequest = {
      firstName: value.firstName.trim(),
      lastName: value.lastName.trim(),
      email: value.email.trim(),
      password: value.password,
      ssn: value.ssn,
      phoneNumber: value.phoneNumber,
      dateOfBirth: value.dateOfBirth,
    };
    this.submitting.set(true);
    this.auth.register(request).subscribe({
      next: (client) => {
        this.submitting.set(false);
        void this.router.navigate(['/login'], {
          queryParams: { registered: '1' },
          state: { registeredEmail: client?.email || request.email },
        });
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.applyServerError(error);
        this.focusFirstInvalid();
      },
    });
  }

  private applyServerError(error: unknown): void {
    const status = httpStatusOf(error);
    const messages = extractServerMessages(error);
    const text = messages.join(' ');

    if (status === 409) {
      if (/ssn|social security/i.test(text)) {
        this.setServerError('ssn', 'An account with this Social Security number already exists.');
        this.formError.set('An account with this Social Security number already exists. If it is yours, sign in instead.');
      } else {
        this.setServerError('email', 'An account with this email address already exists.');
        this.formError.set('An account with this email address already exists. Sign in instead, or use a different email address.');
      }
      return;
    }

    if (status === 400) {
      const unmapped: string[] = [];
      for (const message of messages) {
        const field = fieldForServerMessage(message);
        if (field) {
          this.setServerError(field, friendlyServerMessage(field, message));
        } else {
          unmapped.push(message);
        }
      }
      this.formError.set(unmapped.length > 0 ? unmapped.join(' ') : 'Please correct the highlighted fields and try again.');
      return;
    }

    if (status === 429) {
      this.formError.set('Too many attempts. Please wait a moment and try again.');
      return;
    }

    if (isUnreachable(error)) {
      this.formError.set(
        'The registration service is not reachable right now. If you are running locally, make sure Group-12-Auth is running on port 3000, then try again.',
      );
      return;
    }

    this.formError.set(describeHttpError(error, 'We could not create your account right now. Please try again.'));
  }

  private setServerError(field: RegisterField, message: string): void {
    this.serverErrors.update((errors) => ({ ...errors, [field]: message }));
  }

  private focusFirstInvalid(): void {
    setTimeout(() => this.document.querySelector<HTMLElement>('.register-form [aria-invalid="true"]')?.focus(), 0);
  }
}
