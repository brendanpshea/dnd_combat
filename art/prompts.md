# Art Prompts — D&D Grid Combat

Image-generator prompts for the game's characters and monsters. The goal is a
**cohesive set**, so the discipline here matters more than any single prompt:
every asset shares one locked style preamble, one palette, one set of technical
specs. Generate in as few sessions as possible and chain a reference image to
hold the style.

This doc covers **characters and monsters only** (tokens + portraits). Terrain
tiles, UI frames, health bars, targeting highlights, and spell/particle effects
are hand-authored SVG/CSS in the app, not generated — keep them out of scope
here so the raster set stays tight and consistent.

**Companion docs:** `art/arena-prompts.md` covers the top-down combat backdrops
(one per map theme); `art/adventure-prompts.md` covers adventure mode's
eye-level **location scenes** and **NPC-archetype portraits** — the NPC set
reuses this doc's style bible verbatim.

**Status legend:** ✅ generated and wired in the engine (`HAS_ART` in
`web/src/art.ts`) · ⬜ needed (still on the emoji fallback). **§5 has the
full status by category and the per-monster list.** In short: every hero,
species, and species×role portrait is ✅ and the forge matrix is fully
covered; **67 of the 132 monsters are ✅, and the remaining 65 have prompts
ready to generate in §8.**

---

---

## 1. How to use this doc

1. Copy the **Style Preamble** (§3) verbatim.
2. Append one asset's **subject line** (§6–8).
3. Append the matching **Token spec** or **Portrait spec** (§4).
4. Generate. Lock the style with the first good result: feed it back as a
   style/reference image for every subsequent asset. Keep the same seed family
   if your tool supports it.
5. Save with the exact filename convention in §9 so the engine can map it with
   no guesswork.

> The **§8** monster prompts (and every side-by-side sheet in §6–7) already
> bake the preamble and both specs into one self-contained line — for those,
> copy the whole thing and skip steps 1–3.

**Two assets per character:**
- **Token** — the chibi figure on the board. Must read at ~48px.
- **Portrait** — a bust shown in the status bar, target chooser, character
  sheet, and campaign party cards, where there's room for detail.

---

---

## 2. Art direction (the style bible)

- **Vibe:** modern JRPG meets YA graphic novel. Think Nintendo-friendly —
  charming, readable, expressive. Heroes are heroic and likeable; monsters are
  cartoonishly menacing, **never gory or grim** (skeletons and zombies are
  goofy-spooky, not horror).
- **Proportions:** **chibi / super-deformed.** ~2–2.5 heads tall. Big head,
  large expressive eyes, small body and limbs, big hands/feet. This is
  non-negotiable — grounded proportions turn to mud at 48px.
- **Line:** clean, confident **ink outline** in a dark warm brown-black
  (`#2a2333`), *not* pure black. Medium weight, slightly heavier on the outer
  silhouette. No sketchy or broken lines.
- **Shading:** **cel / flat.** One base color per material + one shadow tone +
  at most one small highlight. No gradients, no painterly rendering, no
  photorealism, no lens effects.
- **Silhouette rule:** each character must be identifiable from its **black
  silhouette alone**, carried by **one iconic feature** (the wizard's hat, the
  ogre's club). Prompts below name that feature — make it dominant.
- **Palette:** warm, saturated, slightly desaturated toward cozy (not neon).
  Colors must **pop against a dark board** (`#1a1625` / `#322b48`). Do **not**
  paint team colors (blue/red) into the character — the engine draws a colored
  base ring under each token. Keep characters team-neutral.
- **Lighting:** soft, top-front, consistent across the whole set (shadow on the
  lower and one side). No dramatic rim light.
- **Cast diversity (required).** The human and humanoid cast must look like the
  real range of people — **do not default to young, pale-skinned, Western, or
  male** (the old prompts did, and the set skewed hard that way). Across the
  ensemble, deliberately vary:
  - **Skin tone** — the full range from deep brown to light, weighted toward
    more brown and tan than pale.
  - **Gender** — a genuine, roughly balanced mix of feminine, masculine, and
    androgynous figures; never male-by-default.
  - **Age** — include elders and youths, not only twenty-somethings.
  - **Heritage & aesthetic** — draw hair, features, armor and dress from many
    cultures (West/East/South African, South & East Asian, Middle Eastern,
    Central/South American, Pacific, Indigenous, and European), as tasteful
    fantasy inflections — **not** literal costumes or stereotypes.
  Every human subject line below now fixes a **specific** identity so the whole
  set stays balanced; keep those traits when you generate. Non-people monsters
  (goblins, wolves, undead, constructs, the minotaur/oni) are exempt, though
  their gear and cultural cues can still vary. Generic "make it diverse" notes
  get ignored by generators — the per-asset specifics are what do the work.

Reference palette (for accents/materials, not mandatory per-pixel):
`#ffd166` gold · `#6ee7a0` green · `#ff9d4d` warm orange · `#9be2ff` ice ·
`#c084fc` arcane purple · skin/metal/cloth in warm mid-tones.

---

---

## 3. Style Preamble (copy verbatim into every prompt)

> Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2
> heads tall with a big head, large expressive eyes, small body. Clean confident
> cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight,
> bold dark warm-brown ink outline (#2a2333), slightly heavier on the
> silhouette. No gradients, no painterly rendering, no photorealism, no text,
> no watermark. Warm saturated but cozy palette that pops on a dark background.
> Soft top-front lighting, consistent. Centered, front-facing, symmetrical
> pose. **Fully transparent background, no ground shadow, no scenery, no base
> or platform.** Single character only.

---

---

## 4. Technical specs (append the relevant one)

### Token spec
> TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom
> edge with even padding all around. Square 1:1 canvas, 512×512, PNG with alpha,
> transparent background. The character fills ~70% of the frame height (see the
> per-asset SIZE note — small creatures fill less, large creatures more, so
> relative scale reads on the board). Iconic feature clearly visible in
> silhouette. No shadow, no ring, no ground.

### Portrait spec
> PORTRAIT: head-and-shoulders bust, 3/4 facing, friendly readable expression.
> Square 1:1 canvas, 512×512, PNG with alpha, transparent background. Head fills
> ~60% of frame, top of head with small padding. Same character design and
> palette as the token. No shadow, no scenery.

**Output for every asset:** 512×512, PNG, transparent alpha, one character,
centered. (The pipeline will trim, downscale to @1x/2x/3x, convert to WebP, and
pack an atlas — generate clean and large; we shrink.)

**Relative SIZE tiers** (how much of the token frame the creature fills, so an
ogre towers over a kobold on the board):
- **S** (~55%): kobold, giant spider
- **M** (~70%): all heroes, goblin warrior, skeleton, zombie, wolf, bandit,
  ghoul, acolyte, scout, orc, cult fanatic, animated armor, knight, priest
- **L** (~85%): goblin boss, dire wolf, brown bear, minotaur, griffon,
  winter wolf, bulette, roper, otyugh, wraith, flesh golem, shield guardian,
  salamander, invisible stalker, chain devil, hezrou, vrock, gelatinous cube,
  black pudding, wyvern, young white/black/green dragon
- **XL** (~95%): ogre, ettin, oni, hill/stone/frost/fire giant, troll,
  giant ape, mammoth, tyrannosaurus, remorhaz, hydra, chimera, aboleth, stone
  golem, glabrezu, horned devil, young blue/red dragon

---



---

---

## 5. Status overview — what's done, by category

Two things are fully done and enforced by tests: the **player-character art**
(§6) and the **species × class forge matrix**. The open work is **monsters** —
58 of 132 have art; the other 74 have ready-to-generate prompts in §8.

**Monsters by creature type:**

| Creature type | Have art | Still needed |
| --- | --- | --- |
| Humanoid | 16/16 | — |
| Beast | 13/15 | Giant Ape, Mammoth |
| Fey | 7/8 | Worg |
| Undead | 8/13 | Banshee, Ghast, Ghost, Vampire Spawn, Wraith |
| Fiend | 2/16 | Barbed Devil, Bearded Devil, Chain Devil, Dretch, Glabrezu, Hell Hound, Hezrou, Horned Devil, Imp, Night Hag, Quasit, Shadow Demon, Succubus, Vrock |
| Elemental | 5/15 | Azer Sentinel, Dust Mephit, Ice Mephit, Invisible Stalker, Magma Mephit, Magmin, Mud Mephit, Salamander, Smoke Mephit, Steam Mephit |
| Giant | 2/7 | Fire Giant, Frost Giant, Hill Giant, Stone Giant, Troll |
| Dragon | 6/12 | Wyvern, Young Black Dragon, Young Blue Dragon, Young Green Dragon, Young Red Dragon, Young White Dragon |
| Monstrosity | 5/14 | Basilisk, Bulette, Chimera, Ettercap, Griffon, Hydra, Remorhaz, Rust Monster, Winter Wolf |
| Aberration | 0/3 | Aboleth, Otyugh, Roper |
| Construct | 2/8 | Animated Flying Sword, Animated Rug of Smothering, Flesh Golem, Scarecrow, Shield Guardian, Stone Golem |
| Ooze | 0/4 | Black Pudding, Gelatinous Cube, Gray Ooze, Ochre Jelly |
| Celestial | 1/1 | — |
| **Total** | **67/132** | **65 needed** |

**Every monster, with status** (✅ = art present and wired · ⬜ = prompt ready in §8, emoji fallback until generated):

| Monster | Id | Type | Status |
| --- | --- | --- | --- |
| Acolyte | `acolyte` | humanoid | ✅ |
| Air Elemental | `air-elemental` | elemental | ✅ |
| Animated Armor | `animated-armor` | construct | ✅ |
| Bandit | `bandit` | humanoid | ✅ |
| Bandit Captain | `bandit-captain` | humanoid | ✅ |
| Black Dragon Wyrmling | `black-wyrmling` | dragon | ✅ |
| Blue Dragon Wyrmling | `blue-wyrmling` | dragon | ✅ |
| Brown Bear | `brown-bear` | beast | ✅ |
| Bugbear Warrior | `bugbear` | fey | ✅ |
| Cockatrice | `cockatrice` | monstrosity | ✅ |
| Cult Fanatic | `cult-fanatic` | humanoid | ✅ |
| Dire Wolf | `dire-wolf` | beast | ✅ |
| Dryad | `dryad` | fey | ✅ |
| Earth Elemental | `earth-elemental` | elemental | ✅ |
| Ettin | `ettin` | giant | ✅ |
| Fire Elemental | `fire-elemental` | elemental | ✅ |
| Gargoyle | `gargoyle` | elemental | ✅ |
| Ghoul | `ghoul` | undead | ✅ |
| Giant Badger | `giant-badger` | beast | ✅ |
| Giant Boar | `giant-boar` | beast | ✅ |
| Giant Constrictor Snake | `giant-constrictor-snake` | beast | ✅ |
| Giant Hyena | `giant-hyena` | beast | ✅ |
| Giant Spider | `giant-spider` | beast | ✅ |
| Giant Toad | `giant-toad` | beast | ✅ |
| Gnoll Warrior | `gnoll` | fiend | ✅ |
| Goblin Boss | `goblin-boss` | fey | ✅ |
| Goblin Warrior | `goblin-warrior` | fey | ✅ |
| Gorgon | `gorgon` | construct | ✅ |
| Green Dragon Wyrmling | `green-wyrmling` | dragon | ✅ |
| Green Hag | `green-hag` | fey | ✅ |
| Guard | `guard` | humanoid | ✅ |
| Harpy | `harpy` | monstrosity | ✅ |
| Knight | `knight` | humanoid | ✅ |
| Kobold Warrior | `kobold` | dragon | ✅ |
| Lizardfolk | `lizardfolk` | humanoid | ✅ |
| Manticore | `manticore` | monstrosity | ✅ |
| Minotaur of Baphomet | `minotaur` | monstrosity | ✅ |
| Mummy | `mummy` | undead | ✅ |
| Ogre | `ogre` | giant | ✅ |
| Oni | `ogre-mage` | fiend | ✅ |
| Orc | `orc` | humanoid | ✅ |
| Owlbear | `owlbear` | monstrosity | ✅ |
| Priest | `priest` | humanoid | ✅ |
| Red Dragon Wyrmling | `red-wyrmling` | dragon | ✅ |
| Satyr | `satyr` | fey | ✅ |
| Scout | `scout` | humanoid | ✅ |
| Shadow | `shadow` | undead | ✅ |
| Skeleton | `skeleton` | undead | ✅ |
| Specter | `specter` | undead | ✅ |
| Sprite | `sprite` | fey | ✅ |
| Spy | `spy` | humanoid | ✅ |
| Unicorn | `unicorn` | celestial | ✅ |
| Water Elemental | `water-elemental` | elemental | ✅ |
| White Dragon Wyrmling | `white-wyrmling` | dragon | ✅ |
| Wight | `wight` | undead | ✅ |
| Will-o'-Wisp | `will-o-wisp` | undead | ✅ |
| Wolf | `wolf` | beast | ✅ |
| Zombie | `zombie` | undead | ✅ |
| Aboleth | `aboleth` | aberration | ⬜ |
| Animated Flying Sword | `flying-sword` | construct | ⬜ |
| Animated Rug of Smothering | `rug-of-smothering` | construct | ⬜ |
| Assassin | `assassin` | humanoid | ✅ |
| Azer Sentinel | `azer` | elemental | ⬜ |
| Banshee | `banshee` | undead | ⬜ |
| Barbed Devil | `barbed-devil` | fiend | ⬜ |
| Basilisk | `basilisk` | monstrosity | ⬜ |
| Bearded Devil | `bearded-devil` | fiend | ⬜ |
| Berserker | `berserker` | humanoid | ✅ |
| Black Pudding | `black-pudding` | ooze | ⬜ |
| Bulette | `bulette` | monstrosity | ⬜ |
| Chain Devil | `chain-devil` | fiend | ⬜ |
| Chimera | `chimera` | monstrosity | ⬜ |
| Dretch | `dretch` | fiend | ⬜ |
| Dust Mephit | `dust-mephit` | elemental | ⬜ |
| Elephant | `elephant` | beast | ✅ |
| Ettercap | `ettercap` | monstrosity | ⬜ |
| Fire Giant | `fire-giant` | giant | ⬜ |
| Flesh Golem | `flesh-golem` | construct | ⬜ |
| Frost Giant | `frost-giant` | giant | ⬜ |
| Gelatinous Cube | `gelatinous-cube` | ooze | ⬜ |
| Ghast | `ghast` | undead | ⬜ |
| Ghost | `ghost` | undead | ⬜ |
| Giant Ape | `giant-ape` | beast | ⬜ |
| Giant Crocodile | `giant-crocodile` | beast | ✅ |
| Giant Scorpion | `giant-scorpion` | beast | ✅ |
| Glabrezu | `glabrezu` | fiend | ⬜ |
| Gladiator | `gladiator` | humanoid | ✅ |
| Gray Ooze | `gray-ooze` | ooze | ⬜ |
| Griffon | `griffon` | monstrosity | ⬜ |
| Hell Hound | `hell-hound` | fiend | ⬜ |
| Hezrou | `hezrou` | fiend | ⬜ |
| Hill Giant | `hill-giant` | giant | ⬜ |
| Horned Devil | `horned-devil` | fiend | ⬜ |
| Hydra | `hydra` | monstrosity | ⬜ |
| Ice Mephit | `ice-mephit` | elemental | ⬜ |
| Imp | `imp` | fiend | ⬜ |
| Invisible Stalker | `invisible-stalker` | elemental | ⬜ |
| Mage | `mage` | humanoid | ✅ |
| Magma Mephit | `magma-mephit` | elemental | ⬜ |
| Magmin | `magmin` | elemental | ⬜ |
| Mammoth | `mammoth` | beast | ⬜ |
| Mud Mephit | `mud-mephit` | elemental | ⬜ |
| Night Hag | `night-hag` | fiend | ⬜ |
| Ochre Jelly | `ochre-jelly` | ooze | ⬜ |
| Otyugh | `otyugh` | aberration | ⬜ |
| Quasit | `quasit` | fiend | ⬜ |
| Remorhaz | `remorhaz` | monstrosity | ⬜ |
| Roper | `roper` | aberration | ⬜ |
| Rust Monster | `rust-monster` | monstrosity | ⬜ |
| Salamander | `salamander` | elemental | ⬜ |
| Scarecrow | `scarecrow` | construct | ⬜ |
| Shadow Demon | `shadow-demon` | fiend | ⬜ |
| Shield Guardian | `shield-guardian` | construct | ⬜ |
| Smoke Mephit | `smoke-mephit` | elemental | ⬜ |
| Steam Mephit | `steam-mephit` | elemental | ⬜ |
| Stone Giant | `stone-giant` | giant | ⬜ |
| Stone Golem | `stone-golem` | construct | ⬜ |
| Succubus | `succubus` | fiend | ⬜ |
| Troll | `troll` | giant | ⬜ |
| Tyrannosaurus Rex | `tyrannosaurus` | beast | ✅ |
| Vampire Spawn | `vampire-spawn` | undead | ⬜ |
| Vrock | `vrock` | fiend | ⬜ |
| Warrior Veteran | `veteran` | humanoid | ✅ |
| Winter Wolf | `winter-wolf` | monstrosity | ⬜ |
| Worg | `worg` | fey | ⬜ |
| Wraith | `wraith` | undead | ⬜ |
| Wyvern | `wyvern` | dragon | ⬜ |
| Young Black Dragon | `young-black` | dragon | ⬜ |
| Young Blue Dragon | `young-blue` | dragon | ⬜ |
| Young Green Dragon | `young-green` | dragon | ⬜ |
| Young Red Dragon | `young-red` | dragon | ⬜ |
| Young White Dragon | `young-white` | dragon | ⬜ |

---

## 6. Player characters — ✅ all generated

The four core heroes (`fighter`, `wizard`, `cleric`, `rogue`), their mature
adult variants, the single-look species portraits, and the species × role
portraits are all generated and wired. Prompts are kept below as the record for
regeneration.

### 6a. Mature hero variants (mid-20s adults)

Prompts for adult mid-20s versions of the 4 core hero classes:

### Mature Knight / Fighter (`fighter-mature` / `human_fighter_mature`) — Size Medium
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, confident brave expression of a mid-20s white man knight with fair skin, short light brown hair, and rosy cheeks. Wearing steel scale-plate armor with a warm brown tabard and gold trim. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character holding a shining steel longsword upright and carrying a round wooden shield with iron rim on his arm. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Young adult knight appearance, not childlike. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. Warm saturated but cozy palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Mature Wizard (`wizard-mature` / `human_wizard_mature`) — Size Medium
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, clever inquisitive smile of a mid-20s East Asian woman mage with smooth tan-olive skin, dark eyes, and dark hair pinned in a neat bun beneath an enormous floppy pointed indigo hat embroidered with gold star constellations. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character in flowing indigo robes with rolled sleeves, holding a gnarled oak staff topped with a glowing purple arcane crystal. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Young adult mage appearance, not childlike. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. Warm saturated but cozy palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Mature Cleric (`cleric-mature` / `human_cleric_mature`) — Size Medium
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, serene smiling expression of a mid-20s Latina woman cleric with warm olive-brown skin, glowing hazel eyes, and dark wavy hair. Wearing golden sunburst plate armor over cream robes with a soft radiant halo glint. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character holding a radiant golden sunburst holy mace and a glowing sunburst holy symbol. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Young adult battle priestess appearance, not childlike. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. Warm saturated but cozy palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Mature Rogue (`rogue-mature` / `human_rogue_mature`) — Size Medium
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, sly confident smirk of a mid-20s Black man rogue with deep brown skin, a clean dark fade haircut, shadowed beneath a dark teal cowl hood. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character in dark teal-green studded leather armor, holding two steel daggers in reverse grip in a low crouched stance. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Young adult rogue appearance, not childlike. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. Warm saturated but cozy palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

---

### 6b. Species portraits (single-look)

One portrait per species, generated (`token-<id>.png` / `portrait-<id>.png`):
`orc-barbarian`, `dragonborn-paladin`, `gnome-bard`, `halfling-rogue`,
`tiefling-warlock`, `dwarf-berserker`, `elf-archer`, `human-bard`.

### 6c. Species × role portraits — ✅ generated
**Why these exist.** `portraitId` drives *both* the board token and the bust
(`Board.tsx` reads `c.portraitId ?? c.classId`), and the forge picks a default
from a species × class matrix (`defaultPortraitFor`, campaign.ts). Before these
landed each species had exactly **one** portrait, tagged martial or not, so the
matrix had holes it filled with the wrong picture:

- A **human ranger** wears `elf-archer` — pointed ears on a human — and a
  **human paladin** wears `dragonborn-paladin`, a dragon's head. Ranger and
  Paladin have no species-neutral art at all.
- A **dwarf wizard** falls back to the generic human `wizard`, because the only
  dwarf art is a bare-armed berserker. Same for elf, orc and dragonborn casters.
- A **tiefling fighter** gets the robed warlock, because the only tiefling art
  is a spellcaster. Same for gnome and halfling fighters.

The goal is **two archetypes per species — one martial, one caster** — plus the
two missing class portraits. That closes the matrix at 10 new assets rather than
the 48 a full species × class grid would need.

**Both files per asset** (`token-<id>.png` + `portrait-<id>.png`), same as the
existing species variants.

### Distinctness rule (read before generating)

Each new asset shares a species with an existing one, so it **must not read as
the same character in a different hat**. For every entry below, the subject line
deliberately changes *at least three* of: silhouette, gender presentation, age,
skin/scale colour, hair colour and style, and palette. Generate the new one
side-by-side with its existing sibling and reject anything that could be
mistaken for a recolour.

Existing siblings, for reference: `dwarf-berserker` is a **young red-bearded
man**, warm orange/brown; `elf-archer` is a **silver-haired woman**, pale
green-tinted, gold leaf motifs; `orc-barbarian` is a **young woman** with black
beaded braids and leopard fur; `dragonborn-paladin` is **gold-scaled** in silver
plate with a purple sash; `tiefling-warlock` is a **red-skinned woman** with
curled ram horns and a teal star robe; `gnome-bard` is a **young woman**, brown
skin, black curls, orange kente; `halfling-rogue` is a **brown-haired boy** in a
navy hood.

### Tier A — species-neutral class art (fixes visibly wrong pictures)

### Ranger (`ranger`) — Size Medium
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, calm watchful half-smile of a chibi human ranger, a man of Middle-Eastern descent with warm brown skin, a close-cropped black beard, and early thirties appearance, wearing a deep-hooded forest-green travelling cloak thrown back off one shoulder and a small hawk perched on his shoulder. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character in worn leather bracers, holding an upright longbow at his side with a quiver of green-fletched arrows. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. Warm saturated but cozy palette in forest green, tan leather, and muted gold. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Paladin (`paladin`) — Size Medium
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, warm determined expression of a chibi human paladin, a woman of Central-American descent with deep brown skin and black hair in a thick braided crown, wearing dark blued-steel plate with a clean white tabard and a stylized gold sun blazon on the chest. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character with one gauntleted fist over her heart in an oath, wearing dark blued-steel armor and a white sun-embroidered tabard. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. Warm saturated but cozy palette in dark steel, crisp white, and warm gold. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Tier B — casters of the martial species

### Dwarf Cleric (`dwarf-cleric`) — Size Medium
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, serene kindly expression with laugh lines of an elder chibi dwarf priestess woman with deep brown skin and silver-white hair in two heavy braided loops, wearing a heavy stone prayer-amulet glowing softly and Himalayan-inflected robes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character wearing saffron and deep-blue layered robes over mail, holding a short warhammer resting head-down. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. Saffron, deep blue, and cool silver palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Elf Wizard (`elf-wizard`) — Size Medium
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, thoughtful amused smile of an ageless chibi elf mage man with deep brown skin and long pointed elf ears, black locs pulled back, wearing indigo and brass robes with geometric embroidery and a floating open magic book at his shoulder. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character in South-Asian-inflected indigo robes, with one hand raised casting a small spinning violet arcane rune. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. Indigo, brass, and violet palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Orc Shaman (`orc-shaman`) — Size Medium
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, wise wry unbothered expression of an elder chibi orc shaman man with grey-green skin, a white topknot, a short white beard, small tusks, and bone-and-shell necklaces. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character wearing a cloak of woven grass and feathers, holding a gnarled staff topped with a carved spirit-mask. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. Bone white, moss green, and sky blue palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Dragonborn Sorcerer (`dragonborn-sorcerer`) — Size Medium
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, sly delighted expression of a chibi dragonborn sorcerer with deep blue-and-teal scales, a slender snout, glowing eyes, and a swept-back crest of fin-like frills. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character in flowing storm-grey robes with silver trim, with arcs of pale lightning crackling between clawed fingertips. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. Deep blue, teal, storm grey, and white lightning palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Tier C — martials of the caster species

### Tiefling Knight (`tiefling-knight`) — Size Medium
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, grim steady kind expression of a chibi tiefling knight man with deep blue-violet skin, straight forward-swept horns, cropped white hair, and a scar through one eyebrow. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character wearing battered dark-iron plate armor, a heavy crimson cloak clasped at the shoulder, holding a greatsword resting point-down. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. Dark iron, crimson, and blue-violet palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Gnome Warden (`gnome-warden`) — Size Medium
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, cheerful pugnacious expression of an older chibi gnome warrior man with ruddy tan skin, a huge bushy white walrus moustache, bushy eyebrows, bald top, and brass goggles pushed up on his forehead. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character wearing a brass-and-leather breastplate and carrying a crossbow slung across his back. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. Warm brass, oxblood leather, and cream palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Halfling Warrior (`halfling-warrior`) — Size Medium
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, bright unintimidated smile of a chibi halfling fighter woman with deep brown skin, tightly coiled black hair in a short puff, freckles across her nose, and broad shoulders. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character wearing a mail shirt over a russet gambeson, holding a round shield with a green spiral device on her arm. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. Russet, steel, and leaf green palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Halfling Priest (`halfling-priest`) — Size Medium
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, gentle patient expression of an older chibi halfling cleric man with light-tan skin, a neat grey beard, round spectacles, wearing cream and jade layered robes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character in East-Asian-inflected robes, holding up a brass lantern in one hand casting a warm glowing light on his face, with wooden prayer beads. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. Cream, jade, and lantern-amber palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.


### Tier D — optional third archetype (only if the set is going wide)

Not needed to close the matrix; listed so nobody re-derives them later. Each
would give its species a light/skirmisher look distinct from both siblings:
`dwarf-scout`, `elf-blade`, `orc-hunter`, `dragonborn-monk`, `gnome-tinker`.

### Wiring — done

All ten are generated, processed and wired. `SPECIES_PORTRAIT` in
`src/campaign/campaign.ts` is now a per-species `{ martial, caster, skirmisher? }`
record, `CLASS_PORTRAIT` has real `ranger` / `paladin` entries, and every
species × class cell is covered by a test in `test/choices.test.ts`.

Only the halfling has all three looks drawn (`halfling-warrior` /
`halfling-priest` / `halfling-rogue`), which is what `skirmisher` is for — a
halfling rogue keeps the hooded art instead of being handed the mail shirt. Any
species that later gains a Tier D skirmisher slots in the same way.

### What went wrong in this run (check for it next time)

Two artefact classes slipped through, neither visible in the source thumbnails:

1. **Baked-in spec labels.** Three of the ten rendered the word "PORTRAIT" into
   the bottom of the canvas, in both the token and the portrait — six files. The
   style preamble already says *no text, no watermark*. Check the bottom strip
   before processing: the artefact vanishes at 48px token size but is obvious on
   the bust.
2. **A zoom shift.** The set came back framed far tighter than the established
   art — portraits ~50% wider in frame, tokens ~70% wider, several touching the
   canvas edge. Individually they looked fine; beside the existing heroes they
   read as bigger, and on the board they broke the size-tier cue that makes an
   ogre tower over a kobold.

`art/process.py` now defends against the second automatically: every asset in
its `ROSTER` (the Medium humanoid heroes) is scaled down if its ink exceeds a
framing **ceiling** measured from the established set. It is a ceiling rather
than a target on purpose — the old art deliberately varies, with the gnome bard
filling 36% of its token frame against the fighter's 51%, which is how Small
species read as smaller. Normalising everything to one number would make
halflings human-sized.

The pipeline also strips keying residue: scattered dust, and the hairline
"curtain" some sources carry down one edge. Where that curtain touches the
figure it becomes part of the same connected shape, so it needs its own pass.
Note the first implementation removed *every* small detached blob and deleted
the elf wizard's floating rune — the iconic feature the prompt asked for — so
the rule is deliberately narrow: border-hugging strokes and true dust only.

Run `python art/process.py --check` to re-measure the committed WebP against the
ceiling without rewriting anything.

---

---

## 7. Monsters — ✅ generated library

The prompts for the monsters that already have art, kept for the record. They
predate the current side-by-side sheet format (§8 uses that); regenerate in the
new format if you ever redo one.

### 7a. Monster tiers (the launch set)
### Tier 1 — launch must-have (most-seen, early ladder) — all ✅ generated

**Goblin Warrior** (`goblin-warrior`) — SIZE M
> A scrappy little chibi goblin, green skin, huge pointed ears, big yellow eyes,
> a mischievous fanged snarl. Ragged leather scraps, a rusty curved scimitar
> raised. Wiry and twitchy. Cartoonish, not scary.

**Goblin Boss** (`goblin-boss`) — SIZE L
> A bigger, meaner chibi goblin chieftain, green skin, a battered chain shirt, a
> small ragged red cape, a bent crown or bone trophies. Scimitar and a nasty
> grin, bossy posture. Same goblin family as the warrior but clearly the leader.

**Kobold** (`kobold`) — SIZE S
> A tiny cute-cowardly chibi kobold: reddish-brown scaled lizard-dog with an
> oversized head, little horns, big worried eyes, a rat-like tail. Clutching an
> oversized dagger and a sling. Twitchy, small, endearing-pathetic.

**Wolf** (`wolf`) — SIZE M
> A chibi grey wolf with a big blocky head, perked ears, a playful-fierce snarl
> showing small fangs, bushy fur and tail. Four legs, alert crouch. Cartoon
> animal, expressive, not realistic.

**Skeleton** (`skeleton`) — SIZE M
> A goofy-spooky chibi skeleton, clean ivory bones (not gory), round eye sockets
> with tiny glowing blue pinpoint eyes, a slightly-too-wide grin. Holding a
> shortsword. Bones held together cartoonishly. Halloween-cute, YA-friendly.

**Zombie** (`zombie`) — SIZE M
> A harmless-gross chibi zombie: pale green-grey skin, tattered ragged clothes,
> one droopy eye and a lopsided open mouth, arms out in a slow shamble. Goofy
> and dopey, **not** bloody or horror. Cartoon mascot energy.

**Ogre** (`ogre`) — SIZE XL
> A huge dim-witted chibi ogre towering and round, warm tan-grey skin, a big
> belly, tiny brain / confused expression with one jutting tooth, a simple
> loincloth. Hoisting an enormous knotted wooden greatclub over one shoulder.
> Lovably dumb and menacing by sheer size.

### Tier 2 — nice-to-have (generate as budget allows) — all ✅ generated

**Bandit** (`bandit`) — SIZE M *(regenerate)*
> A scruffy chibi human bandit — **a woman with warm brown skin** — cloth bandana
> mask over the nose, worn leather and a colored sash, a curved scimitar, shifty
> grin. Rogueish highwaywoman.

**Bandit Captain** (`bandit-captain`) — SIZE L *(regenerate)*
> A cocky chibi bandit captain — **a Black woman with deep brown skin** — in a
> weathered navy blue overcoat with gold trim, a black tricorn hat, a steel
> breastplate, holding a gleaming saber in one hand and a dagger in the other. A
> smug grin. Clearly the leader of the bandit gang.

**Dire Wolf** (`dire-wolf`) — SIZE L
> A larger, darker chibi wolf than the common wolf: charcoal fur, a scar over
> one eye, fiercer bristling snarl, heavier build. Clearly the alpha.

**Ghoul** (`ghoul`) — SIZE M
> A gaunt grey-purple chibi undead ghoul, long clawed fingers, sunken glowing
> eyes, a wide toothy hungry grin, hunched. Spooky-cartoon, stylized and
> creepy-cute, not gory.

**Giant Spider** (`giant-spider`) — SIZE S
> A big cartoon chibi spider, round fuzzy purple-black body, eight little legs,
> a cluster of shiny eyes, small dripping fangs, a friendly-menacing look.
> Reads clearly as a spider from above.

**Acolyte** (`acolyte`) — SIZE M *(regenerate)*
> A chibi robed cultist acolyte — **a person of South-Asian descent with
> medium-brown skin, face partly visible under the hood** — in dark hooded robes
> with a colored trim, holding a glowing holy symbol and a mace, serene
> unsettling smile.

**Orc** (`orc`) — SIZE M
> A burly chibi orc, muscular for a chibi, green-grey skin, small tusks, a fierce
> grin, a topknot, hoisting a big greataxe. Fur-and-hide armor. Proud and
> aggressive.

**Brown Bear** (`brown-bear`) — SIZE L
> A big chibi brown bear, round and fluffy, big head and paws, a roaring-cute
> open mouth with small fangs, standing on all fours. Expressive cartoon animal.

### Tier 3 — later (SVG/emoji fallback holds for now) — all ✅ generated

**Scout** (`scout`) — SIZE M *(regenerate)*
> A chibi scout/ranger — **a woman of East-Asian descent with tan skin** — in
> green-and-leather traveling gear and a hooded cloak, drawing a longbow, keen
> focused expression.

**Cult Fanatic** (`cult-fanatic`) — SIZE M *(regenerate)*
> A chibi cult leader — **a gaunt older man with olive-pale skin** — in ornate
> dark robes with arcane-purple trim and a horned or eye motif, glowing eyes,
> holding a dagger and channeling dark magic. Fancier and more sinister than the
> acolyte. (One deliberately pale figure among many brown ones — variety cuts
> both ways.)

**Animated Armor** (`animated-armor`) — SIZE M
> A chibi empty suit of plate armor standing upright and animated, glowing faint
> blue light in the empty helmet visor, one gauntlet raised. Clanky and
> construct-like, no visible body inside.

### Tier 4 — level 4–5 bosses & casters (✅ art present)

The five newest stat blocks. Knight/Minotaur/Ettin
front the level 4–5 ladder; Priest and Ogre Mage are spellcasters.

**Knight** (`knight`) — SIZE M ✅ *(visor down, face hidden — no change needed)*
> A gallant chibi human knight in gleaming full plate with a warm-gold trim and a
> long flowing crimson-and-white surcoat, a great steel helm with a plume (visor
> up showing a stern noble face), a heavy greatsword held point-down in both
> hands, a small heraldic shield on the back. Disciplined, commanding posture.
> Clearly a heavier, grander armored figure than the Fighter hero. **If the visor
> is up, make the face a woman of colour;** heraldry may draw on non-European
> motifs. Iconic feature: the plumed great-helm + two-handed greatsword.

**Minotaur** (`minotaur`) — SIZE L ✅
> A hulking chibi minotaur: a big bull-headed brute with shaggy red-brown fur, a
> broad snout with a brass nose-ring, two large curved horns (the dominant
> feature), fierce glowing eyes and a snort. Muscular bare torso, simple hide
> kilt, hoofed legs, hoisting an enormous double-bladed greataxe. Cartoon-fierce,
> not gory. Iconic feature: the great curved horns + huge greataxe.

**Ettin** (`ettin`) — SIZE XL ✅ *(giant, exempt; could vary the two heads more)*
> A massive chibi two-headed giant: one lumpy body, **two** ugly-goofy heads
> side by side, **each visibly distinct** — different skin undertones, hair, and
> its own dim expression (one grumpy, one dopey), so they read as two beings.
> Warm grey-tan skin, ragged furs, a battleaxe in one fist and a spiked
> morningstar in the other. Towering and dim-witted, menacing by size — same
> lovable-brute energy as the Ogre. Iconic feature: the two mismatched heads +
> axe-and-morningstar.

**Priest** (`priest`) — SIZE M ✅ *(regenerate: currently an older white man)*
> A solemn chibi priest — **an elder with deep brown skin and a short grey beard
> (or a dignified elder woman with grey locs)** — in ornate cream-and-gold
> vestments with a jeweled pectoral holy symbol and a tall mitre-like headdress,
> one hand raised in blessing wreathed in soft golden radiance, the other holding
> a heavy mace. Serene, authoritative face. Grander and more ceremonial than the
> hooded Acolyte. Iconic feature: the tall headdress + glowing raised hand.

**Ogre Mage** (`ogre-mage`) — SIZE XL ✅
> A towering chibi ogre-mage (oni): a big blue-skinned ogre with small tusks, two
> short horns, and fierce eyes, wrapped in rich embroidered silk robes with an
> arcane-purple glow crackling around one raised clawed hand, a gnarled greatclub
> slung on its back. Regal, arrogant, and dangerous — an arcane brute, clearly
> ogre-sized but robed and spellcasting rather than a dumb club-swinger. Iconic
> feature: blue skin + horns + glowing arcane hand.

---

### 7b. Fey (2024 SRD)

Prompts for the 5 Fey additions:

### Sprite (`sprite`) — Size Tiny, CR 1/4
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, cheerful determined expression of a tiny chibi fairy sprite with glowing iridescent dragonfly wings, a leaf-green tunic, a acorn cap helmet, and bright sparkling green eyes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character holding a miniature wooden bow and a tiny glowing flower-bud arrow. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. Warm saturated but cozy palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Satyr (`satyr`) — Size Medium, CR 1/2
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, mischievous smiling expression of a brown-skinned chibi satyr with sweeping curling ram horns, furry goat ears, and warm amber eyes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character with cloven goat hooves, a leather vest, holding a shortsword and a set of wooden panpipes. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. Warm saturated but cozy palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Dryad (`dryad`) — Size Medium, CR 1
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, serene mystical expression of an elder dark-skinned tree nymph dryad with smooth oak-bark textures on her cheekbones, leaf-braided dark hair adorned with white cherry blossoms, and glowing emerald eyes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character wearing a gown woven from autumn leaves and carrying a glowing wooden Shillelagh staff. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. Warm saturated but cozy palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Green Hag (`green-hag`) — Size Medium, CR 3
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, cackling cartoon-menacing expression of a warty olive-green-skinned fey hag with long pointed ears, wild dark hair woven with pond weeds, and sharp yellow eyes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character in tattered mossy robes with long clawed fingers extended. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. Warm saturated but cozy palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Unicorn (`unicorn`) — Size Large, CR 5
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, noble gentle expression of a chibi unicorn with pearlescent white coat, a gleaming spiraled golden horn, a flowing silver mane, and glowing starlight eyes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character standing proudly with golden hooves and a starry tail. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. Warm saturated but cozy palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

---

### 7c. Chromatic dragon wyrmlings

Prompts for the 5 Chromatic Dragon Wyrmlings (various dragon archetypes):

### Red Wyrmling (`red-wyrmling`) — Size Medium, Western Archetype
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, fierce fiery expression of a chibi red dragon wyrmling with classic Western dragon horns, crimson scales, yellow underbelly, and glowing ember eyes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character perched with leather dragon wings spread slightly and a small smoke wisp from nostrils. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. Warm saturated but cozy palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### White Wyrmling (`white-wyrmling`) — Size Medium, Arctic Nordic Archetype
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, sharp icy expression of a chibi white dragon wyrmling with spiky frost-like head crest, pale icy-white scales, pale blue underbelly, and glowing ice-blue eyes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character perched on spiky talons with frosted leather wings. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. Warm saturated but cozy palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Green Wyrmling (`green-wyrmling`) — Size Medium, East Asian Serpent Archetype
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, clever graceful expression of a chibi green dragon wyrmling with East Asian dragon whiskers, emerald scales, jade green mane fringe, and glowing golden eyes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character with a sinuous serpentine body posture and small winged fins. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. Warm saturated but cozy palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Blue Wyrmling (`blue-wyrmling`) — Size Medium, Middle Eastern Desert Archetype
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, proud electric expression of a chibi blue dragon wyrmling with a single prominent sweeping forehead horn, deep storm-blue scales, tan underbelly, and crackling cyan eyes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character perched proudly with broad wings. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. Warm saturated but cozy palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Black Wyrmling (`black-wyrmling`) — Size Medium, Swampland Shadow Archetype
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, sinister brooding expression of a chibi black dragon wyrmling with a skull-like sunken face, forward-curving horns, charcoal-black scales, and glowing acid-green eyes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character perched in a low stalking stance with dark tattered wings. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. Warm saturated but cozy palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

---

## 8. Monsters — ⬜ still needed (74), by creature type

These have no art yet. Each prompt is a **side-by-side design sheet** (portrait
left, token right, on a #00FF00 chroma key) in the current format the pipeline
slices — copy the whole line, generate, and process with
`slice_side_by_side.py`. Sizes follow the §4 SIZE tiers so relative scale reads
on the board.
### Humanoids

**Berserker** (`berserker`) — SIZE M, CR 2
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a raging chibi human berserker, a burly woman with tan skin, wild red hair, war-paint stripes, and a fierce open-mouthed battle cry. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character bare-armed in furs and leather, hoisting a big greataxe overhead in a reckless stance. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. rust red, fur brown, and steel palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Warrior Veteran** (`veteran`) — SIZE M, CR 3
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a grizzled chibi veteran soldier, a Black man with deep brown skin, close-cropped grey hair, a short beard, a facial scar, and a steady hard-eyed look. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character in well-worn scale mail with a longsword in one hand, a shortsword at the hip, and a light crossbow on the back. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. steel grey, oxblood, and worn brown palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Gladiator** (`gladiator`) — SIZE M, CR 5
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a showy chibi gladiator, a Polynesian man with warm brown skin, traditional tattoo-inflected markings, a topknot, and a crowd-pleasing grin. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character in ornate partial armor over a bare muscular torso, brandishing a trident-spear, one arm raised to the crowd. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. bronze, crimson, and gold palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Mage** (`mage`) — SIZE M, CR 6
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a clever chibi mage, a Middle-Eastern woman with warm brown skin, dark eyes, and dark hair under a star-embroidered hood. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character in deep-blue robes with silver runes, one hand raised trailing a spinning violet spell-glyph, a dagger at the belt. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. deep blue, silver, and arcane violet palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Assassin** (`assassin`) — SIZE M, CR 8
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a cold chibi assassin, an East-Asian person with pale skin, narrow calculating eyes, and a face half-hidden by a dark cloth mask. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character in fitted dark-grey leathers, a poisoned dagger in a reverse grip and a light crossbow, low and silent. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. charcoal grey, muted green, and steel palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Beasts

**Tyrannosaurus Rex** (`tyrannosaurus`) — SIZE XL, CR 8
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a chibi Tyrannosaurus rex with a huge scaly head full of dagger teeth, tiny arms, warm brown-and-tan hide, and gleaming yellow eyes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a big-headed T-rex on two thick legs with tiny clawed arms and a long counterbalancing tail, mid-roar. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. warm brown, tan, and mossy green palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Giant Scorpion** (`giant-scorpion`) — SIZE L, CR 3
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a giant scorpion with a glossy chitinous black-brown carapace, a cluster of little eyes, and two big pincers raised. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character reads clearly from above: eight legs, two great pincers, and a long segmented tail arched with a glistening sting. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. chitin brown, black, and amber palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Elephant** (`elephant`) — SIZE XL, CR 4
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a chibi elephant with a big round grey head, huge floppy ears, kind little eyes, curved ivory tusks, and a curling trunk. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a round grey elephant on four stout legs, tusks and raised trunk, standing four-square. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. warm grey, ivory, and dusty pink palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Giant Crocodile** (`giant-crocodile`) — SIZE L, CR 5
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a giant crocodile with a long armored dark-green snout crowded with teeth, knobbly ridged scales, and slit golden eyes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a low four-legged crocodile with long toothy jaws open, a ridged back and heavy tail, reads from above. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. swamp green, olive, and pale yellow palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Mammoth** (`mammoth`) — SIZE XL, CR 6
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a chibi woolly mammoth with a shaggy red-brown coat, a domed woolly head, huge upcurving tusks, and a raised trunk. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a big four-legged mammoth mounded with fur, great curved tusks, and small ears. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. red-brown, tawny, and ivory palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Giant Ape** (`giant-ape`) — SIZE XL, CR 7
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a giant ape with a huge shaggy dark-brown gorilla head, a heavy brow, deep-set eyes, and a bellowing open mouth. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a massive muscular ape standing and beating its chest with one fist, long arms and broad shoulders. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. dark brown, charcoal, and warm grey palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Fey

**Worg** (`worg`) — SIZE M
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a worg, a big evil wolf with coarse blackish-grey fur, a broad cruel muzzle, jagged fangs, pointed ears, and malicious glowing orange eyes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a hefty four-legged wolf in a low aggressive snarl with hackles raised, reads clearly as a wolf. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. blackish grey, charcoal, and burnt orange palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Undead

**Ghast** (`ghast`) — SIZE M, CR 2
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a ghast, a gaunt grey-green corpse with pulled-back lips over long fangs, sunken glowing eyes, and a look of hunger, spooky-cartoon and not gory. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a hunched clawed undead in rotted rags, mid-lunge, creepy-cute. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. grey-green, bruise purple, and bone palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Banshee** (`banshee`) — SIZE M, CR 4
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a banshee, a translucent floating spirit of a mournful woman with flowing ghostly hair, a wailing open mouth, and hollow glowing eyes, sad and eerie not gory. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a semi-transparent floating female wraith wisping into vapor below, hair and tattered gown streaming. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. spectral teal, pale green, and ghost white palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Ghost** (`ghost`) — SIZE M, CR 4
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a friendly-eerie ghost, a translucent pale figure with a gently sorrowful face, hollow soft-glowing eyes, and a wispy form. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a floating semi-transparent spirit trailing off into vapor, arms drifting. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. ghost white, pale blue, and faint cyan palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Wraith** (`wraith`) — SIZE M, CR 5
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a wraith, a hooded shape of pure darkness with no face but two burning red pinpoint eyes inside the cowl and ragged shadow robes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a floating black-robed figure trailing into shadow, skeletal shadow-hands reaching from the sleeves. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. black, deep charcoal, and ember red palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Vampire Spawn** (`vampire-spawn`) — SIZE M, CR 5
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a vampire spawn, a pale gaunt aristocrat with slicked dark hair, red eyes, and bared fangs in a hungry snarl. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character in torn dark finery with clawed hands raised, poised to spring. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. corpse pale, blood red, and black palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Fiends

**Shadow Demon** (`shadow-demon`) — SIZE M, CR 4
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a menacing shadow demon, a living silhouette of tattered darkness shaped like a winged imp, with two glowing crimson slit eyes and a jagged fanged grin, wisps of black smoke curling off its edges. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character its whole body a flat inky shadow-shape with clawed smoky hands spread wide and small bat wings. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. near-black shadow, ember crimson, and faint violet palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Succubus** (`succubus`) — SIZE M, CR 4
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, an alluring chibi succubus fiend, a woman with dusky rose-red skin, small curved horns, golden cat-eyes, and long dark-violet hair, a sly seductive smirk. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character with leathery bat wings and a spade-tipped tail, in dark elegant silks, one clawed hand beckoning. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. rose red, deep plum, and gold palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Bearded Devil** (`bearded-devil`) — SIZE M, CR 3
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a wiry green-scaled bearded devil with a long writhing barbed serpentine beard, pointed ears, narrow yellow eyes, and a cruel grin. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character holding a saw-toothed glaive, spiny tail lashing behind. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. sickly green, brass, and dull red palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Night Hag** (`night-hag`) — SIZE M, CR 5
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a wicked night-hag fiend with blue-black warty skin, a hooked nose nearly meeting her chin, wild white hair, sharp iron teeth, and burning orange eyes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character in ragged dark robes, clutching a bag of trophies and a glowing heartstone. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. blue-black, bruise purple, and ember orange palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Chain Devil** (`chain-devil`) — SIZE L, CR 8
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a spined red-black chain devil, a faceless barbed head wreathed in animate iron chains, jagged spikes along its shoulders. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character wrapped in a nest of writhing barbed chains that lash outward, spiked humanoid body. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. dark iron, rust red, and black palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Hezrou** (`hezrou`) — SIZE L, CR 8
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a bloated toad-demon hezrou with warty mottled green-brown hide, a huge fanged frog mouth, and tiny red eyes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a hulking pot-bellied toad-like body on two clawed legs, long arms tipped with black talons. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. swamp green, muddy brown, and sickly yellow palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Glabrezu** (`glabrezu`) — SIZE XL, CR 9
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a towering glabrezu demon with a snarling dog-like fanged head and goat horns, rose-brown hide, and four arms. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a massive four-armed body, two arms ending in huge crab pincers and two in clawed hands, both pincers raised. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. rose-brown, bone tan, and dull gold palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Horned Devil** (`horned-devil`) — SIZE XL, CR 11
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a great horned devil with deep-red scaled skin, a pair of huge curved ram horns, a fanged sneer, and glowing yellow eyes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character vast leathery bat wings, a long barbed whipping tail, hoisting a heavy iron fork. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. crimson, charcoal, and molten orange palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Imp** (`imp`) — SIZE S, CR 1
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a tiny sly red imp with little curved horns, big yellow eyes, pointed ears, and a fanged smirk. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character small leathery bat wings and a barbed tail with a dripping stinger, hovering with clawed hands. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. bright red, black, and yellow palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Quasit** (`quasit`) — SIZE S, CR 1
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a tiny warty green quasit demon with spindly limbs, little horns, bat ears, and big mischievous orange eyes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a scrawny toad-green imp-like body with tiny bat wings, needle claws, and a barbed tail. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. mottled green, black, and orange palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Dretch** (`dretch`) — SIZE S
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a pathetic lumpy dretch demon with pale grey-blue rubbery skin, a wide drooping fanged mouth, tiny dull eyes, and stubby horns. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a squat pot-bellied blob-demon with too-long clawed arms dragging at its sides. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. grey-blue, sickly pink, and brown palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Hell Hound** (`hell-hound`) — SIZE M, CR 3
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a fierce hell hound, a big black-mastiff head wreathed in flame with glowing ember eyes and smoke curling from bared fangs. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a four-legged hound in a low growling crouch, fire licking along its spine and jaws. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. coal black, ember orange, and smoky red palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Barbed Devil** (`barbed-devil`) — SIZE M, CR 5
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a barbed devil bristling with vicious spikes, dark-red scaled hide, glowing eyes, and a fanged grimace. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a spiky red humanoid with clawed hands and a spiked tail, spines jutting from every surface. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. dark red, iron grey, and orange palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Vrock** (`vrock`) — SIZE L, CR 6
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a vulture-demon vrock with a long fanged beak, beady red eyes, a mangy feathered ruff, and grey-green mottled skin. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character great ragged vulture wings spread, taloned bird feet, clawed hands, hunched forward. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. grey-green, dirty white, and dull red palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Elementals

**Dust Mephit** (`dust-mephit`) — SIZE S
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a dust mephit, a small impish elemental of swirling grey dust and grit with ragged tattered wings, glinting little eyes, and a smirk. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a scrawny winged dust-imp crumbling at the edges into a haze of grit. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. dusty grey, tan, and pale beige palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Mud Mephit** (`mud-mephit`) — SIZE S
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a mud mephit, a small dripping elemental of wet brown mud with sagging droopy features, tattered clay wings, and a sloppy grin. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a squat winged mud-imp, gloopy and dripping, leaving a splatter of drops. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. wet brown, ochre, and swamp green palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Smoke Mephit** (`smoke-mephit`) — SIZE S
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a smoke mephit, a wispy elemental of curling grey smoke and dull embers with hazy indistinct edges, glowing ember eyes, and a sooty grin. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a small winged smoke-imp trailing off into curling wisps, embers flickering. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. smoke grey, soot black, and ember orange palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Ice Mephit** (`ice-mephit`) — SIZE S
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, an ice mephit, a small crystalline elemental of jagged blue-white ice with frosty spiky wings, sharp icicle features, and a frozen smirk. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a scrawny winged ice-imp of angular frost shards, frost mist at its feet. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. ice blue, frost white, and pale cyan palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Magma Mephit** (`magma-mephit`) — SIZE S
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a magma mephit, a small elemental of cooling black rock cracked with glowing molten-orange seams, drippy lava features, and blazing eyes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a squat winged magma-imp of hardened crust and glowing lava cracks, dripping molten drops. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. molten orange, black basalt, and yellow palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Steam Mephit** (`steam-mephit`) — SIZE S
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a steam mephit, a small elemental of hissing white steam and hot mist with blurry billowing edges and a scalding grin. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a winged steam-imp wreathed in curling vapor, half-dissolving into mist. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. steam white, pale grey, and hot pink-red palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Magmin** (`magmin`) — SIZE S
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a magmin, a tiny gleeful elemental of blackened cooled rock with glowing lava veins, a wide ember grin, and little flames flickering off its head. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a small round rocky imp of cracked crust and molten glow, capering and trailing sparks. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. black basalt, molten orange, and yellow flame palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Azer Sentinel** (`azer`) — SIZE M, CR 2
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, an azer sentinel, a dwarf-like fire elemental with burnished brass-colored skin, a beard and hair of living flame, and glowing amber eyes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a stout brass-skinned smith-warrior with a flaming beard, in a metal kilt, hoisting a warhammer. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. burnished brass, flame orange, and dark bronze palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Salamander** (`salamander`) — SIZE L, CR 5
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a salamander, a fiery serpent-folk with a red-orange scaled humanoid torso, a crest of spines, and glowing eyes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a coiled snake-bodied fire being, humanoid torso wielding a red-hot spear, long flame-hot tail wrapped beneath. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. molten red, orange, and charcoal palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Invisible Stalker** (`invisible-stalker`) — SIZE L, CR 6
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, an invisible stalker air elemental shown as a barely-there translucent humanoid outline of rippling distortion with two faint glowing eyes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a see-through wavering humanoid of moving air, dust and leaves caught spiraling around its outline. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. near-transparent pale blue-grey and faint white palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Giants

**Hill Giant** (`hill-giant`) — SIZE XL, CR 5
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a big dim hill giant with warm ruddy-tan skin, a jowly slack-jawed face, a dull grin, and matted brown hair. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a huge round-bellied brute in patched hides, dragging an uprooted-tree greatclub. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. ruddy tan, earth brown, and mossy green palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Stone Giant** (`stone-giant`) — SIZE XL, CR 7
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a lean grey stone giant with smooth granite-grey skin, a calm angular ascetic face, deep-set dark eyes, and no hair. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a tall lithe grey giant in a simple stone-grey wrap, holding a heavy stone club, poised to hurl a boulder. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. granite grey, slate, and pale ochre palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Frost Giant** (`frost-giant`) — SIZE XL, CR 8
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a fierce frost giant with pale ice-blue skin, a braided frost-white beard hung with ice, blue eyes, and a snarling grin. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a huge muscular giant in patchwork plate and furs, hoisting a great frost-rimed greataxe. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. ice blue, white, and steel grey palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Fire Giant** (`fire-giant`) — SIZE XL, CR 9
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a brutal fire giant with charcoal-black skin glowing with embers at the cracks, a flaming red-orange beard, and molten eyes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a massive giant in blackened iron plate, swinging a huge soot-black greatsword as embers rise. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. charcoal black, molten orange, and dull iron palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Troll** (`troll`) — SIZE L, CR 5
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a lanky green troll with rubbery warty moss-green skin, a long drooping nose, small dull black eyes, tusks, and stringy black hair. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a gangly hunched troll with long clawed arms and a potbelly, mid-lurch. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. moss green, mottled grey, and dull red palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Dragons

**Wyvern** (`wyvern`) — SIZE L, CR 6
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a wyvern, a lean dragon-kin with a fanged reptilian head, swept-back horns, fierce yellow eyes, and two great bat wings (no forelegs). Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character perched on two clawed legs with wings folded and a long tail arched over with a dripping stinger barb. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. slate blue-grey, olive, and venom green palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Young White Dragon** (`young-white`) — SIZE L, CR 6
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a young white dragon with sleek pale icy-white scales, a spiky frost-crest, an angular snout, and cold blue eyes, a wisp of frost breath. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a four-legged winged dragon in a low prowling stance with frosted wings and a whip tail. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. icy white, pale blue, and steel palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Young Black Dragon** (`young-black`) — SIZE L, CR 7
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a young black dragon with glossy charcoal-black scales, forward-curving horns, a skull-like snout, and glowing acid-green eyes, acid dripping from its jaws. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a lean four-legged winged dragon in a stalking crouch with tattered dark wings and a long tail. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. charcoal black, swamp green, and acid green palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Young Green Dragon** (`young-green`) — SIZE L, CR 8
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a young green dragon with emerald scales, a fringed crest and short frilled horns, a cunning narrow-eyed look, and a curl of poison gas. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a sinuous four-legged winged dragon with emerald wings half-spread in a clever poised stance. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. emerald green, olive, and toxic yellow-green palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Young Blue Dragon** (`young-blue`) — SIZE XL, CR 9
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a young blue dragon with deep storm-blue scales, a single large sweeping forehead horn, a ridged brow, and crackling cyan eyes, sparks arcing over its snout. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a broad four-legged winged dragon with big frilled wings and lightning crackling along its horn and tail. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. storm blue, indigo, and electric cyan palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Young Red Dragon** (`young-red`) — SIZE XL, CR 10
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a young red dragon with blazing crimson scales, a fan of back-swept horns, a fanged sneer, glowing ember eyes, and smoke curling from its nostrils. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a big powerful four-legged winged dragon, wings raised, a molten glow in its throat and a long tail. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. crimson red, molten orange, and charcoal palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Monstrosities

**Rust Monster** (`rust-monster`) — SIZE S
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a rust monster, a comical armored bug with a segmented tan-and-rust shell, two feathery antennae, and little stalk eyes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a low four-legged beetle-thing with two waving rust-colored antennae reaching forward and a propeller-like tail, reads from above. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. rust orange, tan, and blue-grey palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Griffon** (`griffon`) — SIZE L, CR 2
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a proud griffon with a fierce golden-eagle head, a hooked beak, sharp amber eyes, and a feathered crest over a tawny lion mane. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character eagle foreparts with taloned front legs and wings, tawny lion hindquarters and tail, wings half-spread. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. tawny gold, chestnut brown, and cream palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Ettercap** (`ettercap`) — SIZE M, CR 2
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, an ettercap, a hunched spider-humanoid with a bulbous fanged head, many little black eyes, mottled grey-green skin, and a distended belly. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a gangly clawed spider-person with spindly limbs and dripping fangs, trailing a strand of web. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. grey-green, sickly yellow, and web white palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Basilisk** (`basilisk`) — SIZE M, CR 3
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a basilisk, a squat reptile with heavy bony brown scales, a stubby snout, a spiky dorsal ridge, and glowing pale-green petrifying eyes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a low stocky eight-legged lizard with a spiny back, reads clearly from above, eyes glinting green. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. earth brown, dull green, and sickly-green glow palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Winter Wolf** (`winter-wolf`) — SIZE L, CR 3
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a winter wolf, a huge frost-white wolf with icy-blue eyes, a frosted ruff, and cold breath misting from its fangs. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a big four-legged white wolf in a low snarling crouch, frost dusting its coat. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. snow white, ice blue, and pale grey palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Bulette** (`bulette`) — SIZE L, CR 5
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a bulette land-shark with a huge fanged shark-like head, a domed iron-grey armor plate over its back, and beady eyes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a hulking four-legged beast with heavy fin-like back plates and big digging claws, mid-lunge from the ground. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. iron grey, slate blue, and bone palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Remorhaz** (`remorhaz`) — SIZE XL, CR 11
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a remorhaz, a monstrous centipede-worm with a chitinous carapace glowing red-hot between the plates and a gaping mandibled maw. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a long many-legged armored worm rearing up, molten heat glowing from the seams of its shell. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. blue-grey chitin, molten orange, and black palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Chimera** (`chimera`) — SIZE XL, CR 6
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a chimera with three heads on one leonine body: a maned lion head roaring, a horned goat head, and a red dragon head breathing a wisp of flame. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a tawny winged lion body with the three heads (lion, goat, dragon) rising together and a serpent tail. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. tawny gold, slate goat-grey, and dragon red palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Hydra** (`hydra`) — SIZE XL, CR 8
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a hydra with five serpentine reptilian heads on long green-scaled necks, each with snapping fanged jaws and yellow eyes. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a squat four-legged green-scaled body with five long necks and snapping heads fanning out. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. swamp green, olive, and pale yellow palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Aberrations

**Roper** (`roper`) — SIZE L, CR 5
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a roper disguised as a craggy stone column with a single hidden eye and a fanged maw splitting its surface, thin barbed tendrils. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a tall craggy grey pillar-creature with several sticky barbed tendrils reaching out and a toothy mouth. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. cave grey, stone brown, and pale eye-yellow palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Otyugh** (`otyugh`) — SIZE L, CR 5
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, an otyugh, a bloated tick-like scavenger with warty grey-brown hide, a huge fanged mouth on its body, and two eye-stalk tentacles. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a squat round three-legged body with two long tentacles ending in leaf-like flaps and eye-stalks, reads from above. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. muddy brown, grey-green, and sickly pink palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Aboleth** (`aboleth`) — SIZE XL, CR 10
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, an aboleth, a primeval fish-thing with a bulbous blue-green body, three red slit eyes stacked on its head, and four long face tentacles over a lamprey mouth. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a long finned eel-like body with trailing tentacles and three glowing eyes, gliding. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. deep teal, blue-green, and glowing red palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Constructs

**Scarecrow** (`scarecrow`) — SIZE M, CR 1
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a creepy-cute scarecrow with a burlap-sack head, stitched eyes glowing faint orange, a jagged stitched grin, and a battered hat, straw poking from its collar. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a raggedy straw-stuffed figure in tattered farm clothes, arms spread, straw hands like claws. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. burlap tan, straw gold, and ember orange palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Shield Guardian** (`shield-guardian`) — SIZE L, CR 7
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a hulking shield-guardian construct, a blocky armored golem with a rune-etched faceplate glowing faint amber and a bound-guardian sigil on its chest. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a big heavy humanoid construct of banded metal and stone, one fist raised, ponderous. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. bronze, dark iron, and amber glow palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Stone Golem** (`stone-golem`) — SIZE XL, CR 10
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a stone golem, a massive carved-granite humanoid with a blocky angular head, rune-lit glowing eyes, and archaic sculpted armor patterning. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a towering slab-muscled stone figure with fists like boulders and ancient carvings across its body. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. granite grey, sandstone tan, and rune blue palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Animated Flying Sword** (`flying-sword`) — SIZE S
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, an animated flying sword: a single ornate steel longsword hovering upright on its own with a faint blue glow along the blade and a jeweled crossguard, no wielder. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character one hovering sword tilted point-down at the ready, a faint arcane glimmer at the hilt. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. steel silver, brass, and arcane blue palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Animated Rug of Smothering** (`rug-of-smothering`) — SIZE M, CR 2
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, an animated rug of smothering, an ornate patterned carpet come to life, its front edge rippling up into a menacing face of folds with bristling tassels. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a large richly-patterned rug rearing and rippling like a stingray, edges curling to grab, reads from above. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. deep red, gold, and indigo weave palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Flesh Golem** (`flesh-golem`) — SIZE L, CR 5
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a flesh golem, a big stitched-together patchwork humanoid with mismatched grey-green skin tones, neck bolts, heavy sutures, and a flat dull expression, Frankenstein-cute not gory. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a lumbering broad patchwork brute in ragged trousers, arms hanging, mismatched limbs. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. grey-green, ashen tan, and iron bolt-grey palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Oozes

**Gray Ooze** (`gray-ooze`) — SIZE M
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a gray ooze, a slick puddle of metallic-grey slime with a wet sheen and a couple of dim eye-glints, blobby and formless. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a low spreading grey slime blob with a raised pseudopod, reads from above as a shiny puddle. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. wet metallic grey, slate, and oily blue palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Ochre Jelly** (`ochre-jelly`) — SIZE M, CR 2
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, an ochre jelly, a translucent amber-yellow blob of jelly with faint bubbles suspended inside and a soft wobble. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a rounded quivering ochre blob spreading low with one bump rising, reads from above. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. amber yellow, ochre, and honey palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Gelatinous Cube** (`gelatinous-cube`) — SIZE L, CR 2
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a gelatinous cube, a huge transparent green-tinted cube of jelly with a few bones and coins suspended inside, glassy and clean-edged. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a big see-through jelly cube with faint highlights on its edges and odds and ends floating within. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. pale green, clear glass, and faint cyan palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

**Black Pudding** (`black-pudding`) — SIZE L, CR 4
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, a black pudding, a glossy tar-black amoeba of acidic sludge with a wet gleaming surface and a bubbling shimmer, featureless. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character a spreading inky-black blob with a couple of pseudopods and an oily sheen, reads from above. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. tar black, oily purple, and acid green palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

---

## 9. Integration — filenames & wiring

Save each asset as `token-<id>.png` + `portrait-<id>.png` in `art/source/`
(IDs are the `classId` / monster id in the engine, so wiring is a lookup with no
ambiguity). The build pipeline emits the atlas and `web/public/` assets. The
full per-asset status list lives in §5.

**After generating ⬜ art:** drop the source PNGs in `art/source/`, add the ids
to `IDS` in `art/process.py` and `HAS_ART` in `web/src/art.ts`, then run
`python art/process.py` to emit the WebP. That's the whole wiring. Anything not
yet generated falls back to the emoji glyph, so the game stays playable while art
lands incrementally.

---

## 10. QA checklist (reject and re-roll if any fail)
- [ ] **Reads at 48px** — shrink the token to a thumbnail; is it still clearly
      that character? Is the iconic feature legible?
- [ ] **Distinct silhouette** — fill it black; is it identifiable and different
      from its neighbors (esp. the two goblins, the wolves)?
- [ ] **On-model style** — chibi proportions, cel-shaded, correct ink outline
      color, matches the rest of the set (compare side by side).
- [ ] **Transparent background** — truly empty alpha, no stray shadow, halo,
      platform, or off-white fringe.
- [ ] **Team-neutral** — no blue/red baked in (the engine adds the team ring).
- [ ] **Tone** — friendly heroes, cartoon-menacing monsters, nothing gory.
- [ ] **Representation** — the person matches the identity fixed in its subject
      line; and stepping back, the **human cast as a whole** spans skin tones,
      genders, and ages (not a row of young pale men). Re-roll defaults.
- [ ] **Relative size** — the ogre visibly dwarfs the kobold when both are
      scaled into a cell.
- [ ] **Consistent framing** — feet near bottom, centered, even padding, so all
      tokens align on the board.

---

---

## 11. Optional: title / key art (not required for launch)

> A modern-JRPG key-art banner: the chibi party of four (fighter, wizard,
> cleric, rogue) standing together heroically on a stylized top-down battle
> grid, facing a cartoon goblin warband across the board, warm cozy palette,
> cel-shaded, thick ink outlines, a dark twilight background with warm rim
> glow. Landscape 16:9. Leave clear space in the upper third for a title.

---
