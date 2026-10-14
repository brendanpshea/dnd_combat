# The Sunken Barrows: design notes

Why chapter two is built the way it is. The chapter lives in
`src/data/modules/sunken-barrows.ts` (places, clock, carries) and
`sunken-barrows/*.story` (scenes). Each heading names the scene or definition
it explains.

## The chapter

Part 2 of the trilogy (docs/trilogy-plan.md), levels 3→4. It pays off chapter
one's victory with its cost: the Reedwife was the jailer of the Warden under
the barrows, paid a lamb each midwinter to keep him asleep. Killing her, or
binding her to strangers' words, broke the vigil. Every line about her is
worded to be true of both.

The chapter is three places and a door:

- **Thornwick** (`towns.square`), the generated village, with the story's
  inn, reeve's hall, churchyard and fen road placed in it.
- **The Deep Fen** (`delves.fen`), a generated marsh held by nobody. The
  chapel and the corpse-lights are the story's lock on the Barrow Gate.
- **The Undercrypt** (`delves.undercrypt`), a generated tomb held by the
  restless dead. The dead digging in the Lead Cut are its lock; past them lie
  the kings' guard and the king.
- **The Warden's door**, below the king's shaft: written scenes, no map, and
  no way back up.

It was rewritten in this shape from a hand-built chapter of about 90 scenes,
with three Wren meetings, two inns, a hand-drawn fen map and a second
dungeon for the shaft's foot. What each of those did is now done by one scene
with conditional lines, an obstacle block, or the generator.

## Levels and the XP ceiling

Fights carry the levels, with no floors except the cold start's. Every way
past a fight pays it (obstacle answers pay `avoided` themselves). The rites
failing is the breach fight, which pays nothing (`loot: false`), so a
company that fails the rites cannot reach chapter three above its band.

Both delves set `maxFights: 0`, and both have a story lock (the fen's: the
chapel and the lights; the Undercrypt's: the cut). So neither budgets
generated fights of its own (`delveFightXpBound` is 0). Without the
Undercrypt's lock, it budgets a key and its guard, and the chapter's ceiling
goes over level 4.

## wren-meet

One scene for every Wren: the one pulled from under the horse (`saved`),
the partner of the scout who died there (`lost`), or a stranger the reeve's
men brought in. Only the first lines differ.

## chapel

An obstacle with the conversation as its approach (`as: dialogue`). Halden's
own burial words, or his bell (easier for a company that read the
churchyard's ranks), are one try between them (`attempt: liturgy`). A
failure is the fight. Saved, he follows the company down and can read the
rites himself.

## lights, purses

Snuff the lights, or find the firm ground round them (a druid or a ranger
reads it more easily). Missing it is the same fight, caught waist-deep
(`lights-lured`). Every way ends at the drowned folk's purses: keep them, or
carry them home for the valley's regard.

## lychgate-won

Wren stays at the gate unless the company has earned enough of her regard
(2) to ask her down.

## diggers, diggers-chain

The cut is the Undercrypt's lock. The old reeve or the grave-goods: carrying
him costs a day on the door's clock, and earns the town's regard.

## seal-approach, seal-doubt, seal-battle, seal-door

Turning Marrow with what the king's wall says is one try. Turned, he sits out
a lighter fight (`seal-doubt`, which pays the difference), then leads his
faithful in the rites or is bound for the reeve. Not turned, his kneelers
laughed at the company, and will not chant for it at the door.

## RESEALING (parts.ts)

Each way of saying the rites is one try. Once the door has shifted (the
fifth dawn, `door-straining`), every way a company has without help is two
harder; Halden's and Marrow's are not. If every voice fails, the door cracks
(`seal-breach`), and the crack is carried into chapter three.
