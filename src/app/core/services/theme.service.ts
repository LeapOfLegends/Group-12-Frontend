import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'leap.theme';

/**
 * Light theme by default; a saved preference wins over the OS setting. The
 * preference is written to `<html data-theme>` so the CSS tokens switch in one place.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly systemDark = signal(this.readSystemPreference());

  readonly preference = signal<ThemePreference>(this.readStoredPreference());
  readonly resolved = computed<ResolvedTheme>(() => {
    const preference = this.preference();
    if (preference === 'system') {
      return this.systemDark() ? 'dark' : 'light';
    }
    return preference;
  });
  readonly isDark = computed(() => this.resolved() === 'dark');

  constructor() {
    const media = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
    media?.addEventListener?.('change', (event) => this.systemDark.set(event.matches));

    effect(() => {
      const preference = this.preference();
      const root = this.document.documentElement;
      if (preference === 'system') {
        root.removeAttribute('data-theme');
      } else {
        root.setAttribute('data-theme', preference);
      }
      try {
        if (preference === 'system') {
          localStorage.removeItem(STORAGE_KEY);
        } else {
          localStorage.setItem(STORAGE_KEY, preference);
        }
      } catch {
        /* storage unavailable */
      }
    });
  }

  setPreference(preference: ThemePreference): void {
    this.preference.set(preference);
  }

  toggle(): void {
    this.preference.set(this.isDark() ? 'light' : 'dark');
  }

  private readStoredPreference(): ThemePreference {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === 'light' || stored === 'dark' ? stored : 'light';
    } catch {
      return 'light';
    }
  }

  private readSystemPreference(): boolean {
    return this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
  }
}
