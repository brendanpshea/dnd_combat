import type { TeamId } from '../../src/engine/types.js';
import { hasArt, portraitUrl } from './art.js';

/** Circular character portrait; renders nothing if there's no art for the id. */
export function Portrait({ id, team, big, label }: { id: string; team: TeamId; big?: boolean; label?: string }) {
  if (!hasArt(id)) return null;
  return (
    <img
      className={`portrait ${team} ${big ? 'big' : ''}`}
      src={portraitUrl(id)}
      alt={label ?? ''}
      draggable={false}
    />
  );
}
