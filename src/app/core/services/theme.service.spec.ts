import { TestBed } from '@angular/core/testing';
import { THEME_SWITCHING_CLASS, ThemeService } from './theme.service';

type FrameCallback = (time: number) => void;

describe('ThemeService', () => {
  const view = document.defaultView as Window & typeof globalThis;
  const originalFrame = view.requestAnimationFrame;
  const root = document.documentElement;
  let frames: FrameCallback[];

  /** Runs one animation frame, including callbacks scheduled by Angular. */
  const nextFrame = () => frames.splice(0).forEach((callback) => callback(0));

  beforeEach(() => {
    frames = [];
    view.requestAnimationFrame = (callback: FrameCallback) => frames.push(callback);
    localStorage.clear();
    root.removeAttribute('data-theme');
    root.classList.remove(THEME_SWITCHING_CLASS);
  });

  afterEach(() => {
    view.requestAnimationFrame = originalFrame;
    localStorage.clear();
    root.removeAttribute('data-theme');
    root.classList.remove(THEME_SWITCHING_CLASS);
  });

  it('starts in the light theme unless dark was saved', () => {
    TestBed.inject(ThemeService);
    expect(root.getAttribute('data-theme')).toBe('light');

    TestBed.resetTestingModule();
    localStorage.setItem('jetzy.theme', 'dark');
    expect(TestBed.inject(ThemeService).isDark()).toBe(true);
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('switches on the click itself, without waiting for change detection, and saves it', () => {
    const theme = TestBed.inject(ThemeService);

    theme.toggle();
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(theme.isDark()).toBe(true);
    expect(localStorage.getItem('jetzy.theme')).toBe('dark');

    theme.toggle();
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('jetzy.theme')).toBe('light');
  });

  it('turns transitions off for the frame that paints the new theme only', () => {
    const theme = TestBed.inject(ThemeService);

    theme.toggle();
    expect(root.classList.contains(THEME_SWITCHING_CLASS)).toBe(true);
    nextFrame();
    expect(root.classList.contains(THEME_SWITCHING_CLASS)).toBe(true);
    nextFrame();
    expect(root.classList.contains(THEME_SWITCHING_CLASS)).toBe(false);
  });

  it('lets only the latest of several quick switches turn transitions back on', () => {
    const theme = TestBed.inject(ThemeService);

    theme.toggle();
    nextFrame();
    theme.toggle();
    nextFrame();
    expect(root.classList.contains(THEME_SWITCHING_CLASS)).toBe(true);
    nextFrame();
    expect(root.classList.contains(THEME_SWITCHING_CLASS)).toBe(false);
  });

  it('ignores a request for the theme that is already showing', () => {
    const theme = TestBed.inject(ThemeService);

    theme.setPreference('light');
    expect(root.classList.contains(THEME_SWITCHING_CLASS)).toBe(false);
    expect(localStorage.getItem('jetzy.theme')).toBeNull();
  });
});
