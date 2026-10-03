# The ledger: what crosses between chapters

A chapter remembers a lot while it is being played. What it hands on to the
next chapter is small and fixed: the ten entries below. Everything else is
chapter-local and is forgotten at the chapter's end.

Every entry has at most three values. A tally is read only in its bands, never
at a finer grain.

| # | Entry | Values | Set in | Stored as |
|---|---|---|---|---|
| 1 | Wren | `saved` (the party pulled her from under the horse) / `lost` (the scout under the horse died; she was Wren's partner, Tamsin) / neither | Part 1 | NPC fate `wren` |
| 2 | Wren's regard | one number, read in 3 bands: cold (below 0), neutral (0–1), warm (2 or more) | any part | NPC attitude `wren` |
| 3 | Vargan | `dead` / `spared` | Part 1 | NPC fate `vargan` |
| 4 | Vex | `turned` / not | Part 1 | NPC fate `vex` |
| 5 | The captives | freed / not | Part 1 | `hollow-road:captives-freed` |
| 6 | The Reedwife | `dead` / `bound` | Part 1 | NPC fate `reedwife` |
| 7 | Halden | `saved` / not | Part 2 | NPC fate `halden` |
| 8 | Marrow | `sings` / `bound` / neither | Part 2 | NPC fate `marrow` |
| 9 | The seal | whole / cracked | Part 2 | `sunken-barrows:seal-cracked` |
| 10 | The valley's regard | one number, 0–3, read in bands | Part 2 | `sunken-barrows:regard` |

Plus each chapter's `won`.

## What is chapter-local

Anything not in the table. In particular:
- **Part 1:** jailed or let go (both are `spared`); bargained with or threatened
  (both are `turned`); refused or rebuffed (both are "not turned"); walked past
  the scout or never found her; the scout's partner by name (Tamsin is a name,
  not state).
- **Part 2:** which of the deeds raised the valley's regard (the drowned purses
  carried home, the old reeve carried home, …); whether Wren came down the
  barrow stair.

## Writing against the ledger

- **Later chapters read only the ledger.** A line that would need a finer fact
  is rewritten so it is true across the ledger value: "He is alive, and works
  the shallows he sold" holds for a Vargan in a chain or a free one.
- **Payoffs live in a few places:** each chapter's opening, its key
  conversations, and the epilogue. Shared text elsewhere is written to be true
  on every route.
- **Tallies are read in bands.** Wren's regard: below 0, 0–1, 2 or more. The
  valley's regard: 0, 1, 2 or more.

## Budget

`npm run check:story` reports each chapter's story flags, conditional
paragraphs and reachable states. The validator holds a chapter to the ledger:
it may carry only its ledger entries, and an NPC may have at most three fates.
