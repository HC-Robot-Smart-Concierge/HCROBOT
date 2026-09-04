import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const publicPath = (...parts) => resolve(process.cwd(), 'public', ...parts);
const manifest = JSON.parse(readFileSync(publicPath('manifest.json'), 'utf8'));

describe('Robot mobile PWA configuration', () => {
  it('opens the Robot display in standalone landscape mode', () => {
    expect(manifest.start_url).toBe('/?view=robot_display');
    expect(manifest.scope).toBe('/');
    expect(manifest.orientation).toBe('landscape');
    expect(manifest.display).toBe('standalone');
  });

  it('ships the raster icons required by Chromium installation', () => {
    const requiredSizes = ['192x192', '512x512'];
    expect(manifest.icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(requiredSizes));
    for (const icon of manifest.icons) {
      expect(existsSync(publicPath(icon.src.replace(/^\//, '')))).toBe(true);
    }
  });

  it('ships an offline service worker shell', () => {
    const serviceWorker = readFileSync(publicPath('sw.js'), 'utf8');
    expect(serviceWorker).toContain("'/index.html'");
    expect(serviceWorker).toContain("url.pathname.startsWith('/api/')");
  });
});
