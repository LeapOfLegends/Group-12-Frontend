import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HoldingPosition } from '../../../core/models/portfolio.models';
import { MoneyPipe, PercentagePipe, PricePipe, QuantityPipe, SignedMoneyPipe } from '../../pipes/format.pipes';
import { EmptyStateComponent } from '../empty-state/empty-state';
import { IconComponent } from '../icon/icon';
import { LoadingSkeletonComponent } from '../loading-skeleton/loading-skeleton';
import { TableScrollDirective } from '../table-scroll';

/** Current holdings with live valuation and Buy / Sell shortcuts. */
@Component({
  selector: 'app-holdings-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MoneyPipe, PricePipe, QuantityPipe, SignedMoneyPipe, PercentagePipe, EmptyStateComponent, IconComponent, LoadingSkeletonComponent, TableScrollDirective],
  template: `
    @if (loading()) {
      <app-loading-skeleton variant="table" [lines]="4" label="Loading holdings" />
    } @else if (positions().length === 0) {
      <app-empty-state icon="briefcase" title="No holdings yet" message="Once an order is filled, the position shows up here with its current value.">
        @if (showActions()) {
          <a class="btn btn-primary btn-sm" routerLink="/trade">Place your first trade</a>
        }
      </app-empty-state>
    } @else {
      <div class="table-wrap" [appTableScroll]="visibleRows()" tableScrollLabel="Current holdings">
        <table class="table">
          <caption class="visually-hidden">Current holdings</caption>
          <thead>
            <tr>
              <th scope="col">Instrument</th>
              <th scope="col" class="num">Quantity</th>
              <th scope="col" class="num">Avg cost</th>
              <th scope="col" class="num">Price</th>
              <th scope="col" class="num">Value</th>
              <th scope="col" class="num">Return</th>
              @if (showActions()) {
                <th scope="col" class="actions-col"><span class="visually-hidden">Actions</span></th>
              }
            </tr>
          </thead>
          <tbody>
            @for (position of positions(); track position.holding.holdingId) {
              <tr>
                <td>
                  <span class="cell-primary">{{ position.symbol }}</span>
                  <span class="cell-secondary">{{ position.name }}</span>
                </td>
                <td class="num">{{ position.quantity | quantity }}</td>
                <td class="num">{{ position.averageCost | price: position.currency }}</td>
                <td class="num">
                  {{ position.currentPrice | price: position.currency }}
                  @if (position.currentPrice === null) {
                    <span class="cell-secondary">No quote</span>
                  }
                </td>
                <td class="num cell-primary">{{ position.marketValue | money: position.currency }}</td>
                <td class="num">
                  @if (position.gain !== null) {
                    <span class="delta" [class.delta-up]="position.gain > 0" [class.delta-down]="position.gain < 0" [class.delta-flat]="position.gain === 0">
                      @if (position.gain > 0) {
                        <app-icon name="trend-up" [size]="14" />
                      } @else if (position.gain < 0) {
                        <app-icon name="trend-down" [size]="14" />
                      }
                      {{ position.gain | signedMoney: position.currency }}
                    </span>
                    <span class="cell-secondary">{{ position.gainPct | pct: true }}</span>
                  } @else {
                    <span class="text-muted">—</span>
                  }
                </td>
                @if (showActions()) {
                  <td class="actions-col">
                    <div class="row-actions">
                      <a class="btn btn-soft btn-sm" [routerLink]="'/trade'" [queryParams]="{ symbol: position.symbol, side: 'BUY' }">Buy</a>
                      <a class="btn btn-secondary btn-sm" [routerLink]="'/trade'" [queryParams]="{ symbol: position.symbol, side: 'SELL' }">Sell</a>
                    </div>
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: `
    .actions-col {
      text-align: right;
      width: 1%;
    }

    .row-actions {
      display: inline-flex;
      gap: 6px;
    }
  `,
})
export class HoldingsTableComponent {
  readonly positions = input<HoldingPosition[]>([]);
  readonly loading = input<boolean>(false);
  readonly showActions = input<boolean>(true);
  readonly visibleRows = input<number | null>(null);
}
