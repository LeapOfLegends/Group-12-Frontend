import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/** Inline 24x24 stroke icons. Markup is static and owned by the app, so it is safe to trust. */
const ICONS: Record<string, string> = {
  dashboard:
    '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  transfer: '<path d="M7 7h11m0 0-3-3m3 3-3 3"/><path d="M17 17H6m0 0 3 3m-3-3 3-3"/>',
  trade: '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  shield: '<path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z"/><path d="m9.5 12 2 2 3.5-4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6"/>',
  users:
    '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 2.9-5.5 6.5-5.5s6.5 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.6c2.1.6 3.5 2.3 3.5 5.4"/>',
  logout: '<path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M13 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-right': '<path d="m9 6 6 6-6 6"/>',
  'arrow-left': '<path d="M19 12H5m0 0 6 6m-6-6 6-6"/>',
  'arrow-right': '<path d="M5 12h14m0 0-6-6m6 6-6 6"/>',
  'arrow-up': '<path d="M12 19V5m0 0-6 6m6-6 6 6"/>',
  'arrow-down': '<path d="M12 5v14m0 0-6-6m6 6 6-6"/>',
  'trend-up': '<path d="m4 16 5-5 4 4 7-7"/><path d="M15 8h5v5"/>',
  'trend-down': '<path d="m4 8 5 5 4-4 7 7"/><path d="M20 11v5h-5"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  'alert-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 8v4m0 4h.01"/>',
  'alert-triangle': '<path d="M12 4 2.5 20h19L12 4z"/><path d="M12 10v4m0 3h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3m-7 0 1 13h6l1-13"/>',
  edit: '<path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="m12.5 7.5 4 4"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off':
    '<path d="M3 3l18 18"/><path d="M10.6 10.6a3 3 0 0 0 4.2 4.2"/><path d="M9.9 5.2A10.5 10.5 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.1 4.1M6.3 6.3C3.6 8.3 2 12 2 12s3.5 7 10 7c1.4 0 2.7-.3 3.8-.8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/><path d="M16 12h4"/><circle cx="16" cy="12" r="1"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12h18"/>',
  'bar-chart': '<path d="M5 20V10m7 10V4m7 16v-7"/>',
  'chart-line': '<path d="M4 19h16"/><path d="m4 15 5-6 4 3 7-8"/>',
  dollar: '<path d="M12 3v18"/><path d="M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3S9.5 10.5 12 11s4.5 1.5 4.5 3.5-2 3.5-4.5 3.5-4.5-1.5-4.5-3.5"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10M15 10v10"/>',
  bank: '<path d="M3 10 12 4l9 6"/><path d="M5 10v9m4-9v9m6-9v9m4-9v9M3 19h18"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8m-4-4v4"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
  'circle-dot': '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>',
};

export type IconName = keyof typeof ICONS;

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.app-icon]': 'true', '[attr.aria-hidden]': 'label() ? null : "true"', '[attr.role]': 'label() ? "img" : null', '[attr.aria-label]': 'label() || null' },
  template: `<svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    [attr.width]="size()"
    [attr.height]="size()"
    [innerHTML]="markup()"
    focusable="false"
  ></svg>`,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      line-height: 0;
      vertical-align: middle;
    }
  `,
})
export class IconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly name = input.required<IconName | string>();
  readonly size = input<number>(20);
  /** Provide a label only when the icon conveys meaning on its own. */
  readonly label = input<string>('');

  readonly markup = computed<SafeHtml>(() => this.sanitizer.bypassSecurityTrustHtml(ICONS[this.name()] ?? ICONS['info']));
}
