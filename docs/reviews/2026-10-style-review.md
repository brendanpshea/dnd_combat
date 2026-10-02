# Style review, October 2026: three writers read the game

Three reviewers read the game's prose independently, each in the critical
persona of a fantasy writer: **Margaret Weis & Tracy Hickman**, **Naomi
Novik** and **Terry Pratchett**. They were asked one question, *what works in
the writing, and what doesn't*, and judged style only, not lore. None of
them saw the others' reviews or the module-writing guide.

**What they read:** the route transcripts in `docs/transcripts/` (the
completionist and cruel trilogy routes in full, the others skimmed), and the
arena's player-facing strings (`src/arena/*.ts`, `web/src/Arena.tsx`), as of
main at `ea35477`.

This file keeps the comparison, then each reviewer's own picks and
recommendations, for reference when revising the style guide.

---

## Where all three agree

### What works

- **Planted objects that pay off later.**
  - The child's left shoe: on the trophy rafters in the chief's hall
    (`boss-approach`), then "The girl has one shoe, on her right foot" in the
    pens (`den-pens`), then new shoes in the Hollow Road epilogue, then riding
    the carter's wagon in Part 3.
  - Aldous's chain of office matching his grandfather's (`sb-aftermath`):
    "The links match. 'He taught me to wear this straight,' he says, and his
    voice gives out on the last word." All three named it a best passage.
  - The stone dog with a ribbon round its neck.
- **Villains with a grievance.**
  - Vargan: "My mother's house went under first. Fair price."
  - Marrow: "Forty graves, and then I walked away and left them all in the
    cold."
  - The sisters, whose lamb-a-midwinter bargain makes the player question
    killing the Reedwife.
- **Debts and ledgers as the trilogy's spine.** "Thornwick does not beg. It
  pays its debts" recurs, and the hags turn it inside out: Nettle talks like
  a bailiff, and reacts to a dead wyrmling "like a clerk striking out a
  line."
- **Wren, through behaviour, not a meter.**
  - "I counted. That's the job" builds to "It is a short list. You are on
    it."
  - The "Somebody's gran" rebuke (`lights-kept`) is the best reactive line.
- **Domestic, strange images:**
  - "hopeful as dogs";
  - "its bell-tower leaning like a man listening";
  - "Your torch makes a small, brave circle, and the dark waits politely
    outside it";
  - the corpse-lights that "sound like home, and supper, and someone calling
    your name across a field."
- **The liturgy turned into a summons.** "*The bell will wake you*" is a
  comfort on every headstone, then turns out to be a summons. Pratchett and
  Novik both singled this out as the trilogy's cleverest idea.
- **Failure text written as a reward.**
  - "You swing too fast. The living always do."
  - The wight: "Not relieved. Not by you."
  - The turnip-cart wake-up after the first defeat.
- **Mira and Bram, economical and funny.**
  - "It is the nearest thing to thanks she keeps in stock, and you both
    know it."
  - "Silver, steel, and no questions. Two of the three I stock."
- **The arena opening and the quasit.**
  - "You do not remember dying. That is normal. Almost nobody does."
  - "a ring of packed sand under a sky nobody built, with something enormous
    and unhurried watching from the seats."

### What doesn't

1. **Short sentences everywhere.** The default rhythm is a string of short
   declaratives, so the big moments can't stand out. One trilogy route has
   24 sentences that open with "Then".
2. **Encyclopedia voice.** Monsters are introduced by definition: "This is a
   **gorgon**. Its breath turns living things to stone." All three picked
   `gorgonvale` as a weakest passage. `tollcliff` ("the body of a lion, the
   wings of a bat") and "That smell means a **green wyrmling**" are the same
   habit.
3. **Explaining the image just shown.**
   - "So the Ashfang answer to a green hag…" (`hollow-won`)
   - "Whatever the Ashfang were, they were cruel to their own monsters too."
   - "That is one monster fewer for the Calling" (quest-log voice, repeated)
   - `calling-won` restating the fight that just ended.
4. **Visible templates.**
   - The interrupted-camp sentence ("…and nobody will sleep…") in every
     chapter.
   - "Comes apart like wet reeds in a fist", reused for the sisters.
   - Near-smiles rationed in the same phrasings.
   - Wren's blush, charming twice.
   - "older than…", "honest", "Whatever…", "like a man who…".
5. **Shared text that ignores the player's choices.** Warm lines fire on the
   cruel route. The default should be neutral, with warmth earned by flags.
6. **The Part 3 epilogue runs long.** About twenty slides, half of them
   status reports. Suggested caps were 6–12 lines, each ending on an object
   or gesture, never a summary or a quote of the player's own choice ("The
   valley still says what you told the sisters…").
7. **Rules jargon in characters' mouths.** The regulars' table
   (`rumor-tactics`, `rumor-magic`): "Disengage — costs you your whole
   action," and spell "slots."
8. **Mixed choice-label formats.**
   - Dash essays ("Climb it head-on — Muscle up the sheer face — fastest, if
     you don't fall.").
   - "Onward" used several times.
   - "[Wren]" and "Wren's tip:" prefixes that give the answer away.

   All three liked quoted-speech labels best ("Keep the purses. The dead
   won't spend them").
9. **The arena explains itself repeatedly.**
   - The "same two fights" rule appears in three places.
   - The healer and the quasit share the "on the house" joke.
   - The gambit `stakes` lines read like a spreadsheet ("your party starts
     baned").

## Where they differ

- **Weis & Hickman** are the most structural:
  - give the Reedwife a living scene before the hall;
  - Part 3 is a monster tour, so tie each threat back to the valley and its
    debts (the talking manticore and ogre-mage show the way);
  - fold the reward menus after the Ashfang fall into one paragraph ("for
    the bonus" is cashier's language);
  - give the arena a second character: named healers, or a rival.
- **Pratchett** looks hardest at humour and failure text, and offers the
  sharpest editing rule: cut each paragraph's last sentence and see whether
  anything was lost.
- **Novik** works at line level: the three label formats, bold used so often
  on **Ashfang** that it means nothing, and the arena slips listed below.
- **The silent party.** Weis & Hickman and Novik both asked for the company
  to have a voice: one line per class at key beats, or one want per
  chapter. Pratchett didn't raise it.

## Confirmed slips (bugs, whatever the style)

Checked against the code and transcripts when the reviews came in:

- **"The best walk any of you can remember"** (`sb-aftermath`) still shows on
  the cruel route, after the party left the old reeve's bones and took the
  grave-goods. Aldous "does not seem to mind" there too.
- **Wren "grins her whole age for once"** at the Part 3 camp gate even at
  attitude −2.
- **"You broke the Ashfang, sealed the Undercrypt, and silenced the stone"**
  is gated only on winning Parts 1 and 2, so it shows on the vigil ending,
  where Sedge silenced the stone.
- **`wc-aftermath`:** "…and it came down the mountain with you. You come
  down on your own feet." The tense shifts and the line repeats itself.
- **Arena gambits** (`src/arena/gambit.ts`):
  - "Tracks in the mud" on packed sand;
  - "You get it braced in time" has no antecedent;
  - "You call it wrong twice, and nobody trusts the third time" doesn't
    parse.

## Candidate style-guide changes

- Mix long and short sentences; save the short one for the punch.
- Never define a monster in narration. Show what it has done to the place;
  let the name come late or from a character.
- End a paragraph on the image. Don't follow it with what it meant.
- Make shared text neutral, and earn warmth (or coldness) with flags.
- Ration each character's signature tell to once a chapter, and vary
  recurring beats (camps, defeats) with a few written variants.
- Cap epilogues at 8–12 slides, told through objects or gestures, never as
  a list of outcomes or a quote of the player's choice.
- Keep rules terms out of characters' mouths; the UI says the rules.
- One choice-label grammar: a verb phrase, or quoted speech where it's
  speech. Add a gloss only when it says something the label can't.
- Say each arena rule once, in one voice.

---

## Each reviewer's picks and recommendations

### Weis & Hickman

> "The prose is better than it needs to be. Mostly it has to stop repeating
> itself."

**Best:**
- `lights-call` ("Every one of you has to decide not to").
- `chapel-won` ("*The bell will wake you, we tell the dead. Forgive me. It
  does.*").
- `sb-aftermath` (the two chains).
- Mira's banner, nailed up upside down over the bar.
- Vargan, who stops cutting reeds while the bells ring (`sb-epilogue`).
- The arena intro.

**Weakest:**
- The `gorgonvale` definition.
- The `aftermath-hub` payout loop.
- The `wc-aftermath` tense wobble.
- "No dragon flies over the high pastures again…" (a progress report).
- The Reedwife's one-simile death.
- The cruel route's "best walk".

**Recommendations:**
1. Stage the climaxes: give the Reedwife a living scene, and give each boss
   defeat a paragraph that ends on an image.
2. Root the Wyrmcalling in the valley and its debts.
3. Write the template sentences out, and audit every shared line against
   every route.
4. Collapse the reward hubs, and trim the epilogues to eight to twelve fates
   that end on an image.
5. Give the party a line per class at key beats, and give the arena a cast.
   Vary the sentence rhythm.

### Naomi Novik

> "What you have is a valley with a memory, where people keep accounts and
> objects come back."

**Best:**
- The shoe across four scenes.
- Halden's "I thought it was a promise. It was a summons" (merciful route).
- `lights-call`.
- "I've got his feet. Mind the steps" and the chain (`sb-aftermath`).
- The stone dog's ribbon.

**Weakest:**
- The `gorgonvale` and `tollcliff` bestiary recitations.
- The cruel route's "best walk".
- The `wc-aftermath` tense shift.
- "The valley still says what you told the sisters…"
- "Force the door to Plunder Tent / It gives."

**Recommendations:**
1. Cut every explaining sentence.
2. Retire the bestiary voice: introduce each monster by what it has done.
3. Audit shared paragraphs against every route, and trim the Part 3
   epilogue to six or eight slides.
4. Break the formulas and vary the rhythm.
5. Use one choice-label grammar, and give the party a voice. In the arena,
   say each rule once and fix the gambit slips.

### Terry Pratchett

> "The people in it would recognise one another in a pub, and that's rarer
> than dragons. Trust them, and trust the reader, a little more."

**Best:**
- "By morning the carters are already complaining about the state of the
  road…"
- The two chains (`sb-aftermath`).
- Vex: "For me he keeps a knife he thinks I haven't seen."
- The carter: "The pay's bad, and nobody locks me in at night."
- `tollcliff-talked`: "You tell it the truth, more or less."
- The arena intro.

**Weakest:**
- The `gorgonvale` definition.
- The cruel route's "best walk".
- `tear-loose-defiant` ("a tooltip reading itself aloud").
- `rumor-tactics` ("Disengage — costs you your whole action").
- `calling-won`'s restatement.
- The gambit "your party starts baned".

**Recommendations:**
1. Give the sentences back their joints: rejoin one clipped pair in three.
2. Cut the last sentence, then check whether anything was lost. Replace
   every "This is a [monster]" with one observed detail.
3. Make the default text neutral, and earn warmth with flags.
4. Ration the recurring beats, and cap epilogues at about ten lines.
5. Get the rulebook out of people's mouths, and say each arena rule once.
   Settle on one choice-label format.
