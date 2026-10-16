import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { OrderStatus } from '../../../core/models/trading.models';
import { orderStatusLabel } from '../../../core/utils/order-reasons';
import { IconComponent } from '../icon/icon';

export type BadgeTone = 'positive' | 'negative' | 'warning' | 'info' | 'neutral' | 'brand' | 'accent';

const ORDER_TONES: Record<OrderStatus, { tone: BadgeTone; icon: string }> = {
  SUBMITTED: { tone: 'info', icon: 'clock' },
  ACCEPTED: { tone: 'warning', icon: 'clock' },
  FILLED: { tone: 'positive', icon: 'check-circle' },
  REJECTED: { tone: 'negative', icon: 'alert-circle' },
  FAILED: { tone: 'negative', icon: 'alert-triangle' },
};

/**
 * Status pill that always pairs colour with an icon and a label, so state is never
 * conveyed by colour alone. Pass an order status, or a custom label + tone.
 */
@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <span class="pill" [class]="'pill pill-' + resolvedTone()">
      @if (resolvedIcon()) {
        <app-icon [name]="resolvedIcon()" [size]="14" />
      }
      {{ resolvedLabel() }}
    </span>
  `,
})
export class StatusBadgeComponent {
  readonly status = input<OrderStatus | null>(null);
  readonly label = input<string>('');
  readonly tone = input<BadgeTone | null>(null);
  readonly icon = input<string | null>(null);

  readonly resolvedTone = computed<BadgeTone>(() => {
    const status = this.status();
    return this.tone() ?? (status ? ORDER_TONES[status].tone : 'neutral');
  });

  readonly resolvedIcon = computed<string>(() => {
    const explicit = this.icon();
    if (explicit !== null) {
      return explicit;
    }
    const status = this.status();
    return status ? ORDER_TONES[status].icon : '';
  });

  readonly resolvedLabel = computed(() => {
    const status = this.status();
    return this.label() || (status ? orderStatusLabel(status) : '');
  });
}
