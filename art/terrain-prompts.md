# Blocking Prop Prompts — the things that *sit on* the terrain

Companion to `art/prompts.md` (characters/monsters) and
`art/arena-prompts.md` (the six painted backdrops).

**We are not redrawing terrain.** The painted backdrops stay exactly as they
are, the floor stays as it is, and the lava and marsh effects stay as CSS.
The only things being drawn are the **objects that block you** — walls and
barricades — which today are CSS gradients pretending to be objects and read
as UI buttons because of it.

**24 assets, 6 sheets.** One 2×2 sheet per map theme, four props each:
two wall variants and two barricade variants.

---

## 0. Why this revises an earlier decision

`art/arena-prompts.md` §0 put terrain art out of scope, and the reasoning
was sound as far as it went:

> Reproducing that with generated tile art would mean an auto-tiling set
> (edge/corner/transition pieces — 15–47 tiles per terrain pair) just to
> butt tiles together without visible seams.

That objection applies to **fields** — floor that has to meet other floor
without a seam. It does not apply to **props**: discrete objects that sit
on a cell with the painted backdrop showing around them. A row of five
bushes in *A Link to the Past* is one bush sprite drawn five times; there
are no corner pieces, because nothing has to join up.

That single reframing is what turns this from a 200-asset auto-tiling job
into a 24-asset prop job, and it is why the earlier call is being revised
rather than overturned. The backdrops stay exactly as they are. These props
sit on top of them.

## 1. What we are *not* drawing, and why

**Hazard and difficult ground stay CSS.** They are effects, not objects: a
lava pool glows and a marsh shimmers, and animated light is something CSS
does well and a static PNG does badly. On the contact sheet
(`npx tsx scripts/terrain-sheet.ts`) they are already the two terrains that
read at 34px. Leave them alone.

The problem is **walls and barricades**, which are objects pretending to be
gradients. Those are all we are drawing.

## 2. What is wrong with the current tiles, since the fix depends on it

Generate the contact sheet and look at stone at 34px before reading on.

1. **They glow.** Every wall carries `drop-shadow(0 0 1.1px #e8e4f0)` twice
   — a near-white halo. Nothing in a 16-bit tileset glows; objects have
   **dark** contours, and a light halo is the visual grammar of *selection*.
   The eye correctly files these as UI chrome.
2. **They are rounded and bevelled.** `border-radius: 5px` plus
   `inset 2px 2px 0 #ffffff36` is, almost exactly, the CSS recipe for a
   raised button.
3. **They are softly graduated.** A two-stop `linear-gradient(150deg, …)`
   is a smooth ramp, and smooth ramps dissolve into flat mush at 34px. Hard
   edges survive downscaling; gradients do not.
4. **They are lighter than the floor.** In 16-bit art a solid blocker is
   equal or darker in value than the ground, with only its **top face**
   catching light. Uniformly lighter reads as "highlighted".
5. **Ember's are simply broken** — pale six-pointed asterisks that read as
   snowflakes on a lava field.

Every rule in §3 is one of these, inverted.

## 3. Style preamble (copy verbatim into every prompt)

> 16-bit SNES-era game sprite of a single object, drawn as pixel-adjacent
> cel art — flat colour regions with hard edges, **not** smooth gradients or
> soft airbrushing. Bold dark contour line (near-black, not pure black)
> around the entire silhouette. Three to four flat value steps only: a lit
> **top face**, a mid-tone **front face**, a dark base, and one small
> highlight. Light comes from the upper left, consistently. Slight
> three-quarter overhead view — the top surface of the object is visible, so
> its height reads as height rather than as shading. Chunky, readable,
> confident shapes; no fine detail, no texture noise, no lens effects, no
> glow, no outer light halo, no drop shadow into the background. Muted
> fantasy palette, saturated enough to sit apart from the ground it stands
> on. No text, no watermark, no border, no grid lines.

The character art is chibi/cel-shaded; these should feel like objects from
the same world at the same scale — a barricade a chibi fighter could crouch
behind.

## 4. Technical spec (append to every prompt)

> Square canvas 1024×1024, arranged as a 2×2 grid of four separate objects,
> one per quadrant, each centred in its own 512×512 quadrant with clear
> space around it. Flat **chroma-green** background (#00b140), fully
> uniform, no gradient and no green spill or green rim light on the objects
> themselves. Each object fully inside its quadrant, not touching the edges
> or bleeding into a neighbouring quadrant. Bake a small, tight contact
> shadow directly beneath each object — a dark ellipse hugging its base, not
> a soft cast shadow stretching away.

The green background is not decoration: `scripts/process_grid.py` keys it
out (`greenness = g - max(r, b)`), crops each quadrant to its bounding box,
and scales to `target_pct`. Green spill on a wet-looking bog hummock or a
mossy stone is the one failure mode that ruins a sheet.

## 5. The sheets

Four props per theme. **Two wall variants**, because a run of six identical
sprites down a map edge reads as wallpaper — `styles.css` already varies
props by cell parity (`nth-child(3n)`), so alternating two is nearly free
and kills the repetition. Then a barricade, then a second barricade variant.

### Silhouette rules — the whole mechanic rides on these

The one distinction a player must never get wrong:

| | **Wall** | **Barricade** |
|---|---|---|
| rule | blocks movement **and** sight | blocks movement, **+2 AC**, shoot over it |
| height | **tall** — fills the cell, top edge near the top | **low** — chest-high, occupying the lower ~55% |
| floor visible | almost none | **yes, clearly, above it** |
| silhouette | solid mass, roughly square | **wide horizontal bar**, wider than tall |
| top face | small, seen edge-on | **broad and clearly lit** — you look down onto it |

If a player can tell these two apart from across the room with the screen
squinted at, the brief has succeeded. Everything else is flavour.

---

### Sheet 1 — `stone` (ruined masonry)

Quadrants, clockwise from top-left:

1. **`terrain-wall-stone-a`** — A block of broken mortared masonry, roughly
   cubic, filling its space. Weathered grey-lavender stone with visible
   courses of brick, one corner crumbled away, a lit top surface of flat
   cut stone. Solid and immovable.
2. **`terrain-wall-stone-b`** — The same masonry, differently broken: taller
   on the left, a diagonal collapse to the right, a few loose blocks at the
   base.
3. **`terrain-cover-stone-a`** — A **low** wall of stacked stone, chest-high,
   much wider than it is tall, with a broad flat lit top you could rest a
   crossbow on. Rubble at its foot.
4. **`terrain-cover-stone-b`** — The same low wall, partly tumbled: one end
   intact, the other collapsed to half height.

### Sheet 2 — `forest` (undergrowth)

1. **`terrain-wall-forest-a`** — A dense round shrub, dark olive-green, made
   of clumped leaf masses with a lit upper canopy. Opaque — you cannot see
   through it. A hint of brown trunk at the base.
2. **`terrain-wall-forest-b`** — A second shrub, lopsided, with a bare
   broken branch protruding and a lighter yellow-green cluster on one side.
3. **`terrain-cover-forest-a`** — A **low** fallen log lying horizontally,
   chest-high, bark-textured, the sawn end facing the viewer, moss along the
   lit upper surface. Clearly something you crouch behind, not something you
   hide inside.
4. **`terrain-cover-forest-b`** — A low thicket of brambles and stacked
   deadfall, wide and flat-topped, twigs bristling from the top edge.

### Sheet 3 — `graveyard` (memorial stone)

1. **`terrain-wall-graveyard-a`** — A tall standing tomb marker, a slab of
   pale cold granite, slightly tilted, lichen-stained at the base, its top
   edge catching light.
2. **`terrain-wall-graveyard-b`** — A cracked stone obelisk, narrower, with a
   split running down it and a chunk missing from one shoulder.
3. **`terrain-cover-graveyard-a`** — A **low** stone sarcophagus lying
   lengthwise, chest-high, its heavy carved lid pushed half aside and lit
   along the top.
4. **`terrain-cover-graveyard-b`** — A low run of iron cemetery railing on a
   stone kerb: dark bars, a lit stone base, wide and clearly see-through
   above waist height.

### Sheet 4 — `ember` (volcanic rock)

This is the theme that is worst today. Basalt, **not** starbursts.

1. **`terrain-wall-ember-a`** — A jagged spire of near-black basalt, angular
   and faceted, with a molten orange crack glowing deep inside one fissure.
   The rock reads dark; only the crack is bright.
2. **`terrain-wall-ember-b`** — A blockier chunk of cooled lava, dark and
   pitted, its top crusted grey-white with ash, a faint ember glow at the
   base.
3. **`terrain-cover-ember-a`** — A **low** ridge of hardened lava flow,
   chest-high, wide, its top surface a cracked crust with dull orange
   showing through the seams.
4. **`terrain-cover-ember-b`** — A low barricade of blackened iron plate
   staked into scorched ground, heat-warped, glowing faintly along the
   bottom edge.

### Sheet 5 — `village` (market square)

1. **`terrain-wall-village-a`** — A market stall: a peaked striped canvas
   awning in faded red and cream over a plank counter, solid enough to block
   the way through.
2. **`terrain-wall-village-b`** — A stack of crates and barrels, wooden,
   roped together, tall enough to block sight.
3. **`terrain-cover-village-a`** — A **low** overturned handcart, chest-high,
   wide, one wheel visible, its flat underside facing you.
4. **`terrain-cover-village-b`** — A low run of wooden fence railing on
   posts, wide and flat-topped, with a water trough at one end.

### Sheet 6 — `bog` (wet ground)

1. **`terrain-wall-bog-a`** — A mossy hummock heaving out of black water:
   wet, dark, rounded, slick highlights on its upper curve, reeds sprouting
   from the crown.
2. **`terrain-wall-bog-b`** — A dead tree stump, waterlogged and black, roots
   splayed, fungus shelving out of one side.
3. **`terrain-cover-bog-a`** — A **low** bank of packed peat and root,
   chest-high, wide, its top edge fringed with wet grass, water pooling at
   its foot.
4. **`terrain-cover-bog-b`** — A low tangle of half-sunk driftwood and
   lashed branches, wide and flat, pale bleached wood against dark water.

---

## 6. Acceptance test

Not "does it look nice at 512" — the game never shows it at 512.

1. Run the sheet through `scripts/process_grid.py` with a config of the four
   names and `target_pct` (walls `0.98`, barricades `0.95`).
2. Drop the PNGs into `web/public/art/`.
3. Regenerate the contact sheet and screenshot it:

   ```
   npx tsx scripts/terrain-sheet.ts
   /opt/pw-browsers/chromium-1194/chrome-linux/chrome --headless --disable-gpu \
     --no-sandbox --hide-scrollbars --force-device-scale-factor=2 \
     --window-size=1500,5200 --screenshot=docs/terrain-sheet.png \
     file://$PWD/docs/terrain-sheet.html
   ```

4. Look at the **34px row**. Three questions, in order:
   - Is the wall obviously taller and more solid than the barricade?
   - Can you see floor above the barricade and not above the wall?
   - Does either one still look like a button?

If the answer to the third is yes, the contour is not dark enough or the
values are too close to the floor.

## 7. Integration notes

- **Config**: add each name to a `scripts/terrain_config.json` in the same
  shape the token configs use — `{ "name": "terrain-wall-stone-a.png",
  "type": "token", "target_pct": 0.98 }`.
- **Registry**: `web/src/art-registry.ts` is generated from the art folder
  (`npm run art-registry`), and a test holds it to that. It will need a
  `HAS_TERRAIN_ART` set alongside the existing ones.
- **CSS**: the per-theme `::before` rules in `styles.css` become
  `background-image` instead of layered gradients. Keep the CSS versions as
  the fallback for any theme whose art has not landed — the board must never
  render a blank cell where a wall should be.
- **The token layer**: `.token-layer` is a single absolute layer over the
  whole board, so tokens always draw above terrain and a barricade can never
  overlap the figure standing behind it. That is the strongest height cue in
  2D games and it is currently unavailable to us at any art quality. Worth
  fixing whether or not this art gets made; if it is fixed first, barricade
  sprites should be drawn expecting a token to overlap their lower third.
