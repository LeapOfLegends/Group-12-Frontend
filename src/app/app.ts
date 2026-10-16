import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { NotificationToastComponent } from './shared/ui/notification-toast/notification-toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NotificationToastComponent],
  template: `
    <router-outlet />
    <app-notification-toast />
  `,
})
export class App {
  // Instantiated eagerly so the saved theme is applied as soon as the app boots.
  private readonly theme = inject(ThemeService);
}
