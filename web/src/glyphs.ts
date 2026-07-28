/**
 * A one-emoji sketch of every creature, for the art backlog.
 *
 * This used to be what the board, the portrait ring and the arena's wave
 * preview drew when a creature had no art. It is not any more: measured on a
 * 430px phone, the glyph came out 20px inside a 49px cell — it was sized off
 * the viewport rather than the cell — and a board of specks reads as broken.
 * Abstract silhouettes took that job over (`silhouette.ts`), and they fill the
 * cell by construction because an SVG has no font-size to get wrong.
 *
 * What is left is the use these were always best at: `scripts/art-backlog.ts`
 * prints one per undrawn monster, and in a table of names an artist has never
 * read, the emoji is the fastest available answer to "what even is this".
 */
const GLYPH: Record<string, string> = {
  fighter: '⚔️', wizard: '🧙', cleric: '✨', rogue: '🗡️', barbarian: '🪓', monk: '👊',
  // Ranger, paladin and druid have class art; bard only has species x class
  // portraits, so a bard built without a portraitId — skirmish and arena never
  // set one — reached the '?' fallback.
  bard: '🪕',
  'goblin-warrior': '👺', 'goblin-boss': '👹', skeleton: '💀',
  bandit: '🥷', 'bandit-captain': '🏴‍☠️', 'dire-wolf': '🐺', ghoul: '🧛', 'giant-spider': '🕷️', acolyte: '🧎',
  kobold: '🦎', scout: '🏹', orc: '🧌', 'brown-bear': '🐻', lion: '🦁', 'cult-fanatic': '🕯️', 'animated-armor': '🛡️',
  wolf: '🐺', zombie: '🧟', ogre: '🦣',
  knight: '🤺', minotaur: '🐂', ettin: '🗿',
  priest: '🙏', 'ogre-mage': '🧞',
  guard: '🛡️', bugbear: '🐻‍❄️', lizardfolk: '🦎', gnoll: '🐺', spy: '🕵️',
  'giant-badger': '🦡', 'giant-toad': '🐸', 'giant-hyena': '🐺', 'giant-boar': '🐗', 'giant-constrictor-snake': '🐍',
  gargoyle: '🗿', 'fire-elemental': '🔥', 'water-elemental': '🌊', 'earth-elemental': '🪨', 'air-elemental': '🌪️',
  sprite: '🧚', satyr: '🐐', dryad: '🌳', 'green-hag': '🧙‍♀️', unicorn: '🦄',
  cockatrice: '🐓', harpy: '🦅', manticore: '🦁', owlbear: '🦉', gorgon: '🐂',
  shadow: '👤', specter: '👻', 'will-o-wisp': '✨', wight: '💀', mummy: '🧟',
  otyugh: '🦑', aboleth: '🐙',
  'dust-mephit': '🌫️', 'ice-mephit': '❄️',
  'magma-mephit': '🌋', 'steam-mephit': '♨️',
  succubus: '💋', 'bearded-devil': '😈', 'night-hag': '🧙‍♀️',
  'chain-devil': '⛓️', hezrou: '🐸', glabrezu: '🦀', 'horned-devil': '👹',
  worg: '🐺', 'rust-monster': '🪲', griffon: '🦅', ettercap: '🕸️', basilisk: '🦎',
  'winter-wolf': '🐺', roper: '🪱', bulette: '🦈', remorhaz: '🐛', tyrannosaurus: '🦖',
  ghast: '🧟', banshee: '👻', ghost: '👻', wraith: '🌑', 'vampire-spawn': '🧛',
  'giant-scorpion': '🦂', elephant: '🐘', 'giant-crocodile': '🐊', mammoth: '🦣', 'giant-ape': '🦍',
  berserker: '🪓', veteran: '⚔️', gladiator: '🛡️', mage: '🧙', assassin: '🥷',
  scarecrow: '🎃', 'shield-guardian': '🗿', 'stone-golem': '🗿',
  magmin: '🔥', azer: '⚒️', salamander: '🦎', 'invisible-stalker': '💨',
  imp: '😈', quasit: '👿', dretch: '👾', 'hell-hound': '🐕‍🦺', 'barbed-devil': '😈', vrock: '🦅',
  'gray-ooze': '🫧', 'ochre-jelly': '🟡', 'gelatinous-cube': '🧊', 'black-pudding': '⬛',
  'flying-sword': '🗡️', 'rug-of-smothering': '🧿', 'flesh-golem': '🧟',
  troll: '👹', 'hill-giant': '🧌', 'stone-giant': '🗿', 'frost-giant': '🥶', 'fire-giant': '🌋',
  chimera: '🦁', wyvern: '🐲', hydra: '🐉',
  'young-white': '🐉', 'young-black': '🐉', 'young-green': '🐉',
  'young-blue': '🐉', 'young-red': '🐉',
  // Lycanthropes. Each is the beast rather than the human half: the hybrid is
  // what you fight, and a row of identical 🧑 tokens would tell you nothing
  // about which one is about to gore you.
  wererat: '🐀', werewolf: '🐺', wereboar: '🐗', weretiger: '🐯', werebear: '🐻',
  // The caster variants. Each one is a magic-using version of a mundane base,
  // so the glyph says "spellcaster" rather than repeating the base's silhouette
  // — a hexer drawn as another 👺 is indistinguishable from the goblins it
  // stands behind, which is the one thing the token has to tell you.
  'goblin-hexer': '🪬', 'kobold-emberling': '🎇', 'skeleton-bonechanter': '🦴',
  'apprentice-mage': '📖', 'gnoll-packcaller': '🐕', 'ettercap-snarecaller': '🪤',
  'azer-forgecaller': '🔨', druid: '🌿',
};

/** The glyph for a creature id, or a neutral one for anything unlisted. */
export function glyphFor(id: string): string {
  return GLYPH[id] ?? '❓';
}
