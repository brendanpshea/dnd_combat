/**
 * Draw a dungeon to an SVG, with whatever the validator finds wrong with it
 * printed across the top and the rooms it names outlined in red.
 *
 * ASCII maps were readable at a glance; a dungeon written as rooms and links
 * is not. This is the glance: write the rooms, run this, look.
 *
 *   npm run dungeon:preview -- hollow-road inner
 *   npm run dungeon:preview -- --seed 12 --theme ember --size large --level 3
 *   (add --out path.svg; default dungeon-preview.svg)
 */
import { writeFileSync } from 'node:fs';
import { MODULES } from '../src/data/modules/index.js';
import { generateDelve, type DelveOptions } from '../src/adventure/dungeon-gen.js';
import { layoutDungeon, checkDungeon, linkKey, ROOM_BOX } from '../src/adventure/dungeon.js';
import type { Dungeon, Module } from '../src/adventure/types.js';

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function pick(): { module: Module; sceneId: string; dungeon: Dungeon } {
  const seed = arg('--seed');
  if (seed !== undefined) {
    const opts: DelveOptions = {};
    const theme = arg('--theme'); const size = arg('--size'); const level = arg('--level');
    if (theme) opts.theme = theme as NonNullable<DelveOptions['theme']>;
    if (size) opts.size = size as NonNullable<DelveOptions['size']>;
    if (level) opts.level = Number(level);
    const { module, rerolls } = generateDelve(Number(seed), opts);
    console.log(`Generated ${module.title} (${rerolls} rerolls)`);
    const s = module.scenes.delve;
    if (s?.kind !== 'dungeon') throw new Error('no delve scene');
    return { module, sceneId: 'delve', dungeon: s.dungeon };
  }
  const [modId, sceneId] = process.argv.slice(2).filter((a) => !a.startsWith('--') && a !== arg('--out'));
  const module = MODULES.find((m) => m.id === modId);
  if (!module) throw new Error(`Unknown module '${modId}'. Try: ${MODULES.map((m) => m.id).join(', ')}`);
  const ids = Object.values(module.scenes).filter((s) => s.kind === 'dungeon').map((s) => s.id);
  const id = sceneId ?? ids[0];
  const s = id ? module.scenes[id] : undefined;
  if (s?.kind !== 'dungeon') throw new Error(`No dungeon scene '${sceneId ?? ''}' in ${modId}. Dungeons: ${ids.join(', ') || 'none'}`);
  return { module, sceneId: s.id, dungeon: s.dungeon };
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const { module, sceneId, dungeon: d } = pick();
const layout = layoutDungeon(d);
const errors = checkDungeon(module, sceneId, d);
const flagged = new Set(d.rooms.filter((r) => errors.some((e) => e.includes(`'${r.id}'`))).map((r) => r.id));

const PX = 150, PY = 110, PAD = 36;
const top = 58 + errors.length * 18;
const W = Math.max(layout.cols * PX + PAD * 2, 900);
const H = top + layout.rows * PY + PAD * 2 + 40;
const at = (c: number, r: number): [number, number] => [PAD + c * PX + PX / 2, top + PAD + r * PY + PY / 2];

const out: string[] = [];
out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui, sans-serif">`);
out.push(`<rect width="${W}" height="${H}" fill="#1a1625"/>`);
out.push(`<text x="16" y="26" fill="#e8e4f0" font-size="18" font-weight="700">${esc(d.title)} — ${esc(module.id)}/${esc(sceneId)}${d.torch ? `  🔥 ${d.torch.length}` : ''}</text>`);
errors.forEach((e, i) => out.push(`<text x="16" y="${70 + i * 18}" fill="#ff5a5a" font-size="13">${esc(e)}</text>`));
out.push(errors.length === 0
  ? '<text x="16" y="48" fill="#6ee7a0" font-size="14">✓ passes every check</text>'
  : `<text x="16" y="48" fill="#ff5a5a" font-size="14">✗ ${errors.length} problem(s)</text>`);

for (const l of d.links) {
  const p = layout.corridors[linkKey(l)];
  if (!p) continue;
  const pts = p.map(([c, r]) => at(c, r).join(',')).join(' ');
  const door = l.door;
  const stroke = door?.secret ? '#b49cff' : door?.locked ? '#ffd166' : '#8a7a60';
  const dash = door?.secret ? ' stroke-dasharray="8 6"' : '';
  out.push(`<polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="${door?.secret ? 4 : 8}" stroke-linecap="round" stroke-linejoin="round"${dash}/>`);
  const mid = p[Math.floor((p.length - 1) / 2)]!, mid2 = p[Math.ceil((p.length - 1) / 2)]!;
  const [x1, y1] = at(mid[0], mid[1]); const [x2, y2] = at(mid2[0], mid2[1]);
  const [mx, my] = [(x1 + x2) / 2, (y1 + y2) / 2];
  const marks = [door?.locked ? '🔒' : '', door?.force ? '💪' : '', door?.ambush ? '⚠️' : '', door?.oneWay ? '➜' : '', (l.length ?? 1) > 1 ? `×${l.length}` : ''].join('');
  if (marks) out.push(`<text x="${mx}" y="${my + 5}" font-size="14" text-anchor="middle" fill="#ffd166">${marks}</text>`);
}
for (const r of d.rooms) {
  const cell = layout.cells[r.id];
  if (!cell) continue;
  const [cx, cy] = at(cell[0], cell[1]);
  const box = ROOM_BOX[r.size ?? 'medium'];
  const w = box.w * PX, h = box.h * PY;
  const stroke = flagged.has(r.id) ? '#ff5a5a' : r.id === d.entry ? '#6ee7a0' : r.goal ? '#ffd166' : '#8a7a60';
  out.push(`<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="9" fill="#2a2338" stroke="${stroke}" stroke-width="${flagged.has(r.id) ? 4 : 2.5}"/>`);
  out.push(`<text x="${cx}" y="${cy + 2}" fill="#e8e4f0" font-size="14" font-weight="700" text-anchor="middle">${esc(r.name)}</text>`);
  const marks = [r.fight ? '⚔️' : '', r.event ? '💬' : '', r.search ? '📦' : '', r.exit ? '🚪' : '', r.goal ? '👑' : ''].join('');
  out.push(`<text x="${cx}" y="${cy + 20}" font-size="13" text-anchor="middle" fill="#9a92b0">${esc(r.id)} ${marks}</text>`);
}
out.push(`<text x="16" y="${H - 14}" fill="#9a92b0" font-size="12">green: entry · gold: goal · ⚔️ fight 💬 event 📦 search 🚪 exit · 🔒 locked 💪 forceable ⚠️ ambush ➜ one-way · dashed purple: secret</text>`);
out.push('</svg>');

const file = arg('--out') ?? 'dungeon-preview.svg';
writeFileSync(file, out.join('\n'));
console.log(`${errors.length === 0 ? 'OK' : `${errors.length} problem(s)`} — wrote ${file}`);
for (const e of errors) console.log(`  ${e}`);
process.exitCode = errors.length ? 1 : 0;
