#!/usr/bin/env bash
# Everything a change must pass before it merges, as fast as it goes:
#
#   npm run verify            # regenerate docs, load check, tests without the sims
#   npm run verify -- --sims  # the same, plus the balance sims (combat changes)
#
# The sims (vitest.config.ts SIM_TESTS) are 4 of the suite's 5 minutes, and
# the deploy skips them too: they run nightly (sims.yml). docs/balance.md
# replays the routes' fights, but from its cache (docs/balance-cache.json):
# only new fights, or all of them after a change to combat code or data.
set -euo pipefail
cd "$(dirname "$0")/.."
sims=0; [[ "${1:-}" == "--sims" ]] && sims=1
t0=$SECONDS
step() { printf '\n== %s (%ss)\n' "$1" $((SECONDS - t0)); }

step 'stories'
npm run -s stories >/dev/null

step 'docs and load check, in parallel'
pids=()
npm run -s atlas >/dev/null & pids+=($!)
( npm run -s transcripts >/dev/null && npm run -s balance >/dev/null ) & pids+=($!)
npm run -s reference >/dev/null & pids+=($!)
# Each adventure module imported on its own: an import cycle shows up only
# when the cycle's far end is the entry (the deploy once broke on one).
( ls src/adventure/*.ts | xargs -P 4 -I{} npx tsx -e "import('./{}').catch((e) => { console.error('{}', e.message); process.exit(1); })" ) & pids+=($!)
for p in "${pids[@]}"; do wait "$p"; done

step 'tests'
if (( sims )); then npx vitest run --reporter=dot; else SKIP_SIMS=1 npx vitest run --reporter=dot; fi
step "done"
