/**
 * Core engine types. GameState is a plain serializable object — no classes —
 * so step() can copy cheaply via structural sharing and replays can be saved
 * as JSON.
 */
import type { RngState } from './rng.js';
/**
 * Type-only, so it is erased at compile time and creates no runtime cycle even
 * though `data/classes.ts` imports back from here. A skill is arguably an
 * engine-level concept now that the engine rolls contests with them, but moving
 * the type would touch every importer for no behavioural gain.
 */
import type { SkillId } from '../data/classes.js';

export type Id = string;
export type TeamId = 'team1' | 'team2';

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export type AbilityScores = Record<Ability, number>;

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonus(level: number): number {
  return 2 + Math.floor((level - 1) / 4);
}

export type DamageType =
  | 'slashing' | 'piercing' | 'bludgeoning'
  | 'fire' | 'cold' | 'lightning' | 'thunder' | 'acid' | 'poison'
  | 'radiant' | 'necrotic' | 'force' | 'psychic';

export interface Position {
  x: number; // file, 0-based (a=0)
  y: number; // rank, 0-based
}

/**
 * `cover` is a barricade: a low wall, a cart, a fallen pillar. It stops
 * movement the way a wall does but does NOT stop sight, and anything shooting
 * across it is shooting at a target with half cover (+2 AC).
 *
 * That combination is the whole point. Full walls shape a battlefield by
 * removing squares, which mostly means everyone walks around them; a barricade
 * shapes it by making the *angle* of a shot matter, which is a decision rather
 * than a detour. It is also where a rogue can hide — see canHide.
 */
export type TerrainId = 'open' | 'difficult' | 'wall' | 'hazard' | 'cover';

export interface Cell {
  terrain: TerrainId;
  occupantId?: Id;
  /**
   * A gnome's Minor Illusion: a shimmering, walkable false wall. Deliberately
   * not a `TerrainId` — an illusion sits *on top of* whatever the cell really
   * is (open ground, difficult terrain) rather than replacing it, so nothing
   * needs to remember what to revert to when it pops. It blocks line of sight
   * like a wall but not movement; any creature that walks through it (either
   * side — an illusion doesn't pick favourites) reveals it, and it expires on
   * its own after a few rounds regardless.
   */
  illusion?: { sourceId: Id; expiresAtRound: number };
  /**
   * Ice Storm's hail: the ground is difficult to cross until this round.
   *
   * An overlay for the same reason the illusion above is one — it sits ON TOP
   * of whatever the cell really is rather than replacing it, so nothing has to
   * remember what to revert to. The first version of Ice Storm did overwrite
   * `terrain`, which made the ice permanent AND destroyed whatever was there:
   * cast it three times and a third of the map was difficult ground forever.
   */
  chilled?: { expiresAtRound: number };
  /**
   * Wall of Fire: this cell burns until the caster stops concentrating.
   *
   * An overlay for the same reason the web and the hail are — it sits on top of
   * whatever the ground already is, so nothing has to remember what to put back.
   * `sourceId`'s side is not spared: a wall you can walk your own party through
   * is a wall that costs nothing to place badly, and placing it badly is the
   * decision the spell is made of.
   */
  /**
   * A standing hazard a spell put here: Wall of Fire's flames, Insect Plague's
   * locusts. `damageType` and `save` default to the wall's fire/Dex 15 when
   * absent, so every cell laid down before this field existed still burns.
   */
  fire?: { sourceId: Id; dice: string; damageType?: DamageType; save?: { ability: Ability; dc: number }; label?: string };
  /**
   * Silence: no spell with a spoken word can be cast from this cell.
   *
   * An overlay for the same reason the fire and the web are: it sits on top of
   * whatever the ground is, and a creature can walk out of it. Unlike those two
   * it hushes BOTH sides — a party that could cast freely inside its own
   * Silence would be casting from behind a wall the enemy cannot shout over.
   */
  silent?: { sourceId: Id };
  /**
   * A lingering Web: strands of webbing filling the cell while the caster
   * concentrates. Unlike the old fire-and-forget Web (which only caught who
   * stood in the blast at cast time), this persists — a creature that *enters*
   * the cell must save or be restrained, and it stays visible on the board so
   * you can read and route around it. Cleared when the caster drops
   * concentration (see breakConcentration). `sourceId`'s team is friendly to it.
   */
  web?: {
    sourceId: Id;
    dc: number;
    /**
     * The save a creature entering the cell rolls. Web is Dexterity; Entangle's
     * vines are Strength — same clinging ground, different way out of it, and
     * the difference is exactly why a druid would take one over the other.
     * Absent means Dexterity, so every existing Web is unchanged.
     */
    ability?: Ability;
    /** Which spell laid it, for the log and the board art. */
    kind?: 'web' | 'entangle';
  };
}

export interface GridState {
  width: number;
  height: number;
  /** Row-major, index = y * width + x. */
  cells: Cell[];
  /**
   * The map's theme, carried on the grid rather than left with the MapData.
   *
   * It is not decoration down here: a hazard tile means something different in
   * a forest than in a volcano — brambles that catch you against lava that
   * takes half your hit points — and the rules layer is where that is decided.
   * Everything that reads a hazard (the damage on entry, the AI's pathing
   * weight, the risk badge on the board) needs it, and all of them have a grid
   * and none of them have the MapData.
   *
   * Optional so a hand-built grid in a test still works; `hazardFor` falls back
   * to the molten default.
   */
  theme?: string;
}

export type ConditionId =
  | 'prone' | 'incapacitated' | 'blinded' | 'poisoned' | 'frightened'
  | 'unconscious'
  | 'paralyzed'    // Hold Person: no move/act, attacks vs have adv, melee hits crit
  | 'guided'       // Guiding Bolt: next attack roll against this target has advantage
  | 'vexed'        // attacker has advantage on next attack vs this source's target
  | 'sapped'       // disadvantage on next attack roll
  | 'slowed'       // Slow mastery: speed cut by 10 ft until this creature's next turn
  | 'restrained'   // Web: speed 0, disadvantage to attack, advantage to be hit
  | 'commanded'    // Command: prone and loses its next action
  | 'charmed'      // can't attack or harm whoever charmed it
  | 'lured'        // charmed *and* incapacitated, and drawn toward the charmer
  | 'fleeing'      // Turn Undead / Suggestion: runs for the nearest board edge and leaves
  | 'shielded'     // Shield reaction: +5 AC (and Magic Missile immunity) until next turn
  | 'dodging'      // attacks against this creature have disadvantage
  | 'blessed'      // +1d4 to attack rolls and saving throws
  | 'baned'        // Bane: -1d4 to attack rolls and saving throws
  | 'wounded'      // Sword of Wounding: cannot regain hit points (save ends)
  | 'warded'       // Shield of Faith: +2 AC
  | 'smiting'      // a smite is armed; the next melee hit discharges it
  | 'burning'      // Searing Smite: 1d6 fire at end of turn until a Con save
  | 'hasted'       // Haste: double speed, +2 AC, one extra attack
  | 'inspired'     // Human Heroic Inspiration: advantage on the next attack roll
  | 'aiming'       // Rogue Steady Aim: advantage on the next attack roll, having stood still
  | 'confused'     // Confusion: each turn it may do nothing, or lash out at whoever is nearest
  | 'hidden'       // unseen: cannot be directly targeted; next attack has advantage
  | 'noReactions'  // Shocking Grasp rider
  | 'outlined'     // outlined: attacks against this creature have advantage, and it can't hide
  | 'marked'       // Hunter's Mark: +1d6 force per hit, from the marking ranger only
  | 'hexed'        // Hex: +1d6 necrotic per hit, from the hexing warlock only
  | 'sacredWeapon' // Devotion's Channel Divinity: +Cha to the paladin's own attack rolls
  | 'sanctuary'    // Sanctuary: an attacker must make a Wis save or waste the attack
  | 'protected'    // Protection from Evil and Good: disadvantage for the six listed types
  | 'bonded'       // Warding Bond: +1 AC and saves, resistance to all damage, the caster shares it
  | 'energyWarded' // Protection from Energy: resistance to one damage type
  | 'cursed'       // Bestow Curse: disadvantage on attack rolls and saving throws
  | 'inspiring'    // Bardic Inspiration: +1d6 on the next attack roll or save, then spent
  | 'shillelagh'   // a club/quarterstaff swings on the caster's spell ability, at a bigger die
  | 'raging'       // Rage: bonus melee damage, physical resistance, Str advantage
  | 'reckless'     // Reckless Attack: advantage on your melee attacks and on everyone else's against you
  | 'stunned'      // Stunning Strike: incapacitated, speed 0, and attacks against it have advantage
  | 'veiled'       // Greater Invisibility: hidden, and attacking does not reveal you
  | 'deathWarded'  // Death Ward: the next drop to 0 leaves you standing at 1 instead
  | 'unbound'      // Freedom of Movement: nothing magical holds you
  | 'innateSorcery' // Innate Sorcery: +1 spell save DC and advantage on spell attacks
  | 'silenced';    // standing in a Silence: no spell with a spoken word

export interface ActiveCondition {
  id: ConditionId;
  sourceId?: Id;
  /** Sustained by the source's concentration; removed when it breaks. */
  concentration?: boolean;
  /** Round number after which the condition expires; undefined = until removed. */
  expiresAtRound?: number;
  /** For save-ends conditions (Sleep): repeat this save at end of turn. */
  repeatSave?: { ability: Ability; dc: number };
  /** The Dexterity (Stealth) result that observers must beat to reveal Hide. */
  hideCheck?: number;
  /**
   * A DC carried by the condition itself, for effects that make *other*
   * creatures roll against it (Sanctuary: an attacker saves or loses the
   * attack). Distinct from `repeatSave`, which is the bearer's own way out.
   *
   * Stored here rather than recomputed from the source because the rules layer
   * cannot reach the spell layer -- spells import the attack rules, so the
   * dependency only runs one way.
   */
  dc?: number;
  /** The damage type this condition is about (Protection from Energy). */
  damageType?: DamageType;
}

export interface ResourcePool {
  current: number;
  max: number;
}

export interface ItemStack {
  itemId: Id;
  qty: number;
}

export interface Equipped {
  mainHand?: Id;          // weapon id
  offHand?: Id;           // weapon id or 'shield'
  armor?: Id;             // armor id; undefined = unarmored
  trinket?: Id;           // wondrous item (one accessory slot); undefined = none
  ring?: Id;              // a ring — its own slot, so a ring and a cloak can be worn together
  /**
   * A carried weapon the player wants surfaced first. DISPLAY ONLY.
   *
   * Nothing in the engine may read this. It is not a hand and it is not a
   * container: the weapon stays in `inventory`, so `equippedWeapons` and
   * `stowedWeapons` — the two lists legality is built from — are exactly what
   * they were, and the AI sees exactly what it saw. Its whole job is to let the
   * UI put one weapon above the fold instead of listing every javelin in the
   * pack against every enemy.
   *
   * `test/ranged-slot.test.ts` asserts `attackableWeapons` is byte-identical
   * with this set. If you are here because you want the engine to honour it,
   * that is a rules change and it needs the balance harness, not a one-liner.
   */
  ranged?: Id;
}

/** Which weapons a class can wield proficiently. `finesseLight` grants the
 *  martial weapons with the Finesse or Light property (the 2024 rogue); a class
 *  can also name `specific` weapon ids it's trained in beyond its categories. */
export interface WeaponProfs {
  simple: boolean;
  martial: boolean;
  finesseLight?: boolean;
  specific?: Id[];
}

export interface Combatant {
  id: Id;
  name: string;
  /** Optional UI art identity. Defaults to classId when absent. */
  portraitId?: Id;
  team: TeamId;
  classId: Id;
  speciesId: Id;
  level: number;
  abilities: AbilityScores;
  maxHp: number;
  hp: number;
  /** Temporary HP is depleted before HP and never stacks. */
  tempHp?: number;
  /** Monsters: flat stat-block AC. PCs derive AC from equipment (acOf). */
  acOverride?: number;
  speed: number; // feet
  position: Position;
  initiative: number;
  savingThrowProfs: Ability[];
  /**
   * Skills this creature is trained in.
   *
   * New because the engine had NO idea what a character was good at. Every skill
   * check in this game happened in campaign or adventure code, through
   * `skillBonus(classId, ...)`, so a fight could not roll one — which is why
   * Shove was a saving throw against a flat DC rather than the contest it is,
   * and why Athletics and Acrobatics were worth nothing once combat started.
   *
   * Folded on the combatant rather than looked up from the class, because the
   * real answer is class + species + background + origin feat and the engine
   * must not have to know about any of those.
   */
  skillProfs?: SkillId[];
  /**
   * This creature casts spells as a CLASS feature -- the question "may I attune
   * to a wand?", which is not the same question as "which ability powers my
   * spells?".
   *
   * They used to be one field. `spellcastingAbility` answered both, so Magic
   * Initiate -- which has to set the second so a fighter's Sacred Flame is not
   * cast off Intelligence -- silently granted the first as well, and a fighter
   * with one origin feat could attune to a Wand of Fireballs. One field doing
   * two jobs; now two fields.
   */
  classCaster?: boolean;
  /** Weapon proficiencies, baked from the class at build time. Absent for
   *  monsters (natural weapons are always proficient) — a non-proficient
   *  attacker keeps its ability mod but loses the proficiency bonus. */
  weaponProfs?: WeaponProfs;
  spellcastingAbility?: Ability;
  spellSlots: ResourcePool[];       // index 0 = level-1 slots
  spellIds: Id[];                   // known/prepared spells incl. cantrips
  featureIds: Id[];                 // class/species features
  featureUses: Record<Id, ResourcePool>;
  /**
   * Charges left in wands and staves the character is carrying, keyed by item
   * id. The mirror of `featureUses`, and deliberately not the same thing as an
   * inventory quantity: a wand is not spent when it is used, it is *drained*,
   * and it comes back at dawn. Optional so a combatant built without any
   * charged item carries no empty record.
   */
  itemUses?: Record<Id, ResourcePool>;
  /**
   * Innate spells — a species' own magic, cast with no spell slot and a limited
   * number of times per encounter (a wood elf's Faerie Fire). Keyed by spell id;
   * the pool is the mirror of featureUses. This is what lets a *fighter* cast a
   * levelled spell at all: it has no slots, so slot-gated casting could only
   * ever have been a caster's perk.
   */
  innateSpells: Record<Id, ResourcePool>;
  /** Carried but not in hand (spare weapons, consumables). */
  inventory: ItemStack[];
  equipped: Equipped;
  weaponMasteries: Id[];            // weapon ids whose mastery property applies
  /** Attacks per Attack action (Multiattack / Extra Attack). Default 1. */
  attacksPerAction: number;
  resistances: DamageType[];
  /**
   * Resisted only when the damage isn't magical — the SRD's "bludgeoning,
   * piercing, and slashing from nonmagical attacks", which is what nearly
   * every physical resistance in the book actually says. Kept apart from
   * `resistances` because the qualifier is the whole point: it is what makes
   * a magic weapon worth carrying, and folding the two together silently
   * turns a wight into a wall that a +1 sword cannot get through.
   */
  resistNonmagical?: DamageType[];
  /**
   * A creature that changes shape — a lycanthrope, and anything else that
   * grows one later.
   *
   * Silvered weapons deal extra damage to these, which is the whole of what
   * silver does. Deliberately a bonus and not a gate: the 2014 lycanthropes
   * could not be hurt at all without silver, and a monster the party simply
   * cannot damage is a wall rather than a fight — especially at CR 2, where a
   * wererat is the first one you meet.
   */
  shapechanger?: boolean;
  vulnerabilities: DamageType[];
  immunities: DamageType[];
  conditions: ActiveCondition[];
  concentratingOn?: { spellId: Id; targetIds: Id[] };
  /**
   * A conjured ally: a real combatant on the board with its own turn, brought
   * in mid-fight (Staff of the Python).
   *
   * It fights, it can be killed, and it is NOT counted when deciding who has
   * won. That exclusion is the whole reason the field exists: a party face-down
   * on the floor has lost even if its snake is still up, and a wave is cleared
   * when the last monster falls even if a summoned thing of theirs lingers.
   * `checkWinner` reads it, and so does everything that reads a survivor list
   * back into a campaign roster — a snake must never end up in the party.
   */
  summonedBy?: Id;
  /**
   * The spell slot a conjured ally was called with. The Otherworldly Steed
   * scales off it — AC, hit points and the size of its Healing Touch — and the
   * SRD writes every one of those as "the spell's level", so the level has to
   * ride on the creature rather than be recomputed from its stats.
   */
  summonSlotLevel?: number;
  /**
   * The spell that conjured this creature, when a spell did.
   *
   * Concentration is why. Summon Dragon and Animate Objects both END when the
   * caster's concentration drops, and Find Steed does not — so "sweep this
   * caster's summons" is the wrong question and "sweep the ones this SPELL
   * made" is the right one. Without it, breaking concentration on a Fireball
   * would dismiss a paladin's steed.
   */
  summonSpell?: Id;
  /** A summoned familiar follows its caster without occupying a grid cell. */
  familiar?: {
    kind: 'owl';
    /** The round in which it last granted the caster attack advantage. */
    helpedRound?: number;
  };
  /** Mage Armor lasts until the campaign's next long rest while unarmored. */
  mageArmor?: boolean;
  /** Has taken a turn this combat (Assassinate window). */
  hasActed: boolean;
  /** Per-turn economy, reset at turn start. */
  turn: {
    actionUsed: boolean;
    bonusActionUsed: boolean;
    reactionUsed: boolean;
    movementUsed: number;   // feet
    movementMax: number;    // feet; this turn's speed, plus any Dash
    /**
     * What one Dash is worth this turn, in feet.
     *
     * Dash used to add `combatant.speed` — the BASE speed — which undid every
     * modifier `startTurn` had applied. A RESTRAINED creature has speed 0 for
     * the turn and could Dash for 30, walking out of the web that was holding
     * it (measured: 62 move destinations). Slowed got the full 30 instead of
     * 20, Spirit Guardians and prone got full instead of half, and a hasted
     * creature was under-granted 30 against its doubled speed of 60.
     *
     * Stored rather than recomputed from `movementMax`, because two Dashes in
     * a turn would otherwise compound off each other — 30, 60, 120 — instead
     * of adding 30 three times.
     *
     * NOT simply `movementMax`'s starting value: standing up from prone costs
     * MOVEMENT, not Speed, so a hero who stood this turn still Dashes for full.
     * See `startTurn`.
     */
    dashSpeed: number;
    disengaged: boolean;    // no opportunity attacks provoked this turn
    attackedThisTurn: boolean; // gates the off-hand bonus attack
    attacksLeft: number;    // extra attacks remaining within the Attack action
    interacted: boolean;    // free object interaction (weapon swap) spent
    sneakAttackUsed: boolean;
    colossusUsed: boolean;  // Colossus Slayer: once per turn
    savageUsed: boolean;    // Savage Attacker (origin feat): once per turn
    /**
     * A level 1+ spell has been cast this turn, and whether Quickened Spell was
     * what cast it. Both halves of the 2024 Quickened clause need this:
     *
     *   "You can't modify a spell in this way if you've already cast a level 1+
     *    spell on the current turn, nor can you cast a level 1+ spell on this
     *    turn after modifying a spell in this way."
     *
     * This is the 2024 replacement for the old bonus-action-spell rule, and it
     * is the whole balance of the option — without it, Quickened is "two
     * leveled spells a turn for two points", which is not what it says.
     * Cantrips are unaffected, so Quicken-a-Fireball-then-Fire-Bolt is the
     * combination the rule intends to leave open.
     */
    leveledSpellCast: boolean;
    quickenedThisTurn: boolean;
  };
  alive: boolean;
  /**
   * At 0 HP this creature drops unconscious instead of dying — player
   * characters do, monsters don't. Set by the builder rather than inferred
   * from the class, because the engine must not know what a "character" is.
   *
   * A downed creature is `alive` with `hp === 0`. That pair is the whole state:
   * it can't act, can't be woken by damage (the Sleep wake rule already only
   * fires above 0 HP), and any healing brings it back. Nothing else is needed —
   * no death saves, no second unconscious condition.
   */
  unconsciousAtZero?: boolean;
  /** Round the combatant last spent Uncanny Dodge (once per round). */
  uncannyDodgeRound?: number;
  /**
   * Cloak of Displacement: set when the wearer takes damage, cleared at the
   * start of its next turn. While set, the cloak's disadvantage is suppressed —
   * "if you take damage, the property ceases to function until the start of
   * your next turn".
   */
  displacementBroken?: boolean;
  /**
   * Conjured battlefield effects this caster owns — a Spiritual Weapon hammer,
   * a Flaming Sphere — that live on the board with a position of their own.
   * They are NOT combatants: no HP, no AC, no initiative slot, untargetable,
   * and they never occupy a cell. Instead each one *acts by itself* at the
   * start of its caster's turn (activateSummons in turn.ts): it chases the
   * nearest enemy and strikes. The Spiritual Weapon runs on a duration clock
   * (`expiresAtRound`); the Flaming Sphere is held by concentration and is
   * swept by breakConcentration instead.
   */
  summons?: Array<{
    kind: 'spiritual-weapon' | 'flaming-sphere' | 'conjure-animals' | 'conjure-elemental';
    position: Position;
    expiresAtRound?: number;
    /**
     * The save a creature caught by this summon rolls. Only the elemental
     * spirit has one — the hammer and the sphere make attack rolls.
     */
    dc?: number;
    /**
     * Conjure Elemental holds ONE creature at a time (the SRD is explicit), so
     * the spirit has to remember which. Absent means its grip is free.
     */
    restrainedId?: Id;
    /**
     * The damage the summon deals, when it scales with the slot it was cast
     * from. Conjure Animals is 3d10 at 3rd level and +1d10 per level above,
     * and unlike Spirit Guardians (which keeps its dice on the caster) a pack
     * roams away from whoever called it, so the dice ride with the pack.
     *
     * Absent for the two older summons, whose damage is fixed by the spell.
     */
    dice?: string;
  }>;
  /** Spirit Guardians: a radiant aura around the caster that hurts enemies
   *  who start their turn near it, and halves their Speed while they are in it
   *  (held by concentration). `dice` carries the slot level it was cast at —
   *  SRD scales it by 1d8 per level above 3. */
  spiritualGuardians?: { dc: number; mod: number; dice: string };
  /**
   * Regeneration (troll): heal `amount` at the start of each of its turns,
   * unless it has taken damage of a `stoppedBy` type since its last turn. That
   * suppression is the whole point of the trait — it turns "hit it harder" into
   * "hit it with the right thing", which is a decision rather than a damage
   * race. `suppressed` is set by applyDamage and cleared once it has cost the
   * creature a turn of healing.
   *
   * 5e also says a regenerating creature only dies if it starts its turn at 0
   * HP without regenerating. There are no monster death saves here — a monster
   * at 0 is dead — so that clause has nothing to attach to, and regeneration
   * only ever matters above 0.
   */
  regeneration?: { amount: number; stoppedBy: DamageType[]; suppressed?: boolean };
  /**
   * Damage dealt at the start of this creature's turn to every enemy it is
   * currently holding — anyone `restrained` with this creature as the source.
   * The gelatinous cube's engulfed victims dissolving in acid, and the shape
   * every grappler-with-a-rider wants (a rug of smothering, a constrictor).
   *
   * The ongoing tick is what separates being *held* from being *eaten*: the
   * restrained condition alone is a positioning problem, and the party can
   * reasonably decide to ignore it. A clock attached to it cannot be ignored,
   * which is the whole reason a cube is frightening rather than annoying.
   */
  /**
   * Wild Shape: the druid is currently wearing a beast's stat block. Holds the
   * form's monster id and everything the transformation overwrote, so reverting
   * is a restore rather than a rebuild.
   *
   * 2024 rules, which are far kinder to implement than 2014: hit points, Hit
   * Point Dice and the mental abilities are *kept*, so nothing has to reconcile
   * two hit point pools when the shape drops. What the beast replaces is AC,
   * speed, the physical abilities, what you are holding, and the traits that
   * come with the body.
   */
  /**
   * Call Lightning: a storm cloud the caster is holding overhead. Each of their
   * turns it drops another bolt (startTurn), for as long as concentration
   * lasts. Stored on the caster rather than the grid because the cloud follows
   * the druid, not the ground.
   */
  stormCloud?: { dice: string; dc: number };
  /**
   * Moonbeam: a column of cold light standing on the board while the caster
   * concentrates. Anything hostile that starts its turn inside it is burned.
   *
   * Anchored to a position rather than to the caster (unlike the storm cloud,
   * which follows the druid overhead) because the beam stays where it was put
   * until someone spends an action shifting it.
   */
  moonbeam?: { position: Position; dice: string; dc: number };
  /**
   * The body this creature is currently wearing: Wild Shape, or Polymorph.
   *
   * One slot for both, because they are the same operation — snapshot what you
   * were, overwrite with a statblock, put it all back later. What differs is
   * the hit points, and that difference is the whole of Polymorph:
   *
   *   Wild Shape keeps the druid's own hit points and adds temporary ones. Drop
   *   to zero and the druid is down.
   *
   *   Polymorph gives the BEAST's hit points as a separate pool. Drop to zero
   *   and the beast's form ends, the original creature comes back with exactly
   *   the hit points it had, and only the excess damage carries over. That is
   *   why Polymorph is not a control spell here and not a damage spell — it is
   *   a large temporary pool, and this game had no version of that.
   *
   * `original.hp` present is what marks the second kind.
   */
  wildShape?: {
    formId: Id;
    original: {
      acOverride?: number;
      speed: number;
      abilities: AbilityScores;
      equipped: Equipped;
      inventory: ItemStack[];
      featureIds: Id[];
      attacksPerAction: number;
      /** Polymorph only: the hit points to hand back when the form ends. */
      hp?: number;
      maxHp?: number;
      /**
       * Polymorph only: the spells to hand back.
       *
       * A polymorphed creature cannot cast — that is most of what "you are an
       * ape now" means, and without it the player keeps every button they had
       * and simply gains 168 hit points and two fist attacks. Wild Shape does
       * not clear this, which is why it is optional rather than always present.
       */
      spellIds?: Id[];
    };
  };
  holdDamage?: { dice: string; type: DamageType };
  /**
   * AC lost to a rust monster's antennae — metal armour eaten away, one point
   * per hit. Restored between fights for free, since combatants are rebuilt
   * from the campaign roster each time.
   *
   * The SRD destroys the armour outright and permanently. That is a tax rather
   * than a decision: you meet a CR 1/2 monster, roll badly, and your reward
   * from three fights ago is gone with nothing you could have done about it.
   * A capped, fight-scoped penalty keeps the gameplay the monster is actually
   * for -- the armoured characters back off and the unarmoured ones deal with
   * it -- without confiscating anything.
   */
  corroded?: number;
  /**
   * Mirror Image: how many duplicates are still shimmering around you.
   *
   * A count on the combatant rather than a condition, for the same reason
   * `corroded` is one: conditions are on/off and this is a resource that gets
   * chewed through. Each attack that would land may strike an image instead,
   * and each one struck is gone.
   */
  mirrorImages?: number;
  /**
   * Death Burst: the thing goes off when it dies. A magmin bursts into fire, a
   * mephit into ice or steam. It is the whole point of those monsters — kill
   * one carelessly in a huddle and you have made your own problem — and
   * without it a mephit is a very small elemental with a rider.
   */
  deathBurst?: { dice: string; type: DamageType; save: { ability: Ability; dc: number }; radius: number };
  /**
   * A smite held ready: the slot is already spent, and the next melee hit
   * discharges it. Every smite works this way (Divine, Searing, Thunderous,
   * Wrathful) so the player picks *which* and *how big* up front, rather than
   * being asked mid-swing — this engine resolves an attack atomically and has
   * nowhere to put a "react to your own hit" prompt.
   */
  armedSmite?: { spellId: Id; slotLevel: number };
  /**
   * SRD creature type (humanoid, beast, undead...). Optional and mostly
   * decorative today — nothing gates on it except Animal Friendship, which
   * needs to tell a wolf from a goblin. Player characters are all `humanoid`;
   * monsters are tagged per stat block. A natural follow-on (not done here,
   * to keep this change scoped) is gating Hold Person to humanoids for the
   * same faithfulness reason.
   */
  creatureType?: CreatureType;
  /** SRD size. Absent means medium — see CreatureSize. */
  size?: CreatureSize;
  /**
   * This creature flies, so the ground is not its problem.
   *
   * Mechanically narrow ON PURPOSE (see rules/movement.ts): it ignores difficult
   * ground and hazard tiles, and crosses chest-high barricades. It does NOT pass
   * through walls — that would make it a ghost, and it would also quietly break
   * cover and line of sight, which are computed from the same terrain.
   */
  flying?: boolean;
}

/**
 * SRD size. Used for cover: half cover comes from a chest-high barricade, and
 * a Large creature is not hiding behind one. Nothing else reads it — every
 * creature still occupies exactly one cell.
 */
export type CreatureSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';

/** Too big to take cover behind a barricade. */
/**
 * Ring of Free Action: "magic can neither reduce any of your Speeds nor cause
 * you to have the Paralyzed or Restrained condition".
 *
 * MAGIC is the operative word, and the reason this is a helper rather than a
 * blanket immunity. Web, Entangle, Ensnaring Strike and Hold Person are all
 * magic and all blocked; a giant spider's bite and a roper's tendril are not,
 * and still bind you. Reading it as a flat immunity would quietly turn the ring
 * into an answer to half the bestiary's melee as well.
 */
export function wardedAgainstMagicalBinding(c: Combatant, condition: ConditionId): boolean {
  return (condition === 'restrained' || condition === 'paralyzed') &&
    // A worn Ring of Free Action, or the spell of the same name. The hook was
    // already here for the ring; Freedom of Movement is the same guarantee with
    // a duration, so it reads the same flag rather than a parallel one.
    (c.featureIds.includes('free-action') || c.conditions.some((k) => k.id === 'unbound'));
}

export function ignoresHalfCover(size: CreatureSize): boolean {
  return size === 'large' || size === 'huge' || size === 'gargantuan';
}

export type CreatureType =
  | 'humanoid' | 'beast' | 'undead' | 'giant' | 'construct' | 'fiend' | 'dragon' | 'elemental' | 'fey' | 'monstrosity'
  | 'ooze' | 'aberration' | 'celestial' | 'plant';

export interface GameState {
  rng: RngState;
  round: number;
  grid: GridState;
  combatants: Record<Id, Combatant>;
  /** Combatant ids in initiative order. */
  initiativeOrder: Id[];
  /** Index into initiativeOrder of whose turn it is. */
  turnIndex: number;
  winner: TeamId | null;
  /**
   * Metamagic bending the cast that is resolving RIGHT NOW.
   *
   * A spell's `cast` function is handed a state and a caster and rolls its own
   * saves through the shared `savingThrow`; there is no way to pass a modifier
   * down through seventy spell implementations without changing all of them.
   * So the modifier waits here, set immediately before `cast` and cleared
   * immediately after, and `savingThrow` reads it.
   *
   * Narrow on purpose: one target, one cast, and gone by the time the next
   * action starts. It is state in the sense that a stack frame is state.
   */
  /**
   * A metamagic bend riding on the state for the duration of ONE cast.
   *
   * Both bends that need to reach inside a spell's own resolution arrive this
   * way, because there is no route for a modifier through seventy `cast`
   * implementations: Heightened is read by the shared `savingThrow`, Empowered by
   * the shared `rollSpellDice`. Cleared in a `finally`, so a spell that throws
   * cannot leave the next creature saving at disadvantage.
   */
  metamagicCast?: { casterId: Id; heightenedId?: Id; empowered?: boolean };
  /**
   * Elemental Affinity has already added its Charisma modifier to a damage roll
   * of the cast currently resolving. Rides the state and is cleared in the same
   * `finally` as `metamagicCast`, for the same reason — see `rollSpellDice`.
   */
  elementalAffinityUsed?: boolean;
}

/**
 * Down, not dead: a hero at 0 HP is unconscious, still on the board, and comes
 * back the moment anything heals it.
 *
 * It is also *out of reach of the fight*. Nothing can hurt it further — damage
 * finds it already at 0 — so hostile targeting must exclude it, and not merely
 * as an optimisation: without that rule an AI scoring "can I kill this?" reads
 * a 0 HP body as a guaranteed kill and every enemy spends the rest of the
 * battle hitting it. That is not a hypothetical; it deadlocked every mirror
 * match the moment downing went in.
 */
export function isDown(c: Combatant): boolean {
  return c.alive && c.hp === 0;
}

/**
 * Can't take actions or reactions, and doesn't threaten anyone.
 *
 * `paralyzed` and `unconscious` include the incapacitated condition in the
 * rules, but this engine applies them standalone (Hold Person, ghoul claws,
 * Fear's critical failure), so every "is it out of the fight?" check has to
 * name all three. Callers kept hand-rolling that list and disagreeing — a
 * paralyzed creature was still taking opportunity attacks — so it lives here.
 *
 * Deliberately excludes `commanded`: Command spends the target's turn, but it
 * can still react.
 */
export function isIncapacitated(c: Combatant): boolean {
  return c.conditions.some(
    (k) => k.id === 'incapacitated' || k.id === 'unconscious' ||
           k.id === 'paralyzed' || k.id === 'stunned',
  );
}

export function cellAt(grid: GridState, p: Position): Cell | undefined {
  if (p.x < 0 || p.y < 0 || p.x >= grid.width || p.y >= grid.height) return undefined;
  return grid.cells[p.y * grid.width + p.x];
}

export function posEq(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}
