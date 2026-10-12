# Quests

A quest is data compiled into ordinary scenes, flags and a journal entry
(`src/adventure/quests.ts`), like a spliced town or delve: the runtime, the
save and the proofs see nothing new.

## Step 1 (built): the foundation

`Module.quests: Record<id, QuestSpec>`:

- **giver** — a story or dialogue scene. Two choices are added before its
  last (the way out): *Ask about work* (until taken) and *Report back*
  (once every stage holds).
- **stages** — requirements, not steps. A party that has already done the
  thing when it takes the quest can report straight back.
- **objects** — flags with names ("has-ring" → "the reeve's ring"), never
  pack items: nothing to sell, drop or drink. Shown in the journal as
  carried; cleared on reporting back. `gives` hands some over on taking.
- **reward** — any effects (gold, XP, items).
- **failsOn** — a flag the story sets when the quest is lost, by a choice.

Flags: `quest-<id>` taken, `quest-<id>-done` reported back.

**The proof.** From every state where a quest is taken and neither done nor
failed, some way on still reaches it done (reach.ts, walking back from the
done states as for victory endings). A quest the story can strand — the
ring thrown in the river with no way back — fails the module's proofs,
unless that choice sets `failsOn`.

The journal lists quests open-first, with stages ticking off as they come
true, what is carried, and done / failed.

## Step 2 (built): defeat, fetch, scout

`QuestSpec.adds` — what a quest adds elsewhere, offered only while it is in
hand: a choice in any story or dialogue scene, or effects on a battle's win.
The other ways through are made of these.

`LandSpec.quests` writes a quest from a line (`{ id, kind, giver, target |
visit, object? }`), given and turned in at a settlement's inn, rewarded by
the target's level (25 gold and 75 XP a level):

- **defeat** a camp — fight, or *Tell them to clear out* (Intimidation,
  DC 10 + 2 × level; failing, they fight) — or a delve, by winning it.
- **fetch** an object — from a delve's hoard (on winning), a camp's (on
  beating it, or bought from a calm or cowed camp), or from the city's
  thieves' guild, dearer and no questions asked.
- **scout** places — *Take note of what you see* there, in whatever state
  the place is found (a camp may be prey, cowed or cold ashes).

**Object names** (`quest-objects.ts`): long and self-describing, proper
nouns in the county's name style — "the Tome of Silent Winters", "Etainne's
Jade Circlet", "the Frozen Diamond of Mirostov".

The county's proof stubs each town with its inn and back room, so a quest
given in a town is proved like any other.

## Step 3 (built): rescue, arrest, deliver

- **rescue** someone held at a camp — fight, pay a ransom (20 gold a
  level), or *slip them out after dark* (Stealth; failing, the fight) — or
  in a delve (win it).
- **arrest** a camp's leader — beat them, or *talk them into coming
  quietly* (Persuasion; it ends the camp too) — or whoever holds a delve.
- **deliver** something to another settlement's inn, handed over on taking
  the quest; back to the giver for the pay.

A person rescued or arrested travels as a named flag ("with you: Mara
Vell"; "Black Tom, in chains"), not a companion in the fights: nothing
kills them by a stray blow, leaves them behind, or sells them. The proof
holds as before — a county whose delivery could never arrive is refused.

## Next

4. Generation: a lord in the city's castle, trade givers, notice-board
   bounties; rewards by level (rarely permanent magic); subquests feeding a
   main quest by count.
