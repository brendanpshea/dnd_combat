/**
 * The player-facing "what does this do?" card. An `<InfoDot>` is a tiny ⓘ button
 * you drop next to any item or spell; tapping it opens `<InfoCard>`, a small
 * modal that reads its stats + blurb from `infoFor`/`spellSheet` (see
 * gameInfo.ts). One component serves camp, shop, and the spell tray.
 */
import { useState } from 'react';
import { infoFor, spellSheet, type InfoSheet } from './gameInfo.js';

/** A little ⓘ button. Tapping opens the card for `sheet`; does nothing if null. */
export function InfoDot({ sheet, label }: { sheet: InfoSheet | null; label?: string }) {
  const [open, setOpen] = useState(false);
  if (!sheet) return null;
  return (
    <>
      <button
        className="info-dot"
        aria-label={label ?? `About ${sheet.name}`}
        title={label ?? `About ${sheet.name}`}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      >
        ⓘ
      </button>
      {open && <InfoCard sheet={sheet} onClose={() => setOpen(false)} />}
    </>
  );
}

/** The ⓘ dot for a game item/weapon/armour/consumable id (or nothing if unknown). */
export function ItemInfoDot({ itemId }: { itemId: string }) {
  return <InfoDot sheet={infoFor(itemId)} />;
}

/** The ⓘ dot for a spell id. */
export function SpellInfoDot({ spellId }: { spellId: string }) {
  return <InfoDot sheet={spellSheet(spellId)} />;
}

export function InfoCard({ sheet, onClose }: { sheet: InfoSheet; onClose: () => void }) {
  return (
    <div className="info-scrim" onClick={onClose}>
      <div className="info-card" onClick={(e) => e.stopPropagation()}>
        <div className="info-card-head">
          <span className="info-card-icon">{sheet.icon}</span>
          <div>
            <strong>{sheet.name}</strong>
            <div className="info-card-kind">{sheet.kind}</div>
          </div>
          <button className="ghost" onClick={onClose}>✕</button>
        </div>
        {sheet.stats.length > 0 && (
          <div className="info-card-stats">
            {sheet.stats.map((s, i) => (
              <div key={i} className="info-card-stat">
                <span className="info-card-stat-label">{s.label}</span>
                <span className="info-card-stat-value">{s.value}</span>
              </div>
            ))}
          </div>
        )}
        <p className="info-card-blurb">{sheet.blurb}</p>
      </div>
    </div>
  );
}
