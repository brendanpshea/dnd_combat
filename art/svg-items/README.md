# SVG Item Icons Library (`art/svg-items/`)

Vector icons for weapons, armour, potions and scrolls, on transparent
backgrounds. Source lives here; the app loads the published copies from
`web/public/art/items/`.

## Regenerating

Two steps, in this order:

```bash
python art/generate_svg_items.py   # draw the shapes
npm run svg-frame                  # crop each viewBox, then publish
```

The second step is not optional. `generate_svg_items.py` draws everything inside
a 512x512 canvas and most icons use very little of it — a rapier covered **4%**
of its own box, and at inventory size a dagger, a longsword and a greatsword
were three identical slivers. `npm run svg-frame` measures each drawing's real
bounding box in a headless browser and crops the viewBox to it, which roughly
doubles how large every icon renders in a fixed slot. It then copies the result
into `web/public/art/items/`.

Both steps are checked by the test suite (`npm test`), so a forgotten framing
pass fails rather than shipping.

## How the app uses them

`web/src/itemArt.ts` maps an inventory id onto the shape it is: `+1`, `silvered`
and `vicious` variants resolve to the plain weapon, every `scroll-*` to one
scroll, and the resistance potions to a potion. That is how 34 pictures cover
**159 of the 191** things a player can own.

The rest — wands, staves, rings, figurines and the named magic blades — keep
their emoji on purpose. Drawing a Sun Blade as an ordinary longsword would say
the wrong thing about the one weapon in the shop worth saving for.

`web/src/ItemIcon.tsx` draws them only where the icon gets 40px or more (gear
slots, gear picker, shop rows). Below roughly 28px these lose to the emoji, so
the 20px loot list keeps emoji.

## File conventions

- **Transparent**: no background rects or badge circles.
- **Namespaced ids**: every gradient and filter id is prefixed with the item id.
  All 34 files once declared the same `blade-light`, `drop-shadow` and so on,
  which is harmless as separate `<img>` files and silently repaints half of them
  the moment two are inlined into one document.
- **No dead defs**: each file carries only the definitions it references. The
  shared block used to be emitted whole, leaving 732 of 884 definitions unused.

## Proportional Specs
- **Background**: 100% Transparent background (no background badge rects or dark circles).
- **Proportional Sword Blade vs Hilt Ratios**:
  - `dagger`: Very short single-hand grip (35px), compact stiletto blade (150px).
  - `shortsword`: Short single-hand grip (42px), medium straight blade (210px).
  - `longsword`: Standard 1.5-hand grip (60px), long double-edged blade (260px).
  - `greatsword`: True two-handed long grip (90px), massive broad blade (270px) with ricasso lugs.
  - `scimitar`: Curved single-edged blade, brass knuckle guard.
  - `rapier`: Slender needle blade, wire cup basket guard.

## Available Item SVGs (34 icons)

| Item ID | Item Name | File Link | Category | Specs |
| :--- | :--- | :--- | :--- | :--- |
| `dagger` | Dagger | [dagger.svg](./dagger.svg) | Simple Weapon | Short grip (35px), stiletto blade (150px), poison drip |
| `shortsword` | Shortsword | [shortsword.svg](./shortsword.svg) | Martial Weapon | Short grip (42px), medium straight blade (210px), brass guard |
| `longsword` | Longsword | [longsword.svg](./longsword.svg) | Martial Weapon | 1.5-hand grip (60px), long blade (260px), swept gold quillons |
| `greatsword` | Greatsword | [greatsword.svg](./greatsword.svg) | Martial Weapon | 2-hand grip (90px), massive blade (270px), ricasso lugs & winged guard |
| `scimitar` | Scimitar | [scimitar.svg](./scimitar.svg) | Martial Weapon | Curved single-edged blade, brass knuckle guard & pommel |
| `rapier` | Rapier | [rapier.svg](./rapier.svg) | Martial Weapon | Slender needle blade, wire cup basket guard |
| `battleaxe` | Battleaxe | [battleaxe.svg](./battleaxe.svg) | Martial Weapon | Single heavy crescent axe blade, rear peen block, top spike |
| `greataxe` | Greataxe | [greataxe.svg](./greataxe.svg) | Martial Weapon | Double-bitted crescent steel axe, top spear point, and leather-wrapped haft |
| `handaxe` | Handaxe | [handaxe.svg](./handaxe.svg) | Simple Weapon | Single-bit crescent blade, flat hammer peen, compact wood haft |
| `spear` | Spear | [spear.svg](./spear.svg) | Simple Weapon | Leaf spearhead, brass socket, wooden shaft, grip wrap |
| `quarterstaff` | Quarterstaff | [quarterstaff.svg](./quarterstaff.svg) | Simple Weapon | Polished hardwood staff, iron-banded ends, leather grip |
| `mace` | Mace | [mace.svg](./mace.svg) | Simple Weapon | Heavy 6-flanged steel mace head with top spike, bronze collar, and haft |
| `warhammer` | Warhammer | [warhammer.svg](./warhammer.svg) | Martial Weapon | Heavy square striking face, rear beak spike, and steel-reinforced shaft |
| `javelin` | Javelin | [javelin.svg](./javelin.svg) | Simple Weapon | Symmetrical leaf spearhead, bronze socket, wooden shaft, red banner ribbon |
| `shortbow` | Shortbow | [shortbow.svg](./shortbow.svg) | Simple Weapon | Recurved wood stave, horn nocks, drawn string, and fitted flight arrow |
| `longbow` | Longbow | [longbow.svg](./longbow.svg) | Martial Weapon | Tall recurved wood stave, horn nocks, drawn string, leather grip |
| `light-crossbow` | Light Crossbow | [light-crossbow.svg](./light-crossbow.svg) | Simple Weapon | Hardwood tiller stock, steel bow arms, brass bridle, and loaded bolt |
| `shield` | Shield | [shield.svg](./shield.svg) | Shield | Heater shield with steel rim & rivets, blue/red field, and gold sunburst crest |
| `padded` | Padded Armor | [padded.svg](./padded.svg) | Light Armor | Quilted cloth tunic, leather collar trim, cross-hatch stitching, brass buttons |
| `leather` | Leather Armor | [leather.svg](./leather.svg) | Light Armor | Warm-brown leather cuirass, pauldrons, double chest harness with brass buckles |
| `studded-leather` | Studded Leather | [studded-leather.svg](./studded-leather.svg) | Light Armor | Dark leather jacket, reinforced steel trim, and grid of brass rivets/studs |
| `hide` | Hide Armor | [hide.svg](./hide.svg) | Medium Armor | Jagged raw beast hide cuirass, fur mantle collar, horn fasteners, cross-stitches |
| `chain-shirt` | Chain Shirt | [chain-shirt.svg](./chain-shirt.svg) | Medium Armor | Interwoven steel chainmail shirt, leather collar and hem trim |
| `scale-mail` | Scale Mail | [scale-mail.svg](./scale-mail.svg) | Medium Armor | Overlapping rows of metallic scale plates on dark leather backing |
| `breastplate` | Breastplate | [breastplate.svg](./breastplate.svg) | Medium Armor | Polished steel breastplate, median ridge, gold trim, shoulder straps |
| `half-plate` | Half Plate | [half-plate.svg](./half-plate.svg) | Medium Armor | Steel chestplate, heavy layered shoulder pauldrons, thigh tassets, gold medallion |
| `ring-mail` | Ring Mail | [ring-mail.svg](./ring-mail.svg) | Heavy Armor | Heavy leather tunic with large iron rings sewn on, brass buckle belt |
| `chain-mail` | Chain Mail | [chain-mail.svg](./chain-mail.svg) | Heavy Armor | Full heavy chainmail hauberk with long sleeves, draped coif hood, waist belt |
| `splint` | Splint Armor | [splint.svg](./splint.svg) | Heavy Armor | Vertical steel splint slats riveted onto leather backing, cross-straps, pauldrons |
| `plate` | Full Plate | [plate.svg](./plate.svg) | Heavy Armor | Full suit of knightly plate armor, massive pauldrons, gorget, gold filigree, gem crest |
| `potion-healing` | Potion of Healing | [potion-healing.svg](./potion-healing.svg) | Consumable | Glass flask, cork stopper, glowing ruby liquid, bubbles, and gold cross |
| `potion-greater-healing` | Potion of Greater Healing | [potion-greater-healing.svg](./potion-greater-healing.svg) | Consumable | Faceted crystal flask, gold filigree cage, glowing ruby core, and sapphire plug |
| `alchemists-fire` | Alchemist's Fire | [alchemists-fire.svg](./alchemists-fire.svg) | Consumable | Hexagonal flask in brass cage, bubbling lava-orange fire liquid, and sparks |
| `scroll` | Scroll | [scroll.svg](./scroll.svg) | Consumable | Unrolling parchment scroll with glowing purple arcane runes, ribbon, and wax seal |
