import { GridStackNode } from 'gridstack';
import {
  DASHBOARD_WIDGETS,
  DEFAULT_WIDGET_ORDER,
  DashboardWidgetId,
  orderWidgets,
} from './dashboard-layout';
import { WidgetGrid, WidgetGridEngine } from './widget-grid';

type Placed = [DashboardWidgetId, number, number, number, number];

/** The default desktop layout in grid units: 8px rows, so a 200px tile is 28 rows. */
const DEFAULT_LAYOUT: Placed[] = [
  ['cash', 0, 0, 6, 28],
  ['portfolio', 6, 0, 6, 28],
  ['performance', 0, 28, 8, 75],
  ['allocation', 8, 28, 4, 75],
  ['holdings', 0, 103, 12, 40],
  ['orders', 0, 143, 12, 51],
  ['transactions', 0, 194, 12, 23],
];
const CELL_WIDTH = 100;
const CELL_HEIGHT = 8;

const readingOrder = (nodes: readonly GridStackNode[]) =>
  [...nodes]
    .sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0))
    .map((node) => node.id);

describe('WidgetGridEngine', () => {
  let engine: WidgetGridEngine;
  const node = (id: DashboardWidgetId) => engine.nodes.find((n) => n.id === id)!;
  const at = (id: DashboardWidgetId) => [node(id).x, node(id).y];

  /** Drags `id` so that its centre lands on the given pixel, the way GridStack reports a drag. */
  function drag(id: DashboardWidgetId, centreX: number, centreY: number): boolean {
    const dragged = node(id);
    const w = (dragged.w ?? 1) * CELL_WIDTH;
    const h = (dragged.h ?? 1) * CELL_HEIGHT;
    engine.beginUpdate(dragged);
    const moved = engine.moveNodeCheck(dragged, {
      x: Math.round((centreX - w / 2) / CELL_WIDTH),
      y: Math.round((centreY - h / 2) / CELL_HEIGHT),
      cellWidth: CELL_WIDTH,
      cellHeight: CELL_HEIGHT,
      rect: { x: centreX - w / 2, y: centreY - h / 2, w, h },
      resizing: false,
    });
    engine.endUpdate();
    return moved;
  }

  beforeEach(() => {
    engine = new WidgetGridEngine({ column: 12, mode: 'list' });
    DEFAULT_LAYOUT.forEach(([id, x, y, w, h]) => engine.addNode({ id, x, y, w, h }));
    expect(readingOrder(engine.nodes)).toEqual([...DEFAULT_WIDGET_ORDER]);
  });

  it('puts a tile dropped on the left half of another tile before it, and the row shifts along', () => {
    expect(drag('portfolio', 150, 112)).toBe(true); // over the left half of "cash"
    expect(readingOrder(engine.nodes)).toEqual([
      'portfolio',
      'cash',
      'performance',
      'allocation',
      'holdings',
      'orders',
      'transactions',
    ]);
    expect(at('portfolio')).toEqual([0, 0]);
    expect(at('cash')).toEqual([6, 0]);
  });

  it('puts a tile dropped on the right half of a wider widget beside it', () => {
    expect(drag('allocation', 150, 112)).toBe(true); // first move it away from the chart
    const chart = node('performance');
    const chartRightHalf = ((chart.x ?? 0) + (chart.w ?? 1) * 0.75) * CELL_WIDTH;
    const chartMiddle = ((chart.y ?? 0) + (chart.h ?? 1) / 2) * CELL_HEIGHT;
    expect(drag('allocation', chartRightHalf, chartMiddle)).toBe(true);
    expect(readingOrder(engine.nodes)).toEqual([...DEFAULT_WIDGET_ORDER]);
    expect(at('allocation')).toEqual([8, 28]);
  });

  it('moves a full-width widget above the whole row it is dropped on the top half of', () => {
    expect(drag('holdings', 600, 28 * CELL_HEIGHT + 100)).toBe(true); // upper part of the chart
    expect(readingOrder(engine.nodes)).toEqual([
      'cash',
      'portfolio',
      'holdings',
      'performance',
      'allocation',
      'orders',
      'transactions',
    ]);
    expect(at('holdings')).toEqual([0, 28]);
    expect(at('performance')).toEqual([0, 68]);
    expect(at('allocation')).toEqual([8, 68]); // the chart and the allocation card stay side by side
  });

  it('leaves the order alone when a widget is dropped below the row it already follows', () => {
    expect(drag('holdings', 1100, 28 * CELL_HEIGHT + 500)).toBe(false); // lower part of the allocation card
    expect(readingOrder(engine.nodes)).toEqual([...DEFAULT_WIDGET_ORDER]);
  });

  it('ranks a widget dropped in empty space past the end last', () => {
    expect(drag('cash', 600, 194 * CELL_HEIGHT + 2000)).toBe(true);
    expect(readingOrder(engine.nodes).at(-1)).toBe('cash');
    expect(at('portfolio')).toEqual([0, 0]);
  });

  it('reorders a single-column grid by the top and bottom halves of the widget under the drop', () => {
    engine = new WidgetGridEngine({ column: 1, mode: 'list' });
    [
      ['cash', 0, 0, 1, 28],
      ['portfolio', 0, 28, 1, 28],
      ['performance', 0, 56, 1, 28],
    ].forEach(([id, x, y, w, h]) =>
      engine.addNode({ id: id as string, x, y, w, h } as GridStackNode),
    );
    expect(drag('performance', 50, 40)).toBe(true); // upper half of "cash"
    expect(readingOrder(engine.nodes)).toEqual(['performance', 'cash', 'portfolio']);
  });

  it('still packs by position when nothing is being dragged', () => {
    const cash = node('cash');
    engine.moveNode(cash, { x: 0, y: 5000 });
    expect(readingOrder(engine.nodes).at(-1)).toBe('cash');
    expect(at('portfolio')).toEqual([0, 0]);
  });
});

describe('WidgetGrid', () => {
  let container: HTMLElement;
  const items = () =>
    Array.from(container.querySelectorAll('.grid-stack-item')).map((item) => ({
      id: item.getAttribute('gs-id'),
      x: Number(item.getAttribute('gs-x')),
      y: Number(item.getAttribute('gs-y')),
      w: Number(item.getAttribute('gs-w') ?? 1),
    }));

  function render(order: readonly DashboardWidgetId[]): HTMLElement {
    const element = document.createElement('div');
    element.className = 'dashboard-widgets';
    element.innerHTML = orderWidgets(order)
      .map(
        (widget) =>
          `<div class="grid-stack-item" gs-id="${widget.id}" gs-w="${widget.desktop}" gs-h="4" gs-no-resize="true">` +
          '<div class="grid-stack-item-content"><div class="dashboard-widget">' +
          '<span class="widget-drag-handle"></span></div></div></div>',
      )
      .join('');
    document.body.appendChild(element);
    return element;
  }

  afterEach(() => container.remove());

  it('flows the widgets in DOM order, widths from the layout, and keeps the DOM sorted by position', () => {
    const reversed = [...DEFAULT_WIDGET_ORDER].reverse();
    container = render(reversed);
    const grid = new WidgetGrid(container, DASHBOARD_WIDGETS, 12);

    expect(container.classList.contains('grid-stack')).toBe(true);
    expect(grid.order()).toEqual(reversed);
    expect(items().map((item) => item.id)).toEqual(reversed);
    // The last two summary tiles share the final row.
    const tiles = items().slice(-2);
    expect(tiles.map((item) => item.x)).toEqual([0, 6]);
    expect(new Set(tiles.map((item) => item.y)).size).toBe(1);
    grid.destroy();
  });

  it('applies an order, re-sorting the DOM so tab order follows the layout', () => {
    container = render([...DEFAULT_WIDGET_ORDER].reverse());
    const grid = new WidgetGrid(container, DASHBOARD_WIDGETS, 12);

    grid.applyOrder(DEFAULT_WIDGET_ORDER);
    expect(grid.order()).toEqual([...DEFAULT_WIDGET_ORDER]);
    expect(items().map((item) => item.id)).toEqual([...DEFAULT_WIDGET_ORDER]);
    expect(items().slice(0, 2)).toEqual([
      { id: 'cash', x: 0, y: 0, w: 6 },
      { id: 'portfolio', x: 6, y: 0, w: 6 },
    ]);
    grid.destroy();
  });

  it('only lets widgets be dragged while movable', () => {
    container = render(DEFAULT_WIDGET_ORDER);
    const grid = new WidgetGrid(container, DASHBOARD_WIDGETS, 12);
    const item = container.querySelector('.grid-stack-item') as HTMLElement & {
      ddElement?: { ddDraggable?: { disabled?: boolean } };
    };
    expect(item.classList.contains('ui-draggable-disabled')).toBe(true);
    expect(item.ddElement?.ddDraggable).toBeUndefined();

    grid.setMovable(true);
    expect(item.classList.contains('ui-draggable-disabled')).toBe(false);
    expect(item.ddElement?.ddDraggable?.disabled).toBe(false);

    grid.setMovable(false);
    expect(item.classList.contains('ui-draggable-disabled')).toBe(true);
    grid.destroy();
  });

  it('switches column counts with each widget at its width for that count, keeping the order', () => {
    container = render(DEFAULT_WIDGET_ORDER);
    const grid = new WidgetGrid(container, DASHBOARD_WIDGETS, 12);

    grid.setColumns(6);
    expect(grid.order()).toEqual([...DEFAULT_WIDGET_ORDER]);
    expect(
      items()
        .slice(0, 4)
        .map((item) => [item.id, item.x, item.w]),
    ).toEqual([
      ['cash', 0, 3],
      ['portfolio', 3, 3],
      ['performance', 0, 6],
      ['allocation', 0, 6],
    ]);
    expect(items()[2].y).toBeLessThan(items()[3].y); // stacked, no longer side by side

    grid.setColumns(1);
    expect(items().every((item) => item.x === 0 && item.w === 1)).toBe(true);
    expect(grid.order()).toEqual([...DEFAULT_WIDGET_ORDER]);

    grid.setColumns(12);
    expect(
      items()
        .slice(0, 2)
        .map((item) => item.x),
    ).toEqual([0, 6]);
    grid.destroy();
  });

  it('releases GridStack on destroy', () => {
    container = render(DEFAULT_WIDGET_ORDER);
    const grid = new WidgetGrid(container, DASHBOARD_WIDGETS, 12);
    grid.destroy();
    expect((container as HTMLElement & { gridstack?: unknown }).gridstack).toBeUndefined();
  });
});
