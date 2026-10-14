# Chapter two review, October 2026: four critics read the new Sunken Barrows

Four reviewers read chapter two after it was rewritten from a hand-built module into stories, a generated Thornwick and two generated delves (the fen and the Undercrypt). Each worked independently, in the critical persona of **Margaret Weis & Tracy Hickman**, **Naomi Novik**, **Terry Pratchett** or **Jennell Jaquays**.

**What they read:** `src/data/modules/sunken-barrows/` and `sunken-barrows.ts`, the chapter two parts of the route transcripts in `docs/transcripts/`, the chapter notes, and (Jaquays) the atlas and balance tables. This was main at `9383f50`.

---

## Where they agree

### What works

- **The burial words.** *"Lie down and be at peace. Your work is done. The bell will wake you."* is planted in `grave-morning`, turns into a summons in the chapel, frees Halden, and gets the party past the diggers. All four singled it out.
- **The reveal is fair.** The hag was the jailer, the lamb was her wage, and the company's victory broke the vigil. Halden's notes, the lead tablet and the painted hall all point the same way, and her brand being "the vigil's mark first" opens the gate.
- **Clues travel.** The churchyard's ranks help at the chapel and the cut, the flyleaf mark opens the gate, the hall's salute settles the guard, and the king's wall turns Marrow.
- **Costs are real.** Purses or regard; the old reeve or the silvered spear, at a day on the clock; Marrow singing or bound. Failure moves the story on (caught waist-deep by the lights, the breach, the cracked seal).
- **Small exact payoffs.** The matching chains, the widow's bone button, "He loses count twice", "Mind the ruts," Marrow given the churchyard to mend.

### What they want fixed

1. **The generated town ignores the emergency** (Weis & Hickman, Novik, Pratchett, Jaquays). A horse fair, a fountain "cold in summer", a lost-goat notice, a smith's stock line, and a temple to a different god each run with its own priest, while Halden's chapel stands empty. *Fix:* replace the temple with Halden's chapel, kept by a frightened acolyte; give the notice board, the landmark and the smith lines that know about the graves.
2. **The bargain and the bell are left open** (Novik, Weis & Hickman). Nobody tells the town its victory broke the vigil; a bound hag is still being fed a lamb for a watch she no longer keeps; the drowned bell, the summons itself, is never silenced; "Halden keeps the vigil" says nothing of what that vigil is. *Fix:* one line from Aldous in `sb-hall` once the rites are known; a bound-hag line where the lamb goes to the barrow door instead; cut the bell-rope in both chapel endings and end the epilogue on that bell.
3. **The delves are corridors** (Jaquays, Weis & Hickman). Both are `spine`; every route meets the cut, the guard and the king in the same order, and the cruel route paced the fen back and forth. *Fix:* the fen as `hub` (chapel and lights in any order), the Undercrypt as `ring`.
4. **A chapter one boss in the fen** (Jaquays). The fen is held by nobody, so a generated ambush drew "The Ashfang Chief, Unguarded" on the rusher route. *Fix:* draw ambushes from a named faction even on an unheld floor, or none when `maxFights: 0`.
5. **The sisters arrive cold** (Weis & Hickman). Chapter three's villains appear only in the last slide. *Fix:* seed them twice: three reed-women on the lead tablet, and a line from Halden about her kin.
6. **Wren's arc is flat** (Weis & Hickman, Jaquays). A Wren who watched you pocket the purses still gets the captain's-knot slide, and almost no route can ask her down. *Fix:* split her epilogue slide by attitude; lower the ask to attitude 1.

---

## Weis & Hickman

**Verdict.** The bones survived the rewrite: a victory that cost something. But the chapter tells its central revelation instead of making anyone face it, and the generated fen wanders.

1. The theme is told, not faced: nobody holds the company to having broken the vigil. Add an Aldous line in `sb-hall` and a slide on the hag's fate.
2. The sisters arrive unseeded. Three reed-women on the Undercrypt's lead tablet; Halden: "She had kin in the deep reeds, they say. Kin keep accounts."
3. A killed Reedwife gets no line of her own (`inn` covers only `bound`); a spared Vargan barely registers.
4. The fen wanders; "Back outside" leaves the story at the Trailhead. Fewer rooms, or route the exit through Wren.
5. Wren's ending ignores her regard; pay off Tamsin once in `sb-aftermath`.
6. Marrow's kneelers chant for his killer at DC 14. Close the approach when `marrow-dead`, or raise it.
7. The completionist reaches 4th at the first fight; the chapter carries no growth.
8. The town between is generic; the temple's "draughts the sisters brew" is an unlucky echo.

## Naomi Novik

**Verdict.** A strong idea whose rules are stated clearly and then forgotten by the ending; the generated town contradicts the story twice.

1. A bound hag is fed a lamb for a watch she no longer keeps, and "Halden keeps the vigil" names no vigil. Close the bargain in `sb-hall` and the slide.
2. The drowned bell, the summons, is never silenced. Cut its rope in both chapel endings; end the epilogue on it.
3. The freeing words quote the summoning line. End `#liturgy` at "*Your work is done*", the speaker stopping short on purpose.
4. Halden writes "*Not me. It will not let it be me*", yet his reading of the rites is the easiest (DC 8). Cut the line, or have him read only with another voice holding the book.
5. A working temple while the priest is missing; replace it with the chapel and an acolyte.
6. Why the dead dig lead is never said. One Marrow line: the Warden wants the hill's lead out, so none can be poured back.
7. Two loose clues: the nailed boots (put them on Marrow) and the woman three weeks buried (name her, and say her name at the supper).
8. Losing at the door costs no time: `seal-battle-lost` should set `door-straining`.

## Terry Pratchett

**Verdict.** Better than the first chapter, with a real moral centre and people who are the right kind of tired. The trouble is at the edges.

**Best lines:** "Somebody who has forgotten how bells work…"; "The dead don't buy boots"; "hopeful as dogs"; "He loses count twice"; "means to have been calm the whole time"; "gives him the churchyard to mend"; "'Mind the ruts,' she says, at every rut."

1. The generated town ignores the emergency (horse fair, fountain, smith). Rewrites offered: "The horse fair is shut…"; "Steel. Nobody's asked for leather since the bells."
2. The temple changes god each run and isn't Halden's.
3. Filler at the wrong scale: "Nothing in them but frogs", and Bone Gallery and Bone Room telling the same joke back to back.
4. "He is light now" and "will slow you all the way down" contradict; and he is carried down a shaft without a word.
5. The Barrow-Guard is "him" and "it" by turns; the bold **stance** promises a mechanic.
6. Over-explained: "and they left together"; "He promised to follow you down, and he has."
7. Purple: "like thread into a needle"; two "inside"s in the king's intro; "rage floods the sweet reason off his face".
8. One shepherd is enough in the chapel.
9. Mira loses her name at the payoff ("the innkeeper keeps a pot on").
10. The supper label reads like an invoice.
11. "Once more" three times in the fights' `again:` lines.
12. "Read the lead letters" — the metal or the verb? "leaded letters".

## Jennell Jaquays

**Verdict.** Good choke points, each with three to five answers drawn from elsewhere; but the generated places are corridors, and story locks have no way round.

1. Both delves are `spine`. Fen as `hub`, Undercrypt as `ring` — one word each.
2. No back way round a story lock. An opt-in `lock.backWay` (a crawl through the Bone Room's skull wall), with the consequence that the old reeve stays below.
3. An unheld fen drew chapter one's chief as an ambush. Draw from a named faction, or none.
4. The Painted Hall can come after the cut. A `where: 'first'` placement.
5. The clock rarely bites (most routes finish by day 4). Put a cost into the dawns: day 4 makes the cut harder.
6. The Undercrypt's dead never react to a loud fight. Let an obstacle's fight rouse the floor, and the guard come out to meet you.
7. The fen reuses chapter one's Trailhead text and has no lore. Give it lore (drag-marks in step, a black candle, a nailed bootprint) and its own entrance text.
8. The salute isn't a discovery; every party passes the hall. Move it to a side room.
9. Wren never comes down. Lower the ask to attitude 1.
10. The town's board and temple are filler; let a place carry a lead.
