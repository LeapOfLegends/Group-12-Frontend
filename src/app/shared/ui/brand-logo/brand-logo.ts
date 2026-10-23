import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * JetZy Trading mark: a paper airplane folded from a dollar bill, taking off across a
 * deep-green tile, with the wordmark beside it. public/favicon.svg carries the same artwork.
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
      <svg
        class="brand-mark"
        viewBox="0 0 64 64"
        [attr.width]="markSize()"
        [attr.height]="markSize()"
        aria-hidden="true"
        focusable="false"
      >
        <rect width="64" height="64" rx="16" fill="#073B2A" />
        <!-- jet trail -->
        <path
          d="M6 50c5 0 9-2 13-6"
          fill="none"
          stroke="#C8A46B"
          stroke-width="2.4"
          stroke-linecap="round"
          opacity="0.85"
        />
        <path
          d="M10 57c4 0 7-1.5 10-4.5"
          fill="none"
          stroke="#C8A46B"
          stroke-width="2.4"
          stroke-linecap="round"
          opacity="0.5"
        />
        <!-- lower wing: the shaded side of the fold -->
        <path d="M57 9 29 36l-4 21z" fill="#2FB071" />
        <!-- upper wing: the dollar bill -->
        <path d="M57 9 7 29l22 7z" fill="#DDF3E6" />
        <text
          x="27.5"
          y="31.5"
          font-family="Inter, Arial, sans-serif"
          font-size="14"
          font-weight="800"
          fill="#073B2A"
          text-anchor="middle"
        >
          $
        </text>
        <!-- centre crease -->
        <path
          d="M57 9 29 36"
          fill="none"
          stroke="#C8A46B"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
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
  /** Where the mark leads: the public landing page by default, the account's own dashboard once signed in. */
  readonly homeLink = input('/');
}
