/**
 * Draw a whole module: its scenes grouped by location, every way between
 * them, and whatever the validator finds wrong outlined in red.
 *
 *   npm run module:map -- hollow-road            (writes module-map.svg)
 *   npm run module:map -- wyrmcalling --out wc.svg
 *
 * Each location is laid out by ELK's layered algorithm (elkjs) and the boxes
 * are stacked in the order a party reaches them.
 * Edges carry what they need ("needs npc.vex.fate.turned") when they need something;
 * the way back to a location is a ↩ on the scene rather than an arrow, and a
 * lost fight's fall to the defeat scene is left out, since every fight has it.
 */
import { writeFileSync } from 'node:fs';
import ELKImport from 'elkjs/lib/elk.bundled.js';
import { MODULES } from '../src/data/modules/index.js';
import { moduleMap, type MapEdge, type MapNode } from '../src/adventure/module-map.js';
import { validateModule } from '../src/adventure/validate.js';

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const modId = process.argv.slice(2).find((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--out');
const module = MODULES.find((m) => m.id === modId);
if (!module) {
  console.error(`Usage: npm run module:map -- <module> [--out file.svg]. Modules: ${MODULES.map((m) => m.id).join(', ')}`);
  process.exit(1);
}

const map = moduleMap(module);
const errors = validateModule(module);
const flagged = new Set(map.nodes.filter((n) => errors.some((e) => e.startsWith(`[${n.id}]`))).map((n) => n.id));

// --- Look ---------------------------------------------------------------------
const KIND: Record<MapNode['kind'], { fill: string; stroke: string; glyph: string }> = {
  story:     { fill: '#2a2338', stroke: '#6b5f8a', glyph: '📜' },
  dialogue:  { fill: '#2a2338', stroke: '#6b8aa8', glyph: '💬' },
  check:     { fill: '#2a2f38', stroke: '#6b9e8a', glyph: '🎲' },
  challenge: { fill: '#2a2f38', stroke: '#6b9e8a', glyph: '🧗' },
  battle:    { fill: '#3a2226', stroke: '#c0574f', glyph: '⚔️' },
  shop:      { fill: '#33301f', stroke: '#b59a4a', glyph: '🛒' },
  rest:      { fill: '#22332a', stroke: '#5fa877', glyph: '🛏️' },
  explore:   { fill: '#1f2a3a', stroke: '#4a9eff', glyph: '🗺️' },
  dungeon:   { fill: '#2f2619', stroke: '#ffb45c', glyph: '🕯️' },
  ending:    { fill: '#3a3420', stroke: '#ffd166', glyph: '🏁' },
};
const EDGE: Record<MapEdge['kind'], { stroke: string; dash?: string }> = {
  go: { stroke: '#8a83a3' },
  pass: { stroke: '#6ee7a0' },
  fail: { stroke: '#ff8a7a', dash: '5 4' },
  win: { stroke: '#6ee7a0' },
  lose: { stroke: '#ff8a7a', dash: '5 4' },
  talk: { stroke: '#7fc8ff' },
  done: { stroke: '#5a5070', dash: '2 5' },
  danger: { stroke: '#ffb45c', dash: '6 4' },
};
const CH = 7.2; // average character width at 12px
const nodeText = (n: MapNode) => `${KIND[n.kind].glyph} ${n.label}${n.returns ? ' ↩' : ''}`;
const edgeText = (e: MapEdge) => [e.label, e.needs ? `needs ${e.needs}` : ''].filter(Boolean).join(' · ');

// --- Layout: each location on its own, then stacked in story order ----------------
// One ELK layout per location (layered, top-down from its hub), stacked in the
// order a party reaches them. The few ways between locations run in lanes of
// their own down the left gutter, so the chapter reads top to bottom.
interface ElkLabel { text: string; width: number; height: number; x?: number; y?: number }
interface ElkEdge { id: string; sources: string[]; targets: string[]; labels?: ElkLabel[]; sections?: Array<{ startPoint: { x: number; y: number }; endPoint: { x: number; y: number }; bendPoints?: Array<{ x: number; y: number }> }> }
interface ElkNode { id: string; width?: number; height?: number; x?: number; y?: number; children?: ElkNode[]; edges?: ElkEdge[]; layoutOptions?: Record<string, string> }

// elkjs is CommonJS: under Node's ESM the class may arrive as `.default`.
type ElkCtor = new () => { layout(graph: unknown): Promise<unknown> };
const ELK = ((ELKImport as unknown as { default?: ElkCtor }).default ?? ELKImport) as unknown as ElkCtor;
const elk = new ELK();
const leaf = (n: MapNode): ElkNode => ({ id: n.id, width: Math.max(90, nodeText(n).length * CH + 22), height: 30 });
const groupOf = (id: string) => map.nodes.find((n) => n.id === id)!.location ?? '';
const order = ['', ...map.locations.map((l) => l.id)].filter((g) => map.nodes.some((n) => (n.location ?? '') === g));
const titleOf = (g: string) => (g === '' ? 'Prologue' : map.locations.find((l) => l.id === g)!.title);
const inner = map.edges.map((e, i) => ({ e, i })).filter(({ e }) => groupOf(e.from) === groupOf(e.to));
const cross = map.edges.map((e, i) => ({ e, i })).filter(({ e }) => groupOf(e.from) !== groupOf(e.to));

const LANE = 9;
const GUTTER = 24 + cross.length * LANE;
const PAD_TOP = 40, PAD = 16, GAP = 34;
interface Placed { g: string; x: number; y: number; w: number; h: number; laid: ElkNode }
const placed: Placed[] = [];
let y = 0;
for (const g of order) {
  const graph: ElkNode = {
    id: `group:${g}`,
    layoutOptions: {
      'elk.algorithm': 'layered', 'elk.direction': 'DOWN',
      'elk.layered.spacing.nodeNodeBetweenLayers': '44', 'elk.spacing.nodeNode': '20', 'elk.spacing.edgeLabel': '3',
      'elk.padding': `[top=${PAD_TOP},left=${PAD},bottom=${PAD},right=${PAD}]`,
    },
    children: map.nodes.filter((n) => (n.location ?? '') === g).map(leaf),
    edges: inner.filter(({ e }) => groupOf(e.from) === g).map(({ e, i }) => {
      const t = edgeText(e);
      return { id: `e${i}`, sources: [e.from], targets: [e.to], ...(t ? { labels: [{ text: t, width: t.length * 6.2 + 6, height: 14 }] } : {}) };
    }),
  };
  const laid = (await elk.layout(graph as never)) as unknown as ElkNode;
  placed.push({ g, x: GUTTER, y, w: laid.width ?? 200, h: laid.height ?? 100, laid });
  y += (laid.height ?? 100) + GAP;
}

// Absolute position of every scene.
const pos = new Map<string, { x: number; y: number; w: number; h: number }>();
for (const p of placed) for (const c of p.laid.children ?? []) pos.set(c.id, { x: p.x + (c.x ?? 0), y: p.y + (c.y ?? 0), w: c.width ?? 0, h: c.height ?? 0 });

// --- Draw -----------------------------------------------------------------------
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const HEAD = 56 + Math.min(errors.length, 12) * 17;
const W = Math.max(GUTTER + Math.max(...placed.map((p) => p.w)) + 20, 900);
const H = y + HEAD + 30;
const out: string[] = [];
out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui, sans-serif">`);
out.push('<defs>' + Object.entries(EDGE).map(([k, v]) =>
  `<marker id="arrow-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${v.stroke}"/></marker>`).join('') + '</defs>');
out.push(`<rect width="${W}" height="${H}" fill="#1a1625"/>`);
out.push(`<text x="20" y="28" fill="#e8e4f0" font-size="18" font-weight="700">${esc(module.title)} — ${map.nodes.length} scenes, ${map.edges.length} ways between them</text>`);
out.push(errors.length === 0
  ? '<text x="20" y="48" fill="#6ee7a0" font-size="13">✓ the validator is happy: every state can still reach a victory</text>'
  : `<text x="20" y="48" fill="#ff5a5a" font-size="13">✗ ${errors.length} problem(s)</text>`);
errors.slice(0, 12).forEach((e, i) => out.push(`<text x="20" y="${66 + i * 17}" fill="#ff8a7a" font-size="12">${esc(e.length > 180 ? `${e.slice(0, 179)}…` : e)}</text>`));
out.push(`<g transform="translate(0 ${HEAD})">`);

const line = (pts: string, kind: MapEdge['kind']) => {
  const st = EDGE[kind];
  return `<polyline points="${pts}" fill="none" stroke="${st.stroke}" stroke-width="1.6"${st.dash ? ` stroke-dasharray="${st.dash}"` : ''} marker-end="url(#arrow-${kind})" opacity="0.85"/>`;
};
const label = (x: number, yy: number, e: MapEdge, text: string) =>
  `<text x="${x}" y="${yy}" fill="${e.needs ? '#ffd166' : '#9a92b0'}" font-size="10.5">${esc(text)}</text>`;

for (const p of placed) {
  out.push(`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="12" fill="#ffffff06" stroke="#453d63" stroke-width="1.5"/>`);
  out.push(`<text x="${p.x + 14}" y="${p.y + 24}" fill="#cbc3e3" font-size="15" font-weight="700">${esc(titleOf(p.g))}</text>`);
  for (const e of p.laid.edges ?? []) {
    const me = map.edges[Number(e.id.slice(1))]!;
    for (const sct of e.sections ?? []) {
      out.push(line([sct.startPoint, ...(sct.bendPoints ?? []), sct.endPoint].map((q) => `${p.x + q.x},${p.y + q.y}`).join(' '), me.kind));
    }
    for (const l of e.labels ?? []) out.push(label(p.x + (l.x ?? 0) + 3, p.y + (l.y ?? 0) + 11, me, l.text));
  }
}
// Between locations: out of the left of one scene, along its own lane, into the left of the other.
cross.forEach(({ e }, k) => {
  const a = pos.get(e.from), b = pos.get(e.to);
  if (!a || !b) return;
  const lane = 18 + k * LANE;
  const ay = a.y + a.h / 2 + ((k % 3) - 1) * 5, by = b.y + b.h / 2 + ((k % 3) - 1) * 5;
  out.push(line(`${a.x},${ay} ${lane},${ay} ${lane},${by} ${b.x},${by}`, e.kind));
  const t = edgeText(e);
  if (t) out.push(label(a.x - Math.min(a.x - lane - 4, t.length * 6.2) , ay - 4, e, t.length * 6.2 > a.x - lane - 4 ? `${t.slice(0, Math.max(4, Math.floor((a.x - lane - 4) / 6.2) - 1))}…` : t));
});
for (const n of map.nodes) {
  const p = pos.get(n.id);
  if (!p) continue;
  const k = KIND[n.kind];
  const stroke = flagged.has(n.id) ? '#ff5a5a' : n.outcome === 'defeat' ? '#9a92b0' : k.stroke;
  out.push(`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="7" fill="${k.fill}" stroke="${stroke}" stroke-width="${flagged.has(n.id) ? 3.5 : 1.8}"/>`);
  out.push(`<text x="${p.x + 10}" y="${p.y + 19.5}" fill="#e8e4f0" font-size="12"${n.kind === 'explore' || n.kind === 'dungeon' || n.kind === 'ending' ? ' font-weight="700"' : ''}>${esc(nodeText(n))}</text>`);
}
out.push('</g>');
out.push(`<text x="20" y="${H - 10}" fill="#9a92b0" font-size="11">green: pass / win · red dashed: fail / lose · blue: talked down · amber dashed: danger (ambush, camp, torch) · grey dotted: "already done" · gold label: needs something · ↩ leads back to its location · left lanes: ways between locations</text>`);
out.push('</svg>');

const file = arg('--out') ?? 'module-map.svg';
writeFileSync(file, out.join('\n'));
console.log(`${module.title}: ${map.nodes.length} scenes, ${map.edges.length} edges, ${errors.length} problem(s) — wrote ${file}`);
