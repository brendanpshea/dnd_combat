/**
 * What a rest gave back, drawn as movement rather than as a total.
 *
 * The rest used to be one line — "🍞 Lunch +12 HP · 2 hit dice spent" — which
 * is a correct summary and a poor screen. A player watching a rest wants to see
 * WHOSE bar moved, and a number that only goes up cannot show that a lunch
 * SPENDS something to buy it.
 *
 * So every row is a before-and-after. Hit points fill from the old value to the
 * new one; hit-dice pips grey out as they are spent at lunch and light up again
 * overnight; slot pips relight for whatever Arcane Recovery handed back. The
 * animation is the point — it is the difference between being told a rest
 * happened and watching it happen.
 *
 * THE SAME COMPONENT IN THREE PLACES, because they are the same event seen at
 * three moments: inline on the loot screen after a morning (lunch), on its own
 * screen at daybreak after a won day, and on the defeat screen after a lost one
 * — where the night happens whether you won or not, and used to go unmentioned.
 *
 * Deliberately not gated behind the animation. This is seen ten times in a run,
 * so every Continue near it stays live from the first frame; the bars simply
 * finish or they do not.
 */
import { useEffect, useState } from 'react';
import type { HeroRest } from '../../src/arena/day.js';

/** How long the bars take to travel. Short: it is watched, not read. */
const FILL_MS = 620;

export function RestLedger({ rows, kind }: { rows: HeroRest[]; kind: 'lunch' | 'night' }) {
  // Start on the BEFORE values and move to the AFTER ones a frame later, so the
  // CSS transition has something to animate from. Rendering the final state and
  // hoping for a transition draws nothing at all.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className={`rest-ledger ${kind}`}>
      {rows.map((r) => {
        const hp = settled ? r.hp.to : r.hp.from;
        const dice = settled ? r.hitDice.to : r.hitDice.from;
        const slots = settled ? r.slots.to : r.slots.from;
        const healed = r.hp.to - r.hp.from;
        const diceDelta = r.hitDice.to - r.hitDice.from;
        const slotDelta = r.slots.to.reduce((n, v, i) => n + v - (r.slots.from[i] ?? 0), 0);
        return (
          <div className="rest-row" key={r.name}>
            <span className="rest-name">{r.name}</span>
            <span className="rest-bar" aria-label={`${hp} of ${r.hp.max} hit points`}>
              <span
                className={`rest-bar-fill${r.hp.to === r.hp.max ? ' full' : ''}`}
                style={{ width: `${(hp / Math.max(1, r.hp.max)) * 100}%`, transitionDuration: `${FILL_MS}ms` }}
              />
              <span className="rest-bar-text">{hp}/{r.hp.max}</span>
            </span>
            <span className="rest-deltas">
              {healed > 0 && <b className="gain">+{healed}</b>}
              {/* A spend is shown as a loss, because it is one. This is the
                  whole reason lunch and night look different. */}
              {diceDelta !== 0 && (
                <b className={diceDelta > 0 ? 'gain' : 'loss'}>
                  🎲{diceDelta > 0 ? `+${diceDelta}` : diceDelta}
                </b>
              )}
              {slotDelta > 0 && <b className="gain">✨+{slotDelta}</b>}
            </span>
            <span className="rest-pips">
              {/* Hit dice: filled to what is left, hollow for what is gone. */}
              {Array.from({ length: Math.min(9, r.hitDice.max) }, (_, i) => (
                <i key={`d${i}`} className={`rest-pip die${i < dice ? ' on' : ''}`} />
              ))}
              {slots.some((n, i) => n > 0 || (r.slots.from[i] ?? 0) > 0) && (
                <span className="rest-pip-gap" />
              )}
              {slots.flatMap((count, level) => {
                const most = Math.max(count, r.slots.from[level] ?? 0);
                return Array.from({ length: most }, (_, i) => (
                  <i key={`s${level}-${i}`} className={`rest-pip slot${i < count ? ' on' : ''}`} />
                ));
              })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
