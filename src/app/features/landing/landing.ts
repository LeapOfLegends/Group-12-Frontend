import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrandLogoComponent } from '../../shared/ui/brand-logo/brand-logo';
import { IconComponent } from '../../shared/ui/icon/icon';
import { NavbarComponent } from '../../shared/ui/navbar/navbar';

interface Feature {
  icon: string;
  title: string;
  points: string[];
}

interface Step {
  title: string;
  text: string;
}

/**
 * Public landing page at `/`: what JetZy Trading does and how to start, under the shared
 * shared navbar, which shows account navigation when signed in. It describes the product's
 * real capabilities only - no statistics, returns or testimonials are invented.
 */
@Component({
  selector: 'app-landing-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NavbarComponent, BrandLogoComponent, IconComponent],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class LandingPage {
  protected readonly year = new Date().getFullYear();

  protected readonly features: Feature[] = [
    {
      icon: 'trade',
      title: 'Trade directly',
      points: [
        'Buy and sell equities, crypto and FX instruments at the platform’s stored market quotes.',
        'Every order is checked against your buying power or holdings before it is accepted.',
        'You see exactly what the platform reports: accepted, filled, rejected or failed, with the reason.',
      ],
    },
    {
      icon: 'chart-line',
      title: 'Track your portfolio',
      points: [
        'Cash balance, holdings value, total return and total account value in one view.',
        'Buying power that accounts for cash reserved by orders still executing.',
        'An invested-capital chart built from your executed orders, with a table view.',
      ],
    },
    {
      icon: 'search',
      title: 'Look up any price',
      points: [
        'Search instruments by symbol or name straight from your dashboard.',
        'See the stored bid, ask and last trade price, and how fresh the quote is.',
        'Jump from a quote to placing an order in one click.',
      ],
    },
    {
      icon: 'briefcase',
      title: 'Keep every record',
      points: [
        'Current positions valued at the latest price the platform holds for each instrument.',
        'A permanent record of every order you have placed, with timestamps and execution prices.',
        'Deposits and withdrawals confirmed by the platform before the balance changes on screen.',
      ],
    },
  ];

  protected readonly steps: Step[] = [
    {
      title: 'Create your account',
      text: 'Sign up with your details. Your login is verified by the authentication service and your password is only ever stored as a salted hash.',
    },
    {
      title: 'Fund it',
      text: 'Deposit cash into your account balance and withdraw whenever you like. The platform confirms every movement.',
    },
    {
      title: 'Trade and track',
      text: 'Look up a price, place an order, follow its execution and watch your portfolio in real figures.',
    },
  ];
}
