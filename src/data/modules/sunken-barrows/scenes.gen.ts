// Built by `npm run stories` from sunken-barrows/*.story. Edit those, not this.
/* eslint-disable */
import type { Scene } from '../../../adventure/types.js';
import { factValue } from '../canon.js';
import { avoidedFightXP } from '../../encounters.js';
import { CHAPEL_CLEARED, HALDEN, MIRA, OPENING, REEVE, REGARD, RESEALING, WORM_CLUE, WREN } from './parts.js';

export const SCENES: Record<string, Scene> = {
  "return": {
    id: "return",
    kind: "story",
    art: { imageId: "loc-town", emoji: "🔔" },
    noBack: true,
    text: [
      "{thornwick} by night, and the bells are ringing, but not to count the hour. Somebody who has forgotten how bells work is hauling on the rope in a panic.",
      "You had hoped for a quiet season after the marsh. You very nearly had one.",
      "The gate-warden meets you on the road, his lantern shaking. Behind him the bell clangs on and on. \"It's the **churchyard**,\" he manages. \"The graves are *open*, and it wasn't shovels did it.\"",
      "Down the lane, past the shuttered market, cold lamplight spills across the churchyard wall. And the shadows between the stones are moving against the light.",
      {
        if: [{ kind: "notFlag", flag: "hollow-road:won" }],
        text: "Your purse is still heavy with the reeve's bounty for the {ashfang}. {thornwick} keeps its word.",
      },
    ],
    next: [
      {
        id: "go",
        label: "Answer the bells",
        to: "lychyard",
        hideWhenBlocked: true,
        requires: [{ kind: "flag", flag: "hollow-road:won" }],
        effects: [...[OPENING].flat()],
      },
      {
        id: "go-cold",
        label: "Answer the bells",
        to: "lychyard",
        hideWhenBlocked: true,
        requires: [{ kind: "notFlag", flag: "hollow-road:won" }],
        effects: [{ kind: "xpToLevel", level: 3 }, ...[OPENING].flat(), { kind: "gold", amount: 250 }],
      },
    ],
  },
  "lychyard": {
    id: "lychyard",
    kind: "battle",
    encounterId: "shadow-ambush",
    mapId: "corridor",
    intro: [
      "The churchyard gate hangs off its hinge. Between the headstones the darkness has come loose, and four shapes of it glide toward you across the grass. You can feel the cold coming off them.",
      "Behind them, by the newest grave, stands a woman in a burial shift. The lamplight goes straight through her. Her face is the face of a woman three weeks buried.",
      "On either side of her, two of the new-buried stand up out of their open graves. They step onto the grass together, square and in step, like men called to the roll.",
    ],
    again: [
      "The shadows are still loose among the headstones, and the woman in the burial shift still stands by the newest grave.",
    ],
    onWin: {
      to: "grave-morning",
      text: [
        "The last shadow tears on your blade and is gone. The woman in the shift sinks back into her grave without a sound. The two that stepped up out of the earth lie still across their own graves.",
      ],
    },
    onLoss: { to: "lychyard-lost" },
  },
  "lychyard-lost": {
    id: "lychyard-lost",
    kind: "rest",
    variant: "long",
    next: "grave-morning",
    intro: [
      "The cold sinks into your bones, and you fall among the headstones. The last thing you hear is the bells.",
      "You wake in the {wander-inn} with the sun up. The bell-ringers carried you in. \"The shadows went with the dark,\" **{mira}** says, and tears you a heel of bread. \"The graves have waited this long. They can wait while you eat.\"",
    ],
  },
  "grave-morning": {
    id: "grave-morning",
    kind: "story",
    art: { emoji: "⛪" },
    noBack: true,
    text: [
      "Morning shows the churchyard plain, and plain is worse. A dozen graves stand open — dug *outward*, turf thrown wide from below. The dead climbed out and left on their own, and they left together.",
      "The drag-marks run through the gap in the wall and out across the water-meadows. Every one of them points the same way: **out to the deep fen**.",
      "Every old headstone carries the same words, cut deep and green with moss. *Lie down and be at peace. Your work is done. The bell will wake you.* {thornwick}'s priests have said them over every grave for {thornwick-liturgy}.",
    ],
    next: [
      {
        id: "on",
        label: "Take it to the town",
        to: "square/city",
        effects: [
          {
            kind: "journal",
            entry: {
              id: "c-deadwalk",
              kind: "clue",
              title: "They Walk One Way",
              body: "Something opened the graves from below. Every trail leads the same way, into the deep fen, where the old burial mounds stand.",
            },
          },
        ],
      },
    ],
  },
  "inn": {
    id: "inn",
    kind: "dialogue",
    npc: MIRA,
    art: { imageId: "loc-tavern", emoji: "🍺" },
    lines: [
      "The {wander-inn} is full, and the drinkers are in no hurry to leave, not with the churchyard standing open across the lane. **{mira}** sets down a bowl in front of you unasked.",
      "\"Well.\" She says it flat, and wipes the bar hard enough to take the varnish off. \"I'll say it, since the rest of them won't. You saw off the {reedwife}, and this whole town drank to it. I poured. Now the dead get up and walk, and we all sleep with the lamp lit.\"",
      {
        if: [{ kind: "npc", npc: "reedwife", fate: "bound" }],
        text: "\"And you didn't even kill her. You held her to her old price, the fen-folk say. They've a {door-price} penned ready for {door-midwinter}, the way their grans did.\" She shakes her head. \"So the price is as good as paid. Then why are the graves open?\"",
      },
      "\"Brother {halden}'s not rung the chapel bell in a week. He walked out toward the fen with his prayer book, and he hasn't come back.\"",
      {
        if: [{ kind: "npc", npc: "vargan", fate: "dead" }],
        text: "She stops with the jug still tilted. \"Some of them haven't forgotten the chief, either. On his knees in his own hall, they say.\" She sets the jug down. \"I haven't forgotten it myself.\"",
      },
      "\"Eat. Then go see the reeve. He's been pacing his hall since the bells.\"",
    ],
    again: [
      "The {wander-inn} is as full as ever. **{mira}** slides a fresh bowl your way.",
      {
        if: [{ kind: "notFlag", flag: "reeve-task" }],
        text: "\"Still here? The reeve's still pacing his hall. Go and let him pay you.\"",
      },
      {
        if: [{ kind: "flag", flag: "reeve-task" }],
        text: "\"So {aldous} hired you. Good. He pays slow, but he pays. Put the dead back where they belong.\"",
      },
    ],
    next: [
      {
        id: "room",
        label: "Take a room for the night ({inn-room}, long rest)",
        to: "inn-rest",
        requires: [{ kind: "gold", atLeast: factValue("inn-room") }],
        effects: [{ kind: "gold", amount: -factValue("inn-room") }],
      },
      { id: "leave", label: "Go back out to the street", to: "@hub" },
    ],
  },
  "inn-rest": {
    id: "inn-rest",
    kind: "rest",
    variant: "long",
    next: "inn",
    intro: [
      "A bolted door, a real bed, and the comfortable murmur of a crowded taproom below. For one night the fen can keep its dead to itself, and you sleep soundly.",
    ],
  },
  "reeve-hall": {
    id: "reeve-hall",
    kind: "dialogue",
    npc: REEVE,
    art: { emoji: "⚖️" },
    lines: [
      "The reeve's hall smells of candle-wax and ledgers. **Reeve {aldous}** stands at the window with his back to you, watching the fen fog eat his water-meadows.",
      "\"You have returned,\" he says, without turning. \"You broke the {ashfang} for us, and {thornwick} remembers that. Now the marsh has sent us a new trouble. My grandfather's grave stands empty. We buried him in his chain of office, the twin of this one. He is gone.\"",
      {
        if: [{ kind: "npc", npc: "vargan", fate: "spared" }],
        text: "Out past the glass, at the edge of the water-meadows, a man is cutting reeds. It is {vargan}. \"Those shallows were common water in my grandfather's day,\" {aldous} says. \"{vargan} sold them to the hag anyway. And there he is, alive, cutting reeds in the shallows he sold.\"",
      },
      "He turns. His collar is undone, and there is ink on his cuff. \"You stood in my churchyard when the bells rang, and my watch did not. So I am paying you, sixty gold today and the rest when it is done. Follow my dead into the fen, find what calls them, and put it down.\"",
      "\"My scout, {wren}, will meet you at the fen road. She asked for the task before I could give it.\"",
    ],
    again: [
      "**Reeve {aldous}** is still at his window, watching the fen fog. \"The commission stands,\" he says, without turning. \"Sixty gold now, and the rest when it is done.\"",
    ],
    next: [
      {
        id: "take",
        label: "Accept the reeve's commission",
        to: "@hub",
        effects: [
          { kind: "setFlag", flag: "reeve-task" },
          { kind: "gold", amount: 60 },
          {
            kind: "journal",
            entry: {
              id: "n-aldous",
              kind: "npc",
              title: "Reeve {aldous}",
              body: "{thornwick}'s reeve is proud and paying, and he takes this one personally. His grandfather's grave is among the opened. Follow the dead into the fen and end what calls them.",
            },
          },
          {
            kind: "journal",
            entry: {
              id: "lead-fen",
              kind: "lead",
              title: "Into the Deep Fen",
              body: "The dead walk one way, into the barrow-country of the deep fen. The reeve's scout, {wren}, waits at the fen road to guide you in.",
              resolvedBy: "lychgate-cleared",
            },
          },
        ],
      },
    ],
  },
  "grave-study": {
    id: "grave-study",
    kind: "check",
    skill: "medicine",
    dc: 12,
    art: { emoji: "🪦" },
    intro: [
      "The open graves are as the dead left them. In the bottom of the nearest, the clay still holds the shape of the body that lay there. A healer's eye might read how it got up.",
    ],
    success: {
      to: "@hub",
      text: [
        "They did not claw their way out. At the lip of the oldest grave, two heel-marks sit square in the clay. The next grave's pair stands one pace behind them, and the next behind that.",
        "They *stepped* out, oldest graves first, in ranks, as if someone had called the roll.",
      ],
      effects: [
        { kind: "setFlag", flag: "graves-read" },
        { kind: "setFlag", flag: "graves-ranks" },
        { kind: "xp", amount: 30 },
        {
          kind: "journal",
          entry: {
            id: "c-muster",
            kind: "clue",
            title: "The Dead Marched in Ranks",
            body: "The dead left in neat rows, oldest graves first. They were obeying orders. If you must pass among them, fall in at the back of the oldest rank.",
          },
        },
      ],
    },
    failure: {
      to: "@hub",
      text: [
        "You get mud, turf, and the underside of a churchyard, and what the graves had to say is gone under your boots. The trails still point one way, into the fen.",
      ],
      effects: [{ kind: "setFlag", flag: "graves-read" }],
    },
  },
  "fen-shut": {
    id: "fen-shut",
    kind: "story",
    art: { imageId: "loc-marsh", emoji: "🌫️" },
    noBack: true,
    text: [
      "The gate-warden will not open the fen road without the reeve's say-so. \"See Reeve {aldous} at his hall,\" he says, and folds his arms.",
    ],
    next: [
      { id: "reeve", label: "Go and see the reeve", to: "reeve-hall" },
      { id: "ok", label: "Walk back into town", to: "@hub" },
    ],
  },
  "wren-meet": {
    id: "wren-meet",
    kind: "dialogue",
    npc: WREN,
    art: { imageId: "loc-marsh", emoji: "🌫️" },
    lines: [
      {
        if: [{ kind: "npc", npc: "wren", fate: "saved" }],
        text: "The cart-road ends where the old raised road begins. **{wren}** sits on a milestone there, putting an edge on a boot-knife, upright this time and with no dead horse on top of her. \"Heard the bells. Figured you'd be along.\"",
      },
      {
        if: [{ kind: "npc", npc: "wren", notFate: ["saved"] }],
        text: "The cart-road ends where the old raised road begins. A young woman in the reeve's colours sits on a milestone there, sharpening a boot-knife. \"**{wren}**. The reeve's scout.\" She says it fast, like she practised it on the way here.",
      },
      {
        if: [{ kind: "npc", npc: "wren", fate: "lost" }],
        text: "\"My partner was {tamsin}. A dead horse came down on her on the marsh road, the week you went for the den. She died out there in the night, alone.\" She tests her bowstring and does not look up.",
      },
      {
        if: [{ kind: "npc", npc: "wren", notFate: ["saved", "lost"] }],
        text: "She favours one leg when she stands, and pretends she doesn't. \"A dead horse came down on me on the marsh road, last season. I was under it until the reeve's men brought me in. It holds.\"",
      },
      "\"I was out on the near fen at first light, and the drag-marks were still wet. They walk in step, and one set has nails in the heel. The dead don't buy boots. Somebody **living** walked out there with them. Every trail runs to the old barrow-country, past the **drowned chapel** and past the **corpse-lights**. I can walk you as far as the barrow-country. Past that, I don't know the ground.\"",
    ],
    again: ["{wren} is still sitting on the milestone where the raised road begins. She looks up. \"Ready?\""],
    next: [
      {
        id: "go",
        label: "Follow her onto the raised road",
        to: "fen",
        effects: [
          { kind: "npc", npc: "wren", met: true },
          { kind: "joinParty", companion: "wren" },
          { kind: "setFlag", flag: "wren-joined" },
          {
            kind: "journal",
            entry: {
              id: "n-wren",
              kind: "npc",
              title: "{wren}, the Reeve's Scout",
              body: "{wren} is Reeve {aldous}'s scout, and she will not be left behind. She guides you through the deep fen as far as the old barrow-country.",
            },
          },
        ],
      },
    ],
  },
  "fen-again": {
    id: "fen-again",
    kind: "story",
    art: { imageId: "loc-marsh", emoji: "🌫️" },
    noBack: true,
    text: ["The old raised road goes on into the fog, the same as before. The fen waits at the end of it."],
    next: [
      { id: "go", label: "Walk out along the raised road", to: "fen" },
      { id: "back", label: "Walk back to town", to: "@hub" },
    ],
  },
  "chapel": {
    id: "chapel",
    kind: "dialogue",
    npc: HALDEN,
    art: { imageId: "loc-temple", emoji: "🕯️" },
    lines: [
      "The chapel kneels in the water, drowned to its windows, its bell-tower leaning like a man listening. Candles burn on every ledge. A few are **black tallow**, and they smoke like wet wood. On the altar steps stands a priest, robes fen-stained, face serene. He is leading a congregation.",
      "The congregation is dead. They stand in the water in row after row, every face turned to the altar.",
      {
        if: [{ kind: "companion", companion: "wren" }],
        text: "{wren} grips your arm. \"That's **Brother {halden}**,\" she whispers. \"He kept the little chapel in {thornwick}. Mildest man in the valley.\"",
      },
      "\"**Welcome!**\" {halden} smiles at you, and the smile is terribly calm. \"You've come to see the great work. The {warden} below is gathering his flock at last. Will you kneel? Everyone kneels down here, sooner or later.\"",
    ],
    again: [
      "The drowned congregation still stands in its rows, and {halden} still waits on the altar steps. \"You came back,\" he says, and beams. \"Everyone does.\"",
    ],
    next: [
      {
        id: "liturgy",
        label: "[Religion DC 14] Speak his own burial words back to him",
        to: "chapel-liturgy",
        hideWhenBlocked: true,
        attempt: "liturgy",
        check: { skill: "religion", dc: 14, failTo: "chapel-fight" },
      },
      {
        id: "bell",
        label: "[Persuasion DC 12] Remind him the dead stepped out in ranks, to his bell",
        to: "chapel-bell",
        hideWhenBlocked: true,
        requires: [{ kind: "flag", flag: "graves-ranks" }],
        attempt: "liturgy",
        check: { skill: "persuasion", dc: 12, failTo: "chapel-fight" },
      },
      {
        id: "bell-plain",
        label: "[Persuasion DC 15] Remind him of the bell he rang in {thornwick}",
        to: "chapel-bell-plain",
        hideWhenBlocked: true,
        requires: [{ kind: "notFlag", flag: "graves-ranks" }],
        attempt: "liturgy",
        check: { skill: "persuasion", dc: 15, failTo: "chapel-fight" },
      },
      { id: "fight", label: "Refuse the sermon and draw", to: "chapel-fight" },
      { id: "leave", label: "Back away from the chapel", to: "@hub" },
    ],
  },
  "chapel-fight": {
    id: "chapel-fight",
    kind: "battle",
    encounterId: "drowned-chapel",
    mapId: "ruins",
    intro: [
      "{halden} sighs, a shepherd let down by his flock. Two skeletons in rotted mourning-clothes wade out of the rows, and behind them two of his drowned parishioners, grey and gnawing. Two acolytes in {thornwick}'s chapel colours step up beside him, their eyes as empty as the dead's.",
    ],
    again: [
      "{halden} sighs again, a shepherd let down twice. \"The {warden} provides,\" he says, and his acolytes and his dead come for you once more.",
    ],
    onWin: {
      to: "@hub",
      text: [
        "{halden} sinks down on the altar steps and does not rise again. At the end, he mostly looks relieved.",
        "His prayer book lies open on the altar, fen-damp. *The {door-price} each {door-midwinter} was never an offering,* says a note in his tidy hand. *It was her wage. The {reedwife} was the {warden}'s jailer, and we paid her to keep him asleep. She is gone from her door, and he is waking.*",
        "Further down, the hand shakes. *The rites of sealing are on the last three pages. Someone must say them at his door, in the great barrow. Not me. It will not let it be me.*",
        "On the flyleaf someone has inked a mark of reeds and a reaching hand. Beside it, steady again: *Her brand. It was the vigil's mark before she took it. The old builders cut it on the {barrow-gate}, and the watchers there still know it.*",
        "Under the altar cloth is a healing potion {halden} never got to drink.",
      ],
      effects: [{ kind: "setFlag", flag: "chapel-cleared" }, ...[CHAPEL_CLEARED].flat()],
    },
  },
  "chapel-liturgy": {
    id: "chapel-liturgy",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-temple", emoji: "🕯️" },
    text: [
      "You say the words cut on every old headstone in his churchyard, slow and plain. *Lie down and be at peace. Your work is done. The bell will wake you.*",
    ],
    next: [
      {
        id: "ok",
        label: "Go on",
        to: "chapel-saved",
        effects: [
          { kind: "setFlag", flag: "chapel-cleared" },
          { kind: "xp", amount: avoidedFightXP("drowned-chapel") },
          { kind: "npc", npc: "halden", fate: "saved" },
        ],
      },
    ],
  },
  "chapel-bell": {
    id: "chapel-bell",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-temple", emoji: "🕯️" },
    text: [
      "You tell him what you read in his churchyard. His dead stepped out in ranks, oldest first, like a parish called to a service. \"You rang your bell to lay them down, Brother. Whose bell is calling them up?\"",
    ],
    next: [
      {
        id: "ok",
        label: "Go on",
        to: "chapel-saved",
        effects: [
          { kind: "setFlag", flag: "chapel-cleared" },
          { kind: "xp", amount: avoidedFightXP("drowned-chapel") },
          { kind: "npc", npc: "halden", fate: "saved" },
        ],
      },
    ],
  },
  "chapel-bell-plain": {
    id: "chapel-bell-plain",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-temple", emoji: "🕯️" },
    text: [
      "You tell him his bell in {thornwick} has rung for nothing but alarms since he left, and not once over a grave. \"Whose bell are you ringing now, Brother?\"",
    ],
    next: [
      {
        id: "ok",
        label: "Go on",
        to: "chapel-saved",
        effects: [
          { kind: "setFlag", flag: "chapel-cleared" },
          { kind: "xp", amount: avoidedFightXP("drowned-chapel") },
          { kind: "npc", npc: "halden", fate: "saved" },
        ],
      },
    ],
  },
  "chapel-saved": {
    id: "chapel-saved",
    kind: "dialogue",
    npc: HALDEN,
    noBack: true,
    art: { imageId: "loc-temple", emoji: "📖" },
    lines: [
      "The thing inside {halden} lets go of him all at once, like a hand opening, and his dead fold down into the water. He sits hard on the altar steps, shaking and himself again. \"It came up through the *prayers*,\" he says. \"A grey little gravedigger brought me black candles. He said his name was **{marrow}**, and I *thanked* him.\"",
      "\"I rang the drowned bell every night. *The bell will wake you.* I thought it was a promise.\" He swallows. \"It was a summons.\"",
      "He pushes his prayer book into your hands. \"The **{reedwife}** was never just a hag. She was a jailer. The fen-folk paid her a {door-price} each {door-midwinter}, and she kept the **{warden} of the Barrows** asleep. When she was gone from that door, his seal broke.\"",
      {
        if: [{ kind: "npc", npc: "reedwife", fate: "bound" }],
        text: "\"They say you held her to her price.\" He shakes his head. \"A keeper held by strangers' words keeps the price, but not the watch. Nobody sits by his door.\"",
      },
      "\"The rites of sealing are at the back. Someone must say them whole at his door. I'll follow you down and wait on the stair.\" He hands you a healing potion from under the altar cloth. \"I bought it for a bad night. I think yours will be worse.\"",
      "He taps the flyleaf, where he has inked a mark of reeds and a reaching hand. \"She wore it as her brand, but it was the vigil's mark first. The old builders cut it on the {barrow-gate}, and the gate's watchers still know it.\"",
    ],
    next: [
      {
        id: "on",
        label: "Take the prayer book",
        to: "@hub",
        hideWhenBlocked: true,
        requires: [{ kind: "companion", companion: "wren" }],
        effects: [...[CHAPEL_CLEARED].flat(), { kind: "npc", npc: "wren", attitude: 1 }],
      },
      {
        id: "on-alone",
        label: "Take the prayer book",
        to: "@hub",
        requires: [{ kind: "noCompanion", companion: "wren" }],
        hideWhenBlocked: true,
        effects: [...[CHAPEL_CLEARED].flat()],
      },
    ],
  },
  "lights": {
    id: "lights",
    kind: "story",
    art: { emoji: "💡" },
    text: [
      "The flat water south of the old road is where the fen does its prettiest lying. Lights hang over the black mirror, soft and swaying, warm as windows. Corpse-candles: they walk mourners into the deep pools and hold them under.",
      "The lights drift nearer, hopeful as dogs. Between them, further out, two colder things stand in the clothes they drowned in.",
      {
        if: [{ kind: "companion", companion: "wren" }],
        text: "\"We don't have to go through,\" {wren} says quietly. \"There's firm ground round the pools, if you can find it. Miss it, and the lights find *you*.\"",
      },
    ],
    again: ["The corpse-lights still sway over the black water, warm as windows."],
    next: [
      { id: "fight", label: "Snuff them out", to: "lights-fight" },
      {
        id: "skirt",
        label: "[Survival DC 13] Find the dry way round the pools",
        to: "lights-skirt",
        hideWhenBlocked: true,
        attempt: "firm-ground",
        check: { skill: "survival", dc: 13, failTo: "lights-lured" },
      },
      {
        id: "druid",
        label: "[Druid · Nature DC 10] Read the fen like a map, and walk round",
        to: "lights-skirt",
        hideWhenBlocked: true,
        requires: [{ kind: "classInParty", classId: "druid" }],
        attempt: "firm-ground",
        check: { skill: "nature", dc: 10, failTo: "lights-lured" },
      },
      {
        id: "ranger",
        label: "[Ranger · Survival DC 10] Follow the reeds that only grow on firm ground",
        to: "lights-skirt",
        hideWhenBlocked: true,
        requires: [{ kind: "classInParty", classId: "ranger" }],
        attempt: "firm-ground",
        check: { skill: "survival", dc: 10, failTo: "lights-lured" },
      },
      { id: "leave", label: "Back away from the water", to: "purses" },
    ],
  },
  "lights-fight": {
    id: "lights-fight",
    kind: "battle",
    encounterId: "corpse-lights",
    mapId: "bog",
    intro: [
      "Four of the lights come in low and fast over the water, crackling with stolen life. The two drowned things rise between them, their mouths open on screams the water drank years ago.",
    ],
    again: ["The four lights come in low over the water again, and the drowned things rise between them."],
    onWin: {
      to: "purses",
      text: ["The last wisp winks out, and the water goes dark for good."],
      effects: [{ kind: "setFlag", flag: "lights-cleared" }],
    },
  },
  "lights-skirt": {
    id: "lights-skirt",
    kind: "story",
    noBack: true,
    art: { emoji: "💡" },
    text: [
      "You find the firm ground and keep to it, one tussock to the next. The lights follow along the water's edge, swaying, waiting for a foot to slip. None does.",
    ],
    next: [
      {
        id: "ok",
        label: "Go on",
        to: "purses",
        effects: [
          { kind: "setFlag", flag: "lights-cleared" },
          { kind: "xp", amount: avoidedFightXP("corpse-lights") },
        ],
      },
    ],
  },
  "lights-lured": {
    id: "lights-lured",
    kind: "battle",
    encounterId: "corpse-lights",
    mapId: "bog",
    surprise: "party",
    intro: [
      "You think you have found the firm ground, and three steps later it is not there. Four wisps flare white-hot in front of your faces, and two cold things rise out of the pool behind you.",
    ],
    onWin: {
      to: "purses",
      text: ["You drag each other out onto the mud, soaked and shaking. Behind you the last wisp is out."],
      effects: [{ kind: "setFlag", flag: "lights-cleared" }],
    },
  },
  "purses": {
    id: "purses",
    kind: "story",
    art: { emoji: "💰" },
    noBack: true,
    text: [
      "In the reeds at the pool's edge lie the drowned, with their purses still tied at their belts. There are {drowned-purses} purses, {drowned-gold} between them, and two hold a stoppered healing potion against the fen-fever.",
      "One body is not like the others. It wears long robes the colour of grave-worms, and a stub of **black candle** sits in its belt. No fen-folk dresses like that to go walking.",
      {
        if: [{ kind: "companion", companion: "wren" }],
        text: "{wren} looks at the purses, then at you. \"Those belonged to somebody's husband, somebody's gran. The families could use them. So could you. Your call.\"",
      },
    ],
    next: [
      {
        id: "keep",
        label: "Keep the purses. The dead won't spend them",
        to: "purses-taken",
        hideWhenBlocked: true,
        requires: [{ kind: "companion", companion: "wren" }],
        effects: [
          { kind: "gold", amount: factValue("drowned-gold") },
          { kind: "addItem", itemId: "potion-healing", qty: 2 },
          ...[WORM_CLUE].flat(),
          { kind: "npc", npc: "wren", attitude: -1 },
        ],
      },
      {
        id: "keep-alone",
        label: "Keep the purses. The dead won't spend them",
        to: "purses-taken",
        requires: [{ kind: "noCompanion", companion: "wren" }],
        hideWhenBlocked: true,
        effects: [
          { kind: "gold", amount: factValue("drowned-gold") },
          { kind: "addItem", itemId: "potion-healing", qty: 2 },
          ...[WORM_CLUE].flat(),
        ],
      },
      {
        id: "home",
        label: "Carry the purses home for the families",
        to: "purses-taken",
        hideWhenBlocked: true,
        requires: [{ kind: "companion", companion: "wren" }],
        effects: [
          { kind: "setFlag", flag: "drowned-gold-home" },
          ...[REGARD].flat(),
          ...[WORM_CLUE].flat(),
          { kind: "npc", npc: "wren", attitude: 1 },
        ],
      },
      {
        id: "home-alone",
        label: "Carry the purses home for the families",
        to: "purses-taken",
        requires: [{ kind: "noCompanion", companion: "wren" }],
        hideWhenBlocked: true,
        effects: [{ kind: "setFlag", flag: "drowned-gold-home" }, ...[REGARD].flat(), ...[WORM_CLUE].flat()],
      },
    ],
  },
  "purses-taken": {
    id: "purses-taken",
    kind: "story",
    art: { emoji: "💰" },
    noBack: true,
    text: [
      {
        if: [{ kind: "flag", flag: "drowned-gold-home" }, { kind: "companion", companion: "wren" }],
        text: "{wren} helps you tie the purses into a bundle. She counts them twice. \"{^drowned-purses},\" she says. \"That's {drowned-purses} families.\" She carries the bundle herself, and walks a little straighter for it.",
      },
      {
        if: [{ kind: "notFlag", flag: "drowned-gold-home" }, { kind: "companion", companion: "wren" }],
        text: "{wren} watches you fill your pockets with the drowned folk's coin. \"Somebody's gran,\" she says at last, and walks on ahead.",
      },
      {
        if: [{ kind: "flag", flag: "drowned-gold-home" }, { kind: "noCompanion", companion: "wren" }],
        text: "You tie the purses into a bundle, and count them twice. {^drowned-purses} families.",
      },
      {
        if: [{ kind: "notFlag", flag: "drowned-gold-home" }, { kind: "noCompanion", companion: "wren" }],
        text: "You fill your pockets with the drowned folk's coin.",
      },
      "The fen is quiet around you, and the black water lies still.",
    ],
    next: [{ id: "on", label: "Go on into the fen", to: "@hub" }],
  },
  "pool": {
    id: "pool",
    kind: "story",
    art: { emoji: "🐍" },
    text: [
      "The reeds part around a pool so still it looks solid. Old offerings crowd the rim: coins, combs, grinding-stones. Fen-folk have fed something here for generations. The surface moves once, with no wind to move it, in a line longer than a boat.",
      {
        if: [{ kind: "companion", companion: "wren" }],
        text: "{wren} picks up a coin and puts it back with great care. \"Since the dead took to the fen roads, not one of them has dared come out this far with a coin.\" She takes one careful step back. \"It will be hungry.\"",
      },
    ],
    again: ["The serpent pool lies still again, too still. The water has not forgotten you."],
    next: [
      { id: "fight", label: "Wade in and clear the pool", to: "pool-fight" },
      { id: "leave", label: "Leave the pool its privacy", to: "@hub" },
    ],
  },
  "pool-fight": {
    id: "pool-fight",
    kind: "battle",
    encounterId: "serpent-pool",
    mapId: "marsh",
    intro: [
      "The pool empties itself at you. Three snakes the girth of roof-beams pour over the rim in oiled coils.",
    ],
    again: [
      "The pool empties itself at you again. The three fen-serpents pour over the rim, as hungry as before.",
    ],
    onWin: {
      to: "@hub",
      text: [
        "The serpents lie in loops like dropped rope. Your boots turn up everything the fen-folk ever left here, from old coins to a sealed flask of potion.",
      ],
      effects: [
        { kind: "setFlag", flag: "pool-cleared" },
        { kind: "gold", amount: 85 },
        { kind: "addItem", itemId: "potion-greater-healing", qty: 1 },
      ],
    },
  },
  "lychgate": {
    id: "lychgate",
    kind: "story",
    art: { imageId: "loc-crypt", emoji: "⛩️" },
    text: [
      "All the tracks come together here, and the barrow-country begins. A gate of standing stones rises ahead, the **{barrow-gate}**, mossed to the knees. Two weathered granite watchers crouch on top of it. In the gateway below them, an empty suit of green-bronze armour leans on its spear.",
      {
        if: [{ kind: "companion", companion: "wren" }],
        text: "{wren} stops dead. \"Those weren't in anybody's stories.\" The stone bases are mossy, but the watchers' claws are clean, and so is the spear.",
      },
    ],
    again: [
      "The two stone watchers sit on the gate again with their wings folded. The bronze armour leans in the gateway below them.",
    ],
    next: [
      {
        id: "mark",
        label: "[History DC 14] Show them the vigil's mark in {halden}'s book",
        to: "lychgate-mark",
        once: true,
        hideWhenBlocked: true,
        check: { skill: "history", dc: 14, failTo: "lychgate-fight" },
      },
      { id: "fight", label: "Walk up to the gate", to: "lychgate-fight" },
    ],
  },
  "lychgate-fight": {
    id: "lychgate-fight",
    kind: "battle",
    encounterId: "barrow-watchers",
    mapId: "ruins",
    intro: [
      "The nearest watcher turns its head with a sound like a millstone. The granite cracks its wings and drops on you like a falling roof. Below it, the empty armour lifts its spear and steps out of the gateway.",
    ],
    again: ["The watchers drop from the lintel again, and the armour steps out of the gateway."],
    onWin: {
      to: "lychgate-won",
      text: [
        "The second gargoyle breaks apart in the air. It rains down as plain gravel, over the bronze plates that lie across the road.",
      ],
      effects: [{ kind: "setFlag", flag: "watchers-done" }],
    },
  },
  "lychgate-mark": {
    id: "lychgate-mark",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-crypt", emoji: "⛩️" },
    text: [
      "You hold up the book, open at the reed-woman's mark on the flyleaf. The old builders cut that same mark into the gate. You find it on the nearest stone and lay your hand flat on it.",
      "The watchers look at the book for a long, grinding moment, then fold their wings and turn back into plain grey stone. Below them, the armour grounds its spear and stands aside.",
    ],
    next: [
      {
        id: "ok",
        label: "Go on",
        to: "lychgate-won",
        effects: [
          { kind: "setFlag", flag: "watchers-done" },
          { kind: "xp", amount: avoidedFightXP("barrow-watchers") },
        ],
      },
    ],
  },
  "lychgate-won": {
    id: "lychgate-won",
    kind: "story",
    art: { imageId: "loc-crypt", emoji: "⛩️" },
    noBack: true,
    text: [
      "Past the {barrow-gate} the mounds rise in their dozens. At the field's heart the largest barrow stands **open**, not fallen in but *unlocked*. Worked steps lead down. Every file of the walking dead leads down into it like thread into a needle.",
      "Letters are cut into the lintel, worn almost smooth. *Here is the **{undercrypt}**. Let it stay shut.*",
      {
        if: [{ kind: "companion", companion: "wren" }],
        text: "{wren} looks at the steps, then at you. \"I don't know the ground past here,\" she says. \"I'll hold the gate.\"",
      },
      {
        if: [{ kind: "companion", companion: "wren" }, { kind: "npc", npc: "wren", attitude: { atLeast: 2 } }],
        text: "\"Someone has to be standing here when you walk back out.\" You pretend, kindly, not to hear the *when* she leans on. She ties a strip of the reeve's colours round your arm, quick and tight.",
      },
      {
        if: [{ kind: "companion", companion: "wren" }, { kind: "npc", npc: "wren", attitude: { below: 0 } }],
        text: "She does not wish you luck. She checks her bowstring instead, and watches the fen, not you.",
      },
    ],
    next: [
      {
        id: "down",
        label: "Leave {wren} the gate, and go down",
        to: "undercrypt",
        hideWhenBlocked: true,
        requires: [{ kind: "companion", companion: "wren" }],
        effects: [{ kind: "setFlag", flag: "lychgate-cleared" }, { kind: "leaveParty", companion: "wren" }],
      },
      {
        id: "ask",
        label: "Ask {wren} to come down with you",
        to: "undercrypt",
        hideWhenBlocked: true,
        requires: [{ kind: "companion", companion: "wren" }, { kind: "npc", npc: "wren", attitude: { atLeast: 2 } }],
        effects: [{ kind: "setFlag", flag: "lychgate-cleared" }],
      },
      {
        id: "down-alone",
        label: "Go down",
        to: "undercrypt",
        hideWhenBlocked: true,
        requires: [{ kind: "noCompanion", companion: "wren" }],
        effects: [{ kind: "setFlag", flag: "lychgate-cleared" }],
      },
    ],
  },
  "hall": {
    id: "hall",
    kind: "story",
    art: { imageId: "loc-crypt", emoji: "🎨" },
    noBack: true,
    text: [
      "The stair opens into a painted hall. The pictures tell one story, over and over. A **door** stands under the earth with a **horned warden** behind it, and before it, age after age, a **woman of the reeds** keeps watch.",
      "In one panel a line of soldiers in green bronze stands before the door, each with a fist pressed flat to his chest. It is the old kings' salute, and the painter took great care over it.",
      "The last panel is fresh mud smeared over old paint. One angry stroke crosses her out. Beneath her, many dead hands scrawled the words: **THE VIGIL HAS ENDED. THE DOOR OPENS FROM WITHIN.**",
      "A thin grey man in a gravedigger's apron stands under the last panel. He smooths the mud flat with his palm, the way you would pat down a fresh grave. A bundle of black candles hangs at his hip.",
      {
        if: [{ kind: "npc", npc: "halden", fate: "saved" }],
        text: "A grey little gravedigger, {halden} said. The one who brought the candles.",
      },
      {
        if: [{ kind: "notFlag", flag: "diggers-passed" }],
        text: "He sees your torch and is not alarmed. \"Mind the cut,\" he says kindly. \"My diggers are working down there, and they don't like to be stopped.\"",
      },
      {
        if: [{ kind: "flag", flag: "diggers-passed" }],
        text: "He sees your torch and is not alarmed. \"You got past my diggers,\" he says kindly. \"No matter. They have dug enough.\"",
      },
      {
        if: [{ kind: "notFlag", flag: "door-straining" }],
        text: "\"Soon enough, the {warden} will put his own shoulder to the door.\" He picks up his lantern and goes on down into the dark.",
      },
      {
        if: [{ kind: "flag", flag: "door-straining" }],
        text: "\"You felt the ground shake? That was the {warden}, leaning on his door.\" He picks up his lantern and goes on down into the dark.",
      },
    ],
    next: [
      {
        id: "on",
        label: "Go deeper in",
        to: "@hub",
        effects: [
          { kind: "setFlag", flag: "hall-seen" },
          {
            kind: "journal",
            entry: {
              id: "c-warden",
              kind: "clue",
              title: "The Door Opens From Within",
              body: "The painted hall shows the {warden}'s door, far below, and the reed-woman who guarded it. His servants are at the door now. Get there first and speak {halden}'s rites.",
            },
          },
        ],
      },
    ],
  },
  "ossuary": {
    id: "ossuary",
    kind: "check",
    skill: "investigation",
    dc: 12,
    art: { emoji: "💀" },
    intro: [
      "Skulls fill this room from floor to ceiling, stacked in rows like bricks. Old gold winks from the niches between them. A careful eye might take some of it back up.",
    ],
    success: {
      to: "@hub",
      text: [
        "Behind a row of skulls, the builders left a hidden nook. Inside are coins stamped with kings with no names, and a flask of drink that has gone strong with age instead of sour.",
      ],
      effects: [{ kind: "gold", amount: 90 }, { kind: "addItem", itemId: "potion-greater-healing", qty: 1 }],
    },
    failure: {
      to: "@hub",
      text: [
        "You grope through two niches, touch something that crunches, and decide to stop. You leave with a few loose coins off the floor.",
      ],
      effects: [{ kind: "gold", amount: 20 }],
    },
  },
  "diggers": {
    id: "diggers",
    kind: "story",
    art: { imageId: "loc-crypt", emoji: "⛏️" },
    text: [
      "{thornwick}'s dead fill the cut. They still wear their burial clothes. They chip at a seam of grey **lead** in the wall with picks, stones and bare fingers. No one stands over them. The picks keep time on their own.",
      "The cut is just wide enough for them. Near the far end, one digger wears a chain of office over its burial coat.",
    ],
    again: ["{thornwick}'s dead are still digging at the lead, wall to wall."],
    next: [
      {
        id: "sneak",
        label: "[Stealth DC 12] Slip past along the wall",
        to: "diggers-sneak",
        hideWhenBlocked: true,
        check: { skill: "stealth", dc: 12, failTo: "diggers-fight", roller: "group" },
      },
      {
        id: "still",
        label: "[Religion DC 13] Say the burial words over them",
        to: "diggers-still",
        hideWhenBlocked: true,
        attempt: "words",
        check: { skill: "religion", dc: 13, failTo: "diggers-fight" },
      },
      {
        id: "ranks",
        label: "[Deception DC 10] Fall in at the back of the oldest rank",
        to: "diggers-ranks",
        hideWhenBlocked: true,
        requires: [{ kind: "flag", flag: "graves-ranks" }],
        attempt: "words",
        check: { skill: "deception", dc: 10, failTo: "diggers-fight" },
      },
      {
        id: "turn",
        label: "[Cleric · Religion DC 10] Raise a holy symbol and turn them aside",
        to: "diggers-turn",
        hideWhenBlocked: true,
        requires: [{ kind: "classInParty", classId: "cleric" }],
        attempt: "words",
        check: { skill: "religion", dc: 10, failTo: "diggers-fight" },
      },
      {
        id: "oath",
        label: "[Paladin · Religion DC 10] Stand in their road and speak your oath",
        to: "diggers-turn",
        hideWhenBlocked: true,
        requires: [{ kind: "classInParty", classId: "paladin" }],
        attempt: "words",
        check: { skill: "religion", dc: 10, failTo: "diggers-fight" },
      },
      { id: "fight", label: "Wade into the diggers", to: "diggers-fight" },
    ],
  },
  "diggers-fight": {
    id: "diggers-fight",
    kind: "battle",
    encounterId: "diggers",
    mapId: "corridor",
    intro: [
      "The dead come down the cut with their picks raised. Two are bare bones in grave-rags. Three are fresh, and still wear the faces {thornwick} buried. Hit hard, and try not to look.",
    ],
    again: ["The dead are waiting in the cut this time, picks raised."],
    onWin: {
      to: "diggers-chain",
      text: ["The last digger falls across its pick. The cut goes quiet, apart from your breathing."],
    },
  },
  "diggers-sneak": {
    id: "diggers-sneak",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-crypt", emoji: "⛏️" },
    text: [
      "The picks ring loud enough to cover a footstep. You edge along the wall between swings, and not one head turns.",
    ],
    next: [
      {
        id: "ok",
        label: "Go on",
        to: "diggers-chain",
        effects: [{ kind: "xp", amount: avoidedFightXP("diggers") }],
      },
    ],
  },
  "diggers-still": {
    id: "diggers-still",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-crypt", emoji: "⛏️" },
    text: [
      "You speak the old words, slow and plain. *Lie down and be at peace. Your work is done.* One by one the picks go quiet, and the dead lie down in the cut in rows.",
    ],
    next: [
      {
        id: "ok",
        label: "Go on",
        to: "diggers-chain",
        effects: [{ kind: "xp", amount: avoidedFightXP("diggers") }],
      },
    ],
  },
  "diggers-ranks": {
    id: "diggers-ranks",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-crypt", emoji: "⛏️" },
    text: [
      "You find the oldest rank by its grave-clothes and fall in at the back of it. Swing, step, swing. The dead make room for you without breaking step, and you walk out the far end, still swinging.",
    ],
    next: [
      {
        id: "ok",
        label: "Go on",
        to: "diggers-chain",
        effects: [{ kind: "xp", amount: avoidedFightXP("diggers") }],
      },
    ],
  },
  "diggers-turn": {
    id: "diggers-turn",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-crypt", emoji: "⛏️" },
    text: [
      "A light that is not torch-light fills the cut. The dead shuffle back from it like sheep from a dog, and press to the walls, and leave you a road.",
    ],
    next: [
      {
        id: "ok",
        label: "Go on",
        to: "diggers-chain",
        effects: [{ kind: "xp", amount: avoidedFightXP("diggers") }],
      },
    ],
  },
  "diggers-chain": {
    id: "diggers-chain",
    kind: "story",
    art: { imageId: "loc-crypt", emoji: "⛓️" },
    noBack: true,
    text: [
      "At the end of the cut, an old man in a good burial coat has folded down against the wall. A reeve's chain of office hangs round his neck, the twin of the one {aldous} grips in his hall. He is light now, just bones in a coat.",
      {
        if: [{ kind: "companion", companion: "wren" }],
        text: "{wren} kneels and straightens the chain on his chest. \"The reeve's grandfather,\" she says, and nothing else.",
      },
      "The diggers stacked their grave-goods against the wall: rings, buckles, old coin, and a boar-spear with a silvered head. You can carry the old man, or the heap, but not both, and the old man will slow you all the way down.",
    ],
    next: [
      {
        id: "carry",
        label: "Carry him home in your cloak, though it will cost the day",
        to: "@hub",
        effects: [
          { kind: "setFlag", flag: "diggers-passed" },
          { kind: "setFlag", flag: "grandfather-home" },
          ...[REGARD].flat(),
          { kind: "npc", npc: "wren", attitude: 1, hearsay: true },
          { kind: "passDay" },
          {
            kind: "journal",
            entry: {
              id: "c-grandfather",
              kind: "clue",
              title: "The Old Reeve",
              body: "Reeve {aldous}'s grandfather was digging with the dead in the {undercrypt}. You are carrying him home to {thornwick}.",
            },
          },
        ],
      },
      {
        id: "leave",
        label: "Lay him down here, chain and all, and take the grave-goods",
        to: "@hub",
        effects: [
          { kind: "setFlag", flag: "diggers-passed" },
          { kind: "gold", amount: 40 },
          { kind: "addItem", itemId: "silvered-spear" },
        ],
      },
    ],
  },
  "wights": {
    id: "wights",
    kind: "story",
    art: { imageId: "loc-crypt", emoji: "⚔️" },
    text: [
      "This is the hall of the kings' guard. Three slabs of black stone stand in the dark. On the middle one, an old guardsman in barrow-armour sits *up*, with cold light burning in its eye sockets. It draws a sword of green bronze, like the soldiers in the paintings, and takes a **stance**.",
    ],
    again: ["The old guardsman stands before its slab again, sword drawn, cold light in its eyes."],
    next: [
      {
        id: "salute",
        label: "[History DC 15] Relieve him of his post, the old way",
        to: "wights-salute",
        once: true,
        hideWhenBlocked: true,
        requires: [{ kind: "flag", flag: "hall-seen" }],
        check: { skill: "history", dc: 15, failTo: "wights-fight" },
      },
      { id: "fight", label: "Draw on him", to: "wights-fight" },
    ],
  },
  "wights-fight": {
    id: "wights-fight",
    kind: "battle",
    encounterId: "wight-tomb",
    mapId: "corridor",
    intro: [
      "From the slabs on either side, two skeletons rise to guard it. They snap to their feet at the same instant, and come for you.",
    ],
    again: ["The guardsman's two skeletons stand at its sides, heads turned toward you."],
    onWin: {
      to: "@hub",
      text: [
        "The wight comes apart at the joints and lies down in its own armour. Under its slab lies a guardsman's pay that no one ever came to collect.",
      ],
      effects: [{ kind: "setFlag", flag: "wights-down" }, { kind: "gold", amount: 40 }],
    },
  },
  "wights-salute": {
    id: "wights-salute",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-crypt", emoji: "⚔️" },
    text: [
      "You give the salute the painted hall showed, fist to chest, and tell him his watch is over. At last he lowers his sword and lies back down on his slab, and his skeletons lie down with him.",
    ],
    next: [
      {
        id: "ok",
        label: "Go on",
        to: "@hub",
        effects: [{ kind: "setFlag", flag: "wights-down" }, { kind: "xp", amount: avoidedFightXP("wight-tomb") }],
      },
    ],
  },
  "king": {
    id: "king",
    kind: "battle",
    encounterId: "barrow-king",
    mapId: "ruins",
    intro: [
      "Old masons sealed the king's chamber in lead. Something has peeled the lead back like fruit-rind, from the *inside*. Inside, a figure in grave-wrappings the colour of old honey stands before a carved wall. It is cut with the names of villages, hundreds of them, and a line runs through every one.",
      "The embalmed king turns. Someone has set a crown of green bronze back on his head, and set it straight. Two of his household dead lurch from the corners, and beside the throne a barrow-soldier in green bronze draws its sword.",
    ],
    again: [
      "The embalmed king still stands before his wall of crossed-out villages. His household dead lurch out of the corners again, and his soldier draws its sword.",
    ],
    onWin: {
      to: "@hub",
      text: [
        "The king crumbles to dust and old spice, his servants drop mid-lurch, and his soldier folds down in its bronze. At the bottom of the wall, one name sits freshly carved, with no line through it yet. **THORNWICK**.",
        "You pick his gold rings out of the dust. Behind the throne, a burial shaft drops into the dark, and chanting comes up out of it. There will be no climbing back up it.",
      ],
      effects: [{ kind: "setFlag", flag: "king-down" }, { kind: "gold", amount: 60 }],
    },
  },
  "shaft": {
    id: "shaft",
    kind: "story",
    art: { imageId: "loc-crypt", emoji: "🕯️" },
    noBack: true,
    text: [
      "You land hard in old bones and older dust. The shaft goes up into the dark, far out of reach. Below, black candles burn on every step of the last stair, toward the chanting.",
    ],
    again: ["The black candles still burn on every step below you, and the chanting has not stopped."],
    next: [
      { id: "down", label: "Go down toward the chanting", to: "seal-approach" },
      { id: "rest", label: "Sleep at the shaft's foot (long rest)", to: "shaft-rest", once: true },
    ],
  },
  "shaft-rest": {
    id: "shaft-rest",
    kind: "rest",
    variant: "long",
    next: "shaft",
    intro: [
      "You sleep badly, under the black candles, with the chanting for a lullaby. Nobody below comes up to look.",
    ],
  },
  "seal-approach": {
    id: "seal-approach",
    kind: "story",
    art: { imageId: "loc-dungeon", emoji: "🚪" },
    noBack: true,
    text: [
      "The lowest stair ends at the door the paintings promised. It is a slab of stone the size of a barn wall, with old words cut across it and lead in every letter. The stone bows *outward*, as something behind it leans its weight on it.",
      "The chanting comes from the **living**. They kneel at the door with candles of black tallow, in long robes the colour of grave-worms. Their leader is the thin grey man from the painted hall. He pries the lead out of the door one letter at a time with a chisel of bone.",
      "A walking suit of ancient armour guards the stair. Two ghouls crouch among the candles like pets. Against the door sit two soldiers of the old kings in green bronze, waiting for an order.",
      "\"**{marrow}**,\" the grey man says, without stopping. \"I brought your priest his candles. I dug graves at {saltmere} for thirty years. Then the fever came. I buried the whole village, my wife and my two boys last, and walked away and left them in the cold. The {warden} leaves nobody in the cold. Is that so wicked?\"",
      {
        if: [{ kind: "flag", flag: "door-straining" }],
        text: "The door has shifted in its frame since the ground shook. A line of dark shows along its top. \"He leaned on it in the night,\" {marrow} says. \"It will be harder to shut now.\"",
      },
    ],
    again: [
      "{marrow} is still at the door, prying the lead out of its letters. \"Back again,\" he says. \"It is nearly open now.\"",
    ],
    next: [
      {
        id: "wall",
        label: "[Persuasion DC 14] Tell {marrow} what the king's wall says",
        to: "seal-doubt-words",
        once: true,
        check: {
          skill: "persuasion",
          dc: 14,
          failTo: "seal-battle",
          failEffects: [{ kind: "setFlag", flag: "kneelers-scorned" }],
        },
      },
      { id: "fight", label: "Interrupt the service", to: "seal-battle" },
    ],
  },
  "seal-doubt-words": {
    id: "seal-doubt-words",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-dungeon", emoji: "⛏️" },
    text: [
      "You tell him about the wall in the king's chamber: hundreds of villages, with a line through every one. \"{thornwick} is the next name,\" you say. \"{saltmere}'s graves will be on the wall after that.\"",
      "{marrow}'s chisel stops. His acolyte sees it stop, and screams that {marrow} has lost his faith.",
    ],
    next: [
      {
        id: "on",
        label: "Face what is left of his flock",
        to: "seal-doubt",
        effects: [{ kind: "xp", amount: avoidedFightXP("cult-at-door") - avoidedFightXP("cult-wavering") }],
      },
    ],
  },
  "seal-doubt": {
    id: "seal-doubt",
    kind: "battle",
    encounterId: "cult-wavering",
    mapId: "firepit",
    noFlee: true,
    loot: { bonusTier: "rare" },
    intro: [
      "{marrow} sits with his back against the door, his chisel loose in his lap. The armour and the ghouls come for you anyway, and two of the kneelers come up off their knees, praying aloud. One bronze soldier gets to its feet at the acolyte's scream. Its twin waits for an order, and {marrow} gives none.",
    ],
    again: [
      "The acolyte is still shrieking. The armour, the ghouls, the two praying kneelers and the one bronze soldier come for you again. {marrow} still has not lifted his chisel.",
    ],
    onWin: {
      to: "seal-door",
      text: [
        "The last ghoul falls among the candles. The bronze soldier that rose lies broken at the foot of the stair, and the cold light goes out of its twin's eyes. {marrow} is still sitting against the door.",
        "Coins lie thick on the bottom step, thrown there by the faithful. You gather them up.",
      ],
      effects: [{ kind: "setFlag", flag: "cult-broken" }, { kind: "gold", amount: 120 }],
    },
    onLoss: { to: "seal-doubt-lost" },
  },
  "seal-doubt-lost": {
    id: "seal-doubt-lost",
    kind: "rest",
    variant: "long",
    sameDay: true,
    next: "seal-doubt",
    intro: [
      "The ghouls drag you down among the candles. When you come round, you are lying by the shaft with a gravedigger's coat folded under your head. Below, the acolyte is still shrieking, and {marrow} still has not lifted his chisel.",
    ],
  },
  "seal-battle": {
    id: "seal-battle",
    kind: "battle",
    encounterId: "cult-at-door",
    mapId: "firepit",
    noFlee: true,
    loot: { bonusTier: "rare" },
    intro: [
      {
        if: [{ kind: "flag", flag: "kneelers-scorned" }],
        text: "{marrow} hears you out without stopping his chisel. \"Then the {warden} chose {thornwick},\" he says. \"He chose well.\" Behind him the kneelers laugh, all together, and lift their black candles higher.",
      },
      "{marrow} turns with the chisel in his hand, and rage floods the sweet reason off his face. \"The door opens for the *faithful*!\" His acolyte pulls a knife. The armour grinds down the stair, the ghouls come low and fast between the candles, and the two bronze soldiers get to their feet.",
    ],
    again: [
      "{marrow} turns from the door again, chisel in hand. The armour, the ghouls and the two soldiers in green bronze come for you once more.",
    ],
    onWin: {
      to: "seal-door",
      text: [
        "{marrow} dies reaching for the door. His kneeling faithful stare at the body and do not get up. Coins lie thick on the bottom step, where the faithful threw them. You sweep them into a sack.",
      ],
      effects: [
        { kind: "setFlag", flag: "cult-broken" },
        { kind: "setFlag", flag: "marrow-dead" },
        { kind: "gold", amount: 120 },
      ],
    },
    onLoss: { to: "seal-battle-lost" },
  },
  "seal-battle-lost": {
    id: "seal-battle-lost",
    kind: "rest",
    variant: "long",
    sameDay: true,
    next: "seal-battle",
    intro: [
      "A knife-hilt catches you behind the ear, and the candles go out. You come to by the shaft with your wrists tied. The faithful were too busy with the door to finish you, and the chanting has not missed a beat.",
    ],
  },
  "seal-door": {
    id: "seal-door",
    kind: "story",
    art: { imageId: "loc-dungeon", emoji: "🚪" },
    noBack: true,
    text: [
      "Quiet settles over the last stair. Only the door still makes a sound, a slow grinding, as the {warden} leans on what is left of its lead.",
      {
        if: [{ kind: "notFlag", flag: "marrow-dead" }],
        text: "{marrow} looks up at the letters he pried loose. \"I thought he would give them back to me,\" he says. \"My faithful will sing whatever I sing. Or you can take me up to your reeve.\"",
      },
      {
        if: [{ kind: "npc", npc: "halden", fate: "saved" }],
        text: "Boots scrape in the shaft above. Brother {halden} drops down it, skinning his palms, and limps down the last stair. He promised to follow you down, and he has.",
      },
    ],
    next: [
      {
        id: "sing",
        label: "Make {marrow} lead his faithful in the rites",
        to: "seal-door-book",
        hideWhenBlocked: true,
        requires: [{ kind: "notFlag", flag: "marrow-dead" }],
        effects: [{ kind: "npc", npc: "marrow", fate: "sings" }],
      },
      {
        id: "bind",
        label: "Bind {marrow} for the reeve, and take the cult's offering-purse",
        to: "seal-door-book",
        hideWhenBlocked: true,
        requires: [{ kind: "notFlag", flag: "marrow-dead" }],
        effects: [
          { kind: "npc", npc: "marrow", fate: "bound" },
          { kind: "gold", amount: factValue("offering-purse") },
        ],
      },
      {
        id: "open",
        label: "Open {halden}'s book at the door",
        to: "seal-door-book",
        hideWhenBlocked: true,
        requires: [{ kind: "flag", flag: "marrow-dead" }],
      },
    ],
  },
  "seal-door-book": {
    id: "seal-door-book",
    kind: "story",
    art: { imageId: "loc-dungeon", emoji: "📖" },
    noBack: true,
    text: [
      {
        if: [{ kind: "npc", npc: "marrow", fate: "sings" }],
        text: "{marrow} kneels down among his faithful. \"Read, or let me read. Whoever reads, they will chant it after, because I will.\"",
      },
      {
        if: [{ kind: "npc", npc: "marrow", fate: "bound" }],
        text: "You tie {marrow}'s wrists with his own apron strings, and take the offering-purse from his belt.",
      },
      "You open {halden}'s book.",
    ],
    next: [
      {
        id: "read",
        label: "Read",
        to: "resealing",
        hideWhenBlocked: true,
        requires: [{ kind: "notFlag", flag: "door-straining" }],
      },
      {
        id: "read-shifted",
        label: "Read",
        to: "resealing-shifted",
        hideWhenBlocked: true,
        requires: [{ kind: "flag", flag: "door-straining" }],
      },
    ],
  },
  "resealing": RESEALING(false),
  "resealing-shifted": RESEALING(true),
  "seal-breach": {
    id: "seal-breach",
    kind: "battle",
    encounterId: "warden-dead",
    mapId: "firepit",
    noFlee: true,
    loot: false,
    intro: [
      "The {warden}'s own dead squeeze out through the split in his door. Skeletons in green bronze come first, then three swollen fen-dead, then two tall dead soldiers with drawn swords. If they get past you, {thornwick} is next.",
    ],
    again: [
      "The {warden}'s dead are still coming, a few at a time. If they get past you, {thornwick} is next.",
    ],
    onWin: {
      to: "seal-closed",
      text: [
        "The last of them falls across the doorstep. You put your shoulders to the door and shove it home over the bodies, and shout the rites into the crack, badly and all at once. It is enough, barely.",
      ],
      effects: [{ kind: "setFlag", flag: "seal-cracked" }],
    },
    onLoss: { to: "seal-breach-lost" },
  },
  "seal-breach-lost": {
    id: "seal-breach-lost",
    kind: "rest",
    variant: "long",
    sameDay: true,
    next: "seal-breach",
    intro: [
      "Grey hands close over your face. You wake on the stair, far above the door, and the dead have not climbed past you. They are still squeezing through, one at a time. Someone has to hold that door, and it is still you.",
    ],
  },
  "seal-closed": {
    id: "seal-closed",
    kind: "story",
    art: { imageId: "loc-dungeon", emoji: "🚪" },
    noBack: true,
    text: [
      {
        if: [{ kind: "notFlag", flag: "seal-cracked" }],
        text: "Line by line the great door stops *straining*, and the weight behind it eases off. Something enormous turns away, unhurried, like a sleeper turning over in a warm bed. The **{warden}** sleeps. The door is shut.",
      },
      {
        if: [{ kind: "flag", flag: "seal-cracked" }],
        text: "The door holds, but the crack in it does not close. Behind the stone the {warden} settles without sleeping, and now and then the door ticks under your hand like a knuckle tapping.",
      },
      "Far above you, across the barrow-field, every walking corpse lies down where it stands.",
      "Among the cult's packs you find a rope ladder and a grapnel. You throw the hook up the burial shaft until it bites.",
    ],
    next: [{ id: "home", label: "Climb back to the light", to: "sb-aftermath" }],
  },
  "sb-aftermath": {
    id: "sb-aftermath",
    kind: "story",
    art: { imageId: "loc-town", emoji: "🏘️" },
    noBack: true,
    text: [
      "The rope ladder brings you up out of the great barrow and into the open air.",
      {
        if: [{ kind: "noCompanion", companion: "wren" }],
        text: "{wren} is still at the gate when you come up, with her knife out. All round her, the dead lie still in the grass at last. She looks like someone who means to have been calm the whole time.",
      },
      {
        if: [{ kind: "companion", companion: "wren" }],
        text: "{wren} comes up behind you. At the top she stands a long moment among the dead, who lie still in the grass at last. Then she unstrings her bow.",
      },
      {
        if: [{ kind: "npc", npc: "halden", fate: "saved" }],
        text: "Brother {halden} climbs out, blinking at the daylight. He says the burial words over every one of the dead in the grass.",
      },
      {
        if: [{ kind: "npc", npc: "marrow", fate: "bound" }],
        text: "{marrow} climbs out behind you with his wrists tied. {wren} looks him up and down, and leaves his rope in your hands.",
      },
      {
        if: [{ kind: "npc", npc: "marrow", fate: "sings" }],
        text: "{marrow} climbs out after you, and walks off alone toward {saltmere}. {wren} keeps her hand on her knife until the fog takes him.",
      },
      {
        if: [{ kind: "flag", flag: "grandfather-home" }],
        text: "{wren} sees the chain glint in the folds of your cloak, and she knows it. She takes one end of the bundle before you can ask. \"I've got his feet,\" she says. \"Mind the ruts.\"",
      },
      {
        if: [{ kind: "notFlag", flag: "seal-cracked" }],
        text: "The walk home is long and wet. The door under the barrows is shut behind you, and the fen is only a fen again.",
      },
      {
        if: [{ kind: "flag", flag: "seal-cracked" }],
        text: "The walk home is long and wet. Every so often one of you stops and looks back at the barrow-field, and the others wait, and listen with them.",
      },
      {
        if: [{ kind: "npc", npc: "wren", attitude: { atLeast: 2 } }],
        text: "At the edge of town {wren} says \"Thank you,\" fast, to the road. She walks on before anyone can ask what for.",
      },
    ],
    next: [
      {
        id: "hall",
        label: "Go up to the reeve's hall",
        to: "sb-hall",
        hideWhenBlocked: true,
        requires: [{ kind: "noCompanion", companion: "wren" }],
        effects: [{ kind: "gold", amount: 150 }],
      },
      {
        id: "hall-wren",
        label: "Go up to the reeve's hall",
        to: "sb-hall",
        hideWhenBlocked: true,
        requires: [{ kind: "companion", companion: "wren" }],
        effects: [{ kind: "gold", amount: 150 }, { kind: "leaveParty", companion: "wren" }],
      },
    ],
  },
  "sb-hall": {
    id: "sb-hall",
    kind: "story",
    art: { emoji: "⚖️" },
    noBack: true,
    text: [
      {
        if: [{ kind: "flag", flag: "grandfather-home" }],
        text: "That evening you carry the old man into the reeve's hall and lay him on the long table among the ledgers. {aldous} takes off his own chain of office and lays it beside his grandfather's. The links match. \"He taught me to wear this straight,\" he says, and his voice gives out on the last word.",
      },
      {
        if: [{ kind: "flag", flag: "grandfather-home" }],
        text: "Then he counts your purse into your hands himself, coin by coin. He loses count twice, and does not seem to mind.",
      },
      {
        if: [{ kind: "notFlag", flag: "grandfather-home" }],
        text: "That evening, in the reeve's hall, {aldous} counts your purse into your hands himself, coin by coin, and does not lose count once.",
      },
      "{thornwick} reburies its dead in the following days, oldest graves first. The reeve stands bareheaded at every service.",
      {
        if: [{ kind: "flag", flag: "drowned-gold-home" }],
        text: "The fen-folk come in from the far pools for the reburials, and {wren} hands over the drowned folk's purses one by one. One widow opens hers and finds a carved bone button among the coins. \"He always kept that,\" she says, and holds the purse to her chest.",
      },
      "Every night of the reburials the {wander-inn} fills with mourners, and the innkeeper keeps a pot on. \"A town remembers who fed it while it buried its dead,\" she says. \"Longer than it remembers who dug the graves.\"",
    ],
    next: [
      {
        id: "mira",
        label: "Spend the reeve's purse on a hot supper for the whole taproom ({taproom-supper})",
        to: "sb-supper",
        hideWhenBlocked: true,
        requires: [{ kind: "gold", atLeast: factValue("taproom-supper") }],
        effects: [{ kind: "gold", amount: -factValue("taproom-supper") }, ...[REGARD].flat()],
      },
      {
        id: "done",
        label: "Let the town sleep",
        to: "sb-epilogue",
        effects: [{ kind: "setFlag", flag: "won" }],
      },
    ],
  },
  "sb-supper": {
    id: "sb-supper",
    kind: "story",
    art: { imageId: "loc-tavern", emoji: "🍺" },
    noBack: true,
    text: [
      "The whole taproom eats on your coin. Someone stands and names {thornwick}'s dead, one by one, and the room listens with its cups down. When the last name is said, someone raises a cup to {mira}, who cooked it all, and she goes on scrubbing the pot.",
    ],
    next: [
      {
        id: "done",
        label: "Let the town sleep",
        to: "sb-epilogue",
        effects: [{ kind: "setFlag", flag: "won" }],
      },
    ],
  },
  "sb-defeat": {
    id: "sb-defeat",
    kind: "story",
    art: { imageId: "loc-tavern", emoji: "🍺" },
    noBack: true,
    text: [
      "The first thing you know is the smell of tallow and wet wool. You are lying in the back room of the {wander-inn}. Fen-mud has dried stiff in your hair.",
      {
        if: [{ kind: "at", hub: "fen/delve" }],
        text: "Eel-catchers found you by the old road at first light, {mira} says. They carried you in on hurdles.",
      },
      {
        if: [{ kind: "at", hub: "undercrypt/delve" }],
        text: "When no one came back up by dark, eel-catchers went down the stair after you with ropes, {mira} says. They hauled you all up.",
      },
      "\"The fen's still there,\" {mira} says. She puts the bread where you can reach it.",
    ],
    again: [
      "Back on the settles in {mira}'s back room, with fresh bruises under the old mud. \"You know where the bread is,\" {mira} says, and leaves you to it.",
    ],
    next: [
      { id: "up", label: "Get back on your feet", to: "square/city", effects: [{ kind: "passDay" }] },
      {
        id: "back",
        label: "Go straight back down the barrow stair",
        to: "undercrypt",
        hideWhenBlocked: true,
        requires: [{ kind: "at", hub: "undercrypt/delve" }],
        effects: [{ kind: "passDay" }],
      },
    ],
  },
  "sb-epilogue": {
    id: "sb-epilogue",
    kind: "ending",
    outcome: "victory",
    art: { emoji: "🏆" },
    slides: [
      {
        if: [{ kind: "npc", npc: "vex", fate: "turned" }],
        text: "{vex} hears the news in a hill inn. He sits up late by the fire, looking back toward the valley.",
      },
      {
        if: [{ kind: "npc", npc: "vargan", fate: "spared" }],
        text: "Out in the reed-beds, {vargan} stops cutting when a burial goes by on the lane. He takes off his cap until it has passed.",
      },
      {
        if: [{ kind: "npc", npc: "marrow", fate: "bound" }],
        text: "{marrow} waits in the reeve's cells. He asks for a shovel. After some thought, {aldous} gives him the churchyard to mend.",
      },
      {
        if: [{ kind: "npc", npc: "marrow", fate: "sings" }],
        text: "In {saltmere}, {marrow} keeps the graves he once left in the cold. He says the rites over them every evening.",
      },
      {
        if: [{ kind: "npc", npc: "halden", fate: "saved" }],
        text: "Brother {halden} keeps the vigil now, and he reads the rites a little louder than he needs to.",
      },
      {
        if: [{ kind: "npc", npc: "halden", notFate: ["saved"] }],
        text: "{halden} and his acolytes share a new grave by the chapel. {mira} of the {wander-inn} paid for the white headstone. Under the names it says only *Asleep*.",
      },
      {
        if: [{ kind: "npc", npc: "wren", met: true }],
        text: "{wren} wears a captain's knot in the reeve's colours now, to her plain horror. She leads the watch that walks the old road once a season.",
      },
      {
        if: [],
        text: "Every night since the graves opened, a lamp has burned in the window of the {wander-inn}. Now {mira} takes it down and blows it out.",
      },
      {
        if: [{ kind: "flag", flag: "drowned-gold-home" }],
        text: "The widow who found the bone button sews it back onto her husband's good coat. They bury him in it beside the rest of {thornwick}'s dead, oldest graves first.",
      },
      {
        if: [{ kind: "flag", flag: "grandfather-home" }],
        text: "{aldous} buries his grandfather a second time, chain and all, and digs the grave himself.",
      },
      {
        if: [{ kind: "flag", flag: "diggers-passed" }, { kind: "notFlag", flag: "grandfather-home" }],
        text: "The old reeve's grave in the churchyard stays empty. {aldous} fills it in anyway, and visits it every week.",
      },
      {
        if: [{ kind: "notFlag", flag: "seal-cracked" }],
        text: "Deep under the barrow-field, the {warden}'s door stands shut in the dark, among the cold candle-ends.",
      },
      {
        if: [{ kind: "flag", flag: "seal-cracked" }],
        text: "On still nights the fen-folk swear that something under the barrows knocks, faintly, like a knuckle on a door.",
      },
      {
        if: [],
        text: "On the night the barrows close, at the fen's edge, two figures step out of the reeds, tall and green-fingered, with river-weed in their hair. They are the {reedwife}'s sisters. They look at the sealed barrow-field, and then at the town, and take their time about both.",
      },
    ],
    text: ["In {thornwick}'s churchyard the turf is back over every grave, and the bell-rope hangs still."],
  },
};

/** Each scene's act: the file it is written in (Module.acts). */
export const ACTS: Record<string, string> = {
  "return": "return",
  "lychyard": "return",
  "lychyard-lost": "return",
  "grave-morning": "return",
  "inn": "thornwick",
  "inn-rest": "thornwick",
  "reeve-hall": "thornwick",
  "grave-study": "thornwick",
  "fen-shut": "thornwick",
  "wren-meet": "thornwick",
  "fen-again": "thornwick",
  "chapel": "fen",
  "chapel-fight": "fen",
  "chapel-liturgy": "fen",
  "chapel-bell": "fen",
  "chapel-bell-plain": "fen",
  "chapel-saved": "fen",
  "lights": "fen",
  "lights-fight": "fen",
  "lights-skirt": "fen",
  "lights-lured": "fen",
  "purses": "fen",
  "purses-taken": "fen",
  "pool": "fen",
  "pool-fight": "fen",
  "lychgate": "fen",
  "lychgate-fight": "fen",
  "lychgate-mark": "fen",
  "lychgate-won": "fen",
  "hall": "undercrypt",
  "ossuary": "undercrypt",
  "diggers": "undercrypt",
  "diggers-fight": "undercrypt",
  "diggers-sneak": "undercrypt",
  "diggers-still": "undercrypt",
  "diggers-ranks": "undercrypt",
  "diggers-turn": "undercrypt",
  "diggers-chain": "undercrypt",
  "wights": "undercrypt",
  "wights-fight": "undercrypt",
  "wights-salute": "undercrypt",
  "king": "undercrypt",
  "shaft": "undercrypt",
  "shaft-rest": "undercrypt",
  "seal-approach": "undercrypt",
  "seal-doubt-words": "undercrypt",
  "seal-doubt": "undercrypt",
  "seal-doubt-lost": "undercrypt",
  "seal-battle": "undercrypt",
  "seal-battle-lost": "undercrypt",
  "seal-door": "undercrypt",
  "seal-door-book": "undercrypt",
  "resealing": "undercrypt",
  "resealing-shifted": "undercrypt",
  "seal-breach": "undercrypt",
  "seal-breach-lost": "undercrypt",
  "seal-closed": "undercrypt",
  "sb-aftermath": "ending",
  "sb-hall": "ending",
  "sb-supper": "ending",
  "sb-defeat": "ending",
  "sb-epilogue": "ending"
};
