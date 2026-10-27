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

describe('dashboard layout', () => {
  it('describes eight widgets whose default rows fill the grid at every column count', () => {
    expect(DEFAULT_WIDGET_ORDER).toEqual([
      'cash',
      'portfolio',
      'return',
      'performance',
      'allocation',
      'holdings',
      'orders',
      'transactions',
    ]);
    expect(DASHBOARD_WIDGETS.map((widget) => widgetWidth(widget, 12))).toEqual([
      4, 4, 4, 8, 4, 12, 12, 12,
    ]);
    expect(DASHBOARD_WIDGETS.map((widget) => widgetWidth(widget, 6))).toEqual([
      2, 2, 2, 6, 6, 6, 6, 6,
    ]);
    expect(DASHBOARD_WIDGETS.map((widget) => widgetWidth(widget, 1))).toEqual([
      1, 1, 1, 1, 1, 1, 1, 1,
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
    expect(orderWidgets(['return', 'cash']).map((widget) => widget.id)).toEqual(['return', 'cash']);
    expect(orderWidgets(['cash', 'news' as 'cash']).map((widget) => widget.id)).toEqual(['cash']);
  });

  it('keeps one layout per client and stores nothing but the order', () => {
    expect(layoutStorageKey(12)).toBe('jetzy.dashboardLayout.12');
    expect(layoutStorageKey(undefined)).toBe('jetzy.dashboardLayout');
    expect(serializeWidgetOrder(['cash', 'return'])).toBe(
      '{"version":1,"order":["cash","return"]}',
    );
  });

  describe('parseWidgetOrder', () => {
    it('accepts a permutation of the current widgets', () => {
      expect(parseWidgetOrder(serializeWidgetOrder(reversed))).toEqual(reversed);
    });

    it.each([
      ['nothing', null],
      ['an empty string', ''],
      ['broken JSON', '{'],
      ['a list without a version', JSON.stringify({ order: DEFAULT_WIDGET_ORDER })],
      ['another version', JSON.stringify({ version: 2, order: DEFAULT_WIDGET_ORDER })],
      ['a missing widget', JSON.stringify({ version: 1, order: DEFAULT_WIDGET_ORDER.slice(1) })],
      [
        'a duplicate widget',
        JSON.stringify({ version: 1, order: [...DEFAULT_WIDGET_ORDER.slice(0, 7), 'cash'] }),
      ],
      [
        'an unknown widget',
        JSON.stringify({ version: 1, order: [...DEFAULT_WIDGET_ORDER.slice(0, 7), 'news'] }),
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
