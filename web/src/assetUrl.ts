/**
 * Where a relative art URL actually points.
 *
 * `BASE` is `./` — the app deploys to a GitHub Pages subpath, so nothing may be
 * rooted at `/`. A relative URL is then resolved against whatever document or
 * stylesheet it ends up inside, and those are not the same place.
 *
 * The board cannot style a `::after` inline, so it hands its drawn blocking
 * props and its Web overlay to CSS in a custom property, which `styles.css`
 * consumes with `background: var(--prop)`. A relative `url()` in a custom
 * property is resolved against the STYLESHEET that uses it, not the element
 * that set it — so `url(./art/terrain/terrain-wall-village-a.svg)`, set on a
 * cell in the document, resolved to `/assets/art/terrain/…` and 404ed. Every
 * drawn tile, on every themed board.
 *
 * It only ever broke in the built app. In dev, Vite injects the CSS as a
 * `<style>` element whose base URL *is* the document, so the terrain rendered
 * correctly every single time anyone looked at it.
 *
 * Lives apart from `art.ts` so the node test suite can import it: `art.ts`
 * reads `import.meta.env`, which is a Vite type the repo-wide typecheck has no
 * business knowing about. Same reason `odds.ts` is its own file.
 */

/** Resolve `path` against `baseHref`, yielding an unambiguous absolute URL. */
export function resolveAsset(path: string, baseHref: string): string {
  return new URL(path, baseHref).href;
}

/**
 * The same, against the current document.
 *
 * Outside a browser there is nothing to resolve against and nothing that can
 * break, so the raw path is the honest answer.
 */
export function assetUrl(path: string): string {
  return typeof document === 'undefined' ? path : resolveAsset(path, document.baseURI);
}
