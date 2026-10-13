# Module Writing Guide

How to build a chapter, and how it should *read*. The engine guarantees the
mechanics and proves every route; this guide guards the voice, so every
chapter sounds like it came from the same world.

The touchstone is the warm, inviting prose of story-driven RPGs (Zelda, Final
Fantasy, the Elder Scrolls), with a **light** dry wit in the Terry Pratchett key:
humour that comes from understatement and a character's weary competence, never
from jokes at the player's expense or winks at the camera. If a line made a
Discworld innkeeper roll their eyes, it's about right. If it sounds like a
stand-up bit, cut it.

The guide has five parts:

1. **[A chapter, start to finish](#1-a-chapter-start-to-finish):** the folder, the files, the loop.
2. **[The story format](#2-the-story-format):** writing scenes.
3. **[Laying out a chapter](#3-laying-out-a-chapter):** places, quests, people, time and levels.
4. **[Writing well](#4-writing-well):** the rules of the voice.
5. **[Checking your work](#5-checking-your-work):** the proofs, the atlas and the routes.

---

## 1. A chapter, start to finish

A chapter is a folder of plain-text scenes and one TypeScript file that says
what holds them together. Chapter one is the worked example:

```
src/data/modules/
  hollow-road.ts              the chapter: places, quests, clock, carries, cast
  hollow-road/
    1-road.story              the scenes, one file per place, read in name order
    2-thornwick.story
    3-marsh.story
    4-den.story
    5-ending.story
    parts.ts                  pieces several scenes share (@NAME in a story)
    scenes.gen.ts             built from the stories: never edit it
docs/chapters/hollow-road-notes.md   why it is built as it is, by scene
```

**The loop:**

1. Write or change scenes in a `.story` file.
2. `npm run stories` to build them into `scenes.gen.ts`. A test fails while the
   build is stale.
3. `npm run check:story` (about 30 seconds): the typecheck, every chapter's
   validation and reachability proof, and the adventure's tests.
4. `npm run atlas` and `npm run transcripts`. Then read the diff, which shows
   what changed for a player.

**What goes where:**

- **Scenes go in stories.** That covers prose, choices, checks, fights and endings.
- **Structure goes in the chapter's `.ts`.** That covers:
  - the generated places (`towns`, `delves`);
  - the clock (`dawns`);
  - what crosses to the next chapter (`carries`);
  - the companions and the cast.
- **Reasons go in the notes doc.** A comment in a story (`// …`) is for the
  next writer of that scene. Why the chapter is shaped as it is, and what the
  proofs needed, goes in `docs/chapters/<chapter>-notes.md`, headed by scene id.

One owner per chapter at a time. Anything that touches the engine or spans
chapters goes first, on its own.

---

## 2. The story format

A scene is a heading, its properties, its prose (one paragraph per line), then
its ways out. Indentation (two spaces) puts a line under the one above.

```
# board
art: 📜
Here is the reeve's bounty in full, nailed up and gone grey at the edges.
Someone has added a line at the bottom in a smaller, prouder hand.
? not spy-seen | A line shown only while that holds.
again:
The reeve's bounty still hangs on the board, a little greyer at the edges than before.
> Take the reeve's retainer up front → @hub  #ok
  once
  do +bounty; gold {bounty-retainer}
  journal quest c-bounty: The Reeve's Bounty
    The reeve pays for the chief dead, and extra for their banner.
    stage Bring down the chief | npc reedwife met
    stage Collect from the reeve | got-bounty
    taken: bounty
    resolved: got-bounty
> Leave it for now → @hub  #leave
```

### Scenes

- `# id` starts a scene. A story is the default kind; anything else says so:
  `kind: dialogue`, `battle`, `check`, `challenge`, `shop`, `rest`, `ending`.
- **Properties** are `key: value` lines:
  - `art: loc-tavern 🍺` gives the image id and the emoji, either one alone.
  - `npc: @MIRA` gives a dialogue's speaker, from `parts.ts`.
  - `noBack: true` / `back: true` say whether the scene can be walked away from
    (see "Falling back" below).
  - A fight's `encounterId: raiders-forward`, `mapId: open`, `surprise: party`
    and `noFlee: true`.
  - A check's `skill: perception`, `dc: 13` and `roller: group`.
  - `assumes: with wren` is what the whole scene takes for granted.
- **Prose:**
  - Each line is one paragraph, and each paragraph is one tap.
  - Prose goes to the kind's own field: a story's text, a dialogue's lines, a
    fight's or a check's intro.
  - `again:` switches to the text shown on every later visit. `text:`,
    `intro:` and `lines:` switch explicitly.
- **Conditional lines:**
  - `? reqs | text` shows only when the requirements hold.
  - `?! reqs | text` says what the line takes for granted.
  - Both can go on one line: `? with wren ?! npc wren met | …`.

### Obstacles

A threat in the way with more than one answer (a fight, or a skill) is one
block, not three scenes. It reads as the approach, the fight and each
answer's success; the fight won and every answer set `done`, and an answer
pays the fight's avoided XP:

```
# barrow
kind: obstacle
art: 🪦
fight: barrow-haunt on corridor
done: barrow-cleared
return: Back to the trail
leave: Leave the dead their peace  #leave
Half-swallowed by the reeds lies a barrow-mound…
again:
The barrow-mound still breathes cold air…
fight > Go down into the dark  #in
The cold answers you…
answer religion 13 > Say the old words over the capstone, and close it  #settle
You kneel at the cracked capstone…
won:
The cold shape shreds into mist…
do gold 45
```

That is `barrow`, `barrow-fight` and `barrow-settle`. A failed answer leads
into the fight. `back:` sets where every way out goes (default `@hub`), and
`as: dialogue` makes the approach a conversation. A fight that differs only
by who is there (a guard who has turned) is one battle with `encounterWhen`
and conditional lines, not a twin.

### Ways out

- **A choice:** `> label → scene  #id`. The `#id` is what a save remembers, so
  keep it when you reword the label. `@hub` goes back to the map the party
  came from. Under a choice:
  - `once` (never offered again once taken), `hide` (hidden, not greyed, when
    blocked), or both: `once hide`;
  - `? requirements` and `do effects`;
  - `check insight 12 → tavern-blank`, a roll on the choice: success goes to
    the choice's scene, failure to this one;
  - `fail do …` (what failing does) and `check roller: group`;
  - `attempt: toll` (a try shared with other choices) and `hint: …`;
  - `journal kind id: title` blocks.
- **A fight's ends:** `won → scene` and `lost → scene`. **A roll's:** `success →`
  and `failure →`. Under each go `do …` and the result's text lines.
- **A talk-down at a fight's door:**
  ```
  parley intimidation 13 > Stare down the goblin boss
    refused: "Chief pays for heads," he cackles. "Yours."
    success → trail
      You hold his eye and draw steel slow…
      do xp avoided goblin-outriders
  ```
- **A challenge's lines of attack:** `approach id skill dc > label`, with
  `hint:`, `? reqs`, `hide`, and their own `success →` / `failure →`.

### Requirements and effects

Several go on one line, separated by `;`.

| Requirement | Means |
|---|---|
| `spy-caught` / `not spy-caught` | a flag set / not set |
| `with wren` / `without wren` | a companion along / not |
| `class ranger` | someone in the company is one |
| `gold 5`, `item potion-healing` | can pay / carries it |
| `visited gate` | has been to that scene |
| `at square/city` | the map the party last entered (for dawns and defeats) |
| `npc wren met`, `npc wren not met` | has met them |
| `npc wren fate saved`, `npc wren not fate saved,lost` | what became of them |

| Effect | Means |
|---|---|
| `+flag` / `-flag` | set / clear a flag |
| `gold 40`, `gold -{inn-room}` | gain / pay |
| `xp 30`, `xp avoided cutpurses` | XP; what a fight would have paid |
| `item potion-healing x2`, `drop potion-healing` | gain / lose an item |
| `day` | a day passes without a rest |
| `join wren`, `leave wren` | a companion joins / leaves |
| `npc wren met fate saved attitude 1` | meet them, settle their fate, move their regard |

- **Numbers:**
  - `{fact}` is a number from the campaign's facts: `{bounty-retainer}`,
    `-{inn-room}`.
  - `avoided enc` is the XP a fight would have paid.
- **Anything without a shorthand** (a tally, an attitude range, a deed) is
  written as JSON: `{"kind":"count","flag":"x","atLeast":2}` in a list, or
  `@key: {...}` for a property. It is always available, but if you reach for
  it often, the format wants a new shorthand.
- **Shared pieces:**
  - `@NAME` is a value from the chapter's `parts.ts` (an effect list, a line,
    a speaker).
  - `@NAME('args')` calls one of its helpers.
  - A whole scene can be one: `# bind-hag-rite = @BIND_HAG_RITE(…)`.
  - Use parts for what two or more scenes must say identically, and nothing
    else.
- **Comments and literal text:** a line starting `//` is a comment. Start a
  line of prose with `\` when it would otherwise read as format, for example
  a paragraph that begins `Note: …`.

---

## 3. Laying out a chapter

A chapter is **a short series of quests across a few places**. Most places are
generated fresh each run, with the story's own scenes built into them. That
keeps chapters short, keeps replays fresh, and keeps each place answering to
only a few flags.

### Places: towns and delves

A generated place goes in the chapter's `.ts`, keyed by the scene id the story
walks into.

**A town** (`towns`) is a generated village, town or city. It has its own
shops, temple, streets and names. The story adds `places`:

```ts
towns: { square: {
  spec: { size: 'village', level: 1, name: '{thornwick}', camp: true,
    people: [{ name: '{bram}', at: 'general', keeps: true, lines: ['…'] }],
    places: [
      { label: 'The {wander-inn}', replaces: 'inn', text: [], event: { scene: 'tavern' } },
      { label: 'The Old Mill', text: ['The sails are turning again.'],
        event: { scene: 'mill', until: [{ kind: 'flag', flag: 'mill-saved' }] } },
      { label: 'The Marsh Road', replaces: 'gate', text: [], event: { scene: 'trailhead',
        when: [{ if: [{ kind: 'notFlag', flag: 'spy-caught' }], to: 'gate-blocked' }] } },
    ] },
  onLeave: { to: 'trailhead' }, proveApart: true, title: '{thornwick}',
} },
```

- **`event`** plays one of the story's scenes on walking up, until `until`
  holds; after that, the place is only its `text`. `when` sends it to a
  different scene first.
- **`replaces`** stands in for one of the town's own venues (its inn, notice
  board or gate).
- **Its map** is `<key>/city` (here `square/city`), so story scenes return to
  it with `@hub`.

**A delve** (`delves`) is a generated dungeon. Its `require`d rooms hold the
story's scenes, and the same `event` / `until` / `when` apply, plus `search`
and `exit`. A `goal` room's event is where the story takes over. A
`lock: { requires, note }` makes the first floor's locked door the story's
own: chapter one's marsh opens past the ravine only once the tracks are read
and the ravine crossed.

**Someone held there** (`hostage`) needs no scenes of your own. Name who,
the two flags your story reads, and, if you like, your own lines, a quest, a
guard and a deadline. The generator builds finding them, getting them out
(quietly, or by force against the watch), and the empty cage once they are
taken:

```ts
{ name: 'The Pens', text: 'Behind the kennels stands a pen of lashed stakes.',
  hostage: { who: 'the captives', as: { freed: 'captives-freed', taken: 'captives-taken' },
    found: ['…'], freed: ['…'], gone: ['…'], guard: { dc: 13, fight: 'pen-watch' },
    quest: { title: 'Bring the Captives Home', body: '…' } } },
```

A held place's generated rooms come from who holds it (`src/data/archetypes.ts`):
a camp has its watch, bunks, stores and trophies; a lieutenant at a gate every
way to the boss runs through; and, past the boss, a vault. Give the place
`lore` (lines of its past) and they turn up in its rooms' searches, on the way
to the goal first.

**`proveApart: true`** (do this for every place):

- The place is proved on its own when it is built: its layout, keys,
  shops and streets.
- The chapter is proved against only its outside: a door, a marker for each
  of the story's scenes in it, and its ways out.
- The place's own flags (a side room cleared, a theft in the market) then
  never multiply the chapter's proof.

**A written location** that isn't generated declares in `places` what it
`reads` from the chapter and `exports` back. The validator holds it to that,
and to a budget of flags (eight by default). Most locations should answer to
a handful of flags, not to the whole chapter.

### Quests

Quests are what the chapter is *for*. Give each a journal entry with stages,
and say how it ends:

```
journal quest q-scouts: The Reeve's Scouts
  The reeve sent two scouts down the marsh road, and neither came back.
  stage Find the scouts on the marsh road | npc wren fate saved
  resolved: npc.wren.fate.saved
  failed: npc.wren.fate.lost, scout-bled-out, scout-walked-past
```

- **`taken`** is the flag that marks it taken. Leave it off for a quest every
  route is given; it is then proved from every state.
- **`resolved` and `failed`** are the flags that end it. The proof checks
  that every taken quest can still be settled, done or failed, on every
  route. A quest the party can fail is a real quest.

### People: the registry and NPC state

**Names.** Named characters live in the campaign's registry
(`src/data/modules/npcs.ts`), and prose names them by token: `{vargan}`,
`{wren}`. A rename is then one line, and a misspelt token is an error at load.
A test fails if a registered name is typed into a story. Places and groups
work the same way, through the campaign's facts (`{thornwick}`, `{ashfang}`),
in `src/data/modules/canon.ts`. `{^id}` capitalises a token to open a sentence.

**What became of them** belongs to the character, not the chapter:

- A fate (`npc wren fate saved`) replaces the one before it.
- Whether the company has met them is `npc wren met`.
- Their regard, `npc wren attitude 1`, is a tally that starts at 0.

All of this is campaign-wide: later chapters see it with no `carries`. Use
NPC state for anything said about a person, and plain flags for things about
the world. Regard follows what an NPC saw: guard a change on their being
present, or mark word of mouth `hearsay`. The validator enforces this.

**The cast.** Rule 7 (below) is checked: each chapter's `cast` lists the
scenes that introduce each name. The proof shows no route reads a name
before one of its introductions.

**Companions.** An NPC can travel with the company. They join with
`join wren` and leave with `leave wren`, and fight with their own stat block,
run by the AI. Bound their stay: Wren guides the company through the marsh
and parts at the den's tree line. Make joining a choice offered beside
sending them home, never a gift.

### The clock

A chapter starts on day 1, and every long rest ends a day. `dawns` in the
chapter's `.ts` name the mornings that matter. Their text plays on waking and
their effects apply: the captives are gone after the sixth night. Time
presses through things a player can see, such as a door shut, a person gone
or a fight harder.

- **Warn before a deadline:** an earlier dawn with text only, or a line in the
  scene the deadline is about.
- **A dawn is read wherever the party slept.** Pick the line with `at` (`at
  square/city` or `at trail/delve`), or write one that suits every place.
- **`day`** loses a day without a rest (a long detour, a trail gone cold). With
  a clock running, a failed check is pressure, not just a fight.
- **A camp deep in enemy ground** can limit its nights.

### Levels come from fights

A company levels by fighting. Size a chapter's fights so that a company
fighting what its road offers reaches the chapter's levels on time. Check the
curve on the transcript routes, not on paper, and tune each fight for the
level the party really meets it at.

- **A way past a fight pays the fight.** Talking, sneaking or paying past it
  gives `xp avoided the-encounter`, on the parley's success, a choice beside
  the fight, or the roll whose other outcome is the fight. A way past *part*
  of a fight pays the difference (`xp avoided a - avoided b`).
- **A fight that only follows a failure** (a failed rite, a night ambush) is
  a setback, not a payday: `loot: false`.
- **No level floors.** `xpToLevel` belongs only on the opening's cold-start
  choice. If the curve comes up short, strengthen the fights the chapter has,
  or add one where the story has room. Don't paper over it.
- **The XP ceiling** (`npm run check:story`) takes the most XP any route can
  bring to each fight, and fails on farmable XP or on a fight met above the
  chapter's `levelBand`.

### Encounters: a distinct roster per fight

A chapter is also a tour of the bestiary.

- Never drop the same encounter into three different battles. Two
  exclusive versions of one fight (surprised, or not) may share one.
- Vary the creature types across acts.
- When something non-obvious fights for the villain, explain why in the
  fiction. Beasts and lizardfolk serve the Ashfang because the chief sold the
  marsh to a green hag.
- Boss and act-climax fights should bite. Prefer a nastier mixed roster, or a
  real single threat, over more mooks.

### At the door of a fight

Every fight opens on its intro with three choices:

- **Fight.**
- **Sneak up:** a group Stealth roll. Success means the enemy loses its first
  round; failure means the company does.
- **Fall back:** return to where the company came from. The fight stays.

During a fight, **Retreat** does the same, at the cost of a parting blow
from every enemy in reach. Add a `parley` where talking is plausible
(mercenaries, a boss who can be bluffed), never for mindless foes. Its
success carries the story effects the win would, but not the loot. Its
`refused:` lines answer in the foe's own voice. Mark `noFlee: true` on a fight
the story cannot let the party walk away from.

### One try, and coming back

- **`once`** stops a choice being taken twice. When the same try is offered in
  more than one place (a plain version and a "with Wren's notes" version, or a
  choice and a fight's parley), give them a shared `attempt:`. Using any one
  of them, whatever the roll, spends it for all.
- **`again:`** text is for every scene the party can come back to, including a
  fight's intro: "The goblins are still in the ditch, and they are ready for
  you now."

### Falling back

A scene opened from a map marker or a room can always be walked away from.
Any other story, dialogue or challenge must say whether it can: `noBack:
true`, or `back: true` when stepping back is meant. The validator refuses a
scene that says neither. A party can't fall back from a fight it was caught
out in (`surprise: party`), so a failed roll can't be fled and walked back
into clean.

---

## 4. Writing well

### The rules

1. **State discoveries plainly, in the moment, in someone's voice, once.** When
   the party learns a fact the game is tracking, *say the fact*, then file it in
   the journal. Never make the player infer what the scene already decided they
   know. Then trust it: don't say it again in the next scene, or at the end of
   this one.
   - ✅ "So the peddler's your leak." / *journal: The Furtive Peddler. Find him by the market gate.*
   - ❌ "You sense there may be more to the market than meets the eye."

2. **One trait per NPC, and keep it.** Give each speaker a single, legible
   personality and let every line express it. A reader should be able to name
   the trait after two sentences. Consistency reads as character; variety reads
   as noise. (See the cast sheet below.)

3. **Choices are intentions, not stat lines.** A label reads like something a
   person would *do* or *say*. Keep the skill and DC chip, but the words after
   it are a decision, not a mechanic. Use one grammar: a verb phrase ("Read
   what she isn't saying"), or quoted speech where the choice *is* speech
   ("Keep the purses. The dead won't spend them").
   - A hint only when it says something the label can't.
   - No "Onward".
   - A companion's idea reads as theirs ("Let Wren lead them off").
   - ✅ `[Persuasion DC 12] Buy the whole room a round`
   - ❌ `[Persuasion DC 12] Attempt to gain information`

4. **Concrete and sensory over abstract.** Name the thing. A "furtive peddler by
   the market gate" beats "a suspicious figure"; "a child's shoe nailed to the
   rafters" beats "signs of cruelty".

5. **Earn the humour, and ration it.** A dry aside lands because the rest is
   played straight. At most one wry beat per scene, usually from an NPC's
   understatement or a narrator's deadpan. Never slapstick, never anachronism.
   - ✅ Mira, on the raiders: "They came down the marsh road. Everyone knows that. Knowing it never filled a cart back up."

6. **Every image resolves inside the passage.** A simile the reader has to solve
   is a wall, not a picture.
   - ✅ "A boulder sits beside the trail with a handprint pressed into it. The hand was wider than a door."
   - ❌ "A boulder with a hand-print in it, if hands came in half-doors."
   - ❌ "eyes flat as coins already spent" / "patient as gravity"

7. **Anchor a proper noun to something physical the first time.** A capitalised
   name with no referent is a debt the reader carries for the rest of the
   scene. Introduce it with a sound, a sight or a feeling, and let a character
   say what it means for the party.
   - ✅ "you hear it at last: the **Calling**. It is not really a sound. It is a pull, like a door standing open somewhere above the clouds."

8. **The narrator describes; a character explains.** Information the player
   must act on goes in dialogue. And a character says it once: a narrator
   closing each fight with "one monster fewer" is the quest log reading itself
   aloud.

9. **Show the creature before you name it. Never define it.** Show it by what it
   has done to the place, or what it does now. Let the name arrive late, or in
   a character's mouth.
   - ✅ The statues in the valley are too good: a hired sword, his blade half drawn. Then Wren: "Gorgon. Don't let it breathe on you."
   - ❌ "This is a **gorgon**. Its breath turns living things to stone."

10. **End on the image, not on what it meant.** If a paragraph closes by
    explaining the picture it just painted, cut that sentence and read it again.
    Nine times in ten nothing was lost.

11. **Shared text is neutral; warmth and coldness are earned.** A line every
    route reads must be true on every route. Anything that praises the company
    needs a flag, or an NPC's attitude, behind it. So does a rebuke. Before
    leaving a shared scene, ask of each line:
    - Does it praise the company, or assume someone helped, came or was told
      something?
    - Does it name where the party is?
    - Does it state what someone remembers from an earlier chapter?

    Each yes needs a `?` or a `?!`.

12. **Ration the tells, and write the recurring beats more than once.** Give
    each character one signature gesture, used once a chapter: Mira's
    near-smile, Wren's blush, Vex's tired calm. A beat that recurs (a night
    ambush, a defeat and waking, a return to the hub) gets two or three
    written variants. Some words have been worked too hard: "Then" to open a
    sentence, "Nobody", "Whatever…", "older than…", "honest", "like a man
    who…". `test/repetition.test.ts` catches any four-word phrase that turns
    up three times in one playthrough.

13. **Epilogues are eight to twelve fates, and they build.** Each slide is a
    person or a place told through an object or a gesture (the stone dog's
    ribbon; the carter's girl in new shoes), ordered so the last is an image to
    close on. Never a status report, and never the player's own choice quoted
    back to them.

14. **Rules terms stay out of people's mouths.** Characters describe the thing;
    the interface names the rule. "Get clear before you start your muttering" is
    a hedge-witch talking. "Your real spells burn *slots*" is a rulebook.

15. **The company is not mute.** At a chapter's big beats, one member can act or
    speak by class (`? class cleric | Your cleric says the words over the
    grave.`). One such line per key beat is plenty. The company's members are
    the player's, so they never get a pronoun: "your cleric", never "he" or
    "she".

### Register

Plain words, varied rhythm. Most sentences carry one idea. But a passage made
only of short declaratives reads like a primer, and its big moment has nowhere
to rise from. Join a pair of short sentences with *and*, *but* or *which* when
they belong together, and let the moment that matters run a little longer
before landing on a short one. The checker grades the paragraph (8 or less on
average), caps a sentence at 26 words, and allows one heavy clause-break.
Prefer the word a nine-year-old already owns: *hall* over *steading*, *loose
rock* over *scree*, *brook* over *beck*. Text is read on phones, and white
space is comprehension.

### Prose in a scene

- **A story's text or a dialogue's lines** unveil one paragraph per tap. End
  each on a small hook. Two or three beats is usually right; more than four
  is a wall.
- **Journal bodies** are for a player returning after a break: name the place,
  the person and the next action, in plain past tense.
- **Result text** lands the consequence in one or two lines.
- **A fight's intro** sets the enemy and the stakes in a sentence or two of
  motion. It is the last thing before the dice, so end it on a verb.

### Promises and threads

- **Never promise a mechanic the scene doesn't enforce.** "There's no second
  try" must be made true (`noFlee`, `noBack`, a shared `attempt`), or the line
  must say less.
- **Close every thread you open, on every route.** Two scouts went out; a debt
  is owed. Check the payoff in the atlas.
- **Late visits.** An optional NPC at a hub can be met first at any point:
  after a defeat, or after the world has moved on. Guard what goes stale on
  the flag that makes it stale, or say less.

### Cast voice sheet (The Hollow Road)

- **Mira, the innkeeper:** dry, competent, has seen worse and said less about
  it. Her warmth is kept firmly under the floorboards.
- **Bram, the quartermaster:** coin first and sentiment never, but he deals
  square, because a dead customer buys nothing.
- **Wren, the scout:** young, hurt, trying to sound braver than she feels.
  Grateful in a way that embarrasses her.
- **Vex, the lieutenant:** tired, not evil. A pragmatist who backed the wrong
  chief and knows it.
- **Vargan, the chief:** entitled brutality. He speaks of a burned town the
  way another man speaks of a good harvest.

### The arena's voice

The arena is drier and more knowing than the valley: it is an afterlife with
a bored demon in it. The quasit is the only arch voice; the healers, the
merchant and the crowd sound like people. Say each rule once, in one voice.
A gambit's stakes are plain speech ("their first swings go wide"), never a
condition name. Every line must be true of every board it can show on.

### The world bible and the ledger

- **`docs/canon.md`** holds the facts the prose relies on: seasons, roads,
  who looks like what (the girl's one shoe, Wren's leg). Check it before you
  write a fact, and add a new fact there first.
- **`docs/state-ledger.md`** fixes what crosses between chapters: ten entries,
  each with at most three values.
  - A later chapter reads only the ledger. If a line needs a finer fact,
    rewrite it to be true across the ledger value.
  - Pay off in a few places: the opening, the key conversations, the
    epilogue.
  - `npm run check:story` prints each chapter's spend against its budget in
    `src/data/modules/ledger.ts`.

Settled decisions, which are not reopened each round, are in
`docs/design-decisions.md`.

---

## 5. Checking your work

### What the proofs promise

The validator walks **every state a party can get a chapter into**: the
scene, the map it returns to, every flag a requirement reads, and every
companion. Every check passes and fails, and every fight is won and lost. It
reports:

- **a scene no state reaches**;
- **a state with no way left to a victory ending**, with the shortest way
  there spelled out (`muster: "Report to the command tent" → envoys: loses
  the fight → …`);
- **a quest taken and never settled**, a name read before its introduction,
  and a line whose `?!` fails on some route.

The search cannot see gold, items, classes or tallies: a requirement on them
is taken either way. Each flag it must track can double its states, and it
stops at 3 million states. **Track what matters:** a generated place proved
apart keeps its own flags out of the count, and a declared place answers to a
few.

Chapters hand each other only what `carries` lists, and the next chapter is
proved once for each mix the last can hand it.

### The commands

- **`npm run stories`** builds the scenes. **`npm run check:story`** checks
  everything a writer touches. **`npm test`** (about two minutes) runs once
  before a commit.
- **`npm run atlas`**, **`npm run transcripts`** and **`npm run reference`**
  regenerate the docs. Their tests fail until the committed files match.
- **`npm run module:map -- <id>`** draws a chapter: a box per location, every
  way between scenes, and anything the validator reports outlined in red.
- **`npm run balance`** (about a minute) simulates every main-path fight
  fresh, worn and on arrival.
  - The target is roughly **70–90% wins fresh** (60–80% for bosses).
  - It flags fights won under 60% (LOW), at 97% or more (EASY), and met
    above or below their level (UNDER, OVER).
  - It has no staleness test: rerun it when encounters or chapters change.

### Reading the atlas

The transcripts show a few routes. `docs/atlas/<chapter>.md` shows every scene
the other way round: each distinct version of its text that some reachable
state can produce, with when it shows ("when Wren saved · Vargan spared"),
then its choices and when each is open.

- **Writers:** read every version of each scene you change, and ask of each
  whether every line is true for every party the "when" admits.
- **"Never shown on any reachable route"** is dead text, or a wrong condition.
- **Shared paragraphs** are marked where they show. When you change one, read
  it in every scene it appears in.
- **`?` on a condition** means the search does not track it (gold, an item, a
  class), so both ways are shown.

### Reading a route

A scene that reads well on its own can still contradict the one before it: a
companion greets you from camp right after walking down the mountain beside
you. Those mistakes are invisible in the source and obvious in the order a
player meets them. So read routes, not just scenes.

`docs/transcripts/` holds the exact text a player reads on fixed
playthroughs:

- the whole trilogy played four ways (completionist, rusher, cruel,
  unlucky);
- cold starts of chapters two and three.

Each transcript shows every paragraph, the choice taken, each roll and fight,
the nights slept and the flags carried between chapters. The routes are
defined in `scripts/transcripts.ts`; add one when a branch you care about is
on none of them.

### Reviewing

- **A content change's transcript and atlas diff** is what changed for a
  player. Review that, not the source.
- **Before a round of fixes ships,** one reviewer reads only the round's diff
  and the atlas versions of every scene it touched (and of the scenes that
  read the flags it changed). They look for what the fixes themselves broke:
  a line false on some path, a promise the scene doesn't keep, a thread
  opened and not closed, regard moved where the NPC wasn't there.
- **Reviewers, human or AI:** report a wrong line with the route or scene id,
  the version's "when" and the quoted line.
