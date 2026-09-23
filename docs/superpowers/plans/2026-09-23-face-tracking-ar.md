# Face Tracking AR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three student-selectable animal AR skins, an automatic final-day crown, on-device MediaPipe face tracking, measured face-presence time, and a free brushing stopwatch alongside the existing one- and three-minute countdowns.

**Architecture:** Keep MediaPipe behind a client-only `FaceTracker` interface and translate its landmarks into a small `FacePose` value before React sees them. Extend the existing timer and signed attempt contracts with a `free` mode, then compose progress preflight, skin selection, camera preview, tracking status, and completion submission inside the existing brushing feature. All model, WASM, and skin files ship locally under `public`; no frame or landmark data leaves the browser.

**Tech Stack:** Next.js 16, React, TypeScript, Zod, `@mediapipe/tasks-vision@1.0.1`, Vitest, Testing Library, Playwright, Google Apps Script, Google Sheets

**Spec:** `docs/superpowers/specs/2026-09-23-face-tracking-ar-design.md`

## Global Constraints

- Student camera video, photos, captures, and face-landmark coordinates must never be stored, logged, or sent to Apps Script.
- Fixed modes count down from 60 or 180 to 0; free mode counts up from 0, unlocks completion at 60 seconds, and caps at 300 seconds.
- `acceptedDays === targetDays - 1` forces the crown; other active days show the three selectable basic skins.
- Face loss never pauses the timer; background/hidden time remains excluded from timer and face-presence totals.
- Camera denial falls back to timer-only; MediaPipe failure keeps the camera and timer while disabling AR.
- MediaPipe inference is limited to at most 15fps and one face.
- Existing device-session, idempotent completion, and daily-stamp semantics must remain unchanged.

## Review Focus

- A free-mode completion at 59 seconds must be rejected, while 60 and 300 seconds are accepted and values over 300 are rejected; Task 2 pins all four boundaries.
- A hidden-tab or long stalled-frame gap must not inflate face-presence time; Task 4 caps frame deltas and tests visibility resets.
- A video element with no decoded dimensions must not be sent to MediaPipe; Task 5 tests the ready-state guard.
- A progress preflight failure must not request camera permission and must offer a deterministic retry; Task 6 tests this state.
- A model/WASM failure after camera success must keep the countdown usable and submit `faceDetectedSec: null`; Tasks 5 and 6 test the fallback and submitted payload.

---

### Task 1: Generalize the timer for fixed and free modes

**Files:**
- Create: `src/shared/brushing-mode.ts`
- Modify: `src/features/brushing-session/brushing-machine.ts`
- Modify: `tests/features/brushing-session/brushing-machine.test.ts`

**Interfaces:**
- Produces from `src/shared/brushing-mode.ts`: `BrushingMode = 60 | 180 | "free"`
- Produces: `BrushingTimerSnapshot = { elapsedSec: number; remainingSec: number | null; displaySec: number; ready: boolean; reachedLimit: boolean }`
- Produces: `createBrushingMachine({ mode, startedAtMs, hiddenMs? }).at(nowMs)`

- [ ] **Step 1: Write failing fixed/free timer tests**

```ts
it("counts fixed time down from the selected duration", () => {
  const machine = createBrushingMachine({ mode: 60, startedAtMs: 0 });
  expect(machine.at(0)).toMatchObject({ displaySec: 60, remainingSec: 60, state: "running" });
  expect(machine.at(60_000)).toMatchObject({ displaySec: 0, remainingSec: 0, state: "readyToSubmit" });
});

it("counts free brushing up and unlocks completion at 60 seconds", () => {
  const machine = createBrushingMachine({ mode: "free", startedAtMs: 0 });
  expect(machine.at(59_999)).toMatchObject({ displaySec: 59, ready: false, state: "running" });
  expect(machine.at(60_000)).toMatchObject({ displaySec: 60, ready: true, state: "readyToSubmit" });
  expect(machine.at(301_000)).toMatchObject({ displaySec: 300, reachedLimit: true });
});

it("excludes hidden time in free mode", () => {
  const machine = createBrushingMachine({ mode: "free", startedAtMs: 0, hiddenMs: 20_000 });
  expect(machine.at(70_000).elapsedSec).toBe(50);
});
```

- [ ] **Step 2: Run the timer test and verify RED**

Run: `pnpm test tests/features/brushing-session/brushing-machine.test.ts`

Expected: FAIL because `mode: "free"`, `displaySec`, and `reachedLimit` do not exist.

- [ ] **Step 3: Implement the generalized timer**

Create the shared type:

```ts
// src/shared/brushing-mode.ts
export type BrushingMode = 60 | 180 | "free";
```

```ts
import type { BrushingMode } from "@/shared/brushing-mode";

export function timerState(startedAtMs: number, nowMs: number, mode: BrushingMode, hiddenMs = 0) {
  const rawElapsedSec = Math.floor(Math.max(0, nowMs - startedAtMs - hiddenMs) / 1000);
  const elapsedSec = mode === "free" ? Math.min(300, rawElapsedSec) : Math.min(mode, rawElapsedSec);
  const remainingSec = mode === "free" ? null : mode - elapsedSec;
  const ready = mode === "free" ? elapsedSec >= 60 : elapsedSec >= mode;
  return {
    elapsedSec,
    remainingSec,
    displaySec: mode === "free" ? elapsedSec : remainingSec,
    ready,
    reachedLimit: mode === "free" && elapsedSec >= 300,
  };
}
```

Update `createBrushingMachine` to accept `mode`, carry `hiddenSec`, and return `readyToSubmit` from `snapshot.ready` while continuing to refresh elapsed time through 300 seconds.

- [ ] **Step 4: Run the timer tests and full unit suite**

Run: `pnpm test tests/features/brushing-session/brushing-machine.test.ts && pnpm test`

Expected: all tests PASS with no timer regressions.

- [ ] **Step 5: Commit**

```bash
git add src/shared/brushing-mode.ts src/features/brushing-session/brushing-machine.ts tests/features/brushing-session/brushing-machine.test.ts
git commit -m "feat: add free brushing timer mode"
```

### Task 2: Sign and validate free-mode attempts

**Files:**
- Modify: `src/shared/contracts.ts`
- Modify: `apps-script/src/domain/attempt-token.ts`
- Modify: `apps-script/src/domain/completion-service.ts`
- Modify: `apps-script/src/repositories/completion-repository.ts`
- Modify: `tests/shared/contracts.test.ts`
- Modify: `tests/apps-script/attempt-token.test.ts`
- Modify: `tests/apps-script/completion-service.test.ts`
- Modify: `tests/apps-script/repositories.test.ts`

**Interfaces:**
- Consumes: `BrushingMode` from `src/shared/brushing-mode.ts`
- Produces: `StartAttemptInput.selectedDurationSec: 60 | 180 | "free"`
- Produces: `StartAttemptResult.durationSec: 60 | 180 | "free"`
- Stores: `CompletionRow.selectedDurationSec: 60 | 180 | "free"` in the existing sheet column

- [ ] **Step 1: Write failing contract, token, repository, and eligibility tests**

```ts
expect(StartAttemptInputSchema.parse({ challengeId: "ABC123", selectedDurationSec: "free" }))
  .toEqual({ challengeId: "ABC123", selectedDurationSec: "free" });

const token = attempts.issue("stu-1", "ABC123", "free");
expect(attempts.verify(token).durationSec).toBe("free");

clock.advanceSeconds(59);
expect(() => service.submit({ ...input(token), elapsedSec: 59 }, "stu-1"))
  .toThrow("ATTEMPT_TOO_EARLY");

clock.advanceSeconds(1);
expect(service.submit({ ...input(token), elapsedSec: 60 }, "stu-1").newlyAccepted).toBe(true);

expect(() => service.submit({ ...input(secondFreeToken), elapsedSec: 301 }, "stu-1"))
  .toThrow("INVALID_FREE_DURATION");
```

Add a repository round-trip assertion that a stored `"free"` value remains `"free"` rather than becoming `NaN`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm test tests/shared/contracts.test.ts tests/apps-script/attempt-token.test.ts tests/apps-script/completion-service.test.ts tests/apps-script/repositories.test.ts`

Expected: FAIL because schemas, claims, service rules, and sheet decoding only accept 60 or 180.

- [ ] **Step 3: Extend the schemas, claims, and repository decoder**

```ts
import type { BrushingMode } from "./brushing-mode";

export const BrushingModeSchema = z.union([
  z.literal(60),
  z.literal(180),
  z.literal("free"),
]) satisfies z.ZodType<BrushingMode>;

const parseStoredMode = (value: unknown): 60 | 180 | "free" => {
  if (value === "free") return "free";
  const numeric = Number(value);
  if (numeric === 60 || numeric === 180) return numeric;
  throw new Error("INVALID_STORED_DURATION");
};
```

Use `BrushingModeSchema` in start request/result schemas. Update attempt claim validation and set free-mode expiry from the 300-second ceiling plus the existing 30-minute allowance.

- [ ] **Step 4: Enforce server eligibility rules**

```ts
const minimumSec = claims.durationSec === "free" ? 60 : claims.durationSec;
if (nowMs - claims.issuedAtMs < minimumSec * 1000 || input.elapsedSec < minimumSec) {
  throw new Error("ATTEMPT_TOO_EARLY");
}
if (claims.durationSec === "free" && input.elapsedSec > 300) {
  throw new Error("INVALID_FREE_DURATION");
}
```

Keep fixed challenge modes strict; allow `"free"` only when `challenge.durationMode === "choice"`.

- [ ] **Step 5: Run focused tests, Apps Script build, and the full unit suite**

Run: `pnpm test tests/shared/contracts.test.ts tests/apps-script/attempt-token.test.ts tests/apps-script/completion-service.test.ts tests/apps-script/repositories.test.ts && pnpm gas:build && pnpm test`

Expected: all commands PASS.

- [ ] **Step 6: Commit**

```bash
git add src/shared/contracts.ts apps-script/src/domain/attempt-token.ts apps-script/src/domain/completion-service.ts apps-script/src/repositories/completion-repository.ts tests/shared/contracts.test.ts tests/apps-script/attempt-token.test.ts tests/apps-script/completion-service.test.ts tests/apps-script/repositories.test.ts
git commit -m "feat: validate signed free brushing attempts"
```

### Task 3: Add the four AR skin assets and selection rules

**Files:**
- Create: `src/features/ar-skins/skin-registry.ts`
- Create: `src/features/ar-skins/skin-selector.tsx`
- Create: `src/features/ar-skins/skin-selector.module.css`
- Create: `tests/features/ar-skins/skin-registry.test.ts`
- Create: `tests/features/ar-skins/skin-selector.test.tsx`
- Create: `public/ar-skins/cat.png`
- Create: `public/ar-skins/rabbit.png`
- Create: `public/ar-skins/bear.png`
- Create: `public/ar-skins/crown.png`

**Interfaces:**
- Produces: `BasicSkinId = "cat" | "rabbit" | "bear"`
- Produces: `ArSkinId = BasicSkinId | "crown"`
- Produces: `resolveSessionSkin(selected: BasicSkinId, acceptedDays: number, targetDays: number): ArSkinId`
- Produces: `<SkinSelector value onChange />`

- [ ] **Step 1: Write failing registry and selector tests**

```ts
expect(BASIC_SKINS.map((skin) => skin.id)).toEqual(["cat", "rabbit", "bear"]);
expect(resolveSessionSkin("rabbit", 3, 5)).toBe("rabbit");
expect(resolveSessionSkin("rabbit", 4, 5)).toBe("crown");

render(<SkinSelector value="cat" onChange={onChange} />);
expect(screen.getAllByRole("radio")).toHaveLength(3);
fireEvent.click(screen.getByRole("radio", { name: "반짝 토끼" }));
expect(onChange).toHaveBeenCalledWith("rabbit");
```

Also assert that `acceptedDays >= targetDays` does not force a playable crown session; the surrounding challenge flow remains responsible for blocking completed challenges.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm test tests/features/ar-skins/skin-registry.test.ts tests/features/ar-skins/skin-selector.test.tsx`

Expected: FAIL because the registry and selector do not exist.

- [ ] **Step 3: Generate and inspect the skin assets**

Use the `imagegen` skill with one consistent prompt family: transparent-background, original cute photo-booth-style 2D accessories, no text/logo, symmetric head placement, generous transparent padding, and separate cat-ear/blush, rabbit-ear/sparkle, bear-ear/heart, crown/sparkle outputs. Inspect every PNG before copying it into `public/ar-skins`.

- [ ] **Step 4: Implement the typed registry and accessible selector**

```ts
export const AR_SKINS = {
  cat: { id: "cat", label: "냥냥 볼터치", src: "/ar-skins/cat.png", widthScale: 1.42, yOffset: -0.38 },
  rabbit: { id: "rabbit", label: "반짝 토끼", src: "/ar-skins/rabbit.png", widthScale: 1.5, yOffset: -0.55 },
  bear: { id: "bear", label: "하트 곰돌이", src: "/ar-skins/bear.png", widthScale: 1.4, yOffset: -0.36 },
  crown: { id: "crown", label: "양치왕 왕관", src: "/ar-skins/crown.png", widthScale: 1.28, yOffset: -0.5 },
} as const;

export function resolveSessionSkin(selected: BasicSkinId, acceptedDays: number, targetDays: number): ArSkinId {
  return acceptedDays === targetDays - 1 ? "crown" : selected;
}
```

Render the three basic skins as radio cards with image, Korean label, selected border, and at least 44px touch targets.

- [ ] **Step 5: Run focused tests and lint**

Run: `pnpm test tests/features/ar-skins/skin-registry.test.ts tests/features/ar-skins/skin-selector.test.tsx && pnpm lint`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/ar-skins tests/features/ar-skins public/ar-skins
git commit -m "feat: add selectable animal AR skins"
```

### Task 4: Convert landmarks to a stable pose and measure face presence

**Files:**
- Create: `src/features/ar-skins/face-pose.ts`
- Create: `src/features/ar-skins/face-presence-clock.ts`
- Create: `tests/features/ar-skins/face-pose.test.ts`
- Create: `tests/features/ar-skins/face-presence-clock.test.ts`

**Interfaces:**
- Consumes: only `{ x: number; y: number }[]`, not MediaPipe classes
- Produces: `FacePose = { centerX: number; centerY: number; width: number; rotationDeg: number }`
- Produces: `facePoseFromLandmarks(landmarks): FacePose | null`
- Produces: `smoothFacePose(previous, next, alpha): FacePose`
- Produces: `FacePresenceClock.update({ nowMs, visible, documentVisible }): void`
- Produces: `FacePresenceClock.seconds(elapsedSec): number`

- [ ] **Step 1: Write failing geometry and timing tests**

```ts
const pose = facePoseFromLandmarks(makeLandmarks({ leftEye: [0.3, 0.4], rightEye: [0.7, 0.5], forehead: [0.5, 0.2], leftEdge: [0.2, 0.5], rightEdge: [0.8, 0.5] }));
expect(pose).toMatchObject({ centerX: 0.5, width: 0.6 });
expect(pose?.rotationDeg).toBeCloseTo(14.04, 1);
expect(mirrorPose(pose!).centerX).toBe(0.5);
expect(mirrorPose({ ...pose!, centerX: 0.25 }).centerX).toBe(0.75);

const clock = new FacePresenceClock();
clock.update({ nowMs: 0, visible: true, documentVisible: true });
clock.update({ nowMs: 100, visible: true, documentVisible: true });
clock.update({ nowMs: 10_100, visible: true, documentVisible: true });
expect(clock.seconds(60)).toBeCloseTo(0.35, 2);
clock.update({ nowMs: 10_200, visible: true, documentVisible: false });
expect(clock.seconds(60)).toBeCloseTo(0.35, 2);
```

The 250ms per-update cap prevents stalled frames from adding a long gap.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm test tests/features/ar-skins/face-pose.test.ts tests/features/ar-skins/face-presence-clock.test.ts`

Expected: FAIL because pose and presence modules do not exist.

- [ ] **Step 3: Implement landmark extraction, mirroring, smoothing, and presence time**

Use indices 33 and 263 for eye direction, 10 for forehead, and 234 and 454 for face edges. Return `null` if any required landmark is missing or non-finite.

```ts
export function smoothFacePose(previous: FacePose | null, next: FacePose, alpha = 0.35): FacePose {
  if (!previous) return next;
  const mix = (from: number, to: number) => from + (to - from) * alpha;
  return {
    centerX: mix(previous.centerX, next.centerX),
    centerY: mix(previous.centerY, next.centerY),
    width: mix(previous.width, next.width),
    rotationDeg: mix(previous.rotationDeg, next.rotationDeg),
  };
}
```

The presence clock keeps only aggregate milliseconds, resets its baseline when the document is hidden, caps each visible delta at 250ms, and returns `Math.min(totalMs / 1000, elapsedSec)`.

- [ ] **Step 4: Run focused and full unit tests**

Run: `pnpm test tests/features/ar-skins/face-pose.test.ts tests/features/ar-skins/face-presence-clock.test.ts && pnpm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/ar-skins/face-pose.ts src/features/ar-skins/face-presence-clock.ts tests/features/ar-skins/face-pose.test.ts tests/features/ar-skins/face-presence-clock.test.ts
git commit -m "feat: calculate stable private face pose"
```

### Task 5: Add the local MediaPipe tracker adapter

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/lib/face-tracking/face-tracker.ts`
- Create: `src/lib/face-tracking/mediapipe-face-tracker.ts`
- Create: `tests/lib/face-tracking/mediapipe-face-tracker.test.ts`
- Create: `public/mediapipe/wasm/vision_wasm_internal.js`
- Create: `public/mediapipe/wasm/vision_wasm_internal.wasm`
- Create: `public/mediapipe/wasm/vision_wasm_nosimd_internal.js`
- Create: `public/mediapipe/wasm/vision_wasm_nosimd_internal.wasm`
- Create: `public/mediapipe/models/face_landmarker.task`

**Interfaces:**
- Produces: `FaceTracker.start(video, onResult): Promise<void>`
- Produces: `FaceTracker.stop(): void`
- Produces: `FaceTrackingResult = { pose: FacePose | null; detected: boolean; nowMs: number }`
- Produces: `createMediaPipeFaceTracker({ createLandmarker?, requestFrame?, cancelFrame?, now? })`

- [ ] **Step 1: Write failing adapter lifecycle and throttle tests**

```ts
it("does not infer before the video has decoded dimensions", async () => {
  const video = fakeVideo({ readyState: 1, videoWidth: 0, videoHeight: 0 });
  await tracker.start(video, onResult);
  runFrame(100);
  expect(detectForVideo).not.toHaveBeenCalled();
});

it("runs at no more than fifteen inferences per second", async () => {
  await tracker.start(fakeVideo({ readyState: 4, videoWidth: 640, videoHeight: 480 }), onResult);
  runFrame(0); runFrame(20); runFrame(67); runFrame(100);
  expect(detectForVideo).toHaveBeenCalledTimes(2);
});

it("cancels the frame and closes the landmarker", async () => {
  await tracker.start(video, onResult);
  tracker.stop();
  expect(cancelFrame).toHaveBeenCalledOnce();
  expect(close).toHaveBeenCalledOnce();
});
```

Add a rejection test proving model creation failure rejects `start()` without scheduling a frame.

- [ ] **Step 2: Run the adapter test and verify RED**

Run: `pnpm test tests/lib/face-tracking/mediapipe-face-tracker.test.ts`

Expected: FAIL because the adapter modules do not exist.

- [ ] **Step 3: Install and vendor exact runtime assets**

Run: `pnpm add @mediapipe/tasks-vision@1.0.1`

Copy the package's WASM runtime files into `public/mediapipe/wasm`. Download the official float16 Face Landmarker bundle from `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task` into `public/mediapipe/models/face_landmarker.task`. Record the downloaded file SHA-256 in a code comment beside the model path constant so unexpected model changes are visible in review.

- [ ] **Step 4: Implement lazy client-only creation and the 15fps loop**

```ts
const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
const landmarker = await FaceLandmarker.createFromOptions(vision, {
  baseOptions: { modelAssetPath: "/mediapipe/models/face_landmarker.task" },
  runningMode: "VIDEO",
  numFaces: 1,
  outputFaceBlendshapes: false,
  outputFacialTransformationMatrixes: false,
});
```

Skip frames less than 66ms after the last inference, skip undecoded video, call `detectForVideo(video, nowMs)`, convert only the first face through `facePoseFromLandmarks`, and never log results.

- [ ] **Step 5: Run focused tests, type-checking build, and lint**

Run: `pnpm test tests/lib/face-tracking/mediapipe-face-tracker.test.ts && pnpm lint && pnpm build`

Expected: PASS and the MediaPipe import must remain client-only.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/face-tracking tests/lib/face-tracking public/mediapipe
git commit -m "feat: add local MediaPipe face tracker"
```

### Task 6: Integrate progress preflight, skin choice, AR preview, and completion metrics

**Files:**
- Create: `src/features/ar-skins/ar-camera-preview.tsx`
- Create: `src/features/ar-skins/ar-camera-preview.module.css`
- Create: `tests/features/ar-skins/ar-camera-preview.test.tsx`
- Modify: `src/features/brushing-session/use-brushing-session.ts`
- Modify: `src/features/brushing-session/brushing-screen.tsx`
- Modify: `src/features/brushing-session/camera-preview.tsx`
- Modify: `src/app/brush/brush.module.css`
- Modify: `src/features/completion/completion-screen.tsx`
- Modify: `tests/features/brushing-session/brushing-screen.test.tsx`
- Modify: `tests/features/completion/completion-screen.test.tsx`

**Interfaces:**
- Consumes: `SkinSelector`, `resolveSessionSkin`, `FaceTracker`, generalized brushing machine
- Extends `BrushingScreenServices` with `getProgress(challengeId, deviceToken)` and `createFaceTracker()`
- Produces `onFaceDetectedSecChange(seconds: number | null)` from `ArCameraPreview`
- Submits aggregate `faceDetectedSec` and displays formatted `elapsedSec`

- [ ] **Step 1: Write failing AR preview tests**

```ts
render(<ArCameraPreview stream={stream} skinId="cat" tracker={tracker} onFaceDetectedSecChange={onTime} />);
await act(() => tracker.emit({ detected: false, pose: null, nowMs: 100 }));
expect(screen.getByText("얼굴이 화면에 보이도록 해주세요!")).toBeVisible();

await act(() => tracker.fail(new Error("model failed")));
expect(screen.getByText("AR 효과 없이 계속 진행해요.")).toBeVisible();
expect(screen.getByLabelText("내 얼굴 카메라 미리보기")).toBeVisible();
expect(onTime).toHaveBeenLastCalledWith(null);
```

Also verify that a valid pose sets the overlay's translate/width/rotate style and unmount calls `tracker.stop()`.

- [ ] **Step 2: Write failing brushing-flow and completion tests**

```ts
expect(screen.getByRole("button", { name: "자유 양치" })).toBeVisible();
fireEvent.click(screen.getByRole("button", { name: "60초" }));
expect(screen.getAllByRole("radio")).toHaveLength(3);

getProgress.mockRejectedValueOnce(new Error("offline"));
expect(await screen.findByRole("alert")).toHaveTextContent("진행 상황을 불러오지 못했어요.");
expect(camera.start).not.toHaveBeenCalled();
fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

getProgress.mockResolvedValue({ ...progress, acceptedDays: 4, targetDays: 5 });
expect(await screen.findByText("마지막 도전! 양치왕 왕관이 자동으로 적용돼요.")).toBeVisible();
expect(screen.queryAllByRole("radio")).toHaveLength(0);
```

Add a free-mode fake-timer assertion for `00:00 → 01:00`, button activation at 60 seconds, face time submission, and completion copy `총 1분 0초 동안 양치했어요.`.

- [ ] **Step 3: Run component tests and verify RED**

Run: `pnpm test tests/features/ar-skins/ar-camera-preview.test.tsx tests/features/brushing-session/brushing-screen.test.tsx tests/features/completion/completion-screen.test.tsx`

Expected: FAIL because preflight, selection, AR preview, free display, and elapsed copy are absent.

- [ ] **Step 4: Add the progress preflight and selection states**

Extend the hook state with `loadingProgress`, `progressError`, `choosingSkin`, and `explaining`. Fetch progress with the device token before camera permission. Preserve the selected mode and basic skin across retry. Resolve crown only after authoritative progress returns.

```ts
type Selection = { mode: BrushingMode; selectedSkin: BasicSkinId };
const activeSkin = resolveSessionSkin(selectedSkin, progress.acceptedDays, progress.targetDays);
```

For a fixed `Challenge.durationMode`, render only that mode; for `choice`, render 60초, 180초, 자유 양치.

- [ ] **Step 5: Render the AR preview and aggregate face time**

Mount `ArCameraPreview` only when a camera stream exists. Keep the video element even if tracking fails. Place the skin layer below countdown/buttons and use `pointer-events: none`. Format all timer displays with a shared `formatMinutesSeconds(seconds)` helper.

At completion, set:

```ts
setCompletionInput({
  challengeId: state.challengeId,
  attemptToken: state.attemptToken,
  idempotencyKey: crypto.randomUUID(),
  elapsedSec: state.elapsedSec,
  faceDetectedSec,
  cameraMode: state.cameraMode,
});
```

Add the formatted elapsed-time sentence to both the pre-submit completion card and the submitted success card, using the original input value after submission.

- [ ] **Step 6: Run component tests and full unit suite**

Run: `pnpm test tests/features/ar-skins/ar-camera-preview.test.tsx tests/features/brushing-session/brushing-screen.test.tsx tests/features/completion/completion-screen.test.tsx && pnpm test`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/ar-skins src/features/brushing-session src/features/completion/completion-screen.tsx src/app/brush/brush.module.css tests/features/ar-skins tests/features/brushing-session/brushing-screen.test.tsx tests/features/completion/completion-screen.test.tsx
git commit -m "feat: integrate face tracked AR brushing"
```

### Task 7: Cover mobile journeys and verify the complete feature

**Files:**
- Modify: `e2e/fixtures/apps-script-mock.ts`
- Modify: `e2e/student-mvp.spec.ts`
- Create: `e2e/ar-brushing.spec.ts`
- Modify: `README.md` if it documents setup commands

**Interfaces:**
- Consumes: complete browser flow from Tasks 1–6
- Produces: deterministic browser coverage for skin choice, crown override, free timer, and AR fallback

- [ ] **Step 1: Write failing browser journeys**

Add a fake camera stream and injectable fake tracker path for Playwright so no biometric fixture or real camera is required.

```ts
test("student chooses a skin and free brushing records measured time", async ({ page }) => {
  await mockAppsScript(page, { durationMode: "choice", acceptedDays: 2 });
  await joinStudent(page);
  await page.getByRole("link", { name: "오늘의 양치 도전하기" }).click();
  await page.getByRole("button", { name: "자유 양치" }).click();
  await page.getByRole("radio", { name: "반짝 토끼" }).click();
  await page.getByRole("button", { name: "이 스킨으로 시작하기" }).click();
  await page.clock.fastForward(60_000);
  await expect(page.getByText("01:00")).toBeVisible();
  await expect(page.getByRole("button", { name: "양치 완료 기록하기" })).toBeEnabled();
});

test("last challenge day forces the crown", async ({ page }) => {
  await mockAppsScript(page, { durationMode: "choice", acceptedDays: 4 });
  await openBrushPage(page);
  await page.getByRole("button", { name: "60초" }).click();
  await expect(page.getByText("마지막 도전! 양치왕 왕관이 자동으로 적용돼요.")).toBeVisible();
});
```

Keep the existing camera-denied journey and assert it still reaches completion without a canvas, download control, or AR error blocking the timer.

- [ ] **Step 2: Run E2E tests and verify RED**

Run: `pnpm test:e2e`

Expected: new journeys FAIL until fixtures expose choice mode and a deterministic tracker hook.

- [ ] **Step 3: Extend fixtures without production biometric test data**

Allow `mockAppsScript` to vary `durationMode` and accepted days, capture the completion request payload, and return matching start mode. Expose a development/test-only tracker factory through dependency injection in `BrushingScreenServices`; do not add window globals containing landmarks.

- [ ] **Step 4: Run the complete verification gate**

Run: `pnpm verify`

Expected: lint passes; all Vitest suites pass; Apps Script bundles; Next production build succeeds; all Playwright mobile journeys pass.

- [ ] **Step 5: Perform browser visual QA**

Run the app at a 390×844 viewport and inspect all four assets on a centered synthetic pose supplied by the injected tracker. Verify that the selected skin does not cover the countdown or completion button, the face-loss message remains readable, and 60/180/free labels fit without horizontal scrolling. Capture one normal animal-skin frame and one final-day crown frame for the user.

- [ ] **Step 6: Check privacy and repository state**

Run:

```bash
rg -n "faceLandmarks|landmarks|ImageData|toDataURL|captureStream" src apps-script
git diff --check
git status --short
```

Expected: landmark references exist only inside pose/tracker modules and tests; no image serialization or camera upload path exists; diff check is clean.

- [ ] **Step 7: Commit**

```bash
git add e2e README.md
git commit -m "test: verify mobile AR brushing journeys"
```

### Task 8: Final verification and handoff

**Files:**
- No new production files

**Interfaces:**
- Consumes: all prior commits
- Produces: verified detached-worktree handoff with browser previews

- [ ] **Step 1: Invoke the verification skill and rerun the full gate**

Use `superpowers:verification-before-completion`, then run `pnpm verify` from the worktree and read the complete output.

- [ ] **Step 2: Confirm the committed tree**

Run: `git status --short && git log --oneline -8`

Expected: empty status and a linear set of feature commits after `7db19b7`.

- [ ] **Step 3: Report exact delivered behavior**

Report the three basic skins, automatic last-day crown, fixed/free timer rules, face-loss behavior, privacy boundary, test counts, worktree path, commit IDs, and preview image paths. State that permanent crown ownership and administrator skin upload remain Phase 4 work.
