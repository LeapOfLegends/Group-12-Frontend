import {
  GridItemHTMLElement,
  GridStack,
  GridStackEngine,
  GridStackMoveOpts,
  GridStackNode,
} from 'gridstack';
import {
  DashboardWidget,
  DashboardWidgetId,
  GridColumns,
  HEIGHT_GROUP_MIN_COLUMNS,
  HeightGroup,
  widgetWidth,
} from './dashboard-layout';

/** Row height in px: fine enough that a widget sized to its content ends within a few px of it. */
export const GRID_CELL_HEIGHT = 8;
/** Px above and below each widget: 24px between rows, the page's section gap. */
export const GRID_ROW_MARGIN = 12;
/** Px left and right of each widget: 16px between columns, the card gap. */
export const GRID_COLUMN_MARGIN = 8;
/** Rows left between ranks while widgets are re-flowed, so nothing overlaps before the grid packs them. */
const RANK_SPACING = 1000;
const WIDGET_SELECTOR = '.dashboard-widget';
const HEIGHT_GROUPS: readonly HeightGroup[] = ['summary', 'overview'];

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const readingOrder = (a: GridStackNode, b: GridStackNode): number =>
  (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0);

/** Squared distance from a point to a box; 0 inside it. */
function distance(box: Box, x: number, y: number): number {
  const dx = Math.max(box.x - x, 0, x - (box.x + box.w));
  const dy = Math.max(box.y - y, 0, y - (box.y + box.h));
  return dx * dx + dy * dy;
}

/**
 * GridStack's `list` mode ranks a dragged widget by the exact cell under its top-left corner,
 * which with 8px rows means a widget dropped a few pixels below the top of a row lands after
 * everything in that row. This engine ranks the way a phone's home screen does instead: the
 * widget takes the place of the one under its centre, before or after it depending on which
 * side of that widget the centre is on, and the rest shift along. A widget that cannot share a
 * row with the one under it goes above or below that widget's whole row.
 */
export class WidgetGridEngine extends GridStackEngine {
  /** The order to lay out in, while a drag is being applied; positions decide otherwise. */
  private ranks: Map<GridStackNode, number> | null = null;

  override sortNodes(dir: 1 | -1 = 1): GridStackEngine {
    const ranks = this.ranks;
    if (!ranks) {
      return super.sortNodes(dir);
    }
    const rank = (node: GridStackNode) => ranks.get(node) ?? Number.MAX_SAFE_INTEGER;
    this.nodes.sort((a, b) => dir * (rank(a) - rank(b)));
    return this;
  }

  override moveNode(node: GridStackNode, o: GridStackMoveOpts): boolean {
    const userDrag = !!o.rect && !o.resizing && !o.nested && this.mode === 'list';
    if (!userDrag || !o.rect || !o.cellWidth || !o.cellHeight) {
      return super.moveNode(node, o);
    }
    const sequence = this.sequenceFor(node, o.rect, o.cellWidth, o.cellHeight);
    this.ranks = new Map(sequence.map((member, rank) => [member, rank]));
    try {
      return super.moveNode(node, o);
    } finally {
      this.ranks = null;
    }
  }

  /** All widgets in reading order, with the dragged one at the slot its pixel rect asks for. */
  private sequenceFor(
    node: GridStackNode,
    rect: GridStackMoveOpts['rect'] & object,
    cellWidth: number,
    cellHeight: number,
  ): GridStackNode[] {
    const others = this.nodes.filter((other) => other !== node).sort(readingOrder);
    if (others.length === 0) {
      return [node];
    }
    const boxOf = (other: GridStackNode): Box => ({
      x: (other.x ?? 0) * cellWidth,
      y: (other.y ?? 0) * cellHeight,
      w: (other.w ?? 1) * cellWidth,
      h: (other.h ?? 1) * cellHeight,
    });
    const centreX = (rect.x ?? 0) + (rect.w ?? 0) / 2;
    const centreY = (rect.y ?? 0) + (rect.h ?? 0) / 2;
    // The widget under the centre, else the nearest one (the centre is in a gap or past the end).
    const target = others.reduce((best, other) =>
      distance(boxOf(other), centreX, centreY) < distance(boxOf(best), centreX, centreY)
        ? other
        : best,
    );
    const box = boxOf(target);
    const targetCentreX = box.x + box.w / 2;
    const targetCentreY = box.y + box.h / 2;
    const canShareRow = (node.w ?? 1) + (target.w ?? 1) <= this.column;
    let at: number;
    if (canShareRow && Math.abs(centreY - targetCentreY) <= box.h / 4) {
      at = others.indexOf(target) + (centreX < targetCentreX ? 0 : 1);
    } else {
      const row = others.filter((other) => other.y === target.y);
      at =
        centreY < targetCentreY ? others.indexOf(row[0]) : others.indexOf(row[row.length - 1]) + 1;
    }
    return [...others.slice(0, at), node, ...others.slice(at)];
  }
}

/**
 * The dashboard's widget grid: GridStack in `list` mode, which flows the widgets in order the way
 * a wrapping list does, so dragging one only re-ranks it and the others shift along. The order of
 * widget ids is the whole layout. Nothing is resizable by the user; each widget is sized to its
 * content here, after the grid exists, rather than with GridStack's own `sizeToContent`, whose
 * collision handling re-orders widgets that grow one after another.
 */
export class WidgetGrid {
  private readonly grid: GridStack;
  private readonly items = new Map<DashboardWidgetId, GridItemHTMLElement>();
  private readonly observer: ResizeObserver | null = null;
  private refresh: number | null = null;
  private refreshAfterDrag = false;
  private dragStart: { rect: DOMRect; x: number; y: number } | null = null;

  constructor(
    container: HTMLElement,
    private readonly widgets: readonly DashboardWidget[],
    private columns: GridColumns,
  ) {
    container.querySelectorAll<GridItemHTMLElement>('.grid-stack-item').forEach((item) => {
      this.items.set(item.getAttribute('gs-id') as DashboardWidgetId, item);
    });
    const grid = GridStack.init(
      {
        column: columns,
        cellHeight: GRID_CELL_HEIGHT,
        margin: `${GRID_ROW_MARGIN}px ${GRID_COLUMN_MARGIN}px`,
        mode: 'list',
        engineClass: WidgetGridEngine,
        // Turned on once the first sizing pass has painted, so widgets do not grow in on load.
        animate: false,
        disableDrag: true,
        disableResize: true,
        handle: '.widget-drag-handle',
      },
      container,
    );
    if (!grid) {
      throw new Error('GridStack could not initialise the dashboard widget grid.');
    }
    this.grid = grid;
    this.refreshSizes();
    this.grid.setAnimation(true, true);
    this.grid.on('dragstart', (event, item) => {
      const pointer = event as MouseEvent;
      this.dragStart = {
        rect: item.getBoundingClientRect(),
        x: pointer.clientX,
        y: pointer.clientY,
      };
    });
    this.grid.on('dragstop', (event, item) => {
      this.settle(event as MouseEvent, item);
      if (this.refreshAfterDrag) {
        this.refreshAfterDrag = false;
        this.scheduleRefresh();
      }
    });
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => this.scheduleRefresh());
      this.items.forEach((item) => observer.observe(this.widgetOf(item)));
      this.observer = observer;
    }
  }

  /** Lets the user drag widgets by their handles, or locks them again. */
  setMovable(movable: boolean): void {
    this.grid.enableMove(movable);
  }

  /** Switches column count, re-flowing the current order with each widget's width for that count. */
  setColumns(columns: GridColumns): void {
    if (columns === this.columns) {
      return;
    }
    this.columns = columns;
    this.grid.column(columns, 'list');
    const widths = new Map(this.widgets.map((widget) => [widget.id, widgetWidth(widget, columns)]));
    this.flow(this.order(), (id) => ({ w: widths.get(id) }));
    this.scheduleRefresh();
  }

  /** The widgets in reading order, which is the layout. */
  order(): DashboardWidgetId[] {
    const saved = this.grid.save(false, false, undefined, this.grid.getColumn());
    return Array.isArray(saved) ? saved.map((widget) => widget.id as DashboardWidgetId) : [];
  }

  /** Re-flows the widgets into the given order. */
  applyOrder(order: readonly DashboardWidgetId[]): void {
    this.flow(order);
  }

  /** Re-measures on the next frame; cheap enough to ask for after every render. */
  scheduleRefresh(): void {
    if (this.refresh !== null) {
      return;
    }
    const run = () => {
      this.refresh = null;
      this.refreshSizes();
    };
    this.refresh =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame(run)
        : window.setTimeout(run, 16);
  }

  /**
   * Sizes every widget's rows to its content. Widgets in an active height group first get the
   * group's tallest natural height, which their cards stretch to.
   */
  refreshSizes(): void {
    this.cancelRefresh();
    if (this.dragStart) {
      this.refreshAfterDrag = true; // the carried widget is a fixed-position helper right now
      return;
    }
    const grouped = this.widgets.filter((widget) => widget.heightGroup);
    grouped.forEach((widget) => (this.widgetOf(this.item(widget.id)).style.height = ''));
    const natural = new Map(
      grouped.map((widget) => [
        widget.id,
        this.widgetOf(this.item(widget.id)).getBoundingClientRect().height,
      ]),
    );
    if ([...natural.values()].every((height) => height === 0)) {
      return; // hidden, or no layout engine (unit tests)
    }
    HEIGHT_GROUPS.filter((group) => this.columns >= HEIGHT_GROUP_MIN_COLUMNS[group]).forEach(
      (group) => {
        const members = grouped.filter((widget) => widget.heightGroup === group);
        const height = Math.max(0, ...members.map((widget) => natural.get(widget.id) ?? 0));
        members.forEach(
          (widget) => (this.widgetOf(this.item(widget.id)).style.height = `${height}px`),
        );
      },
    );
    this.flow(this.order(), (id) => ({
      h: Math.ceil(
        (this.widgetOf(this.item(id)).getBoundingClientRect().height + 2 * GRID_ROW_MARGIN) /
          GRID_CELL_HEIGHT,
      ),
    }));
  }

  destroy(): void {
    this.observer?.disconnect();
    this.cancelRefresh();
    this.grid.destroy(false);
  }

  /**
   * Lays the widgets out in `order`, with any new sizes. Each gets its rank as a row far from
   * the others first, so a widget that grows never collides with (and so never pushes around)
   * a neighbour; the grid's `list` packing then flows them back together in that order.
   */
  private flow(
    order: readonly DashboardWidgetId[],
    size: (id: DashboardWidgetId) => { w?: number; h?: number } = () => ({}),
  ): void {
    this.grid.batchUpdate();
    order.forEach((id, rank) =>
      this.grid.update(this.item(id), { x: 0, y: rank * RANK_SPACING, ...size(id) }),
    );
    this.grid.batchUpdate(false);
  }

  private cancelRefresh(): void {
    if (this.refresh === null) {
      return;
    }
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.refresh);
    } else {
      window.clearTimeout(this.refresh);
    }
    this.refresh = null;
  }

  private item(id: DashboardWidgetId): GridItemHTMLElement {
    const item = this.items.get(id);
    if (!item) {
      throw new Error(`Dashboard widget "${id}" is not in the grid.`);
    }
    return item;
  }

  private widgetOf(item: GridItemHTMLElement): HTMLElement {
    return item.querySelector<HTMLElement>(WIDGET_SELECTOR) ?? item;
  }

  /** After a drop GridStack snaps the item into its slot; slide it there from where it was let go instead. */
  private settle(event: MouseEvent, item: GridItemHTMLElement): void {
    const start = this.dragStart;
    this.dragStart = null;
    const content = item.firstElementChild;
    if (!start || !(content instanceof HTMLElement)) {
      return;
    }
    const rest = item.getBoundingClientRect();
    const dx = start.rect.left + (event.clientX - start.x) - rest.left;
    const dy = start.rect.top + (event.clientY - start.y) - rest.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
      return;
    }
    content.style.transition = 'none';
    content.style.transform = `translate(${dx}px, ${dy}px) scale(1.02)`;
    content.getBoundingClientRect(); // commit that start, so clearing it below animates
    content.style.transition = '';
    content.style.transform = '';
  }
}
