import {
  DASHBOARD_WIDGETS,
  DEFAULT_WIDGET_ORDER,
  gridColumnsFor,
  layoutStorageKey,
  loadWidgetOrder,
  orderWidgets,
  parseWidgetOrder,
  saveWidgetOrder,
  serializeWidgetOrder,
  widgetWidth,
} from './dashboard-layout';

const reversed = [...DEFAULT_WIDGET_ORDER].reverse();
const legacyOrder = [
  'transactions',
  'orders',
  'return',
  'holdings',
  'allocation',
  'performance',
  'portfolio',
  'cash',
];

describe('dashboard layout', () => {
  it('describes seven widgets whose default rows fill the grid at every column count', () => {
    expect(DEFAULT_WIDGET_ORDER).toEqual([
      'cash',
      'portfolio',
      'performance',
      'allocation',
      'holdings',
      'orders',
      'transactions',
    ]);
    expect(DASHBOARD_WIDGETS.map((widget) => widgetWidth(widget, 12))).toEqual([
      6, 6, 8, 4, 12, 12, 12,
    ]);
    expect(DASHBOARD_WIDGETS.map((widget) => widgetWidth(widget, 6))).toEqual([
      3, 3, 6, 6, 6, 6, 6,
    ]);
    expect(DASHBOARD_WIDGETS.map((widget) => widgetWidth(widget, 1))).toEqual([
      1, 1, 1, 1, 1, 1, 1,
    ]);
  });

  it('drops columns at the widths of the media queries the widgets replaced', () => {
    expect(gridColumnsFor(1440)).toBe(12);
    expect(gridColumnsFor(1101)).toBe(12);
    expect(gridColumnsFor(1100)).toBe(6);
    expect(gridColumnsFor(861)).toBe(6);
    expect(gridColumnsFor(860)).toBe(1);
    expect(gridColumnsFor(390)).toBe(1);
  });

  it('orders the widget definitions and drops ids it does not know', () => {
    expect(orderWidgets(['portfolio', 'cash']).map((widget) => widget.id)).toEqual([
      'portfolio',
      'cash',
    ]);
    expect(orderWidgets(['cash', 'news' as 'cash']).map((widget) => widget.id)).toEqual(['cash']);
  });

  it('keeps one layout per client and stores nothing but the order', () => {
    expect(layoutStorageKey(12)).toBe('jetzy.dashboardLayout.12');
    expect(layoutStorageKey(undefined)).toBe('jetzy.dashboardLayout');
    expect(serializeWidgetOrder(['cash', 'portfolio'])).toBe(
      '{"version":2,"order":["cash","portfolio"]}',
    );
  });

  describe('parseWidgetOrder', () => {
    it('accepts a permutation of the current widgets', () => {
      expect(parseWidgetOrder(serializeWidgetOrder(reversed))).toEqual(reversed);
    });

    it('migrates a version 1 layout by removing return and preserving relative order', () => {
      expect(parseWidgetOrder(JSON.stringify({ version: 1, order: legacyOrder }))).toEqual([
        'transactions',
        'orders',
        'holdings',
        'allocation',
        'performance',
        'portfolio',
        'cash',
      ]);
    });

    it.each([
      ['nothing', null],
      ['an empty string', ''],
      ['broken JSON', '{'],
      ['a list without a version', JSON.stringify({ order: DEFAULT_WIDGET_ORDER })],
      ['another version', JSON.stringify({ version: 3, order: DEFAULT_WIDGET_ORDER })],
      ['a missing widget', JSON.stringify({ version: 2, order: DEFAULT_WIDGET_ORDER.slice(1) })],
      [
        'a duplicate widget',
        JSON.stringify({ version: 2, order: [...DEFAULT_WIDGET_ORDER.slice(0, 6), 'cash'] }),
      ],
      [
        'an unknown widget',
        JSON.stringify({ version: 2, order: [...DEFAULT_WIDGET_ORDER.slice(0, 6), 'news'] }),
      ],
      ['an order that is not a list', JSON.stringify({ version: 1, order: 'cash' })],
    ])('rejects %s', (_label, raw) => {
      expect(parseWidgetOrder(raw)).toBeNull();
    });
  });

  describe('storage', () => {
    beforeEach(() => localStorage.clear());

    afterEach(() => {
      vi.restoreAllMocks();
      localStorage.clear();
    });

    it('round-trips through localStorage and treats a missing entry as no layout', () => {
      expect(loadWidgetOrder('layout')).toBeNull();
      saveWidgetOrder('layout', reversed);
      expect(loadWidgetOrder('layout')).toEqual(reversed);
    });

    it('rewrites a migrated version 1 layout using the current version', () => {
      localStorage.setItem('layout', JSON.stringify({ version: 1, order: legacyOrder }));
      const migrated = legacyOrder.filter((id) => id !== 'return');
      expect(loadWidgetOrder('layout')).toEqual(migrated);
      expect(localStorage.getItem('layout')).toBe(
        serializeWidgetOrder(migrated as typeof DEFAULT_WIDGET_ORDER),
      );
    });

    it('still uses a migrated order when storage cannot rewrite it', () => {
      localStorage.setItem('layout', JSON.stringify({ version: 1, order: legacyOrder }));
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota exceeded');
      });
      expect(loadWidgetOrder('layout')).toEqual(legacyOrder.filter((id) => id !== 'return'));
    });

    it('copes with storage being unavailable', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota exceeded');
      });
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      expect(() => saveWidgetOrder('layout', reversed)).not.toThrow();
      expect(loadWidgetOrder('layout')).toBeNull();
    });
  });
});
