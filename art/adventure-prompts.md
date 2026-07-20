# Adventure Art Prompts — Locations & NPCs

Companion to `art/prompts.md` (characters/monsters) and `art/arena-prompts.md`
(top-down battle backdrops). This doc covers the art **adventure mode** needs:
the illustrated backdrops behind story/exploration scenes and the portraits of
the people you meet.

## 0. The one idea: reuse by category, never per-scene

The whole design bet — the same one behind "one backdrop per combat theme" —
is that **adventure art is keyed to reusable categories, not individual
scenes.** A tavern is a tavern in every module; a bandit is a bandit. So we
generate:

- **~21 location scenes**, one per *setting type* (village, tavern, forest,
  marsh, dungeon, throne room…), reused across every module's scenes of that
  type; and
- **~16 NPC portraits**, one per *archetype* (innkeeper, guard, merchant,
  bandit, captain, cultist…), reused for every module's NPC of that role.

A module never ships bespoke art. It names a category id and gets the art for
free — which means **every future adventure is art-complete the moment it's
written**, and the total asset count stays fixed no matter how many modules
exist. The id list is the single source of truth in
[`src/data/adventure-art.ts`](../src/data/adventure-art.ts); every id below
matches an entry there, and both the app and the module *validator* read that
file (a module that names an unknown location/archetype fails validation).

**Status legend:** ✅ generated and wired (`HAS_SCENE_ART` / `HAS_NPC_ART` in
`web/src/art.ts`) · ⬜ needed (still on the emoji fallback). As of this writing
**everything here is ⬜** — the app renders a themed emoji glyph for every
location and NPC until these are generated, so the game is fully playable now
and gets richer per asset, in any order.

---

## 1. How to use this doc

1. Pick a family (§3 Locations or §4 NPCs) and copy its **style preamble**.
2. Append one asset's **subject line**.
3. Append the family's **technical spec**.
4. Generate. Lock the look with the first strong result and chain it as a
   style/reference image for the rest of that family, so the set stays cohesive
   (same lesson as `art/prompts.md`).
5. Save the source with the exact filename in the **integration table** (§5).
6. Run the processor (§6) and add the id to the matching `HAS_*` set in
   `web/src/art.ts`.

You do **not** have to do all of them at once. Generate a few, wire them, ship;
the rest keep falling back to emoji. Prioritize by what your first real modules
use most (village, tavern, forest, dungeon, and the innkeeper/guard/bandit/
captain archetypes cover a huge fraction).

---

## 2. Art direction

Two families, two looks — but one world.

- **NPC portraits reuse the character style verbatim.** They are chibi busts in
  exactly the style bible of `art/prompts.md` §2–3 (super-deformed, cel-shaded,
  warm-brown ink outline, transparent background), so the people you *talk* to
  match the heroes you *fight* with. Follow that doc's **cast-diversity rule**
  (do not default to young/pale/Western/male; vary skin tone, gender, age, and
  heritage across the set) — each subject line below fixes a specific identity
  to keep the ensemble balanced.

- **Location scenes are a notch more painterly**, like the arena backdrops
  (`art/arena-prompts.md`) but seen from **eye level, not overhead** — these are
  places you stand *in*, not maps you fight *on*. They sit behind UI (a story
  panel or a node map with markers on top), darkened by an app-drawn scrim, so
  they read as atmosphere, not the focus. Keep them cel-shaded and cohesive with
  the character set; no photorealism.

Shared palette anchors (accents, not per-pixel): `#ffd166` gold · `#6ee7a0`
green · `#ff9d4d` warm orange · `#9be2ff` ice · `#c084fc` arcane purple, over
warm cozy mid-tones that pop on the app's dark chrome (`#1a1625`).

---

## 3. Location scenes

### Style preamble (copy verbatim)

> Fantasy location illustration, eye-level establishing shot of a *place* (no
> characters, no people). Modern JRPG / YA-graphic-novel style, clean
> cel-shaded cartoon — flat colors, soft shadow tones, confident dark
> warm-brown ink linework (#2a2333), a light painterly texture but no
> photorealism and no 3D-render look. Warm, cozy, slightly desaturated palette,
> rich enough to read as a place yet restrained enough that bright UI markers
> and text stay legible on top. Even, gentle lighting — no harsh spotlight, no
> lens flare. Cohesive with a chibi cel-shaded character set. No text, no
> watermark, no UI, no border frame, no people or creatures.

### Technical spec (append to every location prompt)

> Landscape 16:9 canvas, 1536×864 (or 1600×900). Compose with an **open,
> uncluttered middle band** and calmer center — the app overlays a story panel
> or tappable node markers, and darkens the image with a scrim, so keep the
> focal interest loose and toward the edges/horizon. Even value across the
> frame (no bright corner vs dark corner). PNG or high-quality JPEG.

### Subjects (id → prompt subject)

Each id matches `LOCATION_ART` in `src/data/adventure-art.ts`.

- **`loc-village`** — a small rural village square at golden hour: timber-framed
  cottages with thatched roofs, a stone well, a market cross, hills beyond.
  Welcoming, lived-in, a little worn.
- **`loc-town`** — a larger walled-town street: taller stone-and-timber
  buildings, hanging shop signs, a cobbled lane climbing toward a keep on a
  rise. Busier, prosperous.
- **`loc-tavern`** — a warm tavern interior: hearth-fire glow, heavy beams,
  barrels and hanging lanterns, long trestle tables, a bar with tapped kegs.
  Cozy amber light.
- **`loc-market`** — a cluster of market stalls under striped awnings: crates of
  goods, hanging wares, a peddler's cart. Colorful, cheerful clutter toward the
  edges.
- **`loc-road`** — a country road winding through low green hills between fields
  and hedgerows, a signpost, a distant treeline. Open sky, calm.
- **`loc-crossroads`** — a lonely crossroads at dusk under a weathered signpost
  and a leaning old shrine-stone, paths forking into three landscapes.
- **`loc-field`** — open windblown plains or farmland: golden grass, a lone
  tree, big sky, low distant hills. Spacious and quiet.
- **`loc-forest`** — a sun-dappled woodland clearing: tall trunks, ferns and
  moss, shafts of light through the canopy, a soft leaf-littered floor.
- **`loc-marsh`** — a misty marsh: reed beds and black still water, twisted
  half-dead trees, a plank walkway trailing off, pale fog low over the water.
  Muted greens and greys.
- **`loc-river`** — a river crossing: a shallow ford or a mossy stone bridge,
  reeds, a mill or rope in the distance, water catching light.
- **`loc-hills`** — bleak highland moor: rolling heather-covered hills, grey
  outcrops, a stone cairn, wind-bent grass, overcast light.
- **`loc-mountain`** — a high rocky mountain pass: sheer grey crags, patchy snow,
  a narrow switchback trail, cold thin light and distant peaks.
- **`loc-coast`** — a rugged coast with weathered wooden docks: fishing boats,
  crates and nets, a lighthouse or cliff, grey-green sea and gulls.
- **`loc-cave`** — a natural cavern mouth opening into darkness: wet stone,
  stalactites, a trickle of water, faint blue glow deeper in.
- **`loc-dungeon`** — a torch-lit dungeon corridor of fitted stone blocks:
  iron-banded doors, chains, a low vaulted ceiling, warm torch pools against
  cold shadow.
- **`loc-ruins`** — sunlit ancient ruins: toppled columns and cracked
  flagstones reclaimed by ivy and grass, a broken arch, hints of old
  carvings.
- **`loc-crypt`** — a cold underground crypt: stone sarcophagi and wall niches,
  cobwebs, a single shaft of pale light, dust motes. Spooky-but-not-gory,
  matching the game's goofy-spooky undead.
- **`loc-camp`** — a rough raider/war camp in a hollow: hide tents, a central
  bonfire, a crude palisade of lashed timber, scattered loot and weapon racks.
- **`loc-keep`** — a grim fortress hall: banners on cold stone walls, a long
  flagged floor, arrow-slit light, a heavy portcullis at the far end.
- **`loc-temple`** — a serene temple or shrine interior: a stone altar, tall
  windows with colored light, columns, offering candles. Calm, reverent.
- **`loc-throne`** — a smoky warlord's hall: a rough throne of bones and
  plunder on a dais, guttering braziers, trophy banners, heavy shadow. The
  boss-room mood — menacing, not gory.

---

## 4. NPC portraits

### Style preamble

Use the **exact Style Preamble from `art/prompts.md` §3** (the chibi character
preamble), then the **Portrait spec from `art/prompts.md` §4** (head-and-
shoulders bust, 512×512, transparent alpha). The subjects below only add the
archetype identity. Keep the cast-diversity rule: the notes fix a specific,
varied identity per archetype so the whole NPC set stays balanced alongside the
heroes.

### Technical spec

Same as `art/prompts.md` Portrait spec: **512×512, PNG, transparent alpha, one
character, centered, 3/4 bust, no scenery, no ground.**

### Subjects (id → identity + prompt subject)

Each id matches `NPC_ART` in `src/data/adventure-art.ts`.

- **`npc-innkeeper`** — a warm, broad middle-aged East-Asian woman in an apron
  over rolled sleeves, a dishcloth on one shoulder, hair in a practical bun,
  laugh lines and a shrewd smile. Iconic feature: apron + cloth.
- **`npc-elder`** — an elderly dark-brown-skinned man, village reeve: neat grey
  beard, chain of office, sober fur-trimmed robe, tired kind eyes. Iconic
  feature: chain of office.
- **`npc-merchant`** — a wiry, sharp-eyed Middle-Eastern trader of indeterminate
  age with a beaded headscarf, many rings, a coin-pouch and a too-quick grin.
  Iconic feature: coin pouch + rings.
- **`npc-guard`** — a stocky Pacific-Islander woman town-guard in a mail coif and
  tabard, spear-butt visible at the shoulder, steady no-nonsense expression.
  Iconic feature: coif + tabard.
- **`npc-scout`** — a lean South-Asian nonbinary ranger in a hood and green
  cloak, a bowstring across the chest, a leaf or feather in the hair, alert.
  Iconic feature: hood + bowstring.
- **`npc-commoner`** — a sun-weathered older Latina farmer in a straw hat and
  patched smock, a wisp of straw, gentle worried face. Iconic feature: straw
  hat.
- **`npc-child`** — a small gap-toothed Black child of ~8 with puffs of hair, an
  oversized tunic, wide curious eyes and a smudge of dirt. Iconic feature:
  oversized tunic.
- **`npc-noble`** — an imperious light-brown-skinned young noble of ambiguous
  gender in a high-collared brocade doublet and a jeweled circlet, chin up.
  Iconic feature: circlet + high collar.
- **`npc-priest`** — a serene elderly white acolyte with a shaved head, a holy
  symbol pendant, plain undyed robes, hands folded. Iconic feature: holy
  symbol.
- **`npc-sage`** — a bespectacled deep-brown-skinned scholar of middle age with
  an ink-stained collar, a quill behind the ear, a rolled scroll, curious
  squint. Iconic feature: quill + spectacles.
- **`npc-stranger`** — a shadowed hooded figure, face mostly hidden under a deep
  cowl, only a faint knowing smile and one glinting eye visible, cloak clasp at
  the throat. Iconic feature: deep cowl.
- **`npc-wounded`** — a young androgynous East-African scout, pale with pain, a
  bandaged brow and arm-sling, gritted determined jaw. Iconic feature: bandages
  + sling.
- **`npc-bandit`** — a scruffy tan-skinned raider with a jaw-scar, a half-mask
  pushed down, mismatched studded leather, a crooked sneer. Iconic feature:
  half-mask + scar.
- **`npc-captain`** — a hard-eyed dark-skinned raider lieutenant with a topknot
  and warpaint, a fur-mantled pauldron and a notched blade at the shoulder,
  bitter confidence. Iconic feature: fur mantle + warpaint.
- **`npc-cultist`** — a gaunt pale zealot of ambiguous gender in a deep hood and
  a robe marked with a sigil, a candle-stub, a fervent glassy stare.
  Goofy-spooky, not gory. Iconic feature: sigil robe.
- **`npc-barbarian`** — a burly brown-skinned tribal warrior with bone jewelry,
  face paint, a fur cloak and a great axe-haft at the shoulder, a fierce grin.
  Iconic feature: bone jewelry + axe-haft.

---

## 5. Integration

| Family | Source file | Processed asset | Consumed by |
| --- | --- | --- | --- |
| Location `loc-<type>` | `art/source/scene-<id>.png` | `web/public/art/scene-<id>.webp` | `sceneArtUrl()` in `web/src/art.ts`; scene banner + explore-map backdrop in `web/src/Adventure.tsx` |
| NPC `npc-<archetype>` | `art/source/portrait-<id>.png` | `web/public/art/portrait-<id>.webp` | `portraitUrl()` / `<Portrait>` (dialogue) — same path as hero/monster portraits |

Wiring a new asset is two steps:
1. Drop the source PNG in `art/source/` with the exact filename above.
2. Add its id to the matching set in `web/src/art.ts` — `HAS_SCENE_ART` for a
   location, `HAS_NPC_ART` for an NPC. That's the switch from emoji fallback to
   the image; nothing else changes (modules already name the ids).

Because the module validator (`src/adventure/validate.ts`) checks every art id
against `adventure-art.ts`, a module can only reference ids that exist in the
vocabulary — so there is never a dangling art reference, generated or not.

---

## 6. Processing

NPC portraits go through the **existing** character pipeline unchanged
(`art/process.py` — they're just more `portrait-*.png` sources with alpha).

Location scenes can be generated in 4-scene batches as single square images featuring 4 wide horizontal landscape rows stacked top-to-bottom. Slice the sheet into individual `scene-<id>.png` files in `art/source/` via:

```
python art/slice_scenes.py art/raw/scenes-batch-1.png loc-village loc-town loc-tavern loc-market
```

Then process the source PNGs into web-appropriate WebP assets (`web/public/art/scene-*.webp`):

```
python art/process_scenes.py
```

---

## 7. QA checklist

Locations:
- [ ] **Eye-level, not overhead** — a place you stand in (distinct from the
      top-down arena backdrops).
- [ ] **No people or creatures** — NPCs are separate portrait assets; a figure
      baked into a location can't be reused or removed.
- [ ] **Calm middle / even value** — a story panel and node markers sit on top
      under a scrim; busy or high-contrast centers fight them.
- [ ] **Cohesive** — cel-shaded, warm-brown linework, same world as the
      character set; no photoreal or 3D-render drift.

NPCs:
- [ ] **Matches the hero style bible** (`art/prompts.md`) — chibi, transparent,
      one iconic silhouette feature.
- [ ] **Archetype reads instantly** at portrait size from the iconic feature.
- [ ] **Cast stays diverse** across the set (skin tone, gender, age, heritage) —
      the per-archetype identities above are deliberate; keep them.
- [ ] **Not gory / not grim** — cultists and the like are goofy-spooky, like the
      game's undead.
