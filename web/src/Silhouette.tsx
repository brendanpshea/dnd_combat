import { silhouettePath } from './silhouettePlan.js';
import { SILHOUETTE_BOX } from './silhouettes.js';

/**
 * The abstract shape a creature shows while its art is in flight, or forever if
 * it has none.
 *
 * Inline SVG rather than an `<img>`, for two reasons that both matter. It can
 * be tinted — `fill="currentColor"` picks up the team colour from CSS, and on a
 * board where you cannot yet tell what anything is, whose it is comes first.
 * And it needs no request: this is the fallback for a slow connection, and a
 * fallback that must itself be downloaded arrives exactly when it is no longer
 * needed.
 *
 * `aria-hidden`, always. The shape carries no information a screen reader
 * wants; the label belongs to whatever wraps it, which already has one.
 */
export function Silhouette({ id }: { id: string }) {
  return (
    <svg viewBox={`0 0 ${SILHOUETTE_BOX} ${SILHOUETTE_BOX}`} aria-hidden="true" focusable="false">
      <path d={silhouettePath(id)} fill="currentColor" />
    </svg>
  );
}
