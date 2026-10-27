import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'jetzy.theme';
/** Set on `<html>` while the theme changes; styles.scss turns every transition off under it. */
export const THEME_SWITCHING_CLASS = 'theme-switching';

/**
 * Light theme by default; a saved preference wins over the OS setting. The
 * preference is written to `<html data-theme>` so the CSS tokens switch in one place.
 * index.html applies the same default before Angular boots, so the first paint is right.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly systemDark = signal(this.readSystemPreference());
  private readonly current = signal<ThemePreference>(this.readStoredPreference());
  private switchId = 0;

  readonly preference = this.current.asReadonly();
  readonly resolved = computed<ResolvedTheme>(() => {
    const preference = this.current();
    if (preference === 'system') {
      return this.systemDark() ? 'dark' : 'light';
    }
    return preference;
  });
  readonly isDark = computed(() => this.resolved() === 'dark');

  constructor() {
    const media = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
    media?.addEventListener?.('change', (event) => {
      if (this.current() === 'system') {
        // The CSS media query swaps the tokens itself; keep the controls from fading behind it.
        this.suppressTransitions();
      }
      this.systemDark.set(event.matches);
    });
    this.apply(this.current());
  }

  setPreference(preference: ThemePreference): void {
    if (preference === this.current()) {
      return;
    }
    this.current.set(preference);
    // Applied on the click itself rather than in an effect, which would wait for change detection.
    this.suppressTransitions();
    this.apply(preference);
    try {
      if (preference === 'system') {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, preference);
      }
    } catch {
      /* storage unavailable */
    }
  }

  toggle(): void {
    this.setPreference(this.isDark() ? 'light' : 'dark');
  }

  private apply(preference: ThemePreference): void {
    const root = this.document.documentElement;
    if (preference === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', preference);
    }
  }

  /**
   * Buttons, inputs and links ease their colours over 120 ms, so without this they would trail
   * the page by several frames. Transitions stay off for the frame that paints the new theme and
   * come back on the next one; only the latest switch restores them.
   */
  private suppressTransitions(): void {
    const root = this.document.documentElement;
    const view = this.document.defaultView;
    const id = ++this.switchId;
    root.classList.add(THEME_SWITCHING_CLASS);
    const restore = () => {
      if (id === this.switchId) {
        root.classList.remove(THEME_SWITCHING_CLASS);
      }
    };
    if (typeof view?.requestAnimationFrame === 'function') {
      view.requestAnimationFrame(() => view.requestAnimationFrame(restore));
    } else {
      setTimeout(restore, 50);
    }
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
    return (
      this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false
    );
  }
}
