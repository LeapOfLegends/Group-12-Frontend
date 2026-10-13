import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { describeHttpError, httpStatusOf } from '../../core/utils/http-error';
import { BrandLogoComponent } from '../../shared/ui/brand-logo/brand-logo';
import { IconComponent } from '../../shared/ui/icon/icon';

/** One sign-in page for clients and administrators; the email domain decides on the server. */
@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, BrandLogoComponent, IconComponent],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly theme = inject(ThemeService);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    password: ['', [Validators.required, Validators.maxLength(72)]],
  });

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly showPassword = signal(false);
  protected readonly submitted = signal(false);

  protected readonly sessionExpired = computed(() => this.route.snapshot.queryParamMap.get('reason') === 'expired');

  protected readonly year = new Date().getFullYear();

  protected fieldError(field: 'email' | 'password'): string | null {
    const control = this.form.controls[field];
    if (!(control.touched || this.submitted()) || control.valid) {
      return null;
    }
    if (control.hasError('required')) {
      return field === 'email' ? 'Enter your email address.' : 'Enter your password.';
    }
    if (control.hasError('email')) {
      return 'Enter a valid email address, such as name@example.com.';
    }
    if (control.hasError('maxlength')) {
      return field === 'email' ? 'Email addresses are limited to 255 characters.' : 'Passwords are limited to 72 characters.';
    }
    return 'Check this field.';
  }

  protected togglePassword(): void {
    this.showPassword.update((value) => !value);
  }

  protected submit(): void {
    this.submitted.set(true);
    this.errorMessage.set(null);
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    const { email, password } = this.form.getRawValue();
    this.auth.login({ email: email.trim(), password }).subscribe({
      next: () => {
        this.submitting.set(false);
        void this.router.navigateByUrl(this.safeReturnUrl());
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.form.controls.password.reset('');
        const status = httpStatusOf(error);
        if (status === 401) {
          this.errorMessage.set('The email or password you entered is incorrect. Please try again.');
        } else if (status === 400) {
          this.errorMessage.set('Please enter a valid email address and password.');
        } else if (status === 429) {
          this.errorMessage.set('Too many sign-in attempts. Please wait a moment and try again.');
        } else {
          this.errorMessage.set(describeHttpError(error, 'We could not sign you in right now. Please try again.'));
        }
      },
    });
  }

  /** Only follow same-origin, in-app return paths - never an absolute URL. */
  private safeReturnUrl(): string {
    const requested = this.route.snapshot.queryParamMap.get('returnUrl');
    if (requested && requested.startsWith('/') && !requested.startsWith('//') && !requested.startsWith('/login')) {
      return requested;
    }
    return '/dashboard';
  }
}
