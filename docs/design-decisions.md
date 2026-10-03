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
- **One try at the big mercies** (binding the Reedwife, saving Halden), with
  at least one way that doesn't need a single skill.

## Prose

- **Never promise a mechanic the scene doesn't enforce.** "You won't be
  walking back", "this is your last chance": either the scene makes it true
  (`noFlee`, `noBack`, a one-way door) or the line says less.
- **A thread a line opens, another closes on every route.** If Mira says two
  scouts went out, every route learns what became of both.
