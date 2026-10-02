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

Carried choices (`hollow-road:saved-scout`) are not facts. They never change
once a chapter starts, so the walk runs once for each mix the chapter can be
handed: whatever a victory in the chapter before can carry, found by
searching that chapter, plus a cold start with none. A pairing no party can
bring (a scout both saved and left behind) is never searched, and carried
choices cost no facts. A chapter pays instead for what it hands on: each of
its `carries` that a later chapter reads is one more fact.

### One try, and coming back

`once` stops a choice being taken twice at one scene. When the same try is
offered in more than one place (a plain version and a "with Wren's notes"
version, a story choice and a fight's parley, two fights that offer the same
talk-down), give them a shared `attempt: 'toll'`. Using any one of them,
whatever the roll, spends the attempt for all: choices with it disappear,
approaches show as spent, and the parley is no longer offered.

A story or dialogue the party can come back to should have `again`: the
text shown on every visit after the first, instead of `text` / `lines`. Use
it for anything that would otherwise replay a first meeting ("Welcome!",
introductions, a monster rising to meet you).

### Falling back, and locked markers

A party can fall back from most fights to the map (or, in a dungeon, to the
room it came from). Two exceptions: a fight marked `noFlee`, and any fight
where the party is caught out (`surprise: 'party'`, or a sneak-up rolled
against it at the door). So a failed check that leads to a worse, surprised
fight can't be fled and walked back into clean. Mark `noFlee` on any fight
that can't be come back to.

A map marker gated by `requires` says why with its `note`, in the world's
words ("The ravine cuts the trail."). Without one, the player sees a
generic "Requires something you haven't done yet".

### One scene, routes that differ in a line

Every prose field takes conditional paragraphs, the same shape as an
ending's slides: a story's `text`, a dialogue's `lines`, every `intro`
(check, challenge, battle, shop, rest), every outcome's result `text`, an
ending's `text`, a dungeon room's `firstVisit` and a dawn's `text`:

```ts
text: [
  'The camp cheers.',
  { if: [{ kind: 'companion', companion: 'wren' }], text: 'Wren, still at your shoulder, lowers her bow.' },
  { if: [{ kind: 'noCompanion', companion: 'wren' }], text: 'Wren waves from the scouts\' fire.' },
],
```

Reach for this before copying a scene per route. A shared scene that
assumes one route is the commonest contradiction in review: a companion
greeting you from camp after walking down the mountain beside you. Every
scene needs at least one paragraph that always shows. Text never changes
where a party can go, so the reachability search ignores it.

### Saying what a line takes for granted

A line that only makes sense on some routes should say so with `assumes`:

```ts
{ assumes: [{ kind: 'noCompanion', companion: 'wren' }], text: 'Wren waves from the scouts\' fire.' },
```

It still shows (unless it also has an `if`), but the reachability search
proves that every route which can show it satisfies the assumption, and
reports the shortest route that doesn't. A whole story, dialogue or ending
can carry `assumes` too. Assume flags, carried flags, companions and visits;
the search can't see gold, items, classes or counted flags (tallies), and
says so. Prefer `assumes` to hoping: a shared scene that silently assumes a
route is the commonest contradiction in review.

### Naming characters: the NPC registry

Named characters live in one registry per campaign (`NpcDef` records; see
src/adventure/npcs.ts). Prose names them by token, never by typing the name:

```ts
'{vargan} rises from a throne of lashed spears.'
```

The module is built with `withNpcs(module, NPCS)`, which resolves every
token to the registry's `name`. A rename is one line, and a misspelt token
(`{vragan}`) is an error at load. Dialogue speakers come from the same record
(`npc: speaker(NPCS.wren, 'Chief of Scouts')`), as do companions
(`companions: companionsFrom(NPCS, ['wren', 'halden'])`). A record's
`introducedAt` lists, by chapter, the scenes that introduce the character,
and feeds the cast check below.

### What became of them: NPC state

A character's fate and whether the party has met them belong to the
character, not to a chapter. Declare the fates a record can have, then set
and test them by NPC:

```ts
scout: { id: 'scout', name: 'Wren', fates: ['saved', 'left', 'dead'] },

effects: [{ kind: 'npc', npc: 'scout', met: true, fate: 'saved' }]
requires: [{ kind: 'npc', npc: 'scout', fate: 'saved' }]
if: [{ kind: 'npc', npc: 'scout', notFate: ['dead'] }]
```

A fate replaces the one before it: a character has one at a time. The state
is campaign-wide. Every later chapter sees it with no `carries` entry, and
any chapter may change it (the saved scout can fall at the ford in chapter
two, and chapter three knows). `withNpcs` compiles these to flags (`npc.scout.fate.saved`,
`npc.scout.met`). An unknown NPC or an undeclared fate is an error at load,
and a fate no chapter so far sets is an error in validation. The
reachability search follows the state across chapters as each one leaves it,
so a scene that needs the scout dead is reachable only if some earlier route
can kill her.

Use this for anything said about a person. Keep plain flags for things
about the world (a gate shut, a den raided).

How a character feels about the company is their `attitude`: a signed tally
that starts at 0 and carries like the rest. Deeds move it, and lines and
choices read it by bounds:

```ts
effects: [{ kind: 'npc', npc: 'wren', attitude: -1 }]      // left her to the wolves
if: [{ kind: 'npc', npc: 'wren', attitude: { atLeast: 2 } }]  // she'd follow you anywhere
if: [{ kind: 'npc', npc: 'wren', attitude: { below: 0 } }]    // she hasn't forgotten
```

The search doesn't track a tally, so it treats an attitude gate as possibly
open and possibly shut. Don't gate the only way on, and don't `assume` it.
Use attitude to colour a line or open an extra door. (The same tools, `addFlag`
and `count`, work on any tally.)

### The cast

Rule 7 (a name with no referent is a debt) is checked, not hoped for. List
each chapter's named characters in `cast`, with the scenes that introduce
them:

```ts
cast: [
  { name: 'Vargan', aka: ['the chief'], introducedAt: ['tavern-meet', 'boss-approach'] },
],
```

The reachability search proves no route shows the name (or an alias)
anywhere a player reads it (prose, labels, map markers, slides) before
passing one of its introducing scenes, and reports a route that does. A
mention inside an introducing scene is the introduction. Names are matched as
whole words, as written; aliases in any case. A character known from an
earlier chapter needs no entry in a later one.

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

A dawn can also freeze a count as it stood that morning:
`{ kind: 'copyFlag', from: 'threats-cleared', to: 'tally-at-peak' }`. Read
the snapshot, not the live count, wherever a scene reports how that night
went, so deeds done later can't rewrite it.

A failure can cost time too: `{ kind: 'passDay' }` loses a day without a
rest (a long detour, a trail gone cold), and plays that morning's dawn. With
a deadline on the clock, a failed check is pressure, not just a fight.

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

## Reading a route

A scene that reads well on its own can still contradict the one before it — a
companion greets you from camp right after walking down the mountain beside
you; a dawn warns of a danger the party already put down. Those mistakes are
invisible in the source, which is organised by scene, and obvious in the order
a player meets them. So read routes, not just scenes.

`docs/transcripts/` holds the exact text a player reads, in order, on a few
fixed playthroughs: the whole trilogy with one carried company played four
ways (`trilogy-completionist`, `trilogy-rusher`, `trilogy-cruel`,
`trilogy-unlucky`), and cold starts of chapters two and three
(`cold-sunken-barrows`, `cold-wyrmcalling`). Each lists every paragraph shown
— story text, dialogue lines under the speaker's name, battle intros, results,
room and dawn text, the ending and the slides that show — with the choice
taken, the roll behind each check, each fight's outcome, map moves and nights
slept. The header names the route's policy, its seed, the ending reached and
the flags carried across each chapter boundary. Prose comes from the runtime's
own events, so a conditional paragraph appears exactly when a player would see
it.

- **Regenerate** with `npm run transcripts` after any module or runtime change;
  `test/transcripts.test.ts` fails until the committed files match.
- **Review the diff.** A content PR's transcript diff shows what actually
  changed for a player, in context.
- **Reviewers, human or AI: read the transcripts.** Read a route top to bottom
  as a player would, and look for what only shows in sequence — who is where,
  what the party already knows, what time it is, what a slide claims happened.
  Report a contradiction with the route name and the quoted lines.

The routes are defined at the top of `scripts/transcripts.ts`; add one when a
branch you care about is not on any of them.
