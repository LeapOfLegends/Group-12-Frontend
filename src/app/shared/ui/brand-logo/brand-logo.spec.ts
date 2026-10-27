import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BrandLogoComponent } from './brand-logo';

describe('BrandLogoComponent', () => {
  let fixture: ComponentFixture<BrandLogoComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BrandLogoComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(BrandLogoComponent);
  });

  it('renders the supplied icon with a crisp HTML wordmark', () => {
    fixture.detectChanges();

    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    const image = anchor.querySelector('img') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('jetzy-logo.png');
    expect(image.getAttribute('alt')).toBe('');
    expect(anchor.getAttribute('aria-label')).toBe('JetZy Trading home');
    expect(anchor.querySelector('svg')).toBeNull();
    expect(anchor.querySelector('.brand-text')?.textContent).toContain('JetZy');
    expect(anchor.querySelector('.brand-text')?.textContent).toContain('Trading');
  });

  it('uses the requested icon size', () => {
    fixture.componentRef.setInput('markSize', 40);
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(image.style.width).toBe('40px');
    expect(image.style.height).toBe('40px');
  });

  it('keeps compact placements icon-only', () => {
    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('img')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.brand-text')).toBeNull();
  });
});
