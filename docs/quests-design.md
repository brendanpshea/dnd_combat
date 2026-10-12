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

## Next

2. Types defeat, fetch, scout on existing pieces (won flags, delve finds,
   visits), with alternative ways (talk, pay, sneak); quest object names.
3. Rescue, deliver, arrest: escorted companions, carried parcels.
4. Generation: a lord in the city's castle, trade givers, notice-board
   bounties; rewards by level (rarely permanent magic); subquests feeding a
   main quest by count.
