# Module Writing Guide

How adventure modules should *read*. The engine guarantees the mechanics; this
guide guards the voice. It exists so every module — this one and the next ten —
sounds like it came from the same world.

The touchstone is the warm, inviting prose of story-driven RPGs (Zelda, Final
Fantasy, the Elder Scrolls), with a **light** dry wit in the Terry Pratchett key:
humour that comes from understatement and a character's weary competence, never
from jokes at the player's expense or winks at the camera. If a line made a
Discworld innkeeper roll their eyes, it's about right. If it sounds like a
stand-up bit, cut it.

## The five rules

1. **State discoveries plainly, in the moment, in someone's voice.** When the
   party learns a fact the game is tracking, *say the fact* — then file it in the
   journal. Never make the player infer what the scene already decided they know.
   - ✅ "So the peddler's your leak." / *journal: The Furtive Peddler — find him by the market gate.*
   - ❌ "You sense there may be more to the market than meets the eye."

2. **One trait per NPC, and keep it.** Give each speaker a single, legible
   personality and let every line express it. A reader should be able to name the
   trait after two sentences. Consistency reads as character; variety reads as
   noise. (See the cast sheet below.)

3. **Choices are intentions, not stat lines.** A choice label should read like
   something a person would *do* or *say*. Keep the skill/DC chip — it's useful —
   but the words after it are a decision, not a mechanic.
   - ✅ `[Persuasion DC 12] Buy the whole room a round`
   - ❌ `[Persuasion DC 12] Attempt to gain information`

4. **Concrete and sensory over abstract.** Name the thing. A "furtive peddler by
   the market gate" beats "a suspicious figure"; "a child's shoe nailed to the
   rafters" beats "signs of cruelty". Specifics are what make a place feel real
   and a villain feel earned.

5. **Earn the humour, and ration it.** A dry aside lands because the rest is
   played straight. At most one wry beat per scene, usually from an NPC's
   understatement or a narrator's deadpan — never slapstick, never anachronism.
   - ✅ Mira, on the raiders: "They came down the marsh road. Everyone knows that. Knowing it never filled a cart back up."

6. **Every image resolves inside the passage.** A simile the reader has to solve
   is a wall, not a picture. Say the thing; don't set a riddle whose answer lives
   in your head. This is the rule the readability checker cannot enforce — a
   sentence can be short, active, and made of concrete nouns and still refer to
   nothing the reader can reach.
   - ✅ "A boulder sits beside the trail with a handprint pressed into it. The hand was wider than a door."
   - ❌ "A boulder with a hand-print in it, if hands came in half-doors."
   - ❌ "eyes flat as coins already spent" / "patient as gravity" / "less like math and more like mercy"

7. **Anchor a proper noun to something physical the first time.** A capitalised
   name with no referent is a debt the reader carries for the rest of the scene.
   Introduce it attached to a sound, a sight, or a feeling — and let a character
   say what it *means* for the party.
   - ✅ "you hear it for the first time: the **Calling**. It is not really a sound. It is a pull, like a door standing open somewhere above the clouds."
   - ❌ "The Calling threads through it all… one voice fewer when the Calling peaks."

8. **The narrator describes; a character explains.** When a scene carries
   information the player must act on — what a place costs, why a fight is worth
   taking — put it in dialogue. Vex saying "every den you burn out is one monster
   fewer on the day" lands; the narrator musing about arithmetic does not.

### Register

One idea per sentence. Short sentences beat long ones, and a paragraph of four
short ones beats a single sentence with four clauses in it. Prefer the word a
nine-year-old already owns: *hall* over *steading*, *loose rock* over *scree*,
*empty shepherds' huts* over *abandoned shielings*, *brook* over *beck*. Break
a description into its own short paragraph per beat — text boxes are read on
phones, and white space is comprehension.

## Cast voice sheet (The Hollow Road)

Reusable archetypes — a future module's innkeeper or turncoat lieutenant can
inherit the same register.

- **Mira, the innkeeper** — dry, competent, has seen worse and said less about
  it. Warmth kept firmly under the floorboards. Begs for the town because the
  reeve's too proud to; resents having to.
- **Bram, the quartermaster** — coin first, sentiment never, but he'll deal
  square because a dead customer buys nothing. Gruff, not cruel.
- **Wren, the scout** — young, hurt, trying to sound braver than she feels.
  Grateful in a way that embarrasses her.
- **Vex, the lieutenant** — tired, not evil. A pragmatist who backed the wrong
  chief and knows it. Bargains like a man counting his remaining exits.
- **The Ashfang chief** — entitled brutality. Speaks of a burned town the way
  another man speaks of a good harvest.

## Encounters: a distinct roster per fight

A module is also a tour of the bestiary — part of its job is to *show the
monsters off*. So:

- **Never drop the same encounter into three different battles.** Reusing one
  encounter for two mutually-exclusive variants of a single fight (a surprise
  version and a caught-flat-footed version) is fine; shipping the same three
  goblins as the "climax" of three separate scenes is not. Give each fight its
  own composition. (A test enforces this on The Hollow Road.)
- **Vary the creature types across acts** — humanoids, beasts, undead, fey,
  giants — so fights *feel* different, not just differ on paper.
- **When something non-obvious fights for the villain, explain why in the
  fiction.** Beasts, undead, and lizardfolk serving "bandits" isn't a bestiary
  grab-bag — on the Hollow Road it's the green hag's pact (the chief sold her the
  marsh; she lends him her creatures). The story is what earns the variety.
- **Boss and act-climax fights should bite.** Tune them at the level they're
  *actually fought* (the party is far stronger at L3 than the XP budget implies),
  and prefer a nastier mixed roster or a real single threat over more mooks.

### At the door of a fight

Every battle opens on an intro with **Fight**, **Sneak up** (a group Stealth
check: success and the enemies lose their first round, failure and the party
does) and **Fall back** (return to the location the party came from; the fight
stays put). During the fight, **Retreat** does the same after a parting blow
from every enemy in reach. Two optional fields shape this:

- `parley: { skill, dc, label?, success, failure? }` — a way to talk the fight
  down. Opt-in, because an avoided fight needs its own outcome: `onWin` prose
  assumes a battle happened. Give `success` the same story effects `onWin`
  carries (flags, milestone XP), just not the loot. Write it where talking is
  plausible — mercenaries, a boss who can be bluffed — not for mindless foes.
- `noFlee: true` — no Fall back or Retreat, for a fight the story cannot let the
  party walk away from.

### Companions

An NPC can travel with the party — the Gold Box guide, prisoner or
sellsword. Declare them on the module (`companions: { wren: { id, name,
monsterId, portraitId?, emoji?, blurb } }`) and bring them in and out with
`{ kind: 'joinParty', companion }` / `{ kind: 'leaveParty', companion }`
effects. They fight with the stat block named by `monsterId`, run by the AI,
and are knocked out rather than killed at 0 HP; their wounds carry between
fights and mend with the party's rests. They take no XP or loot, never carry
into a sequel, and — like a summon — do not decide whether the party has won.

- **Give them a reason to leave.** A companion is a boost, so bound it: Wren
  guides the party through the marsh and parts at the den's tree line. Every
  route to the place they leave needs the `leaveParty` beat — gate choices
  with `companion` / `noCompanion` requirements (`hideWhenBlocked`) so the
  right one shows.
- **Make joining a choice, not a gift** — offer it beside sending them away.

### Dungeons

A dungeon is a scene of `kind: 'dungeon'`: **rooms and links, with no
coordinates**. The game lays it out, draws it, and proves it works. Write the
rooms, then look at it with

    npm run dungeon:preview -- <module-id> <scene-id>

which writes an SVG of the layout with every problem the validator finds
printed across the top and the rooms it names outlined in red.

A room (`DungeonRoom`) is a name and what happens there:

- `fight` — a battle scene sprung on walking in, every time, until it is won.
  Its `onWin` routes to `'@hub'` (back to the map, standing in the room).
- `event: { scene, until? }` — a scene that plays on walking in: once, or on
  every entry until `until` holds (Vex's fire plays until `met-vex`).
- `search` — what the Search button turns up there, once (📦 on the map).
- `exit: { to, label? }` — a way out; the only rooms fast travel works from.
- `goal: true` — what the dungeon is for. The checks prove it is reachable.
- `firstVisit` — the room's one piece of prose, shown the first time in.
  **Keep it to a line or two, and leave it off most rooms.** The map is the
  interface; the fight's intro or the event's scene says the rest.
- `size` (`small` / `medium` / `large`) and `at: [col, row]` to pin a room if
  the layout puts it somewhere odd.

A link (`DungeonLink`) joins two rooms. `length` is torch spent walking it. Its
`door` can be `locked` (requirements; `note` is what a tap on it says, `force`
a one-try skill check), `secret` (found by passive Perception on arrival or by
Search), `oneWay` (a to b only), or hold an `ambush` (a battle rolled once, the
first time through).

`torch: { length, out }` makes the light run out: each step spends a link's
length, a search spends 1, and at 0 the party is sent to `out`. Walking back in
from outside lights a fresh one. Leave it off anywhere lit — the den is.

A battle with `mapId: '@room'` is fought on a board drawn for where the party
stands: the dungeon's `theme`, a deeper board for a `large` room, a narrow one
for a corridor ambush. Keep hand-drawn maps for set pieces (the pit, the hall).

**The validator proves, for every dungeon:** every room can be reached; the
goal can be reached with keys the dungeon itself hands out (a flag or item a
room's scenes give) and without finding a secret door; no one-way drop or
lock can leave the party with no way on and no way out; the torch lasts the
proven route; and the layout is clean. A lock whose key lives outside the
dungeon counts as shut — it can guard a side room, not the goal.

`generateDelve(seed, { theme, size, level })` (src/adventure/dungeon-gen.ts)
builds a whole playable module the same way, and is held to the same proofs.

### Can it still be won?

To see a whole chapter at once, `npm run module:map -- <module-id>` draws it:
a box per location, stacked in the order a party reaches them, every way
between scenes labelled with what it needs, and anything the validator
reports outlined in red. (A ↩ on a scene means it leads back to its location;
those arrows are left out, since nearly every scene has one.)

Once a module's shape is sound, the validator walks **every state a party can
get it into** (src/adventure/reach.ts): the scene, the place `@hub` returns
to, and every flag a requirement reads, companion it names and location
visited. Every check passes and fails, every fight is won and lost. It
reports two things:

- a scene no state reaches — something routes to it, but the requirement on
  the way in can never hold by then;
- a state with **no way left to a victory ending**, with the shortest way
  there spelled out (`muster: "Report to the command tent" → envoys: loses
  the fight → …`).

The second is the bug a playtest rarely finds, because it needs one unlucky
loss or one odd button. Both of the ones it found had that shape: losing
Wyrmcalling's opening fight left the party unbriefed with no way to be
briefed, and the Hollow Road's victory scene let the party walk back into a
den with nothing left in it. The usual fixes are `noBack` on a scene that
should be one-way, or a second route to whatever a lost fight would have set.

Gold, items and classes are not tracked (a requirement on them is taken as
possible), nor are spent `once` choices or a dungeon's doors (which the
dungeon checks prove). A state packs at most 31 facts; a module that tracks
more is reported, not passed.

### The clock

A chapter starts on day 1, and every long rest ends a day: a night at a
camp, or a long `rest` scene. (A camp broken up by a fight is not a night
slept.) `Module.dawns` names the mornings that matter:

```ts
dawns: [
  { day: 3, text: ['The pens behind the kennels are empty this morning.'],
    effects: [{ kind: 'setFlag', flag: 'captives-moved' }] },
],
```

The text plays when the party wakes, and the effects apply. Scenes then read
the flag like any other, so time presses through things a player can see: a
door shut, a fight harder, a person gone. Give a warning before a deadline:
an earlier dawn with text only, or a line in the scene the deadline is about.
A module with dawns shows the day on screen; one without has no clock.

The reach search knows a night can pass wherever a party can sleep, so a
deadline that strands a party is reported like any other dead end, with
`sleeps until the morning of day N` on the way there. Each dawn with effects
is one more fact for it to track.

## Mechanics of prose in a scene

- **Story/dialogue `text`/`lines`** unveil one beat per tap — write each entry as
  a self-contained paragraph that ends on a small hook, so the next tap feels
  earned. 2–3 beats is usually right; more than four is a wall.
- **Journal bodies** are written for a player returning after a break: name the
  place, the person, and the next action, in plain past tense.
- **Result text** (an outcome's `text`) is the payoff of a check or fight — make
  it land the consequence in one or two lines, concrete, in the world's voice.
- **Battle `intro`** sets the enemy and the stakes in a sentence or two of
  motion; it's the last thing before dice, so end it on a verb.
