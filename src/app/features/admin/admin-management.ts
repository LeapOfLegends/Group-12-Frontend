import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminsApiService } from '../../core/api/admins-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { ADMIN_ROLES, ADMIN_ROLE_LABELS, AdminRole } from '../../core/models/auth.models';
import { ADMIN_PASSWORD_PATTERN, AdminRecord } from '../../core/models/trading.models';
import { NotificationService } from '../../core/services/notification.service';
import { describeHttpError, httpStatusOf } from '../../core/utils/http-error';
import { ShortDatePipe } from '../../shared/pipes/format.pipes';
import { ConfirmationDialogComponent } from '../../shared/ui/confirmation-dialog/confirmation-dialog';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { IconComponent } from '../../shared/ui/icon/icon';
import { LoadingSkeletonComponent } from '../../shared/ui/loading-skeleton/loading-skeleton';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge';

const ROLE_TONES: Record<AdminRole, 'accent' | 'info' | 'brand'> = {
  super_admin: 'accent',
  operations: 'info',
  finance: 'brand',
};

/** Super Admin tools: list, create, edit and remove administrator accounts via /admins. */
@Component({
  selector: 'app-admin-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ShortDatePipe, ConfirmationDialogComponent, EmptyStateComponent, IconComponent, LoadingSkeletonComponent, StatusBadgeComponent],
  template: `
    <section class="card" aria-labelledby="admin-table-title">
      <div class="card-header">
        <div>
          <h3 id="admin-table-title">Administrators</h3>
          <p class="card-subtitle">Roles are assigned when an administrator is created and cannot be changed afterwards.</p>
        </div>
        <div class="controls">
          <label class="visually-hidden" for="admin-search">Search administrators</label>
          <div class="input-group search">
            <span class="input-prefix" aria-hidden="true"><app-icon name="search" [size]="18" /></span>
            <input id="admin-search" class="input" type="search" placeholder="Search name or email" [value]="query()" (input)="query.set($any($event.target).value)" />
          </div>
          <label class="visually-hidden" for="admin-role-filter">Filter by role</label>
          <select id="admin-role-filter" class="select" [value]="roleFilter()" (change)="roleFilter.set($any($event.target).value)">
            <option value="all">All roles</option>
            @for (role of roles; track role) {
              <option [value]="role">{{ roleLabels[role] }}</option>
            }
          </select>
          <button type="button" class="btn btn-primary" (click)="openCreate()">
            <app-icon name="plus" [size]="18" />
            New administrator
          </button>
        </div>
      </div>

      @if (loading() && admins().length === 0) {
        <app-loading-skeleton variant="table" [lines]="5" label="Loading administrators" />
      } @else if (filtered().length === 0) {
        <app-empty-state icon="shield" title="No administrators match" message="Adjust the search or role filter." />
      } @else {
        <div class="table-wrap">
          <table class="table">
            <caption class="visually-hidden">Administrator accounts</caption>
            <thead>
              <tr>
                <th scope="col">Administrator</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Created</th>
                <th scope="col"><span class="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (admin of filtered(); track admin.adminId) {
                <tr>
                  <td>
                    <span class="cell-primary">{{ admin.firstName }} {{ admin.lastName }}</span>
                    <span class="cell-secondary">ID {{ admin.adminId }}{{ admin.adminId === auth.user()?.id ? ' · you' : '' }}</span>
                  </td>
                  <td>{{ admin.email }}</td>
                  <td><app-status-badge [tone]="roleTones[admin.role]" icon="shield" [label]="roleLabels[admin.role]" /></td>
                  <td>{{ admin.createdAt | shortDate }}</td>
                  <td class="row-actions-cell">
                    <div class="row-actions">
                      <button type="button" class="btn btn-ghost btn-sm" (click)="openEdit(admin)">
                        <app-icon name="edit" [size]="16" />
                        Edit
                      </button>
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm btn-remove"
                        (click)="askDelete(admin)"
                        [disabled]="admin.adminId === auth.user()?.id"
                        [attr.title]="admin.adminId === auth.user()?.id ? 'You cannot remove your own account' : null"
                      >
                        <app-icon name="trash" [size]="16" />
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    <!-- Create / edit dialog -->
    <dialog #formDialog class="dialog" aria-labelledby="admin-form-title" (close)="onFormClosed()">
      <form class="dialog-body" [formGroup]="form" (ngSubmit)="submitForm()" novalidate>
        <div class="spread">
          <h2 id="admin-form-title">{{ editing() ? 'Edit administrator' : 'New administrator' }}</h2>
          <button type="button" class="btn btn-ghost btn-icon" (click)="closeForm()" aria-label="Close">
            <app-icon name="close" [size]="20" />
          </button>
        </div>

        <div class="grid grid-2">
          <div class="field">
            <label class="field-label" for="admin-first-name">First name</label>
            <input id="admin-first-name" class="input" formControlName="firstName" autocomplete="off" [attr.aria-invalid]="showError('firstName') ? 'true' : null" />
            @if (showError('firstName')) {
              <p class="field-error"><app-icon name="alert-circle" [size]="16" />Enter a first name.</p>
            }
          </div>
          <div class="field">
            <label class="field-label" for="admin-last-name">Last name</label>
            <input id="admin-last-name" class="input" formControlName="lastName" autocomplete="off" [attr.aria-invalid]="showError('lastName') ? 'true' : null" />
            @if (showError('lastName')) {
              <p class="field-error"><app-icon name="alert-circle" [size]="16" />Enter a last name.</p>
            }
          </div>
        </div>

        <div class="field">
          <label class="field-label" for="admin-email">Email address</label>
          <input id="admin-email" class="input" type="email" formControlName="email" autocomplete="off" placeholder="name@admin.com" [attr.aria-invalid]="showError('email') ? 'true' : null" />
          <p class="field-hint">Must use an approved administrator email domain (for example &#64;admin.com). The address is stored in lowercase.</p>
          @if (showError('email')) {
            <p class="field-error"><app-icon name="alert-circle" [size]="16" />Enter a valid email address.</p>
          }
        </div>

        @if (!editing()) {
          <div class="field">
            <label class="field-label" for="admin-password">Temporary password</label>
            <div class="input-group input-group-password">
              <input
                id="admin-password"
                class="input"
                [type]="showPassword() ? 'text' : 'password'"
                formControlName="password"
                autocomplete="new-password"
                [attr.aria-invalid]="showError('password') ? 'true' : null"
              />
              <button type="button" class="btn btn-ghost btn-icon input-suffix" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'">
                <app-icon [name]="showPassword() ? 'eye-off' : 'eye'" [size]="20" />
              </button>
            </div>
            <p class="field-hint">At least 12 characters with an uppercase letter, a lowercase letter, a number and a special character.</p>
            @if (showError('password')) {
              <p class="field-error"><app-icon name="alert-circle" [size]="16" />The password does not meet the policy above.</p>
            }
          </div>

          <div class="field">
            <label class="field-label" for="admin-role">Role</label>
            <select id="admin-role" class="select" formControlName="role">
              @for (role of roles; track role) {
                <option [value]="role">{{ roleLabels[role] }}</option>
              }
            </select>
            <p class="field-hint">{{ roleDescription() }}</p>
          </div>
        }

        @if (formError(); as error) {
          <div class="alert alert-error" role="alert">
            <app-icon name="alert-circle" />
            <span>{{ error }}</span>
          </div>
        }

        <div class="dialog-actions">
          <button type="button" class="btn btn-secondary" (click)="closeForm()" [disabled]="saving()">Cancel</button>
          <button type="submit" class="btn btn-primary" [disabled]="saving()" [attr.aria-busy]="saving()">
            @if (saving()) {
              <span class="spinner" aria-hidden="true"></span>
            }
            {{ editing() ? 'Save changes' : 'Create administrator' }}
          </button>
        </div>
      </form>
    </dialog>

    <app-confirmation-dialog
      #deleteDialog
      title="Remove administrator?"
      [message]="deleteMessage()"
      confirmLabel="Remove"
      tone="danger"
      [busy]="deleting()"
      (confirmed)="confirmDelete()"
    />
  `,
  styles: `
    .controls {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }

    .search {
      min-width: 220px;
    }

    .search .input-prefix {
      display: inline-flex;
    }

    .select {
      width: auto;
      min-width: 160px;
    }

    .row-actions-cell {
      text-align: right;
      width: 1%;
    }

    .row-actions {
      display: inline-flex;
      gap: 4px;
    }

    .btn-remove:not(:disabled):hover {
      color: var(--color-negative);
    }

    .input-group-password .input {
      padding-left: var(--space-4);
      padding-right: 52px;
    }
  `,
})
export class AdminManagementComponent {
  private readonly fb = inject(FormBuilder);
  private readonly adminsApi = inject(AdminsApiService);
  private readonly notifications = inject(NotificationService);
  protected readonly auth = inject(AuthService);

  readonly admins = input<AdminRecord[]>([]);
  readonly loading = input<boolean>(false);
  readonly changed = output<void>();

  private readonly formDialog = viewChild.required<ElementRef<HTMLDialogElement>>('formDialog');
  private readonly deleteDialog = viewChild.required<ConfirmationDialogComponent>('deleteDialog');

  protected readonly roles = ADMIN_ROLES;
  protected readonly roleLabels = ADMIN_ROLE_LABELS;
  protected readonly roleTones = ROLE_TONES;

  protected readonly query = signal('');
  protected readonly roleFilter = signal<'all' | AdminRole>('all');
  protected readonly editing = signal<AdminRecord | null>(null);
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly attempted = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly pendingDelete = signal<AdminRecord | null>(null);
  private readonly roleValue = signal<AdminRole>('operations');

  protected readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    password: ['', [Validators.required, Validators.pattern(ADMIN_PASSWORD_PATTERN)]],
    role: ['operations' as AdminRole, Validators.required],
  });

  protected readonly filtered = computed(() => {
    const term = this.query().trim().toLowerCase();
    const role = this.roleFilter();
    return this.admins().filter(
      (admin) =>
        (role === 'all' || admin.role === role) &&
        (!term || `${admin.firstName} ${admin.lastName}`.toLowerCase().includes(term) || admin.email.toLowerCase().includes(term)),
    );
  });

  protected readonly roleDescription = computed(() => {
    switch (this.roleValue()) {
      case 'super_admin':
        return 'Full access, including creating and removing other administrators.';
      case 'finance':
        return 'Sees financial operations: client cash positions and funding activity.';
      default:
        return 'Sees trading operations: client activity, order tracing and market data health.';
    }
  });

  protected readonly deleteMessage = computed(() => {
    const admin = this.pendingDelete();
    return admin ? `${admin.firstName} ${admin.lastName} (${admin.email}) will lose administrator access immediately. This cannot be undone.` : '';
  });

  constructor() {
    this.form.controls.role.valueChanges.subscribe((role) => this.roleValue.set(role));
  }

  protected showError(field: 'firstName' | 'lastName' | 'email' | 'password'): boolean {
    const control = this.form.controls[field];
    return (control.touched || this.attempted()) && control.invalid;
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset({ firstName: '', lastName: '', email: '', password: '', role: 'operations' });
    this.form.controls.password.enable();
    this.form.controls.role.enable();
    this.roleValue.set('operations');
    this.openForm();
  }

  protected openEdit(admin: AdminRecord): void {
    this.editing.set(admin);
    this.form.reset({ firstName: admin.firstName, lastName: admin.lastName, email: admin.email, password: '', role: admin.role });
    this.form.controls.password.disable();
    this.form.controls.role.disable();
    this.openForm();
  }

  private openForm(): void {
    this.formError.set(null);
    this.attempted.set(false);
    this.showPassword.set(false);
    const dialog = this.formDialog().nativeElement;
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    }
  }

  protected closeForm(): void {
    const dialog = this.formDialog().nativeElement;
    if (dialog.open) {
      dialog.close();
    }
  }

  protected onFormClosed(): void {
    this.saving.set(false);
  }

  protected submitForm(): void {
    this.attempted.set(true);
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    const value = this.form.getRawValue();
    const editing = this.editing();
    const request = editing
      ? this.adminsApi.update(editing.adminId, { firstName: value.firstName.trim(), lastName: value.lastName.trim(), email: value.email.trim() })
      : this.adminsApi.create({
          firstName: value.firstName.trim(),
          lastName: value.lastName.trim(),
          email: value.email.trim(),
          password: value.password,
          role: value.role,
        });
    request.subscribe({
      next: (admin) => {
        this.saving.set(false);
        this.closeForm();
        this.notifications.success(
          editing ? `${admin.firstName} ${admin.lastName} was updated.` : `${admin.firstName} ${admin.lastName} can now sign in as ${ADMIN_ROLE_LABELS[admin.role]}.`,
        );
        this.changed.emit();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const status = httpStatusOf(error);
        if (status === 409) {
          this.formError.set('An administrator with this email address already exists.');
        } else if (status === 403) {
          this.formError.set('Only a Super Admin may manage administrators.');
        } else {
          this.formError.set(describeHttpError(error, 'The administrator could not be saved.'));
        }
      },
    });
  }

  protected askDelete(admin: AdminRecord): void {
    this.pendingDelete.set(admin);
    this.deleteDialog().open();
  }

  protected confirmDelete(): void {
    const admin = this.pendingDelete();
    if (!admin || this.deleting()) {
      return;
    }
    this.deleting.set(true);
    this.adminsApi.delete(admin.adminId).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteDialog().close();
        this.pendingDelete.set(null);
        this.notifications.success(`${admin.firstName} ${admin.lastName} no longer has administrator access.`);
        this.changed.emit();
      },
      error: (error: unknown) => {
        this.deleting.set(false);
        this.deleteDialog().close();
        this.notifications.error(describeHttpError(error, 'The administrator could not be removed.'));
      },
    });
  }
}
