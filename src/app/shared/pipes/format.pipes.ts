import { Pipe, PipeTransform } from '@angular/core';
import { formatDate, formatDateTime, formatRelativeAge } from '../../core/utils/dates';
import { formatCompactMoney, formatMoney, formatPercent, formatPrice, formatQuantity, formatSignedMoney } from '../../core/utils/money';

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined, currency = 'USD'): string {
    return formatMoney(value, currency);
  }
}

@Pipe({ name: 'price' })
export class PricePipe implements PipeTransform {
  transform(value: number | null | undefined, currency = 'USD'): string {
    return formatPrice(value, currency);
  }
}

@Pipe({ name: 'signedMoney' })
export class SignedMoneyPipe implements PipeTransform {
  transform(value: number | null | undefined, currency = 'USD'): string {
    return formatSignedMoney(value, currency);
  }
}

@Pipe({ name: 'compactMoney' })
export class CompactMoneyPipe implements PipeTransform {
  transform(value: number | null | undefined, currency = 'USD'): string {
    return formatCompactMoney(value, currency);
  }
}

@Pipe({ name: 'pct' })
export class PercentagePipe implements PipeTransform {
  transform(value: number | null | undefined, signed = false, digits = 2): string {
    return formatPercent(value, { signed, digits });
  }
}

@Pipe({ name: 'quantity' })
export class QuantityPipe implements PipeTransform {
  transform(value: number | null | undefined, maxDecimals = 8): string {
    return formatQuantity(value, maxDecimals);
  }
}

@Pipe({ name: 'dateTime' })
export class DateTimePipe implements PipeTransform {
  transform(value: string | number | Date | null | undefined): string {
    return formatDateTime(value);
  }
}

@Pipe({ name: 'shortDate' })
export class ShortDatePipe implements PipeTransform {
  transform(value: string | number | Date | null | undefined): string {
    return formatDate(value);
  }
}

@Pipe({ name: 'relativeAge' })
export class RelativeAgePipe implements PipeTransform {
  transform(value: string | number | Date | null | undefined, nowMs?: number): string {
    return formatRelativeAge(value, nowMs ?? Date.now());
  }
}

export const FORMAT_PIPES = [
  MoneyPipe,
  PricePipe,
  SignedMoneyPipe,
  CompactMoneyPipe,
  PercentagePipe,
  QuantityPipe,
  DateTimePipe,
  ShortDatePipe,
  RelativeAgePipe,
] as const;
