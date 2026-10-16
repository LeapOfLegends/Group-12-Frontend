import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { RegisterPage, dateOfBirthValidator, formatPhone, formatSsn, usPhoneValidator } from './register';

const REGISTER_URL = `${environment.authApiUrl}/auth/register`;

describe('registration helpers', () => {
  it('formats SSNs and phone numbers as they are typed', () => {
    expect(formatSsn('123456789')).toBe('123-45-6789');
    expect(formatSsn('1234')).toBe('123-4');
    expect(formatSsn('123-45-6789-99')).toBe('123-45-6789');
    expect(formatPhone('2024561111')).toBe('202-456-1111');
    expect(formatPhone('+1 (202) 456-1111')).toBe('202-456-1111');
    expect(formatPhone('202')).toBe('202');
  });

  it('accepts only dialable US numbers', () => {
    expect(usPhoneValidator(new FormControl('202-456-1111'))).toBeNull();
    expect(usPhoneValidator(new FormControl('123-456-7890'))).toEqual({ phone: true });
    expect(usPhoneValidator(new FormControl('202-056-1111'))).toEqual({ phone: true });
  });

  it('requires a real past date of birth for an adult', () => {
    const validator = dateOfBirthValidator(() => new Date(2026, 9, 14));
    expect(validator(new FormControl('1990-01-01'))).toBeNull();
    expect(validator(new FormControl('2008-10-14'))).toBeNull();
    expect(validator(new FormControl('2008-10-15'))).toEqual({ tooYoung: { min: 18 } });
    expect(validator(new FormControl('2027-01-01'))).toEqual({ future: true });
    expect(validator(new FormControl('1990-02-30'))).toEqual({ date: true });
  });
});

describe('RegisterPage', () => {
  let fixture: ComponentFixture<RegisterPage>;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [RegisterPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(RegisterPage);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  function element<T extends HTMLElement>(selector: string): T {
    return fixture.nativeElement.querySelector(selector) as T;
  }

  function type(selector: string, value: string): void {
    const input = element<HTMLInputElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  async function fillValidForm(): Promise<void> {
    type('#register-first-name', 'Nia');
    type('#register-last-name', 'Newby');
    type('#register-email', 'nia@example.com');
    type('#register-phone', '2024561111');
    type('#register-dob', '1990-05-15');
    type('#register-ssn', '123456789');
    type('#register-password', 'ClientPassword123!');
    type('#register-confirm-password', 'ClientPassword123!');
    await fixture.whenStable();
  }

  it('shows every required-field message and sends nothing when submitted empty', async () => {
    element<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    for (const message of [
      'Enter your first name.',
      'Enter your last name.',
      'Enter your email address.',
      'Enter your phone number.',
      'Enter your date of birth.',
      'Enter your Social Security number.',
      'Choose a password.',
      'Re-enter your password.',
    ]) {
      expect(text).toContain(message);
    }
    http.expectNone(REGISTER_URL);
  });

  it('masks the SSN by default and formats it with dashes', async () => {
    const ssn = element<HTMLInputElement>('#register-ssn');
    expect(ssn.type).toBe('password');
    type('#register-ssn', '123456789');
    await fixture.whenStable();
    expect(ssn.value).toBe('123-45-6789');

    element<HTMLButtonElement>('button[aria-label="Show Social Security number"]').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element<HTMLInputElement>('#register-ssn').type).toBe('text');
  });

  it('flags a mismatched confirmation before anything is sent', async () => {
    await fillValidForm();
    type('#register-confirm-password', 'Different123!');
    element<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('The passwords do not match.');
    http.expectNone(REGISTER_URL);
  });

  it('posts exactly the RegisterDto fields and sends the new client to the login page', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await fillValidForm();
    element<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const request = http.expectOne(REGISTER_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      firstName: 'Nia',
      lastName: 'Newby',
      email: 'nia@example.com',
      password: 'ClientPassword123!',
      ssn: '123-45-6789',
      phoneNumber: '202-456-1111',
      dateOfBirth: '1990-05-15',
    });
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(
      { clientId: '77', firstName: 'Nia', lastName: 'Newby', email: 'nia@example.com', phoneNumber: '202-456-1111', dateOfBirth: '1990-05-15', accountBalance: '0', createdAt: '2026-10-14T00:00:00.000Z' },
      { status: 201, statusText: 'Created' },
    );
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { registered: '1' }, state: { registeredEmail: 'nia@example.com' } });
  });

  it('explains an email that is already registered', async () => {
    await fillValidForm();
    element<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    http.expectOne(REGISTER_URL).flush({ message: 'Client with this email already exists', error: 'Conflict', statusCode: 409 }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element('#register-email-error').textContent).toContain('already exists');
    expect(element('[role="alert"]').textContent).toContain('Sign in instead');
    expect(element<HTMLInputElement>('#register-email').getAttribute('aria-invalid')).toBe('true');
  });

  it('maps backend validation messages onto the fields they concern', async () => {
    await fillValidForm();
    element<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    http
      .expectOne(REGISTER_URL)
      .flush(
        { message: ['Phone number must be a valid US phone number.', 'Client registration does not accept emails ending in @admin.com; this domain is reserved for admins.'], error: 'Bad Request', statusCode: 400 },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element('#register-phone-error').textContent).toContain('valid US phone number');
    expect(element('#register-email-error').textContent).toContain('reserved for administrator accounts');

    // Editing the field clears the server message.
    type('#register-phone', '3035550123');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#register-phone-error')).toBeNull();
  });
});
