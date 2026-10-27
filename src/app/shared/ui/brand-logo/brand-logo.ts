import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * JetZy paper-airplane mark with a responsive, theme-aware HTML wordmark.
 */
@Component({
  selector: 'app-brand-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <a
      class="brand"
      [class.brand-on-dark]="onDark()"
      [class.brand-compact]="compact()"
      [routerLink]="homeLink()"
      aria-label="JetZy Trading home"
    >
      <img
        class="brand-image"
        src="jetzy-logo.png"
        alt=""
        [style.width.px]="markSize()"
        [style.height.px]="markSize()"
        aria-hidden="true"
      />
      @if (!compact()) {
        <span class="brand-text">
          <span class="brand-name">JetZy</span>
          <span class="brand-suffix">Trading</span>
        </span>
      }
    </a>
  `,
  styles: `
    .brand {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      color: var(--color-text);
      line-height: 1;
      text-decoration: none;
    }

    .brand:hover {
      text-decoration: none;
    }

    .brand-image {
      display: block;
      flex: none;
      object-fit: contain;
      filter: drop-shadow(0 2px 5px rgba(7, 59, 42, 0.2));
    }

    .brand-text {
      display: flex;
      align-items: baseline;
      gap: 5px;
      font-size: 1.2rem;
      letter-spacing: -0.02em;
      white-space: nowrap;
    }

    .brand-name {
      font-weight: 700;
    }

    .brand-suffix {
      color: var(--color-text-secondary);
      font-weight: 500;
    }

    .brand-on-dark {
      color: #fff;
    }

    .brand-on-dark .brand-suffix {
      color: rgba(255, 255, 255, 0.72);
    }

    .brand-on-dark .brand-image {
      filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.3));
    }
  `,
})
export class BrandLogoComponent {
  readonly onDark = input(false);
  readonly compact = input(false);
  readonly markSize = input(36);
  /** Where the mark leads; defaults to the public landing page. */
  readonly homeLink = input('/');
}
