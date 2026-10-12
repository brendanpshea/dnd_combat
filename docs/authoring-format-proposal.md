# A text-first authoring format: proposal

**Status:** proposal, for discussion before chapters two and three are reworked.

## The problem

A chapter is written as TypeScript object literals. Every scene repeats its
id, its kind and its structure, and every effect is a small object
(`{ kind: 'setFlag', flag: 'bounty' }`). Chapter one is 1,654 lines; perhaps
a third of them is prose. To an author the syntax is noise, and a misplaced
brace stops the build.

The engine doesn't need to change. Only the source format does: what the
author writes compiles to the same `Module` data, so the validator, the
reachability proof, the ledger, the atlas and the transcripts all keep
working untouched.

## The shape

One `.story` file per chapter. Scenes are headed blocks: prose first, then
the ways out. Here are three real scenes, written both ways.

### The notice board

Now: 19 lines of TypeScript.

```
# board · 📜
Here is the reeve's bounty in full, nailed up and gone grey at the edges. He
will pay good coin for proof the {ashfang} chief is dead, and better still for
their banner brought back whole.

Someone has added a line at the bottom in a smaller, prouder hand:
*"{thornwick} does not beg. It pays its debts."* That ink is newer than the rest.

again: The reeve's bounty still hangs on the board, a little greyer at the edges than before.

> Take the reeve's retainer up front → @hub  (once)
  + bounty · gold +{bounty-retainer} · quest c-bounty
> Leave it for now → @hub
```

(The `c-bounty` quest moves to a `quests:` block of its own. Quests are
already compiled from data, see `quests.ts`.)

### The first fight

```
# road-ambush · fight raiders-forward on open
Raiders scramble out of the ditches on both sides: two orcs with notched axes,
and two lean scouts with arrows on the string. …

"The road's the **{ashfang}'s** now!" the bandit in the coat crows. …

won → road-reveal: The bandit in the carter's coat is the last to drop into the mud.
lost → road-carter: The world goes grey, then black.
```

### Mira's bar

```
# tavern · talk mira · 🍺
**{mira}** leans on the bar and waits for you to say something useful.

> [Insight 12] Read what she isn't saying → tavern-spy  (once)
  ? not spy-caught, not spy-seen
  fail → tavern-blank + mira-read
> [Persuasion 12] Buy the whole room a round ({tavern-round}) → tavern-trail  (once)
  ? gold {tavern-round} · gold -{tavern-round}
  fail → tavern-round-flat
> Ask her the way to the den → tavern-plain  (once)
> Drift over to the regulars' table → regulars
> Take a room for the night ({inn-room}, long rest) → inn-rest
  ? gold {inn-room} · gold -{inn-room}
> Step out into the square → square/city
```

The current version is 20 lines of nested objects.

## The grammar, in brief

| Written | Means |
|---|---|
| `# id · kind extras · emoji` | a scene; the kind is `story` by default, or `talk npc`, `fight enc on map`, `check skill dc`, `shop`, `rest`, `ending victory`… |
| blank-line paragraphs | `text` (or `lines`, `intro`) |
| `if flag, not other: text` | a conditional paragraph |
| `again:` | `again` text |
| `> label → target (once)` | a choice |
| `? …` under a choice | its requirements (`flag`, `not flag`, `gold N`, `with wren`, `class ranger`, `npc wren saved`, `visited x`) |
| `+ flag`, `- flag`, `gold ±N`, `xp N`, `item x`, `npc wren +1`, `quest id` | effects |
| `[Skill DC] label` | a check on the choice; `fail → scene + effects` |
| `won → / lost → / parley skill dc: …` | battle outcomes |
| ` ```spec ` blocks | towns, delves, places, dawns, carries and the cast, as YAML that maps 1:1 onto the existing types |

Hidden-when-blocked becomes the default. A choice you can't take says why
only when it's marked `(show)`. That's the commoner case today the other
way round, and it removes a flag from most choices.

## How it is built

1. **Parser** (`src/adventure/story-format.ts`): `.story` text → `Module`.
   It is a small line-oriented parser with no dependencies. Errors carry a
   line number, so a typo says "line 214: no scene 'taven'", not a stack
   trace.
2. **Printer:** `Module` → `.story` text. It exists for migration and for
   one test: **round trip**. Every shipped chapter printed and parsed back
   must equal the original module exactly. That's what makes the switch
   safe: the format can express everything the chapters already use, or
   the test says what it can't.
3. **Loading:** chapters are imported as text (Vite `?raw`, and plain `fs` in
   the scripts), parsed once at start-up, then validated exactly as now.
4. **Escape hatch:** anything the grammar doesn't cover can stay in a small
   `.ts` beside the story (shared effect lists like `AFTERMATH_CLAIMS`, the
   NPC registry), referred to by name (`+ @AFTERMATH_CLAIMS`).

## What it would cost, and what it buys

- **Cost:** about 600–900 lines of parser, printer and tests. Then a
  mechanical conversion of three chapters by the printer, and a hand pass
  over each to tidy the output.
- **Buys:**
  - Chapters at very roughly half their length, most of it prose.
  - Diffs a writer can review.
  - No build break from a missing brace.
  - A format other tools (or another model) can write reliably.
- **Keeps:** every proof. The engine never sees the text.

## Questions to settle first

1. **One file per chapter, or a folder per chapter** (a file per location:
   `thornwick.story`, `marsh.story`, `den.story`)? A folder matches the places
   design (each location answers to its own flags) and keeps files small.
   This is my recommendation.
2. **How much logic belongs in the text?** I'd keep requirements and effects
   inline, as above, and move everything structural (towns, delves, quests,
   the clock) into spec blocks.
3. **Editing in the app?** The same parser could power a live preview later.
   Not needed now.

## Suggested order

1. Parser, printer and round trip on the small modules (`demo`, `classic`).
2. Round trip on chapter one, then switch it to the `.story` source.
3. Write the reworked chapters two and three in the new format from the start.
