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

**Status legend:** ✅ generated and wired in the engine (`HAS_ART` in
`web/src/art.ts`) · ⬜ needed (still on the emoji fallback). As of this writing
the four heroes, eight species portraits, and all Tier 1–3 monsters are ✅; the
five level 4–5 additions in **§6 Tier 4** are ⬜ and the reason this doc was
last touched.

---

## 1. How to use this doc

1. Copy the **Style Preamble** (§3) verbatim.
2. Append one asset's **subject line** (§5–6).
3. Append the matching **Token spec** or **Portrait spec** (§4).
4. Generate. Lock the style with the first good result: feed it back as a
   style/reference image for every subsequent asset. Keep the same seed family
   if your tool supports it.
5. Save with the exact filename in the integration table (§7) so the engine can
   map it with no guesswork.

**Two assets per character:**
- **Token** — the chibi figure on the board. Must read at ~48px.
- **Portrait** — a bust shown in the status bar, target chooser, character
  sheet, and campaign party cards, where there's room for detail.

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
- **L** (~85%): goblin boss, dire wolf, brown bear, minotaur
- **XL** (~95%): ogre, ettin, ogre mage

---



---

## 6. Monsters

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

## 7. Integration — filenames & mapping

Save each asset with these exact names. IDs match `classId` / monster id in the
engine, so wiring is a lookup with no ambiguity. Put source PNGs in
`art/source/`; the build pipeline emits the atlas + `web/public/` assets.

Status: ✅ = art present; ⬜ = still needed (emoji fallback).

| Character | Token file | Portrait file | Status |
| --- | --- | --- | --- |
| Fighter | `token-fighter.png` | `portrait-fighter.png` | ✅ |
| Wizard | `token-wizard.png` | `portrait-wizard.png` | ✅ |
| Cleric | `token-cleric.png` | `portrait-cleric.png` | ✅ |
| Rogue | `token-rogue.png` | `portrait-rogue.png` | ✅ |
| Goblin Warrior | `token-goblin-warrior.png` | `portrait-goblin-warrior.png` | ✅ |
| Goblin Boss | `token-goblin-boss.png` | `portrait-goblin-boss.png` | ✅ |
| Kobold | `token-kobold.png` | `portrait-kobold.png` | ✅ |
| Wolf | `token-wolf.png` | `portrait-wolf.png` | ✅ |
| Skeleton | `token-skeleton.png` | `portrait-skeleton.png` | ✅ |
| Zombie | `token-zombie.png` | `portrait-zombie.png` | ✅ |
| Ogre | `token-ogre.png` | `portrait-ogre.png` | ✅ |
| Bandit | `token-bandit.png` | `portrait-bandit.png` | ✅ |
| Bandit Captain | `token-bandit-captain.png` | `portrait-bandit-captain.png` | ✅ |
| Dire Wolf | `token-dire-wolf.png` | `portrait-dire-wolf.png` | ✅ |
| Ghoul | `token-ghoul.png` | `portrait-ghoul.png` | ✅ |
| Giant Spider | `token-giant-spider.png` | `portrait-giant-spider.png` | ✅ |
| Acolyte | `token-acolyte.png` | `portrait-acolyte.png` | ✅ |
| Orc | `token-orc.png` | `portrait-orc.png` | ✅ |
| Brown Bear | `token-brown-bear.png` | `portrait-brown-bear.png` | ✅ |
| Scout | `token-scout.png` | `portrait-scout.png` | ✅ |
| Cult Fanatic | `token-cult-fanatic.png` | `portrait-cult-fanatic.png` | ✅ |
| Animated Armor | `token-animated-armor.png` | `portrait-animated-armor.png` | ✅ |
| Knight | `token-knight.png` | `portrait-knight.png` | ✅ |
| Minotaur | `token-minotaur.png` | `portrait-minotaur.png` | ✅ |
| Ettin | `token-ettin.png` | `portrait-ettin.png` | ✅ |
| Priest | `token-priest.png` | `portrait-priest.png` | ✅ |
| Ogre Mage | `token-ogre-mage.png` | `portrait-ogre-mage.png` | ✅ |

Species portrait variants (✅, forge only — token + portrait both present):
`orc-barbarian`, `dragonborn-paladin`, `gnome-bard`, `halfling-rogue`,
`tiefling-warlock`, `dwarf-berserker`, `elf-archer`, `human-bard` — files
`token-<id>.png` / `portrait-<id>.png`.

**After generating the ⬜ art:** drop the source PNGs in `art/source/`, add the
ids to `IDS` in `art/process.py` and `HAS_ART` in `web/src/art.ts`, then run
`python art/process.py` to emit the WebP. That's the whole wiring.

Any asset that doesn't exist yet falls back to the current emoji glyph in the
engine, so the game stays playable while art lands incrementally.

---

## 8. Fey Creatures (2024 SRD)

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

## 9. QA checklist (reject and re-roll if any fail)

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

## 9. Optional: title / key art (not required for launch)

> A modern-JRPG key-art banner: the chibi party of four (fighter, wizard,
> cleric, rogue) standing together heroically on a stylized top-down battle
> grid, facing a cartoon goblin warband across the board, warm cozy palette,
> cel-shaded, thick ink outlines, a dark twilight background with warm rim
> glow. Landscape 16:9. Leave clear space in the upper third for a title.

---

## 10. Mature Hero Class Variants

Prompts for mature, seasoned battle-hardened versions of the 4 core hero classes (matching existing skin tones and genders):

### Mature Fighter (`fighter-mature` / `human_fighter_mature`) — Size Medium
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, confident battle-tested expression of a mature Black woman knight with deep brown skin, high cheekbones, and neat dark box braids tucked slightly behind her neck. Wearing steel scale-plate armor with a warm brown tabard and gold trim. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character holding a shining steel longsword upright and carrying a round wooden shield with iron rim on her arm. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Seasoned warrior appearance, not childlike. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. Warm saturated but cozy palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Mature Wizard (`wizard-mature` / `human_wizard_mature`) — Size Medium
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, wise solemn expression of a mature archmage elder with warm tan-olive skin, fine lines around kind eyes, and a long wispy white beard. Wearing a floppy pointed indigo hat embroidered with gold star constellations and small round spectacles. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character in flowing indigo robes with rolled sleeves, holding a gnarled oak staff topped with a glowing purple arcane crystal. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Seasoned archmage appearance, not childlike. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. Warm saturated but cozy palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Mature Cleric (`cleric-mature` / `human_cleric_mature`) — Size Medium
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, serene resolute expression of a mature cleric woman with warm medium-brown skin, dignified features, and thick braided locs neatly bound. Wearing golden celestial plate armor over cream robes with a soft radiant halo glint. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character holding a radiant golden sunburst holy mace and a glowing sunburst holy symbol. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Seasoned battle priestess appearance, not childlike. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. Warm saturated but cozy palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

### Mature Rogue (`rogue-mature` / `human_rogue_mature`) — Size Medium
> A side-by-side character design sheet split vertically down the middle, against a solid bright green chroma-key background (#00FF00). Left side: PORTRAIT: head-and-shoulders bust, 3/4 facing, sharp focused smirk of a mature rogue man with light brown skin (Southeast-Asian / Latino inflection), a subtle razor scar across one cheek, shadowed beneath a dark teal cowl hood. Right side: TOKEN: full-body chibi, standing, facing the viewer, feet near the bottom edge of the same character in dark teal-green studded leather armor, holding two steel daggers in reverse grip in a low crouched stance. Style for both sides: Chibi super-deformed character, modern JRPG / YA-graphic-novel style, about 2 heads tall, big head, large expressive eyes, small body. Seasoned veteran scout appearance, not childlike. Clean confident cel-shaded cartoon: flat colors, one soft shadow tone, one small highlight, bold dark warm-brown ink outline (#2a2333), slightly heavier on the silhouette. No gradients, no painterly rendering, no photorealism, no text, no watermark. Warm saturated but cozy palette. Soft top-front lighting, consistent. No ground shadow, no scenery, no base or platform.

