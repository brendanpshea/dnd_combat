/**
 * Where a relative art URL actually points.
 *
 * The board cannot style a `::after` inline, so it hands the drawn blocking
 * prop to CSS in a custom property and `styles.css` consumes it with
 * `background: var(--prop)`. The catch is that a relative `url()` inside a
 * custom property is resolved against the STYLESHEET that uses it, not the
 * element that set it. `BASE` is `./`, because the app deploys to a GitHub
 * Pages subpath and nothing may be rooted at `/` — so
 *
 *     url(./art/terrain/terrain-wall-village-a.svg)
 *
 * set on a cell in the document resolved to
 *
 *     /assets/art/terrain/terrain-wall-village-a.svg
 *
 * and 404ed. Every drawn tile, on every themed board.
 *
 * It only ever broke in the built app: in dev, Vite injects the CSS as a
 * `<style>` element whose base URL is the document, so the terrain rendered
 * correctly every single time anyone looked at it. It was found by driving the
 * production build and watching for 404s, which is the only way it could have
 * been found.
 *
 * The fix is that art URLs are absolute. What is testable in node is the
 * resolution itself, and that is what these pin: the shape of the mistake, and
 * that resolving against the document is what corrects it.
 */
import { describe, it, expect } from 'vitest';
import { resolveAsset } from '../web/src/assetUrl.js';

const CSS = 'http://example.test/game/assets/index-abc123.css';
const DOC = 'http://example.test/game/';
const PROP = './art/terrain/terrain-wall-village-a.svg';

describe('resolving an art path', () => {
  it('lands beside the page, not beside the stylesheet', () => {
    expect(resolveAsset(PROP, DOC)).toBe('http://example.test/game/art/terrain/terrain-wall-village-a.svg');
  });

  it('is the fix for a real 404: the same path against the stylesheet misses', () => {
    // Not a test of our code — a record of what the browser was doing, and why
    // handing CSS a relative URL was the bug.
    expect(new URL(PROP, CSS).href).toBe(
      'http://example.test/game/assets/art/terrain/terrain-wall-village-a.svg',
    );
    expect(new URL(PROP, CSS).href).not.toBe(resolveAsset(PROP, DOC));
  });

  it('keeps the deploy subpath, which is why the path is relative at all', () => {
    // Rooting these at `/` would be the other obvious fix and would break the
    // GitHub Pages deploy, where the app does not own the origin.
    expect(resolveAsset(PROP, 'http://example.test/dnd_combat/'))
      .toBe('http://example.test/dnd_combat/art/terrain/terrain-wall-village-a.svg');
  });

  it('is unambiguous once absolute, wherever it is then used', () => {
    const absolute = resolveAsset(PROP, DOC);
    expect(new URL(absolute, CSS).href).toBe(absolute);
    expect(new URL(absolute, DOC).href).toBe(absolute);
  });
});
