import { TestBed } from '@angular/core/testing';
import { MarketBackdropComponent, createMarketFeed, smoothPath } from './market-backdrop';

type FrameCallback = (time: number) => void;

describe('createMarketFeed', () => {
  it('is repeatable for a seed and trends both up and down', () => {
    const first = createMarketFeed(7);
    const second = createMarketFeed(7);
    const samples = Array.from({ length: 400 }, () => first());
    expect(Array.from({ length: 400 }, () => second())).toEqual(samples);

    const prices = samples.map((sample) => sample.price);
    const rises = prices.slice(1).filter((price, index) => price > prices[index]).length;
    expect(rises).toBeGreaterThan(100);
    expect(rises).toBeLessThan(300);
    expect(Math.min(...prices)).toBeGreaterThan(0);
    expect(samples.every((sample) => sample.volume > 0 && sample.volume <= 1)).toBe(true);
  });
});

describe('smoothPath', () => {
  it('runs through every point without folding back on very short segments', () => {
    expect(smoothPath([], [])).toBe('');

    const path = smoothPath([0, 10, 10.2, 20], [5, 0, 1, 5]);
    expect(path.startsWith('M0.0 5.0C')).toBe(true);
    expect(path.endsWith(' 20.0 5.0')).toBe(true);
    expect(path).not.toContain('NaN');

    // Every control point stays inside its own segment's x-range.
    const numbers = path.replace(/[MC]/g, ' ').trim().split(/\s+/).map(Number);
    for (let segment = 0; segment < 3; segment++) {
      const [startX] = numbers.slice(segment * 6, segment * 6 + 1);
      const [c1x, , c2x, , endX] = numbers.slice(segment * 6 + 2, segment * 6 + 8);
      expect(c1x).toBeGreaterThanOrEqual(startX);
      expect(c2x).toBeLessThanOrEqual(endX);
    }
  });
});

describe('MarketBackdropComponent', () => {
  const view = document.defaultView as Window & typeof globalThis;
  const originals = {
    requestAnimationFrame: view.requestAnimationFrame,
    cancelAnimationFrame: view.cancelAnimationFrame,
    matchMedia: view.matchMedia,
  };
  // Angular's zoneless scheduler shares this queue, so tests flush every due frame like a browser.
  let pending: Map<number, FrameCallback>;
  let nextFrameId: number;

  beforeEach(() => {
    pending = new Map();
    nextFrameId = 0;
    view.requestAnimationFrame = (callback: FrameCallback) => {
      pending.set(++nextFrameId, callback);
      return nextFrameId;
    };
    view.cancelAnimationFrame = (id: number) => void pending.delete(id);
  });

  /** Runs animation frames 16 ms apart for `duration` ms. */
  function playFrames(duration: number): void {
    for (let time = 0; time <= duration; time += 16) {
      const due = [...pending.values()];
      pending.clear();
      due.forEach((callback) => callback(time));
    }
  }

  afterEach(() => {
    Object.assign(view, originals);
  });

  async function render() {
    const fixture = TestBed.createComponent(MarketBackdropComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  const attr = (host: HTMLElement, selector: string, name: string) =>
    host.querySelector(selector)?.getAttribute(name) ?? null;

  it('draws a decorative chart that stays out of the accessibility tree', async () => {
    const fixture = await render();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(attr(host, 'path.line', 'd')).toMatch(/^M[\d.-]+ [\d.-]+C/);
    expect(attr(host, 'path.area', 'd')).toMatch(/Z$/);
    expect(attr(host, 'path.bars-up', 'd')).toMatch(/^M/);
    expect(attr(host, '.head', 'transform')).toMatch(/^translate\([\d.]+ [\d.]+\)$/);
  });

  it('keeps the line moving on animation frames and stops when destroyed', async () => {
    const fixture = await render();
    const host = fixture.nativeElement as HTMLElement;
    const before = attr(host, 'path.line', 'd');
    const headBefore = attr(host, '.head', 'transform');

    playFrames(1200);

    const moved = attr(host, 'path.line', 'd');
    expect(moved).not.toBe(before);
    expect(attr(host, '.head', 'transform')).not.toBe(headBefore);

    fixture.destroy();
    playFrames(600);
    expect(attr(host, 'path.line', 'd')).toBe(moved);
  });

  it('holds still for visitors who prefer reduced motion', async () => {
    view.matchMedia = ((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof view.matchMedia;

    const fixture = await render();
    const still = attr(fixture.nativeElement, 'path.line', 'd');
    playFrames(1200);

    expect(still).toMatch(/^M/);
    expect(attr(fixture.nativeElement, 'path.line', 'd')).toBe(still);
  });
});
