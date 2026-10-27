import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';

export interface MarketSample {
  price: number;
  /** Relative trading volume for the volume bars, 0-1. */
  volume: number;
}

/** Horizontal distance between two price samples, in CSS pixels. */
const STEP_PX = 16;
/** Seconds between two samples; together with STEP_PX this sets the scroll speed (~32 px/s). */
const TICK_SECONDS = 0.5;
/** How quickly the live price glides toward the next sample. */
const GLIDE_SECONDS = 0.2;
/** How quickly the vertical scale follows the visible price range. */
const RESCALE_SECONDS = 0.9;
/** Enough history for a 4K-wide window. */
const HISTORY_POINTS = 280;
/** Smallest visible price range, as a share of the price, so quiet stretches are not magnified. */
const MIN_RANGE = 0.03;
/** Used until the browser reports a real size (and in unit tests). */
const FALLBACK_SIZE = { width: 1280, height: 400 };

/** Small seeded PRNG (mulberry32) so the opening chart is the same on every visit. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Made-up price feed: a random walk whose returns carry momentum, so it trends up and down
 * in waves, pulled back toward an anchor that drifts gently upwards. Purely decorative. The
 * default seed opens on a dip followed by a rally at every common screen width.
 */
export function createMarketFeed(seed = 9260): () => MarketSample {
  const random = seededRandom(seed);
  const gaussian = () => {
    const u = Math.max(random(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
  };
  let price = 100;
  let anchor = 100;
  let momentum = 0;
  return () => {
    momentum = momentum * 0.9 + gaussian() * 0.0026;
    anchor *= 1.0004;
    const change = momentum + ((anchor - price) / anchor) * 0.03;
    price *= 1 + change;
    return { price, volume: Math.min(1, 0.2 + Math.abs(change) * 40 + random() * 0.35) };
  };
}

/**
 * Smooth curve through the points (cubic Hermite with finite-difference slopes). The control
 * points stay inside each segment's x-range, so very short segments never loop back.
 */
export function smoothPath(xs: readonly number[], ys: readonly number[]): string {
  const count = Math.min(xs.length, ys.length);
  if (count === 0) {
    return '';
  }
  const slope = (from: number, to: number) => {
    const run = xs[to] - xs[from];
    return run > 1e-6 ? (ys[to] - ys[from]) / run : 0;
  };
  const tangent = (index: number) => slope(Math.max(0, index - 1), Math.min(count - 1, index + 1));
  let path = `M${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
  let startSlope = tangent(0);
  for (let index = 0; index < count - 1; index++) {
    const endSlope = tangent(index + 1);
    const third = (xs[index + 1] - xs[index]) / 3;
    path +=
      `C${(xs[index] + third).toFixed(1)} ${(ys[index] + startSlope * third).toFixed(1)}` +
      ` ${(xs[index + 1] - third).toFixed(1)} ${(ys[index + 1] - endSlope * third).toFixed(1)}` +
      ` ${xs[index + 1].toFixed(1)} ${ys[index + 1].toFixed(1)}`;
    startSlope = endSlope;
  }
  return path;
}

/**
 * Decorative live-market backdrop for the sign-in and registration pages: a price line that
 * keeps scrolling up and down, with volume bars and a pulsing "last price" marker. It sits
 * fixed behind the page, never takes pointer events, is hidden from assistive technology and
 * holds still when the visitor prefers reduced motion. Frames write straight to the SVG, so
 * the animation never runs change detection.
 */
@Component({
  selector: 'app-market-backdrop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <div class="chart" #chart>
      <svg #svg focusable="false">
        <defs>
          <linearGradient [attr.id]="areaId" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" class="area-top" />
            <stop offset="100%" class="area-bottom" />
          </linearGradient>
        </defs>
        <path #barsUp class="bars bars-up" />
        <path #barsDown class="bars bars-down" />
        <path #area class="area" [attr.fill]="'url(#' + areaId + ')'" />
        <path #glow class="glow" />
        <path #line class="line" />
        <line #guide class="guide" />
        <g #head class="head">
          <circle class="head-pulse" r="6" />
          <circle class="head-dot" r="4.5" />
        </g>
      </svg>
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: -1;
      overflow: hidden;
      pointer-events: none;
      background:
        radial-gradient(
          ellipse at 12% 18%,
          color-mix(in srgb, var(--color-brand) 12%, transparent),
          transparent 48%
        ),
        radial-gradient(
          ellipse at 88% 75%,
          color-mix(in srgb, var(--color-accent) 16%, transparent),
          transparent 48%
        ),
        var(--color-bg);
    }

    :host::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(
          color-mix(in srgb, var(--color-border) 35%, transparent) 1px,
          transparent 1px
        ),
        linear-gradient(
          90deg,
          color-mix(in srgb, var(--color-border) 35%, transparent) 1px,
          transparent 1px
        );
      background-size: 72px 72px;
      mask-image: linear-gradient(transparent, #000 35%, transparent);
    }

    .chart {
      position: absolute;
      inset-inline: 0;
      top: 30%;
      height: clamp(240px, 44vh, 480px);
      opacity: 0.5;
      /* Older history fades out to the left; the live end stays crisp. */
      mask-image: linear-gradient(90deg, transparent, #000 28%);
      /* Own layer: the per-frame redraw never repaints the form above it. */
      will-change: transform;
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
    }

    .line,
    .glow {
      fill: none;
      stroke: var(--color-accent);
      stroke-linejoin: round;
      stroke-linecap: round;
    }

    .line {
      stroke-width: 2.5;
    }

    .glow {
      stroke-width: 10;
      opacity: 0.14;
    }

    .area-top {
      stop-color: var(--color-accent);
      stop-opacity: 0.32;
    }

    .area-bottom {
      stop-color: var(--color-accent);
      stop-opacity: 0;
    }

    .bars-up {
      fill: var(--color-positive);
      opacity: 0.4;
    }

    .bars-down {
      fill: var(--color-negative);
      opacity: 0.32;
    }

    .guide {
      stroke: var(--color-accent);
      stroke-width: 1.5;
      stroke-dasharray: 2 6;
      opacity: 0.7;
    }

    .head-dot {
      fill: var(--color-accent);
      stroke: var(--color-bg);
      stroke-width: 2.5;
    }

    .head-pulse {
      fill: var(--color-accent);
      transform-box: fill-box;
      transform-origin: center;
      animation: market-pulse 2.4s ease-out infinite;
    }

    @keyframes market-pulse {
      from {
        transform: scale(1);
        opacity: 0.6;
      }
      to {
        transform: scale(3.6);
        opacity: 0;
      }
    }

    @media (max-width: 520px) {
      .chart {
        opacity: 0.35;
      }
    }
  `,
})
export class MarketBackdropComponent {
  private static nextId = 0;
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  private readonly chartRef = viewChild.required<ElementRef<HTMLElement>>('chart');
  private readonly svgRef = viewChild.required<ElementRef<SVGSVGElement>>('svg');
  private readonly lineRef = viewChild.required<ElementRef<SVGPathElement>>('line');
  private readonly glowRef = viewChild.required<ElementRef<SVGPathElement>>('glow');
  private readonly areaRef = viewChild.required<ElementRef<SVGPathElement>>('area');
  private readonly barsUpRef = viewChild.required<ElementRef<SVGPathElement>>('barsUp');
  private readonly barsDownRef = viewChild.required<ElementRef<SVGPathElement>>('barsDown');
  private readonly guideRef = viewChild.required<ElementRef<SVGLineElement>>('guide');
  private readonly headRef = viewChild.required<ElementRef<SVGGElement>>('head');

  protected readonly areaId = `market-backdrop-area-${MarketBackdropComponent.nextId++}`;

  private readonly feed = createMarketFeed();
  private readonly prices: number[] = [];
  private readonly volumes: number[] = [];
  private readonly xs: number[] = [];
  private readonly ys: number[] = [];
  private pending: MarketSample;
  /** The price at the head of the line, gliding toward `pending`. */
  private live: number;
  /** Seconds since the last sample was committed. */
  private elapsed = 0;
  private low = 0;
  private high = 0;
  private width = FALLBACK_SIZE.width;
  private height = FALLBACK_SIZE.height;

  constructor() {
    for (let index = 0; index < HISTORY_POINTS; index++) {
      const sample = this.feed();
      this.prices.push(sample.price);
      this.volumes.push(sample.volume);
    }
    this.live = this.prices[this.prices.length - 1];
    this.pending = this.feed();

    afterNextRender(() => {
      const view = this.document.defaultView;
      let frameId: number | null = null;
      let lastFrame: number | null = null;

      const frame = (now: number) => {
        const seconds = lastFrame === null ? 0 : Math.min(0.1, (now - lastFrame) / 1000);
        lastFrame = now;
        this.advance(seconds);
        this.draw();
        frameId = view!.requestAnimationFrame(frame);
      };
      const start = () => {
        if (frameId === null && typeof view?.requestAnimationFrame === 'function') {
          lastFrame = null;
          frameId = view.requestAnimationFrame(frame);
        }
      };
      const stop = () => {
        if (frameId !== null) {
          view?.cancelAnimationFrame(frameId);
          frameId = null;
        }
      };

      const measure = () => {
        const rect = this.chartRef().nativeElement.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          this.width = rect.width;
          this.height = rect.height;
        }
        this.svgRef().nativeElement.setAttribute(
          'viewBox',
          `0 0 ${this.width.toFixed(1)} ${this.height.toFixed(1)}`,
        );
      };
      measure();
      this.rescale(0);
      this.draw();

      let observer: ResizeObserver | undefined;
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => {
          measure();
          this.draw();
        });
        observer.observe(this.chartRef().nativeElement);
      }

      const reducedMotion = view?.matchMedia?.('(prefers-reduced-motion: reduce)');
      const onMotionChange = (event: MediaQueryListEvent) => (event.matches ? stop() : start());
      reducedMotion?.addEventListener?.('change', onMotionChange);
      if (!reducedMotion?.matches) {
        start();
      }

      this.destroyRef.onDestroy(() => {
        stop();
        observer?.disconnect();
        reducedMotion?.removeEventListener?.('change', onMotionChange);
      });
    });
  }

  /** x of the live price: a little in from the right edge, leaving room for the guide line. */
  private headX(): number {
    return this.width - Math.min(140, Math.max(40, this.width * 0.08));
  }

  /** Index of the oldest sample that is still on screen. */
  private firstVisible(): number {
    return Math.max(0, this.prices.length - Math.ceil(this.headX() / STEP_PX) - 3);
  }

  private advance(seconds: number): void {
    this.elapsed += seconds;
    while (this.elapsed >= TICK_SECONDS) {
      this.elapsed -= TICK_SECONDS;
      this.prices.push(this.live);
      this.volumes.push(this.pending.volume);
      this.prices.shift();
      this.volumes.shift();
      this.pending = this.feed();
    }
    this.live += (this.pending.price - this.live) * (1 - Math.exp(-seconds / GLIDE_SECONDS));
    this.rescale(seconds);
  }

  /** Eases the vertical scale toward the visible range; `seconds = 0` snaps to it. */
  private rescale(seconds: number): void {
    let min = this.live;
    let max = this.live;
    for (let index = this.firstVisible(); index < this.prices.length; index++) {
      min = Math.min(min, this.prices[index]);
      max = Math.max(max, this.prices[index]);
    }
    const middle = (min + max) / 2;
    const half = Math.max(max - min, middle * MIN_RANGE) * 0.56;
    const ease = seconds === 0 ? 1 : 1 - Math.exp(-seconds / RESCALE_SECONDS);
    this.low += (middle - half - this.low) * ease;
    this.high += (middle + half - this.high) * ease;
  }

  private draw(): void {
    const { width, height, prices, volumes, xs, ys } = this;
    const headX = this.headX();
    const top = height * 0.06;
    const bottom = height * 0.74;
    const barMax = height * 0.16;
    const barWidth = STEP_PX * 0.5;
    const span = this.high - this.low || 1;
    const yOf = (price: number) => top + ((this.high - price) / span) * (bottom - top);
    const offset = this.elapsed / TICK_SECONDS;
    const first = this.firstVisible();
    const last = prices.length - 1;

    xs.length = 0;
    ys.length = 0;
    let barsUp = '';
    let barsDown = '';
    for (let index = first; index <= last; index++) {
      const x = headX - (last - index + offset) * STEP_PX;
      xs.push(x);
      ys.push(yOf(prices[index]));
      if (index > 0) {
        const barHeight = (volumes[index] * barMax).toFixed(1);
        const bar = `M${(x - barWidth / 2).toFixed(1)} ${height.toFixed(1)}v-${barHeight}h${barWidth}v${barHeight}Z`;
        if (prices[index] >= prices[index - 1]) {
          barsUp += bar;
        } else {
          barsDown += bar;
        }
      }
    }
    const liveY = yOf(this.live);
    xs.push(headX);
    ys.push(liveY);

    const line = smoothPath(xs, ys);
    this.lineRef().nativeElement.setAttribute('d', line);
    this.glowRef().nativeElement.setAttribute('d', line);
    this.areaRef().nativeElement.setAttribute(
      'd',
      `${line}L${headX.toFixed(1)} ${height.toFixed(1)}L${xs[0].toFixed(1)} ${height.toFixed(1)}Z`,
    );
    this.barsUpRef().nativeElement.setAttribute('d', barsUp);
    this.barsDownRef().nativeElement.setAttribute('d', barsDown);

    const guide = this.guideRef().nativeElement;
    guide.setAttribute('x1', (headX + 12).toFixed(1));
    guide.setAttribute('x2', width.toFixed(1));
    guide.setAttribute('y1', liveY.toFixed(1));
    guide.setAttribute('y2', liveY.toFixed(1));
    this.headRef().nativeElement.setAttribute(
      'transform',
      `translate(${headX.toFixed(1)} ${liveY.toFixed(1)})`,
    );
  }
}
