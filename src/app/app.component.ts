import { ChangeDetectionStrategy, Component, computed, OnDestroy, signal } from '@angular/core';
import { Vibrant } from 'node-vibrant/browser';

interface ColorStop {
  id: number;
  color: string;
}

interface GradientPreset {
  name: string;
  colors: string[];
  angle: number;
  type: 'linear' | 'radial';
}

const PRESETS: GradientPreset[] = [
  { name: 'Sunset', colors: ['#ff6b6b', '#f7b267', '#f4845f'], angle: 120, type: 'linear' },
  { name: 'Ocean', colors: ['#00c6ff', '#0072ff'], angle: 135, type: 'linear' },
  { name: 'Lavender', colors: ['#a18cd1', '#fbc2eb'], angle: 120, type: 'linear' },
  { name: 'Forest', colors: ['#134e5e', '#71b280'], angle: 145, type: 'linear' },
  { name: 'Peach', colors: ['#ed6ea0', '#ec8c69'], angle: 110, type: 'linear' },
  { name: 'Aurora', colors: ['#00f5a0', '#00d9f5', '#9b5de5'], angle: 145, type: 'linear' },
  { name: 'Midnight', colors: ['#232526', '#414345'], angle: 135, type: 'linear' },
  { name: 'Candy', colors: ['#fbc2eb', '#a6c1ee'], angle: 125, type: 'linear' },
  { name: 'Glow', colors: ['#f857a6', '#ff5858'], angle: 90, type: 'radial' },
  { name: 'Citrus', colors: ['#fce38a', '#f38181'], angle: 135, type: 'linear' },
  { name: 'Berry', colors: ['#8e2de2', '#4a00e0'], angle: 140, type: 'linear' },
  { name: 'Lagoon', colors: ['#43cea2', '#185a9d'], angle: 125, type: 'linear' }
];

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.component.html'
})
export class AppComponent implements OnDestroy {
  readonly presets = PRESETS;
  readonly stops = signal<ColorStop[]>([
    { id: 1, color: '#7c5cff' },
    { id: 2, color: '#23c9a9' }
  ]);
  readonly angle = signal(135);
  readonly gradientType = signal<'linear' | 'radial'>('linear');
  readonly theme = signal<'light' | 'dark'>(this.loadTheme());
  readonly favorites = signal<GradientPreset[]>(this.loadFavorites());
  readonly notice = signal('');
  readonly imagePreview = signal<string | null>(null);
  readonly imageName = signal('');
  readonly imagePalette = signal<string[]>([]);
  readonly extractingImage = signal(false);
  readonly cssValue = computed(() => {
    const colors = this.stops().map((stop) => stop.color).join(', ');
    return this.gradientType() === 'linear'
      ? `linear-gradient(${this.angle()}deg, ${colors})`
      : `radial-gradient(circle, ${colors})`;
  });

  private nextId = 3;
  private noticeTimer: ReturnType<typeof setTimeout> | undefined;
  private imagePreviewUrl: string | undefined;

  constructor() {
    this.applyTheme(this.theme());
    this.loadFromUrl();
  }

  ngOnDestroy(): void {
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.releaseImagePreview();
  }

  toggleTheme(): void {
    const nextTheme = this.theme() === 'light' ? 'dark' : 'light';
    this.theme.set(nextTheme);
    this.applyTheme(nextTheme);
    try {
      localStorage.setItem('gradient-studio-theme', nextTheme);
    } catch {
      this.showNotice('Theme will reset when you close this tab');
    }
  }

  setColor(id: number, event: Event): void {
    const color = (event.target as HTMLInputElement).value.toUpperCase();
    this.stops.update((stops) => stops.map((stop) => stop.id === id ? { ...stop, color } : stop));
  }

  setHexColor(id: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const color = input.value.trim();
    if (!/^#[0-9a-f]{6}$/i.test(color)) {
      input.value = this.stops().find((stop) => stop.id === id)?.color ?? '#000000';
      this.showNotice('Enter a valid 6-digit hex color');
      return;
    }
    const normalized = color.toUpperCase();
    input.value = normalized;
    this.stops.update((stops) => stops.map((stop) => stop.id === id ? { ...stop, color: normalized } : stop));
  }

  addStop(): void {
    if (this.stops().length >= 5) return;
    this.stops.update((stops) => [
      ...stops,
      { id: this.nextId++, color: this.randomColor() }
    ]);
  }

  removeStop(id: number): void {
    if (this.stops().length <= 2) return;
    this.stops.update((stops) => stops.filter((stop) => stop.id !== id));
  }

  setAngle(event: Event): void {
    this.angle.set(Number((event.target as HTMLInputElement).value));
  }

  setType(type: 'linear' | 'radial'): void {
    this.gradientType.set(type);
  }

  async extractPaletteFromImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.showNotice('Choose an image file to extract colors');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.showNotice('Choose an image smaller than 10 MB');
      return;
    }

    this.releaseImagePreview();
    const previewUrl = URL.createObjectURL(file);
    this.imagePreviewUrl = previewUrl;
    this.imagePreview.set(previewUrl);
    this.imageName.set(file.name);
    this.imagePalette.set([]);
    this.extractingImage.set(true);

    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Unable to decode the selected image.'));
        image.src = previewUrl;
      });
      const palette = await Vibrant.from(image).maxColorCount(5).getPalette();
      const colors = Object.values(palette)
        .filter((swatch): swatch is NonNullable<typeof swatch> => swatch !== null)
        .sort((left, right) => right.population - left.population)
        .map((swatch) => swatch.hex.toUpperCase())
        .filter((color, index, allColors) => allColors.indexOf(color) === index)
        .slice(0, 5);

      if (colors.length === 0) {
        throw new Error('No colors were found in this image.');
      }
      this.imagePalette.set(colors);
      this.showNotice(`Found ${colors.length} colors in your image`);
    } catch (error) {
      console.error('Image palette extraction failed', error);
      this.showNotice('Could not read this image. Try another image file.');
    } finally {
      this.extractingImage.set(false);
    }
  }

  applyImagePalette(): void {
    const colors = this.imagePalette();
    if (colors.length === 0) return;
    const gradientColors = colors.length === 1 ? [colors[0], colors[0]] : colors;
    this.stops.set(gradientColors.map((color) => ({ id: this.nextId++, color })));
    this.gradientType.set('linear');
    this.showNotice('Image colors added to your gradient');
  }

  applyPreset(preset: GradientPreset): void {
    this.stops.set(preset.colors.map((color) => ({ id: this.nextId++, color })));
    this.angle.set(preset.angle);
    this.gradientType.set(preset.type);
  }

  randomize(): void {
    const count = this.stops().length;
    this.stops.set(Array.from({ length: count }, () => ({
      id: this.nextId++,
      color: this.randomColor()
    })));
    this.angle.set(Math.floor(Math.random() * 360));
    this.gradientType.set(Math.random() > 0.78 ? 'radial' : 'linear');
  }

  reset(): void {
    this.applyPreset(PRESETS[0]);
  }

  toggleFavorite(): void {
    const current = this.currentPreset();
    const exists = this.favorites().some((item) => this.samePreset(item, current));
    const updated = exists
      ? this.favorites().filter((item) => !this.samePreset(item, current))
      : [current, ...this.favorites()].slice(0, 12);
    this.favorites.set(updated);
    this.saveFavorites(updated);
    this.showNotice(exists ? 'Removed from favorites' : 'Saved to favorites');
  }

  isFavorite(): boolean {
    return this.favorites().some((item) => this.samePreset(item, this.currentPreset()));
  }

  async copyCss(): Promise<void> {
    try {
      await navigator.clipboard.writeText(`background: ${this.cssValue()};`);
      this.showNotice('CSS copied to clipboard');
    } catch {
      this.showNotice('Clipboard unavailable — select and copy the CSS');
    }
  }

  async share(): Promise<void> {
    const url = new URL(window.location.href);
    url.searchParams.set('g', btoa(JSON.stringify({
      c: this.stops().map((stop) => stop.color),
      a: this.angle(),
      t: this.gradientType()
    })));
    try {
      await navigator.clipboard.writeText(url.toString());
      this.showNotice('Share link copied');
    } catch {
      window.history.replaceState(null, '', url);
      this.showNotice('Share link added to the address bar');
    }
  }

  downloadSvg(): void {
    const colorStops = this.stops()
      .map((stop, index) => `<stop offset="${index / (this.stops().length - 1) * 100}%" stop-color="${stop.color}"/>`)
      .join('');
    const rotation = this.angle() - 90;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><defs><linearGradient id="g" x1="0" y1="0.5" x2="1" y2="0.5" gradientTransform="rotate(${rotation} .5 .5)">${colorStops}</linearGradient><radialGradient id="r">${colorStops}</radialGradient></defs><rect width="1200" height="800" fill="url(#${this.gradientType() === 'linear' ? 'g' : 'r'})"/></svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'gradient-studio.svg';
    link.click();
    URL.revokeObjectURL(link.href);
    this.showNotice('SVG downloaded');
  }

  trackStop(_index: number, stop: ColorStop): number {
    return stop.id;
  }

  private currentPreset(): GradientPreset {
    return {
      name: 'Custom',
      colors: this.stops().map((stop) => stop.color),
      angle: this.angle(),
      type: this.gradientType()
    };
  }

  private samePreset(left: GradientPreset, right: GradientPreset): boolean {
    return left.type === right.type
      && left.angle === right.angle
      && left.colors.join(',') === right.colors.join(',');
  }

  private randomColor(): string {
    return `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0').toUpperCase()}`;
  }

  private loadTheme(): 'light' | 'dark' {
    try {
      const savedTheme = localStorage.getItem('gradient-studio-theme');
      if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
    } catch {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private applyTheme(theme: 'light' | 'dark'): void {
    document.documentElement.dataset['theme'] = theme;
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#171821' : '#f6f6f2');
  }

  private releaseImagePreview(): void {
    if (this.imagePreviewUrl) URL.revokeObjectURL(this.imagePreviewUrl);
    this.imagePreviewUrl = undefined;
    this.imagePreview.set(null);
  }

  private showNotice(message: string): void {
    this.notice.set(message);
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => this.notice.set(''), 2600);
  }

  private loadFavorites(): GradientPreset[] {
    try {
      const stored = localStorage.getItem('gradient-studio-favorites');
      return stored ? JSON.parse(stored) as GradientPreset[] : [];
    } catch {
      return [];
    }
  }

  private saveFavorites(favorites: GradientPreset[]): void {
    try {
      localStorage.setItem('gradient-studio-favorites', JSON.stringify(favorites));
    } catch {
      this.showNotice('Browser storage is unavailable');
    }
  }

  private loadFromUrl(): void {
    const encoded = new URLSearchParams(window.location.search).get('g');
    if (!encoded) return;
    try {
      const state = JSON.parse(atob(encoded)) as { c?: unknown; a?: unknown; t?: unknown };
      if (!Array.isArray(state.c) || state.c.length < 2 || state.c.length > 5) return;
      if (!state.c.every((color) => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color))) return;
      this.stops.set(state.c.map((color) => ({ id: this.nextId++, color: color.toUpperCase() })));
      if (typeof state.a === 'number' && Number.isFinite(state.a)) this.angle.set(Math.round(state.a) % 360);
      if (state.t === 'linear' || state.t === 'radial') this.gradientType.set(state.t);
    } catch {
      this.showNotice('That share link could not be loaded');
    }
  }
}
