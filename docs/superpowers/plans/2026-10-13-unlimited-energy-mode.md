# 无限推进模式 Implementation Plan

> **For agentic workers:** Execute the tasks inline in order. Preserve unrelated working-tree changes. Do not add or run tests unless the user asks for verification.

**Goal:** Add a selectable unlimited-energy sortie mode where player and enemy mechs can fly, boost, and jump without spending energy, while preserving standard mode.

**Architecture:** Keep the selected sortie mode in `Game` and pass the rule through the existing shared movement path used by the player and AI. Add the choice to the sortie menu and show the active mode in the HUD; keep the selection for the current app session.

**Tech Stack:** TypeScript, Three.js, Vite.

---

### Task 1: Apply the energy rule consistently to player and enemy movement

**Files:**
- Modify: `src/gameplay/movement.ts`
- Modify: `src/gameplay/ai.ts`

- [x] Add optional `unlimitedEnergy?: boolean` to `MovementIntent`, defaulting to standard behavior when omitted. Use it to bypass the 20-energy flight start check and 8-energy takeoff cost; let boost activate at zero energy; skip flight, air boost, ground boost, and jump deductions; and allow jump below the usual 22-energy threshold. Keep movement physics, recharge behavior, collision handling, and all standard-mode branches unchanged.
- [x] Add an optional final `unlimitedEnergy = false` parameter to `stepEnemy`. In unlimited mode, do not start the AI recovery state from low energy, clear any stale recovery state, allow takeoff without the 60-energy AI threshold, and pass `unlimitedEnergy` into the enemy's `MovementIntent`. Preserve existing recovery, recharge, and threshold behavior in standard mode.
- [x] Review both movement paths to ensure the free mode changes only energy gates and deductions; speed, flight duration, combat, and collision rules remain shared.

### Task 2: Expose and retain the mode in the game flow and HUD

**Files:**
- Modify: `src/gameplay/game.ts`
- Modify: `src/ui/ui.ts`

- [x] Define `SortieMode = 'standard' | 'unlimited'` in the UI module and keep `selectedSortieMode: SortieMode = 'standard'` in `Game`.
- [x] Handle `data-setting="sortie-mode"` in `Game.ui.onSetting`. Store the selection in both `Game` and `GameUI`, update the existing selector in place, and synchronize it in `showMenu` alongside the selected pilot. Do not reset it in `start`, `restart`, or `menu` actions.
- [x] Add a mode `<select>` beside the pilot selector in the preparation menu. Its options are “标准模式” and “无限推进（飞行、冲刺、跳跃不耗能）”; render the current selection and reuse the existing pilot selector styling.
- [x] Pass the selected mode to the player's `MovementIntent`, to every `stepEnemy` call, and into `HudState` from `updateHud`.
- [x] Give the flight-system label an element ID. In `GameUI.update`, show the active mode and a clear free-movement hint for unlimited mode; continue showing the actual energy meter. Suppress low-energy flight hints in unlimited mode while leaving standard-mode hints unchanged.
- [x] Keep the first-run default as standard mode. Mode retention is session-only, matching the existing in-memory pilot selection; do not add it to persisted quality/audio preferences.

### Task 3: Document the player-facing mode

**Files:**
- Modify: `README.md`

- [x] Add a short section after the current energy rules explaining how to choose the new mode, that it applies to the player and enemies, that flight/boost/jump are free in that mode, and that standard rules remain unchanged.
- [x] Review the final source diff and working-tree status to ensure no unrelated pre-existing edits were staged, overwritten, or incorporated.

### Validation constraints

No tests or runtime verification commands are included in this plan unless the user asks to test or verify the implementation.
