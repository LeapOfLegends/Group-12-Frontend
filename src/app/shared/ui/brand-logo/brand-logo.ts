import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Original Leap Trading mark: a rising path inside a rounded tile, with the wordmark beside it. */
@Component({
  selector: 'app-brand-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="brand" [class.brand-on-dark]="onDark()" [class.brand-compact]="compact()" href="/dashboard" aria-label="Leap Trading home">
      <svg class="brand-mark" viewBox="0 0 64 64" [attr.width]="markSize()" [attr.height]="markSize()" aria-hidden="true" focusable="false">
        <rect width="64" height="64" rx="16" fill="#073B2A" />
        <path d="M14 44 L28 30 L36 38 L50 20" fill="none" stroke="#C8A46B" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M40 20 H50 V30" fill="none" stroke="#C8A46B" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      @if (!compact()) {
        <span class="brand-text">
          <span class="brand-name">Leap</span>
          <span class="brand-suffix">Trading</span>
        </span>
      }
    </a>
  `,
  styles: `
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: var(--color-text);
    }

    .brand:hover {
      text-decoration: none;
    }

    .brand-mark {
      flex: none;
      box-shadow: 0 2px 6px rgba(7, 59, 42, 0.25);
      border-radius: 10px;
    }

    .brand-text {
      display: flex;
      align-items: baseline;
      gap: 6px;
      font-size: 1.25rem;
      letter-spacing: -0.02em;
      line-height: 1;
      white-space: nowrap;
    }

    .brand-name {
      font-weight: 700;
    }

    .brand-suffix {
      font-weight: 500;
      color: var(--color-text-secondary);
    }

    .brand-on-dark {
      color: #fff;
    }

    .brand-on-dark .brand-suffix {
      color: rgba(255, 255, 255, 0.72);
    }

    .brand-on-dark .brand-mark {
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12);
    }
  `,
})
export class BrandLogoComponent {
  readonly onDark = input(false);
  readonly compact = input(false);
  readonly markSize = input(36);
}
