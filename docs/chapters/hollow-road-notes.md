# The Hollow Road: design notes

Why chapter one is built the way it is. The notes moved here from comments in the chapter's source (now `src/data/modules/hollow-road.ts` and `hollow-road/*.story`), so the chapter reads as story. Each heading names the scene or definition it explains (`scene › part` when it sits inside one).

## The chapter

"The Hollow Road" — the campaign module: an original, SRD-safe ~2-hour
adventure in three acts (village hub → wilderness trail → raider hideout →
boss), the deliverable that proves the whole adventure system end to end.

Design targets from docs/adventure-mode-plan.md: ~25 scenes, 3 explore maps,
combat never more than 3–4 scenes away, two avoidable fights, skill variety
across the 18-skill list, and an epilogue that reads flags back so choices
visibly mattered. No new stat blocks — every encounter is composed from the
existing bestiary. All content is original; no published module text is reproduced.

LEVEL BAND 1→3: fights carry the leveling, with no milestone floors
(docs/module-writing-guide.md, "Levels come from fights"). Every way past a
fight pays what the fight would have (`avoidedFightXP`): the spy's crew
shouted down or caught, the den's gate slipped, Vex turned so that Hask
stands aside from the chief's guard, the road-out goblins stared down. A company
that fights its road reaches 2nd on the marsh road, and every company
reaches 3rd before the chief's hall: the den's
gate (fought or slipped) and the pit on its forced spine carry about 560 XP
a head between them, enough to lift a company that walked past every side
fight (the mill, the barrow, the thicket, the toads, the kennels) to 3rd
just as it wins the pit. The side fights buy a margin, not the level.

MONSTER VARIETY is a goal in itself — this module is a tour of the bestiary,
a distinct roster per fight (goblins, human crooks, the marsh's toads and
risen dead, a hag-thrall lizardfolk war-party, a bugbear/gnoll gate, a chained
ogre pit-brute and its berserker champion, kenneled hyenas, and a green-hag-and-warlord finale) across a
spread of maps (road, village square, bog ford, ruins, corridor, fire-pit). The connective story explains
*why* beasts, undead and lizardfolk fight for "bandits": chief Vargan, a
Thornwick-born reed-cutter, sold the reed-cutters' common marsh to the
Reedwife, a green hag, for coin and monsters. She branded him like the rest.

## `PENS_LEAD`

The pens, as a lead: Vex points the way, but only while the pen is still
 an open question (`pens-settled` unset). Looking in it, the dark moon, or
 the hag's death (no way back into the den after it) settles it.
Proved from every state (no `takenBy`): its taking needs no flag of its own,
and each tracked flag doubles the search.

## `BOSS_FALLS`

The chief and the hag go down together, in every version of the hall. He
 is beaten, not dead: what becomes of him is the company's call
 (`vargan-beaten`), and finishing him there is an execution (`dead`), as
 it is for a chief who turned on her. The hag's death also closes the
 pens lead: there is no going back into the den after it.
She dies as a body, not a heap of reeds: in Part 3 her sister's seeming
melts into wet reeds and a puddle, and the two must not read alike.

## `BIND_VARGAN`

Marching him down to the reeve (`spared`). {wren} asked for something to
 arrest, and thinks the better of the company for it — if she knows the
 company at all (pulled out from under the horse): regard moves only in
 someone met, by the engine's rule, not a twin of the choice.

## `FREE_VARGAN`

Letting him go: `spared` too, as far as the rest of the campaign cares,
 and `vargan-let-go` for this chapter's square and ending. The reeve pays nothing for a chief he cannot see, so the
 bounty is settled there and then (`got-bounty`). A company that drew the
 retainer at the board (`bounty`) gives it back: the reeve asks for it in
 the square (`aftermath`), and the coin goes as the company walks in.
 (Charged on the way in, not as a claim in the square: an unsettled bounty
 there is a state the search would carry through the whole square.)

## `BIND_HAG_WON`

Binding her instead: with {vargan} turned on her, his bargain is broken and
only the older one stands. Every company that gets here has heard its price
from her own mouth (`boss-approach`). Said back to her at the door of the
fight, it holds her (a parley: one try between both fights, `bind-hag`, so
a miss is the fight and the kill, never a second roll). Its success pays
what the fight would have, and carries the fight's story effects (not her
purse, which she keeps). The parley has no scene of its own: it lands on
`vargan-fate`, so the reach search gains no layer.

Two skills reach it (docs/design-decisions.md, "One try at the big
mercies"): the parley is Arcana, the words as a spell; `vargan-turns` offers
the same try as Religion, the words as a rite (`bind-hag-rite`, a check
spending the same `bind-hag`). Either spends both.

## `BIND_HAG_RITE_CHOICE`

The same binding as a rite (Religion), offered before the fight, before
 she whistles in her guard. A miss is that fight, the parley spent. Bound,
 she whistles as she goes, so the chief's guard answers her whistle and
 never fights the company, as at the fight's door (docs/canon.md, Hask).

## `AFTERMATH_CLAIMS`

The claims in the square after the chief falls. Each pays out once, shows a
one-line result beat, and comes back to the short `aftermath-hub` instead of
replaying the homecoming. The bounty is owed to whoever killed the chief; a
party that took the 25-gold retainer at the board collects the balance.

## `AFTERMATH_CLAIMS › won`

`won`: every road to the victory ending runs through here, so the next
chapters can tell a company that broke the Ashfang from a cold start.
Shown once the bounty is settled (paid, or forfeit for a freed chief), so
no company walks off and leaves it on the well by accident. Here too
the scout under the horse is settled for the rest of the campaign: past
the fifth morning and never pulled out, she died there ({wren} `lost`,
as covering her already said). Before it, she lived, and a scout the
company stepped round holds it against them (−2, booked here rather
than at `wounded` so it lands only on a {wren} who lived to hold it;
`hearsay` only to the validator's eye: she saw it herself, at `wounded`).
And the pen: a {wren} pulled out from under the horse sent the reeve's
men up to it (sent home, or running for them from the tree line), so a
pen the company left or never opened, the moon still up, was emptied on
her word, and counts as freed (docs/design-decisions.md; the epilogue's
pens slides read the same).

## `SPY_LIST`

NPCs name a reusable archetype `portraitId` (src/data/adventure-art.ts) so
they share art with every other module's innkeeper / scout / captain; the
emoji is the fallback until that portrait is generated.
What the peddler's stall gives up, however he was taken.

## `VEX_OFFERS`

What the company can say at {vex}'s fire. Split on whether the pen is
 still an open question: only then does his word on it go in the journal
 (PENS_LEAD). Shared `attempt`s keep each try to one go across both.
 Being told of the pen costs nothing with {wren}: she is never at this
 fire, and every {wren} who knows the company at all (`met`) has already
 sent the reeve's men up to it (see the epilogue's pens).

## `MIRA_WARM`

What earns {mira}'s warmth at the end, as mutually exclusive cases (one
 line shows): the captives freed, else the scout saved, else the mill
 turning. MIRA_COOL is none of them. The aftermath and the epilogue both
 read these, each beside "not executed".

## `road`

=== ACT 0 — THE VALLEY ROAD (cold open: a fight in the first minute) ===
The module leads with combat, not conversation: an ambush that teaches the
battle UI (it's the first fight, so the tutorial fires) and names the enemy
— the raiders declare for the Ashfang chief before you ever reach town.

## `thornwick › tavern-meet`

The tavern is a small loop, not a one-way door (#6): each social read is a
`once` choice that returns you here, so you can try Insight *and*
Persuasion but never re-roll either. "Head to the square" is the way out.
First meeting: Mira's introduction plays once, then every return to the
inn (rest, the regulars, a lead followed up) lands on the short `tavern` hub.

## `tavern › regulars`

The rumor table: an optional, in-character tutorial any player can skip.
Each regular teaches one real mechanic; kept as its own loop so it never
gets in the way of the plot choices above.

## `tavern-round-flat › regulars`

--- The Regulars' Table: a reusable "lore table" ------------------------
A drop-in, fully optional in-character tutorial. Each regular teaches ONE
real mechanic in the world's own voice; the choices are `once` so a lesson
isn't repeated, and "leave them to it" exits at any time. Any module can
paste this shape into its hub — a hub scene whose `once` choices each route
to a short lore beat that loops back. Skippable by design: advanced players
simply never walk over.

## `spy-confront › spy-caught`

Taken quietly (stalked and grabbed, his crew shouted down, or caught by
a read of the crowd): nobody runs for the marsh to warn the den, so the
gate-signal he gives up is still good.

## `spy-caught › spy-caught-loud`

Taken the loud way (a brawl, or his knives scared off): one of them ran
for the den, so the signal is spoiled before the peddler can give it up. The den still has
other ways in (the wall, the water-gate, the gate itself).

## `ravine › approaches`

`perApproach`: a botched climb doesn't strand you — you can still scramble
the rubble or take the slow way round. Only when every line fails do you
take the long detour, and it costs a whole day on the clock.

## `wounded › next`

One sure way to save her (a potion), and the rest are rolls: a healer's
hands come easier than the plain Medicine check, but they can still
slip. A slip fails forward (`scout-fail`): she lives, but it costs a day
and she is no guide. Every way out of here is recorded, so she is
met once. Walking past is final (`scout-walked-past`): the map marker
then shows only the empty horse, never the rescue again. Left untended
until the fifth morning (the dawn's `scout-bled-out`; {mira} warns of
her at the first meeting), she dies there, walked past or never found:
walking past never leaves her better off than not finding her at all.
A scout who died there is {wren}'s fate `lost` (her partner, {tamsin},
was the one under the horse): set when the company covers her, or on
the way out of the square (AFTERMATH_CLAIMS). Walked past or never
found before that morning, she lived: no fate.

## `wounded › leave`

`scout-walked-past` outlives the fifth dawn, so the body and the
ending can say who stepped round her. She watched them step round
her, but her −2 is booked on the way out of the square
(AFTERMATH_CLAIMS), once it is settled that she lived: if the fifth
morning comes first, the scout who watched was {tamsin}, and the
{wren} who came home saw nothing.

## `scout-saved › ok`

Sent home from here, she has the reeve's men on the marsh road long
before the den falls: the epilogue's pens slide reads it. Every rescue that lands here earns her +1, by
potion, prayer or a steady hand alike.

## `scout-saved › come`

The Gold Box guide: she knows the marsh, and she owes you twice over.
Only as far as the den's gate: a party that has already been inside
(and could walk straight back in) sends her home instead.

## `scout-fail › scout-dead`

The fifth morning came first: the scout under the horse died (Wren's
`lost`), and the party only finds her (or finds her again) to cover her.
A party that stepped round her finds where she crawled to.

## `ambush › success`

The perception check only sets the terms (surprise). The hollow ambush is
the one route to the den (approach needs trail-read from the tracks), so
it never gets skipped.

## `den-pens › leave`

The pen moves {wren}'s regard only if she has met the company (the
engine's rule: regard follows what an NPC saw). One saved after the
den misses it; that is the smaller cost.

## `den-cache › { if: [{ kind: 'notFlag', flag: 'pens-found' }, …`

Every winning route passes his fire before the hall, so no company
misses the pen by not knowing it is there (it drives a Part 3 war
asset and the epilogue's slide). Text only, so free to the search.
The lead (PENS_LEAD) goes in the journal whatever the party says, if
the pen is still unsettled (VEX_OFFERS).

## `vex-turned › next`

Hask standing aside pays the gap between the guarded hall and the
unguarded one, quartered like any avoided fight. Her snake and a raider
take his place, so it is less than beating him would pay.
The journal holds for a {vex} bought with a pardon or cowed at
blade-point (`vex-threatened`), so it promises him nothing.

## `boss-approach › insight`

The talk with Vargan is always on offer (`turn`, one try however
it is reached). The read on him first (he wears the hag's brand too)
makes it easier, and a fight he starts a round behind; a missed read
(`vargan-unread`) leaves the harder talk and the plain fight. Every
copy splits on Vex's bargain, so each lands in the right hall.

## `boss-approach › fight-alone`

Vex's bargain pays off here: his guard stands down, and the chief and
the hag fight alone. The two choices are mutually exclusive on the flag.
Back after a wipe with the brand already named (`vargan-shaken`): he
still starts the fight a round behind.

## `boss-unguarded-shaken › vargan-brand`

The brand named: Vargan sees what he sold himself for, and the talk comes
easier; a miss (or striking now) is the fight he starts behind.
Two copies, split on Vex's bargain like every version of the hall.

## `vargan-brand-alone › vargan-turns`

Vargan turned: the hag burns him down with his own brand. The turn is its
own beat, so a party back from a wipe (`reedwife-lost`) does not watch him
turn twice: the fights after it open on the hag alone.

## `reedwife-lost-alone › vargan-beaten`

Won in the hall: the hag is dead and the chief is beaten, but breathing.
The same three roads as `vargan-fate`. Finishing a man on his knees is an
execution (`dead`) here too, and Mira and Wren (if she knows the
company) hear of it the same way.

## `vargan-fate › aftermath`

The reckoning: your earlier choices surface here as rewards you can (or
can't) claim — blocked options show *why*, so what you did back in the
village and the marsh visibly mattered.

## `aftermath › ...MIRA_WARM.map((when) => ({ if: [{ kind: 'npc'…`

Mira's one near-smile is earned by more than the kill: the captives
out, the scout brought home, or the mill turning again. It comes
after the reeve's temper over a chief let go, so it reads as hers
at his expense, not as a smile beside it ("Behind him": the reeve,
or {vargan} marched in ahead of him).

## `defeat › next`

A wipe costs time: the day goes by on Mira's cot. Then the square, or,
once the party has walked it, straight back out on the marsh road, so a
loss out there or in the den is not the whole road again.
A party that fell inside the den goes straight back in, to the room it
fell in (as Part 2's barrow stair), not the whole marsh road again.

## `defeat › epilogue`

The ending reads the run back: a short universal close, then one line for
each person or place the party touched. Every slide stands alone, so any
mix of them reads in order.

## `epilogue › { thread: 'vargan', cases: [`

The chief, then the den, then the scout, then the inn, building to the
pens: every victory ends on one of the captives' slides.
Dead in his hall, or after it: every victory leaves him one fate.
One card, first case that holds: let go is spared too, so it comes
before plain spared.

## `epilogue › { thread: 'vex', cases: [`

Turned; or, not turned, he refused the company and went up to the
ridge (`vex-refuses`), or it refused him and he stayed at his fire
(`vex-dismissed`, `vex-rebuffed`).

## `epilogue › { thread: 'wren', cases: [`

The scout: saved; lost under the horse (the company covered her, and
there is nothing more to tell; or stepped round her, and she crawled;
or nobody came); or neither, and she lived (Part 2's limping {wren}).

## `epilogue › { thread: 'mira', cases: [`

Mira's thanks are earned, as her near-smile in the square is: the
captives out, the scout brought home, or the mill turning again, and
never from a company that killed a beaten man in front of her town.
Otherwise she pours, and takes the coin like anyone's.

## `epilogue › if`

The captives. Left, or never opened, with the moon still up: a {wren}
pulled out from under the horse had the reeve's men in the reeds
below the den when it fell (sent home, or running for them from the
tree line), and the pen counts as freed (set on the way out of the
square, AFTERMATH_CLAIMS). The company's own key never leaves it
`captives-left` or unfound, so these two never show beside it.

## `epilogue › { if: [{ kind: 'notFlag', flag: 'captives-taken'…`

Left, or never opened, the moon still up, and no {wren} to send
anyone (a {wren} pulled out from under the horse would have made it
`captives-freed` by now): the reeve's men come late, and the pen is
empty. Those captives never came home (docs/canon.md, the captives).

## `HOLLOW_ROAD_RENAMED_NPC_FLAGS`

What this chapter once said about people in flags of its own, and the NPC
state that says it now (old saves load under the new names). Exported for
the later chapters, which renamed the carried forms (`hollow-road:<flag>`).
`scout-met` marked the covered scout under the horse: Wren `lost`. Each
goes straight to its name under the ledger (docs/state-ledger.md).

## `HOLLOW_ROAD_RENAMED`

And in this chapter's own saves: fates the ledger folded away, back to
 the chapter-local flags that still tell them apart here. (A chief let go
 in a save from before reads as `spared` only: marched in, in the square.)

## `delves › inner` (the den)

The den: laid out fresh every run (delve-spec), held by the Ashfang's
gnolls, with the chapter's own pieces built in where they belong — the
pit and its champion, the kennels, the pens, the plunder tent, Vex at
his fire on the way to the hall, and the hall itself as the goal, where
the story takes over (boss-approach). Every way in through the gate
comes to its door (`inner`); out is back to the marsh road.


Thornwick's square answers to what Mira told the party and its own
errands; the rest of the chapter sees only what it hands on: the spy
dealt with (and how), the bounty taken, the mill saved.

## `towns › square` ({thornwick})

{thornwick}: a village laid out fresh every run, its shops and the
temple the generator's own. The story's places in it: {mira}'s inn, the
reeve's notice board, the mill, the peddler's stall, and the gate, which
stays shut until the peddler is caught.

## `towns › square` (the peddler's stall)

Always there under a plain label: the map doesn't know he's the
leak until {mira} says so. A party that read the lead can stalk
him, until he has whistled at them.

## `delves › trail`

The marsh road: small, walked carefully, laid out fresh every run. The
tracks and the ravine before the story's own lock (the dry line read and
the ravine crossed), the scout and the barrow off to the side, the webs
and the hollow past it. The hollow is the goal, where the story takes
over: its ambush, then on to the den's gate. Its rooms answer only to
their own flags; the chapter sees its outside (proveApart).

## `dawns › { day: 4, text: [`

Every dawn here is read wherever the party woke: a camp on the marsh
road, the den, or Mira's cot after a wipe (where `at` still names the
place it fell). So none of them names a place to stand in.
The warning before the dark moon, while the pen is still an open
question: what {vex} told them (PENS_LEAD), or only what {mira} did.

## `carries`

What the rest of the campaign remembers (read as 'hollow-road:won', …),
and no more than the ledger (docs/state-ledger.md): that the company won
this chapter at all (`won`), and whether it cut the captives out of the
pens (a war asset at the Wyrmcalling's council). What became of Wren,
Vex, Vargan and the Reedwife is NPC state, which every later chapter sees
without a carry. How each came to it (walked past, cowed, let go) stays
here.

## Short notes, by scene

The one- and two-line comments that sat inside the scenes before they moved to `hollow-road/*.story`.

- **`road-ambush`**
  - Losing the very first fight must not skip the arrival in Thornwick (the module's defeat scene wakes you at Mira's hearth before you've met her).
- **`thornwick`**
  - === ACT 1 — THORNWICK (village hub) ===================================
- **`tavern-meet`**
  - The reeve's two scouts, out on the marsh road: found in time, or not. Given on every road, so proved from every state (no `takenBy`).
- **`tavern`**
  - Nothing left to read once the peddler is in the cells.
  - A paid long rest: cheap, but a real gold sink and the place to re-prepare spells. Gated on having the coin; the effect deducts it before resting.
- **`board`**
  - `once` so the reeve's retainer can't be re-claimed by revisiting the board.
- **`spy-confront`**
  - A party sent by Mira (`know-spy`) has just looked his stall over in `spy-stalk`.
  - Worded for a first stalk and for the evening after he saw you creeping up on him (`spy-slipped`, which says so itself).
  - The whistle has gone up and his crew is closing: no strolling off now. `spy-seen`: he knows their faces, so Mira's quiet-approach tip is stale.
- **`spy-stalk`**
  - Mira's lead pays off: the party knows who he is, and he doesn't know them.
- **`gate-blocked`**
  - Before the peddler whistled: the warden doesn't know his face.
  - {mira}'s read is still to be had only while the peddler hasn't shown his hand (the tavern's Insight is gone once he has, or once tried).
  - After the whistle and the brawl at his stall, the whole square knows.
- **`mill`**
  - --- Optional: the mill bounty (Act 1 side fight) ------------------------
- **`spy-ambush`**
  - You picked them out first and stood between them and the gate, so nobody gets out to warn the den.
- **`spy-balked`**
  - Shouted down: the hired help decides this is not worth dying for.
- **`spy-slipped`**
  - A failed stalk: he sees you coming and slips away, and the party loses a day waiting for him to come back to his stall.
- **`spy-pinched`**
  - A failed read of the crowd: while you look for his crew, one of them robs you.
- **`trailhead`**
  - === ACT 2 — THE MARSH ROAD (wilderness) ==============================
- **`road-out`**
  - No milestone on the win: the fight's own XP is the reward. Staring the pack down is the clever way past, and pays what the fight would have.
- **`tracks`**
  - The tracks: a Survival roll, easier for a ranger. One try either way.
- **`tracks-lost`**
  - `trail-wet`: the hollow's ambush is sprung on the party, no Perception roll.
- **`hollow-quiet`**
  - Wren parts at the tree line whichever way the party comes up to it.
  - Out of the den, or turned back at its wall: the marsh road home.
- **`ravine`**
  - Reached only if every line of attack fails (or is spent).
- **`wounded`**
  - No stepping back to the map: walking away from her is a choice (`leave`, `scout-walked-past`), never a quiet click that records nothing.
- **`scout-left`**
  - Walking past (not `met`): the party never learned her name.
- **`scout-passed`**
  - The marker after walking past, before the fifth morning: she's gone, and no telling how.
- **`wren-parts`**
  - She came as far as she said she would.
- **`scout-fail`**
  - A slip fails forward: she lives, but the bleeding costs the day, and the leg won't carry her through the marsh, so she can't guide.
- **`scout-gone`**
  - "Already done" beats: a finished location shows this instead of replaying its full scene (the explore node's sceneWhen routes here once its flag set).
- **`scout-sent`**
  - Sent home from here, or gone from the tree line above the hollow.
- **`barrow`**
  - --- Optional: the sunken barrow (Act 2 side fight, undead teaser) -------
- **`thicket`**
  - --- Optional: the webbed thicket (Act 2 side fight — hard, telegraphed) --
- **`ambush-wet`**
  - The wet way in (a failed read at the tracks): no chance to spot them.
- **`ambush-wren`**
  - Wren's one trick on the marsh road: she reads the reeds before anyone rolls.
- **`hollow-won`**
  - The reveal beat: the lizardfolk didn't choose the raiders — something in the marsh owns them, and now you know its name.
- **`gate`**
  - === ACT 3 — THE ASHFANG DEN (dungeon) ================================
  - `den-entered` is set by every way in (a failed roll clears it again on the way to the gate fight), so a return trip only offers the way back in.
  - A rogue's bonus: the water-gate's cheap lock, an easy roll and no alarm. One try: a snapped pick leaves the other ways in.
- **`den-slipped`**
  - In by the signal or over the wall: past the gate's enforcers without a blow, which earns what beating them would have.
- **`gate-signal-blown`**
  - The stolen signal, called wrong: the watch knows it has been sold. The party lies up in the reeds until the den settles, and the signal is gone.
- **`gate-caught`**
  - Caught on the wall: the gate-runners are waiting at the bottom of it.
- **`den-pens-door`**
  - The clock (see DAWNS): the Reedwife takes her due when the moon goes dark. Until then the pen holds people; after, it holds a shoe.
- **`den-pens`**
  - Freeing them is never free: a quiet lock that may fail, or a loud one that brings the watch. Leaving them is final (the event plays once).
- **`pens-alarm`**
  - The price of the captives: a hard fight with nothing in its pockets.
  - The pens are played once: there is no coming back to them, so the fight is seen through, and losing it loses the captives.
- **`den-pens-freed`**
  - As with a pen left (`den-pens`): only a Wren who has met the company.
- **`vex-parley`**
  - One-way: whatever the party says (or doesn't), Vex has met them.
- **`vargan-unread`**
  - The read missed: his hand stays wrapped, and the talk is the harder one.
- **`boss-approach`**
  - The first meeting plays once; a party back from falling back or a wipe gets `again`, a short return.
  - The jailer, planted where every winning route walks: a line that reads as a hag's grumble now and as the whole story in Part 2.
  - A warlock knows a pact-mark when one sees it: the brand, named on an easier roll.
  - Back after a wipe with the brand named and the talk not yet tried.
- **`boss-shaken`**
  - The same hall with Vargan's brand named: he loses the first round.
- **`boss-unguarded`**
  - The same hall with Vex's word kept: his guard finds somewhere else to be.
- **`boss-unguarded-shaken`**
  - Vex's guard gone *and* the brand named.
- **`vargan-turns-alone`**
  - The binding as a rite (BIND_HAG_RITE), split on Vex's bargain like the fight.
- **`reedwife-fight`**
  - The hag fights on without him, with the chief's guard and four raiders.
  - No falling back: the hall behind you is the one where Vargan turned.
- **`reedwife-fight-alone`**
  - The same, with Hask gone: two raiders come in from the yard at her whistle, and her own branded marsh snake with them.
- **`reedwife-lost`**
  - Healed, but not a night (sameDay): Vargan's "Get up" is now, and no dawn (the dark moon's included) can come while the hag waits by the fire.
- **`vargan-fate`**
  - Turned on the hag: she is dead or bound, and the chief is alive. What becomes of him is the company's call, and the reeve pays only for a chief he gets to see.
  - Mercy has a price: the reeve pays for a chief he gets to see, not one the company let walk.
  - Dead is read only by text and the endings, so it is free.
- **`aftermath`**
  - What became of Vargan, if the company turned him on the hag.
  - Let go: he came to pay for a chief, and there is no chief (see below).
  - Drew the retainer at the board, then let him go (FREE_VARGAN): no sum named, since the loss takes only what the company still has.
  - Back in Thornwick with the chief dead: there is no den to go back to, and walking into it would leave the ending behind for good.
- **`aftermath-hub`**
  - Where each claim comes back to: the same choices, without the homecoming.
- **`defeat`**
  - A total party wipe lands here (revived at half HP), not a hard game over — dragged back to Thornwick to lick wounds and try again.
  - How the company got home, by where it fell (Part 2 has its own).
  - (Dead, he was beaten first: no fight is left to lose after that.)
- **`epilogue`**
  - The town and the marsh, true on every road to here.
  - Bound to the old price in the hall (BIND_HAG).
  - Freed, by the company's hand or on {wren}'s word.
  - Taken by the dark moon, never found, or left too long.
