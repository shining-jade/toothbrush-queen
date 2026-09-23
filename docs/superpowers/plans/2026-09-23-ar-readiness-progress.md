# AR Readiness and Loading Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep AR skins fully inside every mobile camera viewport, show honest 0–100% loading progress, and start the timer after a permissive face-plus-toothbrush-like readiness check or an explicit skip.

**Architecture:** Extend the session state machine with progress-bearing loading states and a camera-only `preparing` state. Keep geometry and image-change analysis in pure modules so mobile edge cases can be unit-tested; the React preview only measures DOM/video inputs and renders guidance. No captured image leaves the browser.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, CSS Modules, MediaPipe face landmarks, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-23-ar-readiness-progress.md`

## Global Constraints

- Read the repository `AGENTS.md` and relevant Next 16 docs before editing client components.
- Preserve the existing always-available completion button and aggregate-only face time submission.
- Readiness is advisory: the user can always skip it, and timer-only camera fallback starts immediately.
- Do not upload or persist camera pixels.
- Use test-first RED→GREEN for every production behavior.

## Review Focus

- A narrow/tall 320px viewport with a rotated wide skin must keep all rotated bounds inside the stage.
- An image whose natural dimensions are unavailable must remain hidden until safe geometry is known.
- Loading failure and retry must reset progress instead of retaining 100%.
- Head movement alone must not satisfy the elongated-change heuristic; a thin changed region near the mouth should.
- Detector or canvas failure must leave the skip path usable and must not stop the camera/timer workflow.

---

### Task 1: Honest Loading Progress

**Files:**
- Modify: `src/components/loading-indicator.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/features/brushing-session/use-brushing-session.ts`
- Modify: `src/features/brushing-session/brushing-screen.tsx`
- Test: `tests/components/loading-indicator.test.tsx`
- Test: `tests/features/brushing-session/brushing-screen.test.tsx`

**Interfaces:**
- Produces: `LoadingIndicator({ label, progress?: number })`, loading states with `progress: number`.
- Consumes: existing challenge, progress, camera, and `brushing.start` promises.

- [ ] **Step 1: Write failing tests** proving the component exposes a progressbar with a clamped percentage and the screen shows 100% before leaving both loading flows.
- [ ] **Step 2: Run** `pnpm test -- tests/components/loading-indicator.test.tsx tests/features/brushing-session/brushing-screen.test.tsx`. **Expected:** FAIL because progress is not rendered or carried by state.
- [ ] **Step 3: Implement** progress semantics, staged async updates (10/45/80/100 for preflight; 10/55/90/100 for camera/start), a short abortable 100% hold, retry reset, and accessible CSS progress styling.
- [ ] **Step 4: Run the targeted command again. Expected:** PASS.
- [ ] **Step 5: Commit** `feat: show real loading progress`.

### Task 2: Viewport-Bounded AR Skin Geometry

**Files:**
- Create: `src/features/ar-skins/bounded-overlay.ts`
- Modify: `src/features/ar-skins/ar-camera-preview.tsx`
- Modify: `src/features/ar-skins/ar-camera-preview.module.css`
- Create: `tests/features/ar-skins/bounded-overlay.test.ts`
- Modify: `tests/features/ar-skins/ar-camera-preview.test.tsx`

**Interfaces:**
- Produces: `boundedOverlayStyle(pose, calibration, stageSize, imageSize, insetPx)` returning a safe `CSSProperties` result.
- Consumes: existing `FacePose`, `SkinCalibration`, measured stage dimensions, intrinsic image dimensions.

- [ ] **Step 1: Write failing pure geometry tests** for narrow portrait, rotation, extreme calibration position/scale, and invalid dimensions; add a component test for recomputation after resize/image load.
- [ ] **Step 2: Run** `pnpm test -- tests/features/ar-skins/bounded-overlay.test.ts tests/features/ar-skins/ar-camera-preview.test.tsx`. **Expected:** FAIL because the bounded geometry module and measured rendering do not exist.
- [ ] **Step 3: Implement** rotated AABB scaling/clamping with an 8px inset, hide-before-measure behavior, and `ResizeObserver` recalculation while retaining stage clipping as a final safeguard.
- [ ] **Step 4: Run the targeted command again. Expected:** PASS.
- [ ] **Step 5: Commit** `fix: keep ar skins inside mobile preview`.

### Task 3: Permissive Toothbrush Readiness Gate

**Files:**
- Create: `src/features/brushing-session/toothbrush-like-detector.ts`
- Modify: `src/features/ar-skins/ar-camera-preview.tsx`
- Modify: `src/features/ar-skins/ar-camera-preview.module.css`
- Modify: `src/features/brushing-session/use-brushing-session.ts`
- Modify: `src/features/brushing-session/brushing-screen.tsx`
- Create: `tests/features/brushing-session/toothbrush-like-detector.test.ts`
- Modify: `tests/features/ar-skins/ar-camera-preview.test.tsx`
- Modify: `tests/features/brushing-session/brushing-screen.test.tsx`

**Interfaces:**
- Produces: `ToothbrushLikeDetector.observe(video, facePose, nowMs)`, `reset()`, and `beginBrushing()` transition from `preparing` to `running`.
- Consumes: raw unmirrored face pose and video frames; Task 2 measured preview remains independent.

- [ ] **Step 1: Write failing detector tests** using literal synthetic pixel frames for a thin mouth-adjacent change, a broad head-motion change, persistence, reset, and unavailable canvas; write screen tests for waiting, detected start, skip, and timer-only immediate start.
- [ ] **Step 2: Run** `pnpm test -- tests/features/brushing-session/toothbrush-like-detector.test.ts tests/features/ar-skins/ar-camera-preview.test.tsx tests/features/brushing-session/brushing-screen.test.tsx`. **Expected:** FAIL because readiness interfaces and state are absent.
- [ ] **Step 3: Implement** local-only baseline differencing in a mouth-adjacent ROI, elongated-candidate filtering, 800ms persistence, camera `preparing` state and guidance, and `인식 없이 시작하기`; failures degrade to the skip path.
- [ ] **Step 4: Run the targeted command again. Expected:** PASS.
- [ ] **Step 5: Commit** `feat: add permissive toothbrush readiness`.

### Task 4: Full Verification and Mobile Flow

**Files:**
- Modify if required: `tests/e2e/student-flow.spec.ts`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified production build and mobile behavior.

- [ ] **Step 1: Add or update the mobile browser test** to cover progress UI, explicit readiness skip, timer start, and completion access.
- [ ] **Step 2: Run** `pnpm test:e2e`. **Expected:** PASS after any required test-first update.
- [ ] **Step 3: Run** `pnpm verify`. **Expected:** lint, all unit tests, Apps Script build, Next build, and all browser tests pass.
- [ ] **Step 4: Inspect at 320×568, 390×844, and 430×932, then commit** `test: verify mobile ar readiness flow` if the task changes tests.

