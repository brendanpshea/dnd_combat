# Settled design decisions

What has been decided for the trilogy, so reviews and fixes don't reopen it
each round. A reviewer who thinks one of these is wrong says so once, as a
proposal for the user, and doesn't build fixes on the assumption it will
change. Each entry gives the decision and, briefly, why.

## State and branching

- **What crosses between chapters is the ledger** (`docs/state-ledger.md`):
  ten entries, at most three values each, tallies read only in bands. A
  later chapter reads nothing finer; text that needs a finer fact is
  rewritten to hold across the ledger value. Chapters stay inside their
  budget (`src/data/modules/ledger.ts`).
- **The captives are freed or not.** The ledger does not distinguish "taken
  by the dark moon" from "never found"; the loss is paid in Part 1's epilogue.
  A pen emptied on Wren's word (she was sent home before the moon went dark)
  counts as freed.
- **Prefer fixes that add no state.** When two fixes work, take the one with
  fewer flags, conditional paragraphs and branches.

## People

- **An NPC's regard moves only for what they saw.** An attitude change is
  guarded on the NPC being met, with the party, or declared `present` on the
  scene; word of mouth is marked `hearsay`, deliberately and rarely. The
  validator enforces it.
- **Wren's regard is read in three bands:** cold (below 0), neutral (0–1),
  warm (2 or more). Lines for a cold Wren must hold for any cold Wren, not
  only the one the party walked past.
- **The Reedwife can be bound, not spared.** Binding (after Vargan turns on
  her) holds her to her old price; she lives. The weight of blame for her
  fall lies on Vargan's sale of the shallows. Bound, she keeps the price but
  not the watch, so the Warden still wakes: binding changes the story's
  voice, not its plot.
- **Vargan is dead or spared** (jailed or let go read the same later).
  **Vex is turned or not.**
- **Kept lines:** Mira's "It is the nearest thing to thanks she keeps in
  stock, and you both know it." and Bram's "Two of the three I stock" stay.
  Reviewers have asked to cut Mira's line several times; it stays.

## Play

- **Levels come from fights** (and from walking past a fight, which pays the
  same). No level floors except cold starts. The level curve is the same on
  every route by design: optional fights pay in story and gold, not levels.
  Part 3 tops out at 5th.
- **No fail state beyond a chapter's own defeat ending.** Losses cost time
  and position, never a soft-lock. A rest straight back into a fight is
  `sameDay` (no night passes mid-fight).
- **One try at the big mercies** (binding the Reedwife, saving Halden), and
  more than one skill can reach each: a party is never shut out of a mercy
  because it lacks one particular skill (binding the Reedwife: Arcana as a
  parley, or Religion as a rite; Halden: Religion, or Persuasion by his bell,
  easier after reading the churchyard;
  the vigil's plain ask: Persuasion, or Religion in the old words).
- **Combat is meant to be a challenge.** A main-path fight wins roughly 70–90%
  for a fresh party at the level routes actually meet it (bosses and finales
  60–80%); the "worn" column of `docs/balance.md` shows real danger. Night
  ambushes scale to their chapter. Tune by roster against the balance table,
  not by adding state.
- **The answer to the sisters decides the vigil, and the scene says so.** Each
  answer's weight is foreshadowed by what the sisters do in the scene, not by
  hints that hand over the answer. No false options: where an answer closes
  the vigil (defiant, cold, Vargan's sale when he is dead), Sedge's refusal is
  part of that answer's scene, not a choice offered afterwards.

## Prose

- **Never promise a mechanic the scene doesn't enforce.** "You won't be
  walking back", "this is your last chance": either the scene makes it true
  (`noFlee`, `noBack`, a one-way door) or the line says less.
- **A thread a line opens, another closes on every route.** If Mira says two
  scouts went out, every route learns what became of both.

## Process

- **Bugs and suggestions are different.** A *bug* is text false on some path
  (check it in the atlas), a reward paid twice, a way to get stuck, a promise
  the scene doesn't keep, or a contradiction of `docs/canon.md`: bugs are
  always fixed. A *suggestion* is design or prose taste: it goes to a backlog,
  and the user picks which to do.
- **Feature freeze.** Until a read-through finds no confirmed bugs, no new
  mechanics, scenes or branches except to fix a bug or carry a suggestion the
  user picked. Every new branch is a new place to be inconsistent.
- **Done** is a read-through whose playtester, working from the atlas, finds
  no confirmed bugs.
- **Facts come from `docs/canon.md`.** Add a fact there before writing it.
