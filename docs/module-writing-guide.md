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

## The rules

1. **State discoveries plainly, in the moment, in someone's voice — once.** When the
   party learns a fact the game is tracking, *say the fact* — then file it in the
   journal. Never make the player infer what the scene already decided they know.
   Then trust it: don't say it again in the next scene, or at the end of this one.
   - ✅ "So the peddler's your leak." / *journal: The Furtive Peddler — find him by the market gate.*
   - ❌ "You sense there may be more to the market than meets the eye."

2. **One trait per NPC, and keep it.** Give each speaker a single, legible
   personality and let every line express it. A reader should be able to name the
   trait after two sentences. Consistency reads as character; variety reads as
   noise. (See the cast sheet below.)

3. **Choices are intentions, not stat lines.** A choice label should read like
   something a person would *do* or *say*. Keep the skill/DC chip — it's useful —
   but the words after it are a decision, not a mechanic. One grammar: a verb
   phrase ("Read what she isn't saying"), or quoted speech where the choice *is*
   speech ("Keep the purses. The dead won't spend them"). A hint below the label
   only when it says something the label can't; never "Title — gloss — gloss".
   No "Onward". A companion's idea reads as theirs ("Let Wren lead them off"),
   not as a tag ("[Wren] …"), and a tip is a clue, not the answer.
   - ✅ `[Persuasion DC 12] Buy the whole room a round`
   - ❌ `[Persuasion DC 12] Attempt to gain information`
   - ❌ `Climb it head-on — Muscle up the sheer face — fastest, if you don't fall`

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
   - ✅ "you hear it at last: the **Calling**. It is not really a sound. It is a pull, like a door standing open somewhere above the clouds."
   - ❌ "The Calling threads through it all… one voice fewer when the Calling peaks."

8. **The narrator describes; a character explains.** When a scene carries
   information the player must act on — what a place costs, why a fight is worth
   taking — put it in dialogue. Vex saying "every den you burn out is one monster
   fewer on the day" lands; the narrator musing about arithmetic does not. And
   Vex says it once: a narrator closing each fight with "one monster fewer for
   the Calling" is the quest log reading itself aloud.

9. **Show the creature before you name it. Never define it.** Introduce a
   monster by what it has done to the place, or by what it does now; let the
   name arrive late, or in a character's mouth. The narrator is not a
   bestiary.
   - ✅ The statues in the valley, too good, a hired sword with his blade half drawn. Then Wren: "Gorgon. Don't let it breathe on you."
   - ❌ "This is a **gorgon**. Its breath turns living things to stone."

10. **End on the image, not on what it meant.** If a paragraph closes by
    explaining the picture it just painted ("So the Ashfang answer to a green
    hag…", "They climbed all this way for revenge…"), cut that sentence and
    read it again. Nine times in ten nothing was lost.

11. **Shared text is neutral; warmth and coldness are earned.** A line that
    every route reads must be true on every route. A smile, a thank-you, "the
    best walk any of you can remember" — anything that praises the company —
    needs a flag, or an NPC's attitude, behind it. So does a rebuke. Before
    you leave a shared scene, check each line against three questions: does
    it praise the company, or assume someone helped, came, or was told
    something? Does it name where the party is? Does it state what someone
    remembers from an earlier chapter? Each yes needs an `if` or an
    `assumes`. Read the
    cruel and merciful transcripts after any change to a shared scene.

12. **Ration the tells, and write the recurring beats more than once.** Give
    each character one signature gesture and use it once a chapter: Mira's
    near-smile, Wren's blush, Vex's tired calm. A beat that recurs (a camp
    attacked in the night, a defeat and waking, a return to the hub) gets two
    or three written variants, not one sentence with the place swapped. Words
    that have been worked too hard: "Then" to open a sentence, "Nobody",
    "Whatever…", "older than…", "honest", "like a man who…", "comes apart
    like reeds". A test reads every route transcript for four-word
    phrases that turn up in three or more paragraphs of one playthrough
    (test/repetition.test.ts): rewrite the tic, or, if the repeat is the
    point (the liturgy, a place's name), list it as a motif there.

13. **Epilogues are eight to twelve fates, and they build.** Each slide is a
    person or a place told through an object or a gesture (the stone dog's
    ribbon; the carter's girl in new shoes), ordered so the last one is an
    image to close on. Never a status report ("No dragon flies over the high
    pastures again") and never the player's own choice quoted back to them.

14. **Rules terms stay out of people's mouths.** Characters describe the thing;
    the interface names the rule. "Get clear before you start your muttering"
    is a hedge-witch talking. "Your real spells burn *slots*" is a rulebook.
    The same goes for narration: not "No time to ready anything".

15. **The company is not mute.** The party is the player's own, so it has no
    fixed lines, but at a chapter's big beats one member can act or speak by
    class (`if: [{ kind: 'classInParty', classId: 'cleric' }]`): the cleric
    who says the words over the grave, the rogue who already has the lock
    open. One such line per chapter's key beat is plenty; the valley's
    people still do most of the feeling. The company's members are the
    player's, so they never get a pronoun: "your cleric", never "he" or
    "she".

### Register

Plain words, varied rhythm. Most sentences carry one idea, but a passage made
only of short declaratives reads like a primer, and its big moment has nowhere
to rise from. Join a pair of short sentences with *and*, *but* or *which* when
they belong together; let the moment that matters run a little longer and then
land on a short one. The checker allows this: it grades the paragraph (≤ 8 on
average), caps a sentence at 26 words and one heavy clause-break, and nothing
stricter. A paragraph of four short sentences still beats one sentence with four
clauses in it. Prefer the word a nine-year-old already owns: *hall* over *steading*, *loose rock* over *scree*,
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
  carries (flags), just not the loot, and the XP the fight would have paid
  (see "Levels come from fights" below). Write it where talking is
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
dungeon checks prove). A state packs at most 52 facts, and a search stops
at 3 million states; a module past either is reported, not passed. Each
fact a chapter tracks can double its states, so track what matters.

Carried choices (`hollow-road:captives-freed`) are not facts. They never change
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

A battle, check or challenge takes `again` too, in place of its `intro`. A
fight the party fell back from, or lost and came back to, shouldn't burst
out of the ditch a second time ("The goblins are still in the ditch, and
they are ready for you now").

A talk-down that fails and leaves the party in the fight can say why, with
`parley.refused`: the boss's answer, in the boss's voice. Without it the
game says "They aren't interested in talking." That is fine for a pack of
wolves, but a waste on anyone with something to say.

### Falling back, and locked markers

A scene opened from a map marker or a room can always be walked away from.
Any other story, dialogue or challenge (one reached as the outcome of a
choice, a check or a fight) must say whether it can: `noBack: true`, or
`back: true` when stepping back to the map is meant. The validator refuses
a scene that says neither. A way back out of a victory is how a won fight
gets fought again; and a won fight pays once regardless.

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

A test fails if a registered name is typed in a chapter's source outside a
comment: write the token.

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

### Facts of the world: canon

Places, prices and counts that more than one line relies on live in the
campaign's facts (`CanonFact` records), beside its people. Prose says them by
token, and a fact with a `value` gives the number rules use:

```ts
'drowned-gold': { text: 'fifty-five gold', value: 55 },

text: ['There are a dozen purses, {drowned-gold} between them.'],
effects: [{ kind: 'gold', amount: FACTS['drowned-gold'].value }],
```

`{^id}` capitalises a fact or name to open a sentence ("{^drowned-gold} in
all."). Build the module with `withCanon(module, { npcs, facts })`. An id
names a person or a fact, never both, and an unknown token is an error at
load. Register a fact when a second line or a rule depends on it. That goes for things
and terms too, not only numbers: if two scenes name the same object (the
peddler's stall, the raiders' gate-signal), make it a fact, so one scene
can't call it a cart and another a tray. A one-off
detail stays plain prose. The trilogy's facts are in src/data/modules/canon.ts
(`TRILOGY_FACTS`). As with people, a test fails if a registered place or group
name is typed in a chapter's source outside a comment, and another checks that
each numeric fact's text spells its value and that the effects paying it agree.

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
whole words, as written; aliases in any case. A line behind an `if`, a hidden
choice or a conditional slide counts only where its condition can hold, so a
mention gated on a flag that only an introduction sets needs no entry. A character known from an
earlier chapter needs no entry in a later one.

### Where the party is

A dawn is read wherever the party slept, and a defeat scene wherever it
fell. Say where with `{ kind: 'at', hub: 'undercrypt' }`: the map or dungeon
the party last entered. As an `if` it picks the line ("You wake on the cold
floor of the crypt" / "You wake in Mira's back room"); as an `assumes` the
search proves no route reads the line anywhere else. A dawn that names no
place must suit every place.

### The clock

A camp deep in enemy ground can limit its nights: `camp: { nights: 2 }`
lets the party sleep there twice in the chapter (a night broken up by an
ambush was never slept, and doesn't count), then only short-rest. Use it where waiting out every wound would take the
danger out of a dungeon; leave towns and safe maps unlimited.

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

### Levels come from fights

A company levels by fighting. Size a chapter's fights so a company that
fights what its road offers reaches the chapter's levels on time: budget
the encounter XP first (each of four characters earns a quarter of it), then
check the curve on the transcript routes, not on paper. Tune each fight for
the level the party really meets it at.

`xpToLevel` is **not** a progression mechanism. It stands in two places only:

- **The opening.** A chapter's start scene can set a fresh company's level (a
  cold start begins Part 2 at 3rd). Only the cold-start choice carries it; a
  company carried in from the last chapter arrives with what its fights
  earned.
- **A way past a fight.** A company that talks, sneaks or pays its way past
  a fight must not fall behind one that fought it. Pay it what the fight
  would have: `{ kind: 'xp', amount: avoidedFightXP('the-encounter') }`
  (a quarter of the roster's XP, so it follows any retuning), or an
  `xpToLevel` where the fought path would ding at that point anyway. It sits
  on the avoidance itself: a parley's `success`, a choice offered beside the
  way into the fight, or the outcome of a roll whose other outcome is the
  fight.

Never put a floor on a fight's win or on a road every company walks: that
makes up for a chapter with too few fights, and hides it. If the curve comes
up short, retune where the fights sit against the party's real level, then
strengthen the fights the chapter has (more XP and more danger together),
and add a fight only where the story has room for one (an empty marker, a
wandering encounter). A company that walks past optional fights may arrive a
level lower; that is its choice, and no floor makes it up. The validator
rejects an `xpToLevel` anywhere else.

## The arena's voice

The arena is drier and more knowing than the valley, and that is fine: it is
an afterlife with a bored demon in it. The quasit carries the attitude and is
the only arch voice; the healers, the merchant and the crowd sound like
people. Say each rule once, in one voice: if the quasit explains that a
retried day replays the same two fights, the temple screen doesn't explain
it again. Two characters never share a joke. A gambit's stakes
line is plain speech a player can weigh ("their first swings go wide"), not a
condition name ("baned"). Every line must be true of every place it can show:
a fight's board may be sand, forest, bog or lava, so a line any board can
draw names none of them. A rule the quasit explains in voice may also stand
once, plainly, in the interface, because a player can silence the quasit.

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

## What crosses between chapters: the ledger

A chapter may remember as much as it likes while it is played. What it hands
on is fixed: the ten entries in `docs/state-ledger.md` (Wren, Wren's regard,
Vargan, Vex, the captives, the Reedwife, Halden, Marrow, the seal, the
valley's regard). Each has at most three values, and a tally is read only in
its bands.

- **Read only the ledger in a later chapter.** If a line needs a finer fact
  (jailed or let go, which deed raised the valley's regard), rewrite the line
  so it is true across the ledger value instead of carrying the fact.
- **Pay off in a few places:** a chapter's opening, its key conversations and
  its epilogue. Shared text elsewhere is true on every route.
- **A new choice resolves inside its chapter.** It may move a ledger entry; it
  doesn't add one.
- **Mind the budget.** `npm run check:story` prints each chapter's story flags,
  conditional paragraphs and reachable states against its ceiling in
  `src/data/modules/ledger.ts`, and `test/ledger.test.ts` holds the chapters
  to the ledger. Passing a ceiling means raising it in the same commit, with
  a reason.

## Checking your work

Edit against `npm run check:story` (about 30 seconds): the typecheck, every
module's validation and reachability search (with its state count), and the
adventure's own tests, transcripts and readability included. Regenerate with
`npm run transcripts` and `npm run reference` when prose or routes change,
and read the transcript diff. The full `npm test` (about two minutes, most
of it arena simulations) is for once before a commit, not for every edit.

When several people (or agents) work at once, split the work by chapter: one
owner per chapter file, so nobody edits a file someone else has open.
Anything that spans chapters, or touches the engine, goes first, on its own.

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
