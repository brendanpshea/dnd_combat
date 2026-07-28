# Terrain & Blocking Prop SVGs (24 Vector Assets)

Companion vector prop library created from specifications in `art/terrain-prompts.md`.

## 🎨 Design Rules Applied
- **SNES 16-Bit / Cel-Shaded JRPG Style**: Hard-edged color regions, dark bold contours (`#2a2333`), and 3-step value shading (lit top face, midtone front face, dark base).
- **Light Source**: Consistent upper-left illumination.
- **Silhouette & Height Rules**:
  - **Walls (`terrain-wall-*`)**: Tall solid blockers (`y=40..450`), edge-on top surface, occupying 85–95% cell height.
  - **Cover (`terrain-cover-*`)**: Low chest-high barricades (`y=230..450`), occupying lower ~55% of cell, broad lit top face viewing down onto it.

## 🔎 Read at 34px, not at 512

The assets are judged on `scripts/terrain-sheet.ts`, which renders them in the
real board markup at phone size beside the CSS they replace. Four rules came
out of that pass and are enforced by the generator rather than by hand:

- **Walls are scaled to 1.12** about the cell centre so a run of them abuts
  instead of reading as separate blocks with floor showing between. Cover is
  deliberately *not* scaled: visible floor above a barricade is the cue that
  says it is low enough to shoot over.
- **Strokes are thickened 60%.** A stroke of 8 in a 512 viewBox is 0.53 CSS
  pixels in a 34px cell — the contour is the whole reason these read as objects
  rather than as UI, and it was too fine to survive the only size that matters.
- **A theme's wall and its barricade never share a material.** Stone's
  barricades are timber and sandbags, not more masonry: where both props are
  grey brick the only thing separating them at 34px is height, which is a weak
  signal on a small tile.
- **Filter defs are emitted only where referenced** (4 of 24 files, not all 24).

---

## 📸 Asset Gallery

### Sheet 1 — `stone` (Ruined Masonry)

| Asset ID | Type | Preview |
|---|---|---|
| `terrain-wall-stone-a` | Wall (Tall) | ![terrain-wall-stone-a](preview/terrain-wall-stone-a.png) |
| `terrain-wall-stone-b` | Wall (Tumbled) | ![terrain-wall-stone-b](preview/terrain-wall-stone-b.png) |
| `terrain-cover-stone-a` | Cover (Timber Palisade) | ![terrain-cover-stone-a](preview/terrain-cover-stone-a.png) |
| `terrain-cover-stone-b` | Cover (Sandbags) | ![terrain-cover-stone-b](preview/terrain-cover-stone-b.png) |

---

### Sheet 2 — `forest` (Undergrowth)

| Asset ID | Type | Preview |
|---|---|---|
| `terrain-wall-forest-a` | Wall (Shrub) | ![terrain-wall-forest-a](preview/terrain-wall-forest-a.png) |
| `terrain-wall-forest-b` | Wall (Bush B) | ![terrain-wall-forest-b](preview/terrain-wall-forest-b.png) |
| `terrain-cover-forest-a` | Cover (Fallen Log) | ![terrain-cover-forest-a](preview/terrain-cover-forest-a.png) |
| `terrain-cover-forest-b` | Cover (Thicket) | ![terrain-cover-forest-b](preview/terrain-cover-forest-b.png) |

---

### Sheet 3 — `graveyard` (Memorial Stone)

| Asset ID | Type | Preview |
|---|---|---|
| `terrain-wall-graveyard-a` | Wall (Tombstone) | ![terrain-wall-graveyard-a](preview/terrain-wall-graveyard-a.png) |
| `terrain-wall-graveyard-b` | Wall (Obelisk) | ![terrain-wall-graveyard-b](preview/terrain-wall-graveyard-b.png) |
| `terrain-cover-graveyard-a` | Cover (Sarcophagus) | ![terrain-cover-graveyard-a](preview/terrain-cover-graveyard-a.png) |
| `terrain-cover-graveyard-b` | Cover (Iron Railing) | ![terrain-cover-graveyard-b](preview/terrain-cover-graveyard-b.png) |

---

### Sheet 4 — `ember` (Volcanic Rock)

| Asset ID | Type | Preview |
|---|---|---|
| `terrain-wall-ember-a` | Wall (Basalt Spire) | ![terrain-wall-ember-a](preview/terrain-wall-ember-a.png) |
| `terrain-wall-ember-b` | Wall (Cooled Lava Chunk, ash-crusted) | ![terrain-wall-ember-b](preview/terrain-wall-ember-b.png) |
| `terrain-cover-ember-a` | Cover (Lava Ridge) | ![terrain-cover-ember-a](preview/terrain-cover-ember-a.png) |
| `terrain-cover-ember-b` | Cover (Iron Plate Barricade) | ![terrain-cover-ember-b](preview/terrain-cover-ember-b.png) |

---

### Sheet 5 — `village` (Market Square)

| Asset ID | Type | Preview |
|---|---|---|
| `terrain-wall-village-a` | Wall (Market Stall Awning) | ![terrain-wall-village-a](preview/terrain-wall-village-a.png) |
| `terrain-wall-village-b` | Wall (Crates & Barrels) | ![terrain-wall-village-b](preview/terrain-wall-village-b.png) |
| `terrain-cover-village-a` | Cover (Overturned Handcart) | ![terrain-cover-village-a](preview/terrain-cover-village-a.png) |
| `terrain-cover-village-b` | Cover (Fence & Trough) | ![terrain-cover-village-b](preview/terrain-cover-village-b.png) |

---

### Sheet 6 — `bog` (Wet Ground)

| Asset ID | Type | Preview |
|---|---|---|
| `terrain-wall-bog-a` | Wall (Moss Hummock) | ![terrain-wall-bog-a](preview/terrain-wall-bog-a.png) |
| `terrain-wall-bog-b` | Wall (Rotten Stump) | ![terrain-wall-bog-b](preview/terrain-wall-bog-b.png) |
| `terrain-cover-bog-a` | Cover (Peat Bank) | ![terrain-cover-bog-a](preview/terrain-cover-bog-a.png) |
| `terrain-cover-bog-b` | Cover (Driftwood Tangle) | ![terrain-cover-bog-b](preview/terrain-cover-bog-b.png) |
