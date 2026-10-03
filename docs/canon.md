# The world bible: canon for the trilogy

The facts the prose of The Hollow Road, The Sunken Barrows and The
Wyrmcalling relies on, in one place. Names and numbers that rules also read
(prices, counts, the liturgy's three hundred winters) live in
`src/data/modules/canon.ts` and are said by token (`{door-price}`); this page
holds the rest: when, where, what people look like and carry, and who was
where on each ledger value (`docs/state-ledger.md`).

**Before you write a fact, look it up here. If it is not here, add it here
first**, then write the line. Where the text disagreed when this page was
written, the reading most of the text already supports was chosen, and the
lines that disagree are listed under **Contradicts** (scene id and quote) for
the next fix round. `test/canon-phrases.test.ts` bans the phrasings that
contradict this page; those still in the text sit in its `KNOWN` list until
they are fixed.

Scene ids are written `chapter:scene`; a dawn is `chapter:dawn-N`.

---

## Timeline

| | Season | Length | What the text says |
|---|---|---|---|
| Part 1, The Hollow Road | **spring** | at most a week (the dark moon on the seventh dawn) | "the raids started this spring" (Mira), "this spring I came home and sold them" (Vargan); frost on the fifth morning (an early spring) |
| Part 2, The Sunken Barrows | **summer**, one season later | a few days | "A dead horse came down on me on the marsh road, last season" (Wren, `sunken-barrows:fen-out`); "You had hoped for a quiet season after the marsh" |
| Part 3, The Wyrmcalling | **autumn**, one season after Part 2 | six days to the peak | "Two seasons ago … broke the Ashfang", "Last season the dead of Thornwick walked" (`wyrmcalling:muster`); "In the autumn the reeve sends Vex his pardon" |

- **About a season between chapters.** A line may say "last season", "a
  season ago", "two seasons ago". It never says "last year".
- **The year of three wars** is one calendar year, spring to autumn: the
  raiders, the graves, the hills (`wyrmcalling:wc-epilogue`). Midwinter (the
  lamb) falls after all three parts.
- **The dark moon (Part 1).** The moon is a thin paring at dawn 4, "wasting"
  at dawn 5, a rind at dawn 6, and gone the night before dawn 7. That night the
  Reedwife takes whoever is still in the pen (dawn 7 sets `captives-taken`).
  The reed-cutters count the nights toward it; the carter was taken "last
  week" before the company arrives.
- **The Calling (Part 3).** The stone began singing "when the fires started",
  some days before the company comes; at dawn 3 Wren reckons "three more
  nights", and it peaks at dawn 6 (`peak-nights` in canon.ts).
- **The lamb** is paid each midwinter, at the water's edge; it is a wage, not
  an offering (Halden's notes).

**Contradicts:** none. (The lines listed here were fixed in round 15; `test/canon-phrases.test.ts` keeps them out.)

## Places

**Thornwick** sits in a valley under grey hills, a day's walk up the valley
from the lowland road. In it: the square and its well, the market (Bram), the
reeve's hall (Aldous), the Wander-Inn (Mira), the churchyard and its bell; the
old mill is just outside. Thornwick has two roads out that matter:

- **The marsh road** runs out of Thornwick's gate, past the reeds, into the
  marsh toward the hills (the Part 1 trail map is "The Marsh Road"). Along it:
  the goblins a mile from the gate, the patrols' tracks, the sunken ravine, the
  scout under the dead horse, a sunken barrow off the road (Part 1's barrow,
  the first crack), the webbed thicket. It ends at **the hollow**, a basin in
  the hills past the marsh, where the lizardfolk ambush waits at its lip and
  the **Ashfang den** stands inside a ring of lashed timber with one gate.
  **The carter was taken off the marsh road.** Both scouts rode down it, and
  the dead horse came down on the marsh road.
- **The fen road** is a cart-road from a second gate (the gate-warden keeps it
  shut without the reeve's say-so). It ends at a milestone where **the old
  raised road** (the causeway) begins, into the deep fen. From the causeway:
  the drowned chapel to the north, its still pool north of the chapel, the
  corpse-lights on the flat water to the south. Past both, the **Barrow Gate**
  (standing stones, where the barrow-country begins), the barrow-field, and
  the great barrow at its heart: the **Undercrypt**, and at the bottom of its
  stair the **Warden's door** ("the door under the fen", "the door under the
  barrows": one door).
- **The marsh and the fen.** The reed-cutters' **shallows** (common water
  until Vargan sold them) are at the near edge of the marsh below Thornwick.
  The deep fen lies beyond, and the fen-folk live out at the far pools. The
  Reedwife's own water, **her pool**, is out in the fen; the shallows "above
  the barrows" are where the three tall women are seen at the end.
- **Saltmere** is Marrow's village out on the fen, emptied by fever: forty
  graves, which he dug.
- **The war-camp** (Part 3) spreads across the wet meadows below the high
  hills, its weak side the **east line**. Above it: the switchbacks, the three
  wyrm dens, the manticore's toll-cliff, the boar-runs, the ogre-mage's hold
  across the **middle pass**, the gorgon's valley of statues past it, the
  giants' hall above the tree-line, the last ridge and its **rim**, and below
  the rim **the bowl**, with **the Calling Stone** (a black fang of rock, lead
  letters round its base) at the bottom.
- **The dens** are three, each its own place: the **red** den, a forge-hall in
  the rock (fire, scorch); the **green** den, a briar tunnel (poison, no fire);
  the **blue** den, a ruined watchtower hung with copper rods (lightning).
- Not fixed, and not to be invented in passing: compass directions between
  Thornwick, the hollow, the fen and the high hills. If a line needs one, add it
  here first.

**Contradicts:** none. (The lines listed here were fixed in round 15; `test/canon-phrases.test.ts` keeps them out.)

## People and objects

**The carter and his granddaughter.** A grey-bearded carter and his
granddaughter, **seven** ("about seven" to the narrator), taken off the marsh
road a week before the company comes. In the pen with them: **two
reed-cutters**, four in all. The carter's gran paid the Reedwife a lamb each
midwinter. He carries the girl on his back. The narrator calls her "the girl"
or "the carter's girl"; he calls her "my granddaughter", never "a girl".
In Part 3 (freed only) he drives supply wagons for the war-camp, and she wears
the new shoes.

**The girl's one shoe.** She wears **one shoe, on her right foot**. The
**left** shoe hangs among the trophies in the chief's hall ("a child's left
shoe, small and still muddy"). Taken from the pen, she leaves the right one in
the straw. Freed, she gets a new pair (on the well in Part 1's epilogue; "the
girl in her new shoes" in Part 3). She never holds the shoe in her hands.

**Wren.** The reeve's scout: young, a bow, a grey horse, a boot-knife; the
reeve's colours by Part 2, a captain's knot at its end, **Chief of Scouts** in
Part 3, a short list folded in her bracer. **Her leg:** a dead horse came down
on her on the marsh road (fates `saved` and neither). She favours it in
Part 2 and still limps on cold mornings in Part 3. Which leg is not fixed; don't
name it. A `lost` Wren was never under the horse (her partner was) and has no
bad leg. Her partner's bow, with **Tamsin**'s name burned into the grip, hangs
at her fire in Part 3 when she is `lost`.

**The two scouts.** The reeve sent two scouts down the marsh road on grey
horses, "a pair of girls": **Wren and her partner Tamsin**. One was pinned
under her dead horse; the other lost her horse in the fen and walked home the
long way round. On `saved` and neither, Wren was under the horse and her
partner walked home. On `lost`, Tamsin was under the horse and died there, and
Wren walked home too late. "Tamsin" is named only where Wren is `lost`.

**Vex.** The Ashfang's lieutenant: lean, grey-templed, a bare blade across his
knees at a lone fire, a **coat** (worn again under a captain's sash in
Part 3). Turned: he took the road out, sat in a hill inn through Part 2, came
back and offered the reeve his sword; his pardon is **folded in his coat**,
opened so often the creases have gone soft. Not turned: at dawn after the den
fell he walked into Thornwick and gave himself up, a cell with a window; the
reeve took him out to run the war on terms (hold the valley or hang); the
pardon comes **sealed in red wax**, never opened, on a nail by his cot. He
commands the war-camp either way.

**Hask.** The chief's guard, who answered to Vex: a **grey, scarred old
soldier** with a **spear**, "the only one in the hall who looks as if he has
done this before"; in Part 3 Vex's sergeant, who "has called the step for
twenty years". He appears in Part 3 only when Vex is `turned`. (Nettle's
hired swords include "a grey old sellsword with a scarred face": not Hask, so
keep the two from reading alike.)

**Mira** keeps the Wander-Inn. **Her cup:** the one she wipes (cold to a
company that executed Vargan: "wiping the same cup"); the extra cup she fills
for the dead scout. **Her lamp:** lit in the inn's window every night from the
night the graves opened (Part 2); she blows it out in Part 2's epilogue. She
pours on the house only for a company the town thinks well of; she never
counts the times aloud (Part 1's round depends on facts the ledger drops).

**Halden.** Thornwick's priest, Brother Halden. **His prayer book** holds the
rites of sealing, notes in his tidy hand. In the drowned chapel the party gets
it either way: pressed into their hands (saved) or taken off the altar
(not saved). They carry it to the Warden's door. Saved: he has it back by the
end of Part 2 (he walks the barrow-field with it open) and carries it under his
arm in Part 3. Not saved: he died in the chapel and shares a grave there with
his acolytes ("*Asleep*"), and the book rides in the party's pack, fen-damp.
**The bell** is the drowned tower's bell that he was made to ring.

**Marrow.** A grey man in a gravedigger's apron, with **a chisel of bone**,
prising the lead letters out of the Warden's door, an acolyte holding the
candle; he dug Saltmere's forty graves over thirty years. He lays the chisel
down on the bottom step, and it stays there. `sings`: he leads his faithful in
the rites, and in Part 3 mends Saltmere's graves by lamplight unseen. `bound`:
taken for the reeve, and mends Thornwick's churchyard on the reeve's orders.

**Vargan.** The Ashfang chief, a Thornwick reed-cutter's son. His mother's
house drowned the spring he was a boy. He carries a great axe and keeps a rag
over the hag's **brand** on his axe hand: **a mark of reeds and a reaching
hand**, the brand on every marsh-thing that ran with the Ashfang. `dead`:
buried unmarked at the edge of the shallows he sold. `spared`: cuts reeds in
those shallows (jailed or let go read the same later).

**The three sisters.** **Nettle** is the eldest ("elder sister to the one you
called the Reedwife"), a head taller than anyone, duckweed in her braids.
**Sedge** is the youngest ("the younger sister"), who weeps and calls her
sister's name. The **Reedwife** keeps no other name that the valley knows.
All three are tall and green, with long fingers and river-weed hair. The
Reedwife's door is the Warden's door; her price is the lamb.

**Naming.** In narration "the girl" is the carter's granddaughter. Wren is
never "the girl".

**Contradicts:** none. (The lines listed here were fixed in round 15; `test/canon-phrases.test.ts` keeps them out.)

### Foes the fights rely on

- **The chief's hall:** beside the chief and the hag, one raider (with Hask,
  or with the snake when Hask stands aside). After Vargan turns, Hask brings
  four raiders to her whistle (three orcs and an archer); with Vex turned two
  raiders come instead. **Her branded marsh snake** (the reed-mark on its
  scales) appears only where Vex is turned and Hask doesn't come: it answers
  her whistle in the unguarded hall and in her fight after Vargan turns.
- **The Warden's door:** two soldiers of the old kings, in bronze, stand with
  the cult (not one). Both fight when Marrow does (`seal-battle`). With Marrow
  talked round (`seal-doubt`), one rises at his acolyte's scream and the other
  stays at the door; two of the kneelers rise to fight, and the rest never
  do.
- **The fen dead at night (`fen-night`):** six shapes out of the water (four
  ghouls, two that stink worse: ghasts).
- **The toll-cliff:** the manticore keeps a wyvern on its ledge; its goblins
  stay hidden in the rocks.
- **The valley of statues:** the gorgon (the old bull) and two younger bulls.
- **The dens:** the red forge keeps three hounds and two kobolds; the blue
  mesa two kobolds, two emberlings, two whirlwinds and a winged stone thing on
  its tower. The brood on the rim is the wyrmlings alone.

## Who was where, per ledger value

### Wren in Part 1 (entry 1)
- **`saved`**: the company lifted the horse off her. She sends the reeve's men
  up the marsh road, either sent home or after walking with the company to the
  tree line above the hollow ("As far as their gate"). The reeve's men are in
  the reeds below the den when it falls.
- **`lost`**: Tamsin died under the horse, alone in the night, covered with
  reeds if the company found her. Wren walked home out of the fen too late.
- **neither**: Wren was under the horse and the company walked past her or
  never found her. The reeve's men brought her in. She lived, and holds it
  against a company that stepped round her.

### Wren in Part 2 (chapter-local)
Every company meets her at the fen road and she guides it through the deep
fen. **She holds the Barrow Gate** and does not go down the barrow stair,
**unless her regard is 2 or more and the company asks her** (`lychgate-wren-comes`).
That is chapter-local, so **Part 3 may not assume she went underground**: she
"walked the fen with you as far as the barrows". She is at the gate when the
company comes back up.

**Contradicts:** none. (The lines listed here were fixed in round 15; `test/canon-phrases.test.ts` keeps them out.)

### Wren in Part 3
Chief of Scouts at the scouts' fire; at the council she comes up the last
slope with the column, and goes down into the bowl only if the company takes
her.

### Hask in the chief's hall (entry 4, Vex, with entry 6, the Reedwife)
- **Vex `turned`**: Hask grounds his spear, steps aside, and walks out into
  the smoke. He never fights the company (nor in the Reedwife's fight after
  Vargan turns: he "still does not come").
- **Vex not turned, Reedwife `dead`**: Hask answered the hag's call and
  **fought for the chief**, or for her after Vargan turned.
- **Vex not turned, Reedwife `bound`**: Hask came out of the smoke at her
  whistle. The binding is said at the door of the fight, before a blow, and
  then "the chief's guard watches her go, and then walks out into the smoke
  after her", his four raiders with him. A company that lost that fight
  first and bound her on its return did fight him, so a later line can say **he answered her whistle** or **he
  stood for the chief**, never that he fought the company. The binding can
  also be said as a rite (Religion) before her whistle: she whistles at the
  door as she leaves, and Hask follows her out the same way.

**Contradicts:** none. (The lines listed here were fixed in round 15; `test/canon-phrases.test.ts` keeps them out.)

### The Reedwife after Part 1 (entry 6)
- **`dead`**: killed in the chief's hall; she dies "as a body, not a heap of
  reeds".
- **`bound`**: held to her old price and sent out into the night toward the
  marsh. **She keeps the price, but not the watch**: she eats the lamb and sits
  by **her pool**, and **nobody sits by the Warden's door** (Halden,
  `sunken-barrows:chapel-saved`, `chapel-won`; design-decisions). That is why
  the Warden still wakes. In a vigil ending her sisters go to the door, and
  "three tall women" are seen in the shallows after.

**Contradicts:** none. (The lines listed here were fixed in round 15; `test/canon-phrases.test.ts` keeps them out.)

### The captives (entry 5): freed or not
The ledger has two values, and **a pen not freed means the carter, the girl
and the reed-cutters never came home**. That is the loss Part 1's epilogue
pays (design-decisions).

| Case | Ledger | What happened, and what the reeve's men found |
|---|---|---|
| Opened by the company (`den-pens-freed`, quietly or after the alarm fight) | freed | The carter lifts the girl onto his back and they slip out of the gate onto the marsh road. Epilogue: the girl in new shoes on the well. |
| Left, or never opened, moon still up, **Wren `saved`** | freed (on Wren's word) | The reeve's men are in the reeds below the den when it falls and have the pen open before the fires are out. The carter carries the girl out, still wearing her one shoe. |
| Taken by the dark moon before anyone opened it (`den-pens-empty`) | not freed | Chain hanging open, wet webbed footprints to the marsh, none back, one small shoe in the straw. A widow calls a name across the water. |
| Left, then the dark moon came | not freed | The reeve's men come after the moon has gone dark: the chain hanging open, a child's shoe in the straw. |
| The alarm fight at the pen lost | not freed | The gate open, the captives gone, tracks out toward the deep fen. |
| Left, or never opened, moon still up, **Wren not `saved`** | not freed | Nobody sent the reeve's men. **They reach the pen two days after the den falls and find it empty**: the chain cut, and the fleeing Ashfang took what they could sell. They are never found. |

So in Part 3 the carter, his wagon and the girl in new shoes appear only where
`hollow-road:captives-freed` is set, and "her pen is empty / everyone in it
walked home" is said only then.

**Contradicts:** none. (The lines listed here were fixed in round 15; `test/canon-phrases.test.ts` keeps them out.)

### Halden, Marrow, the seal, the valley (entries 7–10)
- **Halden `saved`**: talked out of the Warden's grip in the drowned chapel.
  He follows the company down and waits on the stair, keeps the vigil after
  Part 2, and climbs to the council in Part 3. **Not saved**: dead in the chapel
  (see People).
- **Marrow**: `sings` (home to Saltmere, his dead), `bound` (the reeve's),
  neither (dead at the door).
- **The seal** whole or cracked: cracked, the Warden's door knocks every night
  the stone sings, and the reeve has it checked each spring.
- **The valley's regard**: 1 or more brings Thornwick's watch (twenty men, the
  east line's thin end). 2 or more adds **two fen-folk** with drowning-ropes
  at the rim.
