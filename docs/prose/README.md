# Module prose exports

Generated. Do not edit these by hand — edit `src/data/modules/*.ts` and re-run:

```
npm run prose -- --out docs/prose
```

## Why these exist

The readability test tells you which passages *fail* a mechanical check. These
tell you what the writing actually *reads like*, in scene order, the way a
player meets it — which is the thing a check can't measure. Reviewing prose by
scrolling TypeScript object literals is how "a hand-print, if hands came in
half-doors" survived three passes.

Each passage is annotated with its reading grade, and anything the checker
flags is marked ⚠ inline.

## Other uses

```
npm run prose                       # everything → stdout
npm run prose -- hollow-road        # one module
npm run prose -- --issues           # only passages the checker flags
```
