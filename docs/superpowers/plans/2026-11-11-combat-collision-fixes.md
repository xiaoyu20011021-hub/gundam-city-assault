# Combat collision fixes implementation plan

**Goal:** Fix the four reproduced defects approved by the user: invisible building corners, third-person muzzle clipping, simultaneous lethal damage, and high-altitude funnels.

**Architecture:** Keep the spatial index and rectangular broad phase. Add optional normalized convex footprints for SELENE solids and use them in projectile, movement, camera, AI and remote navigation queries. Use the actor's safe chest position when its gun penetrates cover. Resolve player defeat after all damage in a simulation step. Give the remote runtime a flight envelope containing full-height actors and their equipment while preserving the standalone navigator's default bounds.

**Tech Stack:** TypeScript, Three.js, Vitest, Vite.

- [x] Add regressions comparing actual building mesh rays to collision rays, retaining solid-wall hits and testing movement/remote clearance at clipped corners. Reproduce blocked third-person fire with the real actor and city collider. Run new tests and confirm expected failures.
- [x] Implement optional footprint geometry in `maps/types.ts`, SELENE collider generation and shared `gameplay/collider-shape.ts`; integrate with combat, spatial movement and navigation. Match octagon and chamfer geometry, including landmark foundations.
- [x] Guard third-person muzzle positions using a safe actor origin, and verify a real wall still blocks bullets. Cover all playable ranged weapons.
- [x] Test both projectile insertion orders through `Game.simulation`; finalize defeat at the end of the step and count both actors' damage consistently.
- [x] Test funnel launch, shots and docking at 96 and 100 world units; supply a larger vertical envelope from the runtime, preserving ordinary navigator limits and building obstruction checks.
- [x] Run focused tests, full suite and production build. Obtain independent review of this task's changes against the saved pre-edit baseline, address findings and update validation notes.

The working tree contains existing user changes. Preserve them and compare this task against the saved baseline; do not create commits containing unrelated work.
