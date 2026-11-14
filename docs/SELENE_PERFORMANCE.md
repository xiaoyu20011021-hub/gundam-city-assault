# SELENE performance work — 2026-10-22

## Changes

- Static collider arrays now have a cached 16-unit spatial grid. Ray hits, body sweeps, rooftop support and remote-weapon visibility use nearby candidates, retaining exact narrow-phase tests. Map collider arrays must be replaced if geometry changes.
- Each remote unit retains a complete route. Complex searches yield across simulation steps; the default budget is 4096 search advances per step, at most 512 per unit, with a soft 0.25 ms per-unit time slice checked every 16 advances. Six funnels receive independent slices. A single geometric operation can exceed the soft limit; this is not a hard real-time guarantee.
- Search tries local building corners before expanding to the full map. Moving destinations retain valid intermediate routes; the final motion segment always checks the current destination. Invalid/blocked movement remains stationary rather than teleporting.
- Static architecture and facilities use 600-source-unit spatial instance batches. Moving traffic batches are unchanged.
- Peripheral terrain goes from 320×320 to 160×160 subdivisions (204,800 to 51,200 triangles). The 600 distant rocks use their existing low-detail geometry. Battle bounds, colliders, weapon statistics and six-funnel loadout are unchanged.

## Evidence

Pre-edit navigation, environment and batch source snapshots are in `.cache/performance-before/`. The isolated benchmark is `.cache/selene-performance.test.ts`, with raw results in `.cache/selene-navigation-benchmark.json`.

The benchmark repeats three fixed routes on the actual 1,384-collider SELENE map 60 times. Both versions return matching immediate movements. One measured run gave median 7.594 ms before / 0.235 ms after, and p95 37.383 / 3.818 ms. This measures a small navigation workload, not complete frame time; machine load and JIT warmup affect timing.

At the same menu camera `(13, 8.2, 201.8)`, medium quality, 1350×805 viewport, browser render counters changed from 1,234,578 triangles / 884 calls to 851,342 triangles / 1,082 calls. That is about 31% fewer submitted triangles but 22% more draw calls. Spatial batching trades calls for finer culling; it is not a demonstrated FPS improvement in every view. The observed browser remained around 4 FPS in the menu and 5 FPS in combat, so no stable-60-FPS claim is made.

The test browser's WebGL renderer was verified as `ANGLE (Microsoft, Microsoft Basic Render Driver (0x0000008C) Direct3D11 vs_5_0 ps_5_0, D3D11)`, vendor `Google Inc. (Microsoft)`. This software rendering backend makes the observed FPS unsuitable as evidence of normal hardware-accelerated performance. No browser or driver settings were changed.

Portable evidence is saved under `docs/validation/selene-performance/`: navigation timings, before/after menu counters, combat diagnostics and screenshot.

## Validation

- Spatial queries compared against brute-force bounds queries, including negative coordinates and spanning walls.
- Navigation regression tests cover thin walls, high walls, roof routes, sealed maps, moving docks, strict search-step budgets and six concurrent units.
- Independent code review reproduced and then verified the moving-goal fix: in a 600-step, ten-high-wall scenario, the moving-target case changed from staying at the initial position with 60 restarted plans to reaching the latest goal with one plan.
- Production TypeScript/Vite build passed.
- A concurrent run passed 181 / 183 assertions; two existing tests (`simulation` frame-rate-independent movement and `nu-game` lifecycle) exceeded the wall-clock timeout while the browser rendered continuously. After leaving the test game tab, both files passed (9 tests, 2.05 seconds total), without code changes.
- Final clean full run: `node node_modules/vitest/vitest.mjs run tests --maxWorkers=2 --pool=threads` — **34 files, 183 tests passed**, 9.38 seconds, using the default test timeout. `git diff --check` passed (only pre-existing line-ending warnings).
- Real browser input selected SELENE and the Nu Gundam, started pointer-locked combat and moved forward. At simulation time 42.2 seconds, six deployed funnels were moving with `blocked=false`, six projectiles were active and one enemy had been defeated. Screenshot and diagnostics were captured; this is a limited smoke test, not a complete playthrough.

## Remaining limits

Real gameplay FPS depends on hardware, GPU acceleration, resolution and current system load. The checks above establish geometry/query reductions and movement safety, not a universal FPS guarantee. Far scenery simplification may slightly change mountain silhouettes. Spatial batching may cost more on a draw-call-bound GPU/CPU combination.
