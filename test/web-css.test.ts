import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A layout class with no rule behind it is a silent failure. `.adv-stage` is
 * `flex: 1`, so if its parent has no styling the stage collapses to zero
 * height and the screen renders as a blank strip — which is exactly what a
 * typo'd root class (`adv-root` for `adventure`) did to the arena. Nothing
 * throws, nothing logs; the page is just empty.
 *
 * So: every class the web code names must exist in the stylesheet. Started as
 * a check on the `adv-*`/`arena-*` layout scaffolding, where a missing rule
 * costs the whole view; widened to everything after a sweep turned up four
 * more dead ones (`card-picker`, `choice-point`, `prepare-list`, `frozen`).
 * Those were harmless — each rode along on a styled primary class — but they
 * read as styling that isn't there.
 */
const WEB = new URL('../web/src/', import.meta.url).pathname;
const CSS = readFileSync(join(WEB, 'styles.css'), 'utf8');

function tsxFiles(): string[] {
  return readdirSync(WEB).filter((f) => f.endsWith('.tsx')).map((f) => join(WEB, f));
}

/** Class names out of `className="a b"` and `` className={`a ${x}`} `` alike. */
function classNamesIn(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    const body = m[1] ?? m[2] ?? '';
    // Drop interpolations — `${sel ? 'on' : ''}` is decided at runtime.
    for (const w of body.replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) {
      if (w) out.push(w);
    }
  }
  return out;
}

describe('web stylesheet coverage', () => {
  it('every class the code names has a rule', () => {
    const defined = new Set(
      [...CSS.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]!),
    );
    const missing = new Set<string>();
    for (const file of tsxFiles()) {
      for (const cls of classNamesIn(readFileSync(file, 'utf8'))) {
        // A trailing hyphen is the literal half of an interpolated name
        // (`fx-${kind}`), not a class anyone wrote a rule for.
        if (cls.endsWith('-')) continue;
        if (!defined.has(cls)) missing.add(cls);
      }
    }
    expect([...missing], `classes used but never styled: ${[...missing].join(', ')}`).toEqual([]);
  });
});
