# Spell & Condition Icon Prompts — D&D Grid Combat

Companion doc to `art/prompts.md` (characters/monsters), `art/arena-prompts.md` (combat backdrops), and `art/adventure-prompts.md` (location scenes & NPC portraits).

This document details visual proposals and prompt templates for all **48 implemented spells** and **25 implemented combat conditions** in the game, intended for AI image generation (e.g. Midjourney, Stable Diffusion, Dall-E 3).

---

## 1. Style Preamble & Technical Specifications

To ensure the icons feel cohesive with the rest of the game's modern JRPG / YA graphic novel aesthetic, all icon prompts share a locked style preamble and technical output specification.

### Style Preamble (Include in every prompt)
> Centered fantasy UI icon badge, modern JRPG digital illustration style, bold cel-shaded line art with clean dark outlines. High contrast, vibrant glowing colors against a dark desaturated dark-purple background (`#1a1528`). Bold graphic silhouette, crisp focal object, stylized readable shapes designed to read clearly at small display sizes (32x32px). No text, no numbers, no UI frame borders, no watermark, flat frontal or slight 3/4 perspective.

### Color Coding Conventions
- **Evocation / Fire:** Warm fiery reds, oranges, and bright golden yellows (`#ff5500`, `#ffaa00`).
- **Evocation / Lightning:** Electric blues and bright white-cyan arcs (`#00d4ff`, `#ffffff`).
- **Evocation / Cold:** Frosty blues, ice-cyan, and crystalline sparkles (`#73d2de`, `#a5f0f5`).
- **Abjuration / Shields / Wards:** Golden radiance, sapphire barrier energy (`#ffd700`, `#3a86ff`).
- **Healing / Life:** Warm emerald greens, rosy pinks, and holy gold (`#2ec4b6`, `#ff4d6d`, `#ffe66d`).
- **Necromancy / Poison / Acid:** Toxic lime green, shadowy violet, spectral teal (`#70e000`, `#7b2cbf`, `#48cae4`).
- **Illusion / Stealth:** Shimmering violet, misty lavender, deep midnight shadows (`#9d4edd`, `#3c096c`).
- **Divination / Mind:** Arcane magenta, cosmic violet, glowing eyes/orbs (`#e0aaff`, `#c77dff`).
- **Conditions (Debuffs):** Darker tones with prominent status symbols (chains, cracked skulls, shattered shields).
- **Conditions (Buffs):** Glowing positive symbols (wings, halos, upward crests, shining dice).

---

## 2. Implemented Spells (48 Spells)

### Cantrips (Level 0)

| Spell ID | Name | Current Emoji | Proposed Visual Concept | Full Generation Prompt |
| :--- | :--- | :---: | :--- | :--- |
| `acid-splash` | Acid Splash | 🧪 | A glass flask shattering into a splash of glowing lime-green acid droplets. | *Style preamble*. A spherical glass potion flask shattering in mid-air, bursting into a vibrant splash of glowing lime-green toxic acid droplets and sizzling foam. |
| `fire-bolt` | Fire Bolt | 🔥 | A roaring streak of orange-yellow flame launching forward like a miniature comet. | *Style preamble*. A blazing fireball projectile trailing a tail of roaring orange and yellow sparks, launching across the dark void like a miniature comet. |
| `guidance` | Guidance | 🔮 | A floating crystalline orb surrounded by a soft golden halo and shimmering stardust. | *Style preamble*. A radiant crystal orb floating gracefully, emitting a gentle warm golden glow and surrounded by tiny sparkling motes of celestial light. |
| `minor-illusion` | Minor Illusion | 🌫️ | A shimmering purple translucent wall glyph floating with magical distortion ripples. | *Style preamble*. A shimmering translucent magic wall glyph composed of violet light particles, with visible spatial distortion and misty optical ripples. |
| `poison-spray` | Poison Spray | ☠️ | A billowing cloud of sickly dark-green gas swirling outward from an open palm. | *Style preamble*. A thick billowing cloud of noxious dark-green poison mist and purple spore haze erupting outward in a swirling plume. |
| `ray-of-frost` | Ray of Frost | ❄️ | A piercing beam of pale blue ice crystals and freezing frost particles. | *Style preamble*. A sharp concentrated beam of crackling ice energy, surrounded by floating jagged frost crystals and cold blue mist. |
| `sacred-flame` | Sacred Flame | 🔆 | A pillar of radiant golden holy fire descending from above. | *Style preamble*. A bright column of divine golden flame descending downwards, with holy light rays and glowing yellow embers. |
| `shocking-grasp` | Shocking Grasp | ⚡ | An armored gauntlet surrounded by crackling blue-white electrical arcs. | *Style preamble*. A heavy metal armored gauntlet surrounded by intense crackling blue-white lightning bolts and high-voltage energy sparks. |
| `true-strike` | True Strike | 🗡️ | A gleaming silver blade superimposed over a glowing cyan target reticle. | *Style preamble*. A sharp silver sword blade pointing upward, surrounded by a glowing cyan arcane targeting reticle and precision sightlines. |

---

### Level 1 Spells

| Spell ID | Name | Current Emoji | Proposed Visual Concept | Full Generation Prompt |
| :--- | :--- | :---: | :--- | :--- |
| `animal-friendship` | Animal Friendship | 🐾 | A gentle glowing golden paw print encircled by leaves and soothing light. | *Style preamble*. A luminous golden wolf paw print emblem, surrounded by floating green leaves and a calm aura of harmony. |
| `bane` | Bane | 💀 | A sinister purple skull rune encircled by dark reddish-purple swirling curse threads. | *Style preamble*. A stylized dark purple skull glyph surrounded by crackling crimson curse runes and swirling shadowy tendrils. |
| `bless` | Bless | 🙏 | Two hands raised toward a glowing golden celestial sunburst symbol. | *Style preamble*. A holy golden sun emblem bursting with warm rays of divine light, releasing tiny shimmering stars into the air. |
| `burning-hands` | Burning Hands | 🖐️ | An outstretched hand shooting a wide fan-shaped spray of fiery orange flames. | *Style preamble*. Outstretched silhouette of a wizard's hand casting a wide 15-foot fan of roaring orange fire flames and glowing embers. |
| `color-spray` | Color Spray | 🌈 | A dazzling burst of vibrant rainbow light beams fanning outward in a cone. | *Style preamble*. A brilliant rainbow beam burst fanning out in a wide cone, with vivid neon pink, cyan, yellow, and violet light streaks. |
| `command` | Command | ❗ | A glowing golden exclamation rune above an authoritative royal sceptre symbol. | *Style preamble*. A glowing golden heraldic icon featuring an authoritative glowing exclamation mark emblem surrounded by a pulsing pulse-wave of mental command. |
| `cure-wounds` | Cure Wounds | 💚 | A glowing green heart wrapped in soothing emerald light and sparkling leaves. | *Style preamble*. An emerald green glowing heart emblem enveloped in swirling restorative light tendrils and soft sparkling healing energy. |
| `faerie-fire` | Faerie Fire | 🧚 | A flickering pink and violet starlight flame glowing with ethereal fairy dust. | *Style preamble*. An ethereal flickering pink and violet fairy flame, showering sparkling stardust and outline aura motes into the air. |
| `false-life` | False Life | 💀 | A dark teal skull silhouette surrounded by a protective temporary shield of pale blue soul essence. | *Style preamble*. A ghostly teal skull outline encased inside a shimmering pale-blue protective energy shield barrier. |
| `find-familiar` | Find Familiar | 🦉 | A glowing spectral owl perched inside an arcane ritual circle. | *Style preamble*. A glowing white-and-cyan spectral owl spirit perched inside a glowing circle of arcane summoning runes. |
| `guiding-bolt` | Guiding Bolt | 🌟 | A blinding golden light bolt striking downward, leaving a luminous star marker behind. | *Style preamble*. A bright beam of pure golden starlight plunging down, leaving behind a glowing star marker emblem. |
| `healing-word` | Healing Word | 🩹 | Floating glowing musical notes wrapped in warm green-gold healing bands. | *Style preamble*. Floating glowing golden musical notes wrapped in flowing bands of warm green healing light and soothing magic. |
| `hunters-mark` | Hunter's Mark | 🎯 | Crimson glowing crosshairs locking onto a stylized stag/beast silhouette. | *Style preamble*. A sharp crimson glowing target crosshair emblem superimposed over the silhouette of a wild beast. |
| `inflict-wounds` | Inflict Wounds | 👻 | A skeletal clawed hand reaching out enveloped in dark purple necrotic flames. | *Style preamble*. A skeletal claw reaching forward, draped in dark shadowy purple necrotic fire and decaying energy wisps. |
| `mage-armor` | Mage Armor | 🛡️ | A translucent sapphire-blue force shield floating in front of a robes motif. | *Style preamble*. A magical translucent sapphire-blue barrier shield made of shimmering geometric hex-patterns of force. |
| `magic-missile` | Magic Missile | ✨ | Three glowing magenta arcane force darts streaking upward together. | *Style preamble*. Three bright glowing magenta and cyan magical force darts streaking in curved trails across a dark background. |
| `ray-of-sickness` | Ray of Sickness | 🤢 | A sickly green beam of venomous liquid energy with dripping toxic droplets. | *Style preamble*. A jagged beam of murky yellow-green toxic ray energy, spitting droplets of venomous bile and sickly fumes. |
| `shield` | Shield | 🛡️ | An instant burst of bright blue barrier light stopping an incoming glowing arrow. | *Style preamble*. An instantaneous flash of bright blue arcane barrier energy blocking a glowing arrowhead impact. |
| `shield-of-faith` | Shield of Faith | 🛡️ | A holy silver knightly shield emblazoned with a shining golden cross/sun crest. | *Style preamble*. A shining silver heraldic knight shield emblazoned with a glowing golden holy sunburst emblem. |
| `sleep` | Sleep | 😴 | A crescent moon floating amidst soft purple dream mists and falling Zzz stars. | *Style preamble*. A glowing silver crescent moon floating over dark violet dream mist, with sleepy sparkling stardust. |
| `thunderwave` | Thunderwave | 💥 | A massive shockwave ring exploding outward with swirling blue sonic waves. | *Style preamble*. A powerful shockwave ring bursting outward, depicted with swirling blue sonic wind lines and crumbling rock debris. |
| `breath-weapon` | Breath Weapon | 🐲 | A roaring dragon head silhouette breathing a torrent of fiery orange breath. | *Style preamble*. Profile silhouette of a fierce dragon breathing a wide stream of roaring elemental fire and ember ash. |

---

### Level 2 Spells

| Spell ID | Name | Current Emoji | Proposed Visual Concept | Full Generation Prompt |
| :--- | :--- | :---: | :--- | :--- |
| `aid` | Aid | 💗 | Three glowing golden heart emblems linked together by a ring of fortitude. | *Style preamble*. Three golden heart icons linked in a triangular ring, glowing with warm pink-and-gold aura of boosted vitality. |
| `blindness` | Blindness | 🙈 | A dark blindfold tied across a glowing eye silhouette, with shadows dripping down. | *Style preamble*. A stylized eye silhouette covered by a thick black blindfold, with dark purple shadows dripping from the edges. |
| `hold-person` | Hold Person | ⛓️ | Glowing golden magical chains binding a humanoid figure silhouette tight. | *Style preamble*. Heavy glowing golden arcane chains wrapping tightly around a dark humanoid silhouette, locking it in place. |
| `invisibility` | Invisibility | 👤 | A figure silhouette dissolving into translucent dotted outlines and subtle mist. | *Style preamble*. A human figure silhouette fading into translucent glass-like invisibility, with shimmering silver outline particles. |
| `lesser-restoration` | Lesser Restoration | 💫 | A cleansing burst of white-gold light washing away dark green toxic droplets. | *Style preamble*. A bright starburst of pure white-gold cleansing light, dissolving away dark green drops of poison and sickness. |
| `misty-step` | Misty Step | 👣 | A pair of boots stepping through a swirl of silvery mist and purple teleportation sparks. | *Style preamble*. Silvery boots stepping into a swirling vortex of lavender teleportation mist and sparkling magic dust. |
| `scorching-ray` | Scorching Ray | ☄️ | Three flaming fiery comets blazing parallel paths through the air. | *Style preamble*. Three flaming fiery fireballs trailing white-hot tails of combustion as they blast forward side-by-side. |
| `spiritual-weapon` | Spiritual Weapon | 🌟 | A floating translucent golden force hammer glowing with divine light. | *Style preamble*. A translucent glowing golden warhammer made of pure holy force energy, levitating with radiant light rays. |
| `suggestion` | Suggestion | 💭 | A purple thought bubble containing a glowing golden spiral of mental compulsion. | *Style preamble*. An arcane thought bubble icon containing a swirling golden hypnotic mind spiral and hypnotic influence waves. |
| `web` | Web | 🕸️ | A thick sticky spiderweb spreading across a dark stone pattern, glistening with dew drops. | *Style preamble*. A dense sticky spiderweb stretching across a dark backdrop, with glowing silken strands catching glistening light. |

---

### Level 3 Spells

| Spell ID | Name | Current Emoji | Proposed Visual Concept | Full Generation Prompt |
| :--- | :--- | :---: | :--- | :--- |
| `dispel-magic` | Dispel Magic | 🚫 | A glowing blue anti-magic rune breaking and shattering an active red spell ring. | *Style preamble*. A bold sapphire anti-magic glyph shattering a surrounding ring of red spell runes into dissolving dust. |
| `fear` | Fear | 😱 | A ghostly terrifying visage mask exuding purple dread smoke and trembling aura. | *Style preamble*. A terrifying ghostly phantom face silhouette shrieking, surrounded by dark purple dread mist and fear shockwaves. |
| `fireball` | Fireball | 💥 | A gigantic spherical explosion of churning orange lava-fire and dark smoke. | *Style preamble*. A colossal spherical blast of roaring orange lava fire and fiery combustion, filling a 20-foot blast radius. |
| `haste` | Haste | 🐇 | A winged boot icon moving with golden speed lines and lightning afterimages. | *Style preamble*. A winged golden boot icon dashing forward, leaving behind bright golden motion lines and electric speed streaks. |
| `lightning-bolt` | Lightning Bolt | ⚡ | A massive blinding blue-white bolt of lightning striking straight in a line. | *Style preamble*. A fierce straight beam of blinding blue-white lightning, crackling with intense electric voltage and branch sparks. |
| `mass-healing-word` | Mass Healing Word | 💞 | A giant glowing holy heart surrounded by multiple smaller orbiting healing stars. | *Style preamble*. A large glowing pink-gold heart emitting a wide circular wave of restorative light stars and soothing rays. |
| `spiritual-guardians` | Spiritual Guardians | 👼 | Two glowing golden winged angel spirits circling around a holy shield symbol. | *Style preamble*. Two translucent golden winged angelic spirits flying in a protective circle, radiating divine holy aura. |

---

## 3. Implemented Conditions (25 Conditions)

Conditions represent active status effects on combatants (buffs, debuffs, or special states).

| Condition ID | Name | Type | Proposed Visual Concept | Full Generation Prompt |
| :--- | :--- | :---: | :--- | :--- |
| `prone` | Prone | Debuff | A figure knocked flat on their back with impact dust clouds around them. | *Style preamble*. Silhouette of a character knocked down onto the ground, with a red down-arrow and impact dust clouds. |
| `incapacitated` | Incapacitated | Debuff | A dazed head with spinning yellow dizzy stars overhead. | *Style preamble*. A silhouette head surrounded by spinning yellow dizzy stars and a hazy dazed icon ring. |
| `blinded` | Blinded | Debuff | A closed eye with a bold red slash through it and dark cloud overlay. | *Style preamble*. A stylized open eye emblem with a dark violet shadow covering it and a red diagonal prohibition slash. |
| `poisoned` | Poisoned | Debuff | A bubbling green skull icon dripping venom fumes. | *Style preamble*. A toxic neon-green skull icon emitting dripping venom droplets and sickly green vapor bubbles. |
| `frightened` | Frightened | Debuff | A trembling purple heart with jagged shockwaves and wide fear eyes. | *Style preamble*. A stylized purple heart symbol cracking under a jagged fear shockwave emblem. |
| `unconscious` | Unconscious | Debuff | A sleeping face silhouette with floating blue Zzz symbols and closed eyes. | *Style preamble*. A peaceful silhouette head with closed eyes and floating blue Zzz dream letters. |
| `paralyzed` | Paralyzed | Debuff | A figure wrapped in stiff yellow electricity bolts and jagged paralysis locks. | *Style preamble*. A rigid figure silhouette frozen in place by sharp yellow electric paralysis sparks and padlock icons. |
| `guided` | Guided | Buff | A golden glowing target mark over a crosshair (from Guiding Bolt). | *Style preamble*. A radiant golden star crosshair emblem floating as a target mark indicator. |
| `vexed` | Vexed | Debuff | A broken shield icon with a red vulnerability indicator arrow (Vex mastery). | *Style preamble*. A red cracked shield icon with an inward arrow indicating vulnerability to the next strike. |
| `sapped` | Sapped | Debuff | A heavy leaden anvil pressing down on a weakened sword icon (Sap mastery). | *Style preamble*. A heavy dark iron weight crushing down onto a weakened sword emblem, reducing attack power. |
| `slowed` | Slowed | Debuff | A boot frozen inside a block of ice with a down-speed chevron (Ray of Frost / Slow). | *Style preamble*. A boot icon encumbered by heavy blue ice crystals and a downward speed arrow. |
| `restrained` | Restrained | Debuff | Manacles and thick spiderwebs wrapping around wrist silhouettes. | *Style preamble*. Pair of dark metal wrist shackles intertwined with tight white spiderweb strands. |
| `commanded` | Commanded | Debuff | A glowing red exclamation sign above a kneeling silhouette (Command spell). | *Style preamble*. A sharp red exclamation mark glyph commanding obedience above a bowed figure silhouette. |
| `shielded` | Shielded | Buff | A bright cyan force bubble barrier surrounding a shield silhouette (Shield spell). | *Style preamble*. A glowing cyan hexagonal force-field shield bubble protecting a central icon. |
| `dodging` | Dodging | Buff | A character silhouette with multiple motion-blur afterimages and swooshes. | *Style preamble*. A agile silhouette surrounded by motion blur lines and twin evasive afterimage swooshes. |
| `blessed` | Blessed | Buff | A golden halo over a shimmering d4 die with glowing numerical light. | *Style preamble*. A golden heavenly halo hovering above a bright glowing d4 die emblem. |
| `baned` | Baned | Debuff | A shadowy purple cracked d4 die surrounded by dark omen wisps. | *Style preamble*. A shadowy dark-purple cracked d4 die surrounded by swirling bad luck smoke. |
| `warded` | Warded | Buff | A glowing silver protection crest with a shining inner fortress star (Shield of Faith). | *Style preamble*. A silver armor crest icon glowing with a protective white inner barrier glow. |
| `hasted` | Hasted | Buff | Golden wings flanking a running boot icon with double-forward speed chevrons. | *Style preamble*. Pair of golden feathers/wings attached to a boot icon with double forward speed chevrons. |
| `inspired` | Inspired | Buff | A gleaming golden starburst badge with a lion emblem (Heroic Inspiration). | *Style preamble*. A brilliant golden starburst medal emblazoned with a roaring heroic lion profile. |
| `hidden` | Hidden | Buff | A dark hooded cloak silhouette fading into shadowy mist and eye outline. | *Style preamble*. A dark hooded assassin cloak silhouette melting into shadowy smoke clouds. |
| `noReactions` | No Reactions | Debuff | An arm wrapped in blue shock lightning with a muted reaction symbol (Shocking Grasp). | *Style preamble*. A muted lightning bolt icon inside a slashed circle, representing disabled counteractions. |
| `outlined` | Outlined | Debuff | A silhouette glowing with a bright magenta faerie fire contour outline. | *Style preamble*. A character silhouette surrounded by a vivid glowing neon-magenta starlight outline contour. |
| `marked` | Marked | Debuff | A glowing crimson hunter's crosshair over a creature silhouette (Hunter's Mark). | *Style preamble*. A glowing crimson target lock icon tracking a target silhouette. |
| `sacredWeapon` | Sacred Weapon | Buff | A holy sword infused with brilliant sunbeams and divine gold flame. | *Style preamble*. A broadsword blade bathed in intense radiant sunbeams and holy golden light. |

---

## 4. File Structure & Asset Integration Plan (For Future Use)

When art assets are generated, they can be processed and wired into the game following the existing repository pipeline:

1. **Raw Generation:** Save generated 1024x1024 or 512x512 PNGs into `art/raw/spells/` and `art/raw/conditions/`.
2. **Batch Processing:** Run an optimization script (similar to `art/process.py`) to crop/resize/compress to WebP:
   - Spells: `web/public/art/spell-<id>.webp` (64x64 / 128x128)
   - Conditions: `web/public/art/condition-<id>.webp` (48x48 / 64x64)
3. **TypeScript Wiring:** Update `web/src/art.ts` with lookup tables `HAS_SPELL_ART` and `HAS_CONDITION_ART` for seamless UI fallbacks (falling back to existing emoji glyphs when webp asset is absent).
