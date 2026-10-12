# NPCs as objects: the stage

Chapters kept losing track of their people: a scene that forgot to check
whether someone was alive, here, friendly, or already asked. So the NPC
carries it (`src/adventure/staging.ts`), and the story only changes state.

## The registry and the stage

- **Registry** (`NpcDef`, campaign-wide): who someone is — name, portrait,
  fates (dead, jailed…), a stat block if they can fight with you, and now
  `values`: what they care about.
- **Stage** (`Module.stage`, per chapter): where they can be in it, and what
  they say.

## The stage

```ts
stage: { wren: {
  places: [{ scene: 'square', x: 50, y: 20 }, { scene: 'well' }, { scene: 'jail' }],  // first is home
  gone: ['dead'],
  greet: [{ text: '"You again."', if: [...] }, { text: '"Scout\'s business."' }],   // last: always
  topics: [{ id: 'key', label: 'Ask about the key', lines: [...], requires?, effects?, repeat?, to? }],
  hostile: { when: { kind: 'npc', npc: 'wren', fate: 'angry' }, to: 'wren-fight' },
  join: { companion: 'wren', when: [attitude ≥ 1, empathy ≥ 0], yes: [...], refuse: [[...], [...]] },
} }
```

- Every place offers **Talk to Wren** — a choice in a story or dialogue
  scene, a marker on a map — exactly while she is there, not gone, and not
  travelling with the company. A place's own text describes only the place.
- **Moving:** `{ kind: 'npc', npc: 'wren', at: 'well' }`; and
  `{ kind: 'npc', npc: 'wren', at: 'well' }` as a requirement. One place at a
  time, like fates; home is "none of the others", so nothing need be set at
  the start.
- **Talk:** the greeting (every line whose condition holds), then the topics
  that apply, each told once unless `repeat`. Each place has its own copy
  of the conversation, so taking your leave goes back where you were.
- **Hostile:** when its condition holds, *Talk to* becomes *Confront*, and
  leads to the fight.

## Reputation

Two axes, roughly the old alignments: **empathy** (kind, merciful; below
zero, cruel) and **law** (keeps the rules and its word; below zero, breaks
them). A choice tags a deed — `{ kind: 'deed', empathy: -2, law: -1 }` — and
it moves the company's name (`{ kind: 'reputation', empathy: { below: 0 } }`)
and, by their `values`, the attitude of everyone who cares: word gets round.
Greetings remark on it; `join` turns on it, and a refusal says which thing
stood in the way.

## The proofs

All of it compiles to ordinary choices, scenes and flags, so the validator
sees it whole. It already catches the first kind of incoherence this was for:
a place someone can be that nothing ever sends them to ("talk-wren@jail can
never be reached").

## Three rules that end twins

Chapter one's survey found its tangles were not about where people are but
about *twins*: choices and lines written twice over one NPC's state. Three
engine rules let a chapter write them once.

- **Regard moves only in someone who knows the company.** An NPC attitude
  effect compiles with `ifSet: npc.<id>.met`: before they have met the
  company it does nothing. No more "met" and "not met" copies of a choice
  just to keep a stranger's opinion still. (Talking to a staged NPC meets
  them.)
- **A fight picks its enemies** (`battle.encounterWhen`): the first variant
  whose `if` holds, else `encounterId`. One hall, guarded or not, with its
  text varying by the same conditions — not a twin of every choice leading
  in.
- **Outcome cards** (an ending slide `{ thread, cases }`): one thread's
  ending, the first case that holds. Order says what negation used to; two
  lines of one thread can never both show; a case after one that always
  holds is refused.

## Next

- Port chapter one (*The Hollow Road*): Wren, Vex, Vargan, the reed-wife.
- Wanderers: NPCs who move by themselves (a route, by day or night), when a
  chapter wants one.
