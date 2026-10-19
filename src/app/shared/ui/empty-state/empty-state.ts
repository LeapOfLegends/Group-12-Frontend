import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon';

/** Friendly empty and error states with an optional projected action. */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="empty-state" [class.empty-state-error]="tone() === 'error'">
      <div class="empty-icon" [class.empty-icon-error]="tone() === 'error'">
        <app-icon [name]="icon()" [size]="24" />
      </div>
      <h3>{{ title() }}</h3>
      @if (message()) {
        <p>{{ message() }}</p>
      }
      <ng-content />
    </div>
  `,
  styles: `
    .empty-icon-error {
      background: var(--color-negative-soft);
      color: var(--color-negative);
    }

    p {
      max-width: 42ch;
    }
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly message = input<string>('');
  readonly icon = input<string>('info');
  readonly tone = input<'neutral' | 'error'>('neutral');
}
