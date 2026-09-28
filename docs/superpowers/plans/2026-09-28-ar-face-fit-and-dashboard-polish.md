# AR Face Fit and Dashboard Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fit every bundled AR skin to the appropriate facial landmarks and polish the challenge preset and student dashboard layouts.

**Architecture:** Extend `FacePose` with face height, eye midpoint, and forehead coordinates, carry them through mirroring, smoothing, and cover mapping, then let bundled skins declare a `face`, `eyes`, or `forehead` placement mode. Keep uploaded skins on the legacy face-center behavior for compatibility. Make the two dashboard changes with focused component/style updates.

**Tech Stack:** Next.js, React, TypeScript, CSS Modules, Vitest, Testing Library, Playwright

**Spec:** `docs/superpowers/specs/2026-09-28-ar-face-fit-and-dashboard-polish.md`

## Global Constraints

- Preserve uploaded-skin calibration behavior.
- Preserve unrelated user files and changes.
- Follow test-first RED-GREEN cycles for every behavior change.
- Deploy to the existing Vercel project only after lint, unit tests, Apps Script build, Next build, and browser verification pass.

## Review Focus

- Missing or non-finite landmarks return no pose instead of emitting invalid CSS.
- Mirroring and cover mapping transform every added landmark consistently.
- Uploaded skins without placement metadata retain legacy positioning.
- Small phone widths do not overflow the six challenge presets.
- The attendance board/action gap applies only where the action follows the board.

---

### Task 1: Landmark-aware AR skin placement

**Files:**
- Modify: `src/features/ar-skins/face-pose.ts`
- Modify: `src/features/ar-skins/skin-registry.ts`
- Modify: `src/features/ar-skins/bounded-overlay.ts`
- Modify: `src/features/ar-skins/ar-camera-preview.tsx`
- Modify: `tests/features/ar-skins/face-pose.test.ts`
- Modify: `tests/features/ar-skins/bounded-overlay.test.ts`
- Modify: `tests/features/ar-skins/ar-camera-preview.test.tsx`
- Modify: `tests/features/ar-skins/skin-registry.test.ts`

**Interfaces:**
- Produces: `FacePose` geometry containing `height`, `eyeCenterX`, `eyeCenterY`, `foreheadX`, and `foreheadY`.
- Produces: optional `ArSkin.placement` with `face | eyes | forehead`; omitted means legacy placement.
- Produces: `boundedOverlayStyle(..., placement?)` that resolves the anchor from the selected placement mode.

- [ ] **Step 1: Write failing tests** proving landmark derivation, mirror/smooth/cover transforms, category metadata, eye/forehead anchoring, and legacy uploaded-skin positioning.
- [ ] **Step 2: Run `pnpm test -- tests/features/ar-skins`** and verify failures are caused by the missing geometry and placement behavior.
- [ ] **Step 3: Implement the minimal pose fields, transformations, placement metadata, calibrated bundled values, and runtime wiring.**
- [ ] **Step 4: Run `pnpm test -- tests/features/ar-skins`** and expect all AR skin tests to pass.
- [ ] **Step 5: Commit `feat: fit AR skins to face landmarks`.**

### Task 2: Six challenge duration presets

**Files:**
- Modify: `src/features/admin/dashboard/challenge-settings-form.tsx`
- Modify: `src/features/admin/dashboard/teacher-dashboard.module.css`
- Modify: `tests/features/admin/dashboard/teacher-dashboard.test.tsx`

**Interfaces:**
- Produces: preset actions for 5, 10, 15, 20, 25, and 30 days while retaining manual input.

- [ ] **Step 1: Write a failing dashboard test** that finds all six presets and verifies selecting 15 days recalculates the end date.
- [ ] **Step 2: Run `pnpm test -- tests/features/admin/dashboard/teacher-dashboard.test.tsx`** and verify the missing 15/25 presets fail.
- [ ] **Step 3: Add the six presets and responsive six-column/three-column styling.**
- [ ] **Step 4: Re-run the focused test** and expect it to pass.
- [ ] **Step 5: Commit `feat: add five-day challenge presets`.**

### Task 3: Student dashboard action spacing

**Files:**
- Modify: `src/features/challenge/student-dashboard.tsx`
- Modify: `src/app/page.module.css`
- Modify: `tests/features/challenge/student-dashboard.test.tsx`

**Interfaces:**
- Produces: a board/action layout container with an explicit 18px gap.

- [ ] **Step 1: Write a failing component test** that verifies the active action is grouped with the attendance board in a dedicated layout region.
- [ ] **Step 2: Run `pnpm test -- tests/features/challenge/student-dashboard.test.tsx`** and verify the missing region fails.
- [ ] **Step 3: Add the focused wrapper and CSS grid gap without changing completed/pre-start behavior.**
- [ ] **Step 4: Re-run the focused test** and expect it to pass.
- [ ] **Step 5: Commit `fix: separate attendance board action`.**

### Task 4: Whole-project verification and deployment

**Files:**
- Verify all modified files and deployment output.

**Interfaces:**
- Consumes: all three completed tasks.
- Produces: a verified production deployment on the existing Vercel project.

- [ ] **Step 1: Run `pnpm lint`, `pnpm test`, `pnpm gas:build`, and `pnpm build`; expect zero failures.**
- [ ] **Step 2: Run the relevant Playwright/browser checks at phone width and inspect AR preview/preset/action layout.**
- [ ] **Step 3: Review the complete diff against the spec and record any rulings or deferred minor findings.**
- [ ] **Step 4: Merge the verified work into `main`, push, and deploy to the existing Vercel project.**
- [ ] **Step 5: Verify the stable production URL serves the updated application.**

