import { DOCUMENT } from '@angular/common';
import { Injectable, OnDestroy, inject, signal } from '@angular/core';

/** Shared browser activity state used to pause background network work. */
@Injectable({ providedIn: 'root' })
export class AppVisibilityService implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly visibleState = signal(this.document.visibilityState !== 'hidden');
  private readonly resumeState = signal(0);

  readonly visible = this.visibleState.asReadonly();
  readonly resumeRevision = this.resumeState.asReadonly();

  constructor() {
    this.document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.document.defaultView?.addEventListener('focus', this.onFocus);
  }

  ngOnDestroy(): void {
    this.document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.document.defaultView?.removeEventListener('focus', this.onFocus);
  }

  private readonly onVisibilityChange = (): void => {
    const visible = this.document.visibilityState !== 'hidden';
    this.visibleState.set(visible);
    if (visible) this.resumeState.update((value) => value + 1);
  };

  private readonly onFocus = (): void => {
    if (this.document.visibilityState !== 'hidden') {
      this.visibleState.set(true);
      this.resumeState.update((value) => value + 1);
    }
  };
}
