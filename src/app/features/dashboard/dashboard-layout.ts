/**
 * The client dashboard's widgets and the layout a client can save.
 *
 * Only the order is stored. The grid flows the widgets in order (see widget-grid.ts), so an
 * ordered list of ids is the whole layout: it stays valid when a widget's height changes with
 * its data and when the grid switches column counts.
 */
export type DashboardWidgetId =
  | 'cash'
  | 'portfolio'
  | 'return'
  | 'performance'
  | 'allocation'
  | 'holdings'
  | 'orders'
  | 'transactions';

/** Column counts the grid switches between. */
export type GridColumns = 12 | 6 | 1;

/** Widgets that shared a row in the original layout keep one height, as that CSS grid row did. */
export type HeightGroup = 'summary' | 'overview';

export interface DashboardWidget {
  readonly id: DashboardWidgetId;
  readonly title: string;
  /** Width in columns of the 12-column (desktop) grid. */
  readonly desktop: number;
  /** Width in columns of the 6-column (tablet) grid; a 1-column grid stacks everything. */
  readonly tablet: number;
  readonly heightGroup?: HeightGroup;
}

/** The default layout, in order: three summary tiles, the chart beside the allocation card, then the tables. */
export const DASHBOARD_WIDGETS: readonly DashboardWidget[] = [
  { id: 'cash', title: 'Account cash balance', desktop: 4, tablet: 2, heightGroup: 'summary' },
  {
    id: 'portfolio',
    title: 'Total portfolio value',
    desktop: 4,
    tablet: 2,
    heightGroup: 'summary',
  },
  { id: 'return', title: 'Total return', desktop: 4, tablet: 2, heightGroup: 'summary' },
  {
    id: 'performance',
    title: 'Portfolio performance',
    desktop: 8,
    tablet: 6,
    heightGroup: 'overview',
  },
  {
    id: 'allocation',
    title: 'Buying Power & Asset Allocation',
    desktop: 4,
    tablet: 6,
    heightGroup: 'overview',
  },
  { id: 'holdings', title: 'Current holdings', desktop: 12, tablet: 6 },
  { id: 'orders', title: 'Recent orders', desktop: 12, tablet: 6 },
  { id: 'transactions', title: 'Recent transactions', desktop: 12, tablet: 6 },
];

export const DEFAULT_WIDGET_ORDER: readonly DashboardWidgetId[] = DASHBOARD_WIDGETS.map(
  (widget) => widget.id,
);

/**
 * A height group only applies while its members can still share a row: the summary tiles stay
 * three across down to the 6-column grid, the chart and the allocation card only share a row on
 * the 12-column grid. Below that they take their natural heights, as the old layout did.
 */
export const HEIGHT_GROUP_MIN_COLUMNS: Readonly<Record<HeightGroup, GridColumns>> = {
  summary: 6,
  overview: 12,
};

/**
 * Window widths at which the grid drops columns: the thresholds of the `.grid-3` and
 * `.dashboard-grid` media queries the widgets replaced, smallest first.
 */
export const GRID_BREAKPOINTS: readonly {
  readonly maxWidth: number;
  readonly columns: GridColumns;
}[] = [
  { maxWidth: 860, columns: 1 },
  { maxWidth: 1100, columns: 6 },
];

export function gridColumnsFor(viewportWidth: number): GridColumns {
  return GRID_BREAKPOINTS.find((breakpoint) => viewportWidth <= breakpoint.maxWidth)?.columns ?? 12;
}

export function widgetWidth(widget: DashboardWidget, columns: GridColumns): number {
  switch (columns) {
    case 12:
      return widget.desktop;
    case 6:
      return widget.tablet;
    default:
      return 1;
  }
}

/** The widget definitions in the given order. */
export function orderWidgets(order: readonly DashboardWidgetId[]): DashboardWidget[] {
  const byId = new Map(DASHBOARD_WIDGETS.map((widget) => [widget.id, widget] as const));
  return order.flatMap((id) => byId.get(id) ?? []);
}

const LAYOUT_VERSION = 1;
const STORAGE_KEY = 'jetzy.dashboardLayout';

/** One layout per account, keyed by the client id the session already holds; nothing sensitive is stored. */
export function layoutStorageKey(userId: number | null | undefined): string {
  return userId == null ? STORAGE_KEY : `${STORAGE_KEY}.${userId}`;
}

export function serializeWidgetOrder(order: readonly DashboardWidgetId[]): string {
  return JSON.stringify({ version: LAYOUT_VERSION, order });
}

/** The saved order, or null when there is none or it is not a permutation of the current widgets. */
export function parseWidgetOrder(raw: string | null | undefined): DashboardWidgetId[] | null {
  if (!raw) {
    return null;
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const { version, order } = data as { version?: unknown; order?: unknown };
  if (
    version !== LAYOUT_VERSION ||
    !Array.isArray(order) ||
    order.length !== DEFAULT_WIDGET_ORDER.length
  ) {
    return null;
  }
  const known = new Set<unknown>(DEFAULT_WIDGET_ORDER);
  if (new Set(order).size !== order.length || !order.every((id) => known.has(id))) {
    return null;
  }
  return order as DashboardWidgetId[];
}

/** The saved order for the key; storage can be unavailable (private windows), which counts as none. */
export function loadWidgetOrder(key: string): DashboardWidgetId[] | null {
  try {
    return parseWidgetOrder(localStorage.getItem(key));
  } catch {
    return null;
  }
}

export function saveWidgetOrder(key: string, order: readonly DashboardWidgetId[]): void {
  try {
    localStorage.setItem(key, serializeWidgetOrder(order));
  } catch {
    /* storage unavailable: the layout lasts for this visit only */
  }
}
