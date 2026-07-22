# Arena Background Prompts — D&D Grid Combat

Companion to `art/prompts.md` (which covers characters/monsters and
explicitly puts terrain **out of scope**, calling it "hand-authored
SVG/CSS"). This doc revises that call for one specific, low-risk piece:
a **generated background image per map theme**, sitting behind the
existing CSS grid — not a modular per-cell tileset.

## 0. Why a background, not a tileset

The board (`web/src/Board.tsx`) composes terrain per-cell at runtime: walls,
difficult ground, hazards, and illusion overlays can appear in any
combination on any of the 8×8 cells, and `web/src/styles.css` already draws
all of that (bevelled wall blocks, glowing lava, watery bog) as CSS
gradients keyed by theme class (`theme-stone`, `theme-forest`,
`theme-graveyard`, `theme-ember`). Reproducing that with generated tile art
would mean an auto-tiling set (edge/corner/transition pieces — 15–47 tiles
per terrain pair) just to butt tiles together without visible seams. That's
a lot of generation and QA for a payoff that's easy to get wrong.

A **single painterly backdrop per theme**, rendered once behind the grid,
sidesteps the tiling problem entirely and still gets most of the visual
lift: the grid and all its dynamic terrain logic stay exactly as they are;
the image just gives the "floor" underneath more atmosphere than a flat
CSS color.

**Six assets** — one per `MapTheme` (`src/data/maps.ts`), reused across the
maps that share a theme (`open`/`marsh` → forest, `ruins` → stone,
`firepit` → ember, `corridor` → graveyard, `village` → village,
`bog` → bog). All six theme backdrops are now generated and integrated.

---

## 1. Style preamble (copy verbatim into every prompt)

The character set is chibi/cel-shaded (see `art/prompts.md` §2–3); the
environment shouldn't compete with it or look photoreal, but it can be a
notch more painterly since it's blurred/darkened behind gameplay UI.

> Top-down (bird's-eye / overhead) game battle-mat background, painterly
> digital illustration with clean cel-shaded texture — no photorealism, no
> 3D render look. Even, soft top-down lighting, no strong directional
> shadows (shadows would fight the grid's own lighting). Muted, slightly
> desaturated cozy palette — rich enough to read as a place, restrained
> enough that colorful character tokens and UI highlights stay legible on
> top. No text, no watermark, no border frame, no vignette drawn into the
> image (the app adds its own edge fade). Perfectly flat overhead
> perspective — no isometric or angled tilt, no objects tall enough to
> occlude tokens standing on the ground.

## 2. Technical spec (append to every prompt)

> Square canvas, 2048×2048, PNG or high-quality JPEG. Seamless/edge-safe:
> keep strong focal detail (rubble piles, tree clusters, headstones,
> cracked earth) loosely scattered and away from a perfect grid pattern of
> their own, since a real 8×8 gameplay grid will be composited on top and
> should not visually collide with a busy printed pattern underneath.
> Overall value (lightness) should stay in a fairly narrow mid-dark range
> edge-to-edge — no bright corner and dark corner — so no part of the board
> reads as spotlit versus shadowed.

## 3. Per-theme prompts

**Stone** (`theme-stone`, map: `ruins` — Walled Ruins)
> Subject: weathered ancient stone ruin floor, seen from directly above —
> large cracked flagstones in cool grey with moss in the seams, a few
> scattered rubble chunks and broken column stumps (kept low and roughly
> around the board's edges rather than centered, so they don't read as
> occupying a specific gameplay cell). Base color family: cool stone greys
> (`#6b6480`–`#453f5c` range) matching the existing wall palette used
> elsewhere in the game.

**Forest** (`theme-forest`, maps: `open` — Open Field, `marsh` — Misty Marsh)
> Subject: a forest clearing floor from directly above — dense short grass
> and moss in mixed greens, dappled leaf-litter texture, a few scattered
> fallen leaves and small stones, hints of exposed dark earth. Base color
> family: warm-to-cool greens (`#46693c`/`#3d5d34` range) matching the
> existing forest cell palette. Keep the ground itself dry-looking in this
> pass (the marsh's watery bog is drawn dynamically by the app on top of
> whichever cells need it).

**Graveyard** (`theme-graveyard`, map: `corridor` — The Corridor)
> Subject: an old graveyard/crypt courtyard floor from directly above —
> weathered grey cobble and packed dirt, thin cracks, a light scatter of
> dead leaves, maybe one or two low mossy headstones pushed toward the
> edges. Cool desaturated greys (`#3b4048`/`#343941` range), faint cold
> undertone, no fog or mist baked in (the app renders grave-mist
> dynamically on specific cells).

**Ember** (`theme-ember`, map: `firepit` — Fire Pit Arena)
> Subject: a scorched volcanic arena floor from directly above — dark
> cracked basalt rock with a warm reddish-brown undertone, faint dried
> ash texture, a few dark cinder chunks. Base color family: warm dark
> browns (`#4a3630`/`#412e29` range). Keep this pass ember-free and
> unlit — no glow, no molten cracks (the app renders the animated lava
> hazard glow dynamically on specific cells; a pre-lit background would
> double up and clash).

**Village** (`theme-village`, map: `village` — Market Square)
> Subject: a cobbled town-square plaza floor from directly above — fitted
> paving stones and packed dirt lanes in warm neutral tones, worn smooth in
> the middle from foot traffic, a light scatter of straw, spilled produce,
> and a stray cart-rut toward the edges. Base color family: warm tan-greys
> (`#7a6e60`/`#5e5448` range) matching the village cell palette. No stalls,
> awnings, or crates drawn in (those are the CSS-drawn walls); the plaza
> floor itself should stay open and plain through the middle.

**Bog** (`theme-bog`, map: `bog` — The Black Ford)
> Subject: a marsh causeway floor from directly above — a dry central line
> of packed dark earth and matted reeds threading between wet ground, mossy
> green-black mud, a few tussocks of grass toward the edges. Base color
> family: dark desaturated greens (`#3a5440`/`#304636` range) matching the
> bog cell palette. Keep the open channels of black water OUT of this pass —
> the app draws the deep-water "difficult" tiles dynamically on top; the
> backdrop is just the darker, wetter ground they sit in.

## 4. QA checklist

- [ ] **Flat overhead** — no perspective tilt, no tall objects that would
      look like they're occluding a token standing near them.
- [ ] **Even value range** — no corner noticeably brighter/darker than
      another; a translucent grid needs uniform legibility everywhere.
- [ ] **Calm center** — busiest detail (rubble, headstones, tree clusters)
      stays loose and edge-biased; the middle, where most of the fighting
      happens, stays relatively plain.
- [ ] **No baked-in dynamic elements** — no lava glow, no mist, no puddles;
      those terrain types already render in CSS and must stay editable
      per-cell.
- [ ] **Palette matches** the theme's existing hex range so the generated
      backdrop and the CSS-drawn walls/hazards/highlights don't clash.
- [ ] **Tileable-enough at the edges** — if the board is ever framed with
      repeated/mirrored edge padding, no obvious hard seam.

---

## 5. Integration

Mirrors the existing character-art pipeline (`art/prompts.md` §7,
`art/process.py`) so there's one consistent asset workflow in the repo.

1. **Generate** the four images above; save sources as
   `art/source/bg-stone.png`, `art/source/bg-forest.png`,
   `art/source/bg-graveyard.png`, `art/source/bg-ember.png`.
2. **Process**: extend `art/process.py` with a second pass (or a small
   sibling script) that downsizes these to a web-appropriate size (e.g.
   1024×1024 — larger than character art since it fills the whole board)
   and emits WebP into `web/public/art/`, same as tokens/portraits:
   `bg-stone.webp`, `bg-forest.webp`, `bg-graveyard.webp`, `bg-ember.webp`.
3. **Wire into CSS** (`web/src/styles.css`): give `.board.theme-<x>` a
   `background-image` pointing at the processed asset (`background-size:
   cover`, `background-position: center`), keeping the existing
   `background: #hex` as the fallback color underneath (and as the actual
   render if that theme's WebP is missing — same "art absent → graceful
   fallback" pattern `web/src/art.ts` uses for tokens).
4. **Let the grid read on top**: give `.cell` a slight translucency (or an
   `rgba()` background instead of opaque hex) so the backdrop shows through
   between/under cells rather than being fully hidden by them — tune the
   alpha per theme so checkerboard contrast, terrain badges (💧/🔥), and
   highlight rings (`hl-move`, `hl-enemy`, etc.) all stay readable. This is
   the one part worth actually eyeballing in-browser rather than guessing
   a value up front.
5. **Leave walls/hazards/difficult terrain exactly as they are** — those
   stay 100% CSS-drawn on top of the new backdrop; nothing in `Board.tsx`
   or the terrain logic changes.
6. **Gate on the `HAS_BOARD_BG` set** (`web/src/art.ts`) — the implementation
   diverged from the original "pure CSS" plan: `Board.tsx` sets the backdrop
   inline via `boardBgUrl(theme)`, but only for themes listed in the
   `HAS_BOARD_BG` allowlist; a theme not in the set renders on its flat
   `background:` colour alone. So a new backdrop ships in three steps: drop
   `bg-<theme>.webp` into `web/public/art/`, add the theme to `HAS_BOARD_BG`,
   done. `village` and `bog` are now included in the set.

Total assets: **6 images** (all 6 generated), not
dozens — this is why the background approach is worth doing where a full
tileset likely isn't.
