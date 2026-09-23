# Brush King Phase 1 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify a deployable mobile-first MVP where a student enters through a challenge QR, resumes by device token, runs a one- or three-minute camera timer, submits once, and reloads the saved result from Google Sheets.

**Architecture:** A Next.js App Router client renders the student flow and performs camera work locally. A feature-oriented API adapter sends simple `text/plain` JSON requests to a bundled Google Apps Script Web App; Apps Script owns identity resolution, signed attempt tokens, idempotent completion, and Sheets persistence. Shared Zod contracts define the boundary without exposing Google Sheets details to the UI.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS Modules, Zod, Vitest, Testing Library, Playwright, esbuild, Google Apps Script V8, Google Sheets, pnpm

**Spec:** `docs/superpowers/specs/2026-09-23-brush-king-ar-challenge-design.md`

## Global Constraints

- Phase 1 only: student entry, challenge lookup, device-token resume, duration selection, camera, timer, signed start, completion submission, duplicate prevention, Sheets storage, and progress restoration.
- Mobile portrait layout is primary; interactive controls provide an effective touch target of approximately 44px or larger.
- Student access requires no app installation and no Google login.
- Camera video, images, captures, face landmarks, and biometric feature data never enter API payloads, logs, local storage, or Sheets.
- Camera denial is not participation failure; the student may continue in timer-only mode.
- The browser stores only `challengeId`, the opaque device token, and a minimal pending completion envelope needed for retry.
- Apps Script, not the browser, decides participation date, daily allowance, completion acceptance, and saved progress.
- Challenge dates use the configured IANA time zone; the initial production challenge uses `Asia/Seoul`.
- Every completion carries one stable `idempotencyKey`; retrying the same key returns the original success without another row.
- Use `pnpm`; commit the generated lockfile and do not introduce MediaPipe, QR, admin, stamp animation, rewards, or skin dependencies in Phase 1.

## Review Focus

- Two rapid submissions for one attempt must create one completion row and return the same completion ID; Task 5 pins this with concurrent/idempotent service tests.
- A submission around midnight must use the challenge time zone and server clock, not a client-provided date; Task 5 tests the Seoul date boundary.
- Missing, malformed, expired, or revoked device tokens must return the student-entry state without crashing or leaking whether another student exists; Tasks 4 and 6 test this.
- Denied or unavailable camera access must keep the timer and submit flow usable with `cameraMode: "timer-only"`; Task 8 tests the fallback.
- If the server saves a completion but the response is lost, retrying the pending envelope must restore the original success and clear the outbox; Task 9 tests this end to end.

---

## File Map

### Web application

- `src/app/layout.tsx`: root metadata and mobile viewport.
- `src/app/globals.css`: global tokens, safe-area rules, and accessible base styles.
- `src/app/page.tsx`: challenge QR entry route.
- `src/app/brush/page.tsx`: duration choice, privacy notice, camera, and timer route.
- `src/app/completion/page.tsx`: submission and saved-result route.
- `src/features/student-session/`: student identity form, resume UI, session hook.
- `src/features/challenge/`: challenge query and student dashboard.
- `src/features/brushing-session/`: timer state machine, camera preview, signed attempt lifecycle.
- `src/features/completion/`: pending completion outbox and submit/retry UI.
- `src/lib/api/`: typed Apps Script client and error mapping.
- `src/lib/device-session/`: device token storage.
- `src/lib/camera/`: browser camera adapter and cleanup.
- `src/lib/config/`: validated public environment configuration.
- `src/shared/contracts.ts`: request/response schemas shared by web and Apps Script.

### Apps Script

- `apps-script/src/entry.ts`: global `doGet`/`doPost` entry points.
- `apps-script/src/router.ts`: action dispatch and response envelope.
- `apps-script/src/domain/`: student session and completion rules.
- `apps-script/src/repositories/`: challenge, student, session, and completion repositories.
- `apps-script/src/platform/`: Sheets, clock, token, signer, and lock adapters.
- `apps-script/src/schema.ts`: required tabs and exact column order.
- `apps-script/scripts/build.mjs`: esbuild bundle that exposes Apps Script globals.
- `apps-script/appsscript.json`: V8 runtime manifest and Asia/Seoul default time zone.

### Verification and operations

- `tests/`: shared contract, repository, service, and web feature tests.
- `e2e/student-mvp.spec.ts`: QR entry through saved progress restoration.
- `.env.example`: Apps Script URL and public app URL names only.
- `docs/deployment/phase-1.md`: Sheets, Apps Script, Next.js, and physical-device deployment checklist.

## Task 1: Establish the Web and Test Toolchain

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `eslint.config.mjs`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `playwright.config.ts`
- Create: `apps-script/scripts/build.mjs`
- Create: `apps-script/appsscript.json`
- Create: `apps-script/src/entry.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `src/lib/config/client-env.ts`
- Test: `tests/lib/config/client-env.test.ts`

**Interfaces:**
- Consumes: no application code.
- Produces: `getClientConfig(env?: Record<string, string | undefined>): { appsScriptUrl: string }` and working `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, `pnpm gas:build` commands.

- [ ] **Step 1: Create the package manifest and install only Phase 1 dependencies**

```json
{
  "name": "brush-king",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "gas:build": "node apps-script/scripts/build.mjs"
  },
  "dependencies": {
    "next": "latest",
    "react": "latest",
    "react-dom": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@eslint/eslintrc": "latest",
    "@playwright/test": "latest",
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "@types/google-apps-script": "latest",
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "@vitejs/plugin-react": "latest",
    "esbuild": "latest",
    "eslint": "latest",
    "eslint-config-next": "latest",
    "jsdom": "latest",
    "typescript": "latest",
    "vite-tsconfig-paths": "latest",
    "vitest": "latest"
  }
}
```

Run: `pnpm install`

Expected: `pnpm-lock.yaml` is created and installation exits with code 0.

- [ ] **Step 2: Write the failing environment validation test**

```ts
import { describe, expect, it } from "vitest";
import { getClientConfig } from "@/lib/config/client-env";

describe("getClientConfig", () => {
  it("rejects a missing Apps Script URL", () => {
    expect(() => getClientConfig({})).toThrow("NEXT_PUBLIC_APPS_SCRIPT_URL");
  });

  it("accepts an HTTPS Apps Script deployment URL", () => {
    expect(getClientConfig({
      NEXT_PUBLIC_APPS_SCRIPT_URL: "https://script.google.com/macros/s/example/exec",
    })).toEqual({ appsScriptUrl: "https://script.google.com/macros/s/example/exec" });
  });
});
```

- [ ] **Step 3: Run the focused test and verify the missing module failure**

Run: `pnpm vitest run tests/lib/config/client-env.test.ts`

Expected: FAIL because `src/lib/config/client-env.ts` does not exist.

- [ ] **Step 4: Add the configuration loader and baseline Next.js files**

```ts
// src/lib/config/client-env.ts
import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APPS_SCRIPT_URL: z.string().url().startsWith("https://"),
});

export function getClientConfig(env = process.env) {
  const parsed = clientEnvSchema.parse(env);
  return { appsScriptUrl: parsed.NEXT_PUBLIC_APPS_SCRIPT_URL };
}
```

Configure `@/*` to `src/*`, `jsdom` as the default Vitest environment, Testing Library setup, Chromium Playwright, and a mobile viewport project at 390×844. Make `/` render `양치왕` and an empty loading region without reading the environment during static build.

```js
// apps-script/scripts/build.mjs
import { build } from "esbuild";

await build({
  entryPoints: ["apps-script/src/entry.ts"],
  outfile: "apps-script/dist/Code.js",
  bundle: true,
  format: "iife",
  platform: "neutral",
  target: "es2020",
});
```

Create a minimal `entry.ts` that assigns `globalThis.doPost` and returns the strict `{ ok, data, error }` envelope; Task 4 replaces its stub route with the real router. Set `runtimeVersion` to `V8` in `appsscript.json`.

- [ ] **Step 5: Run baseline checks**

Run: `pnpm test && pnpm lint && pnpm build && pnpm gas:build`

Expected: tests, lint, and Next build pass; `gas:build` exits successfully after producing a minimal Apps Script entry bundle with global `doPost`.

- [ ] **Step 6: Commit the toolchain**

```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json next.config.ts eslint.config.mjs vitest.config.ts vitest.setup.ts playwright.config.ts src/app src/lib/config tests/lib/config apps-script
git commit -m "chore: scaffold brush king phase one"
```

## Task 2: Define Shared API Contracts

**Files:**
- Create: `src/shared/contracts.ts`
- Test: `tests/shared/contracts.test.ts`

**Interfaces:**
- Consumes: Zod from Task 1.
- Produces: `ApiRequestSchema`, `ApiResponseSchema`, `ChallengeSchema`, `StudentProgressSchema`, `JoinStudentInputSchema`, `StartAttemptInputSchema`, `SubmitCompletionInputSchema`, and their inferred TypeScript types.

- [ ] **Step 1: Write failing contract tests for valid and forbidden payloads**

```ts
import { describe, expect, it } from "vitest";
import { JoinStudentInputSchema, SubmitCompletionInputSchema } from "@/shared/contracts";

describe("API contracts", () => {
  it("normalizes student fields but preserves the display name", () => {
    const parsed = JoinStudentInputSchema.parse({
      challengeId: "ABC123", grade: "2", classNo: "3", studentNo: "12", name: " 김민지 ",
    });
    expect(parsed.name).toBe("김민지");
  });

  it("rejects camera and landmark data in completion payloads", () => {
    const result = SubmitCompletionInputSchema.safeParse({
      challengeId: "ABC123", attemptToken: "signed", idempotencyKey: crypto.randomUUID(),
      elapsedSec: 60, faceDetectedSec: null, cameraMode: "timer-only", image: "data:image/png;base64,...",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the contract tests to verify failure**

Run: `pnpm vitest run tests/shared/contracts.test.ts`

Expected: FAIL because the schemas do not exist.

- [ ] **Step 3: Implement strict Zod schemas and inferred types**

```ts
const baseCompletion = z.object({
  challengeId: z.string().regex(/^[A-Z0-9]{6,24}$/),
  attemptToken: z.string().min(20),
  idempotencyKey: z.string().uuid(),
  elapsedSec: z.number().int().min(0).max(3600),
  faceDetectedSec: z.number().min(0).max(3600).nullable(),
  cameraMode: z.enum(["camera", "timer-only"]),
}).strict();

export const SubmitCompletionInputSchema = baseCompletion;
export type SubmitCompletionInput = z.infer<typeof SubmitCompletionInputSchema>;
```

Define the challenge duration as `60 | 180 | "choice"`, return masked student display text separately from identity fields, and keep every schema `.strict()` so unexpected media fields fail validation.

- [ ] **Step 4: Run focused and full tests**

Run: `pnpm vitest run tests/shared/contracts.test.ts && pnpm test`

Expected: all tests pass.

- [ ] **Step 5: Commit the contracts**

```bash
git add src/shared/contracts.ts tests/shared/contracts.test.ts
git commit -m "feat: define phase one API contracts"
```

## Task 3: Build the Sheets Schema and Repository Boundary

**Files:**
- Create: `apps-script/src/schema.ts`
- Create: `apps-script/src/platform/sheet-gateway.ts`
- Create: `apps-script/src/platform/google-sheet-gateway.ts`
- Create: `apps-script/src/repositories/challenge-repository.ts`
- Create: `apps-script/src/repositories/student-repository.ts`
- Create: `apps-script/src/repositories/device-session-repository.ts`
- Create: `apps-script/src/repositories/completion-repository.ts`
- Create: `tests/apps-script/in-memory-sheet-gateway.ts`
- Test: `tests/apps-script/repositories.test.ts`

**Interfaces:**
- Consumes: shared contract types from Task 2.
- Produces: `SheetGateway`, `ChallengeRepository`, `StudentRepository`, `DeviceSessionRepository`, and `CompletionRepository` classes with `find`, `append`, and idempotency-specific methods used by Tasks 4 and 5.

- [ ] **Step 1: Write failing repository tests**

```ts
it("finds a student by normalized challenge identity", () => {
  const repo = new StudentRepository(memory);
  repo.insert({ studentId: "stu-1", challengeId: "ABC123", grade: "2", classNo: "3", studentNo: "12", name: "김민지" });
  expect(repo.findByIdentity("ABC123", "2", "3", "12", " 김민지 ")?.studentId).toBe("stu-1");
});

it("finds the original completion by idempotency key", () => {
  const repo = new CompletionRepository(memory);
  repo.insert(completionFixture({ completionId: "cmp-1", idempotencyKey: "key-1" }));
  expect(repo.findByIdempotencyKey("key-1")?.completionId).toBe("cmp-1");
});
```

- [ ] **Step 2: Run the repository tests to verify failure**

Run: `pnpm vitest run tests/apps-script/repositories.test.ts`

Expected: FAIL because repository classes do not exist.

- [ ] **Step 3: Implement exact tab schemas and the in-memory gateway**

```ts
export const SHEET_SCHEMAS = {
  Challenges: ["challengeId", "name", "startDate", "endDate", "targetDays", "timeZone", "durationMode", "dailyLimit", "status", "createdAt", "updatedAt"],
  Students: ["studentId", "challengeId", "grade", "classNo", "studentNo", "name", "createdAt", "updatedAt", "status"],
  DeviceSessions: ["tokenHash", "studentId", "challengeId", "createdAt", "expiresAt", "lastUsedAt", "revokedAt"],
  Completions: ["completionId", "idempotencyKey", "challengeId", "studentId", "participationDate", "attemptId", "attemptIndex", "selectedDurationSec", "elapsedSec", "faceDetectedSec", "cameraMode", "completed", "stampGranted", "createdAt"],
} as const;
```

The gateway exposes `readAll(tab)`, `append(tab, row)`, and `update(tab, rowIndex, row)`; repositories own column mapping and normalization.

- [ ] **Step 4: Implement the Google Sheets gateway and repositories**

Use `SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID"))`. Validate each header row against `SHEET_SCHEMAS` on first access and fail with `SHEET_SCHEMA_MISMATCH` rather than writing shifted columns.

```ts
export interface SheetGateway {
  readAll(tab: keyof typeof SHEET_SCHEMAS): unknown[][];
  append(tab: keyof typeof SHEET_SCHEMAS, row: unknown[]): number;
  update(tab: keyof typeof SHEET_SCHEMAS, rowIndex: number, row: unknown[]): void;
}
```

- [ ] **Step 5: Test repository behavior and schema mismatch**

Run: `pnpm vitest run tests/apps-script/repositories.test.ts`

Expected: normalized lookup, idempotency lookup, append/read round trip, and schema mismatch tests pass.

- [ ] **Step 6: Commit the persistence layer**

```bash
git add apps-script/src/schema.ts apps-script/src/platform apps-script/src/repositories tests/apps-script
git commit -m "feat: add sheets repository boundary"
```

## Task 4: Implement Student Join and Device-Token Resume

**Files:**
- Create: `apps-script/src/platform/security.ts`
- Create: `apps-script/src/domain/student-session-service.ts`
- Create: `apps-script/src/router.ts`
- Modify: `apps-script/src/entry.ts`
- Modify: `apps-script/scripts/build.mjs`
- Test: `tests/apps-script/student-session-service.test.ts`
- Test: `tests/apps-script/router.test.ts`

**Interfaces:**
- Consumes: `ChallengeRepository`, `StudentRepository`, `DeviceSessionRepository`, `CompletionRepository`, shared contracts, and `SheetGateway` from Tasks 2–3.
- Produces: `StudentSessionService.join(input): JoinStudentResult`, `StudentSessionService.resume(rawToken, challengeId): ResumeStudentResult`, `ProgressService.get(studentId, challengeId): StudentProgress`, `route(request): ApiResponse`, and global `doPost(event)`.

- [ ] **Step 1: Write failing join/resume tests including invalid tokens**

```ts
it("stores only a device-token hash and resumes with the raw token", () => {
  const result = service.join(joinFixture());
  expect(result.deviceToken).toHaveLength(64);
  expect(sessionRepo.all()[0].tokenHash).not.toBe(result.deviceToken);
  expect(service.resume(result.deviceToken, "ABC123").student.studentId).toBe(result.student.studentId);
});

it.each(["", "bad-token", "expired-token", "revoked-token"])("returns unauthenticated for %s", token => {
  expect(service.resume(token, "ABC123")).toEqual({ status: "unauthenticated" });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm vitest run tests/apps-script/student-session-service.test.ts tests/apps-script/router.test.ts`

Expected: FAIL because the service and router are absent.

- [ ] **Step 3: Implement token creation, hashing, masked display, and service logic**

```ts
export interface SecurityProvider {
  randomToken(): string;
  sha256(value: string): string;
}

export type ResumeStudentResult =
  | { status: "authenticated"; student: { studentId: string; displayName: string }; progress: StudentProgress }
  | { status: "unauthenticated" };
```

`join` resolves the normalized identity inside the challenge, inserts only when no match exists, revokes prior tokens for the same device/student pair when requested, hashes the new token, and returns the raw token once. `resume` uses a constant-shape unauthenticated response for all invalid-token classes.

- [ ] **Step 4: Implement strict router envelopes and Apps Script globals**

```ts
export type ApiResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
```

`doPost` parses `event.postData.contents` as `{ action, auth?: { deviceToken?: string }, payload }`, routes by `action`, and always returns JSON through `ContentService`. It must never include token values, student names, or request bodies in errors.

Route `challenge.get`, `student.join`, `session.resume`, and `progress.get`. `challenge.get` exposes only active public settings; `progress.get` requires a valid device token and computes accepted-day count from Completions rather than trusting a cached client value.

- [ ] **Step 5: Run service, router, build, and privacy assertions**

Run: `pnpm vitest run tests/apps-script/student-session-service.test.ts tests/apps-script/router.test.ts && pnpm gas:build`

Expected: tests pass and the bundle contains global `doPost` without ESM imports.

- [ ] **Step 6: Commit student sessions**

```bash
git add apps-script/src apps-script/scripts/build.mjs tests/apps-script
git commit -m "feat: add student device sessions"
```

## Task 5: Add Signed Attempts and Idempotent Completion

**Files:**
- Create: `apps-script/src/domain/attempt-token.ts`
- Create: `apps-script/src/domain/completion-service.ts`
- Create: `apps-script/src/platform/lock.ts`
- Modify: `apps-script/src/router.ts`
- Test: `tests/apps-script/attempt-token.test.ts`
- Test: `tests/apps-script/completion-service.test.ts`

**Interfaces:**
- Consumes: authenticated student session from Task 4 and repositories from Task 3.
- Produces: `AttemptTokenService.issue(studentId, challenge, durationSec): string`, `AttemptTokenService.verify(token): AttemptClaims`, `CompletionService.start(...)`, and `CompletionService.submit(...)`.

- [ ] **Step 1: Write failing attempt and completion tests**

```ts
it("rejects completion before the signed duration elapses", () => {
  const attemptToken = attempts.issue("stu-1", challengeFixture({ durationMode: 60 }), 60);
  clock.advanceSeconds(59);
  expect(() => completions.submit(submitFixture({ attemptToken }))).toThrowError("ATTEMPT_TOO_EARLY");
});

it("returns one completion for two submissions with the same idempotency key", () => {
  const input = submitFixture({ idempotencyKey: "97ab5a61-26eb-45fd-8fa2-5dc01fb1f5d6" });
  const first = completions.submit(input);
  const second = completions.submit(input);
  expect(second.completionId).toBe(first.completionId);
  expect(completionRepo.all()).toHaveLength(1);
});

it("uses Asia/Seoul when UTC is still the prior date", () => {
  clock.set("2026-09-23T15:05:00.000Z");
  const result = completions.submit(submitFixture());
  expect(result.participationDate).toBe("2026-09-24");
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `pnpm vitest run tests/apps-script/attempt-token.test.ts tests/apps-script/completion-service.test.ts`

Expected: FAIL because signed attempts and completion service do not exist.

- [ ] **Step 3: Implement HMAC-signed attempt claims**

```ts
export type AttemptClaims = {
  attemptId: string;
  studentId: string;
  challengeId: string;
  durationSec: 60 | 180;
  issuedAtMs: number;
  expiresAtMs: number;
};
```

Serialize claims as base64url JSON and sign them with `Utilities.computeHmacSha256Signature` using `ATTEMPT_SIGNING_SECRET` from Script Properties. Compare signatures without early exit. Set expiry to selected duration plus 30 minutes.

- [ ] **Step 4: Implement locked, idempotent completion**

Acquire the Apps Script script lock, recheck idempotency after acquiring it, derive `participationDate` with `Utilities.formatDate(serverNow, challenge.timeZone, "yyyy-MM-dd")`, count accepted rows for the student/date, and append only when below `dailyLimit`. Return the existing result for a repeated key.

Add authenticated router handlers for `brushing.start` and `completion.submit`. Validate both request bodies with the shared strict schemas before calling the domain services.

```ts
submit(input: SubmitCompletionInput, studentId: string): CompletionResult {
  return this.lock.runExclusive(() => {
    const prior = this.completions.findByIdempotencyKey(input.idempotencyKey);
    if (prior) return toCompletionResult(prior);
    const claims = this.attempts.verify(input.attemptToken);
    this.assertEligible(claims, studentId, input.elapsedSec);
    return this.recordAcceptedCompletion(claims, input);
  });
}
```

- [ ] **Step 5: Add review-focus tests for daily limit and simulated concurrent replay**

Add tests that run two service calls through a fake lock, verify one insert, reject a new key after the daily limit, and confirm no client `localDate` field exists in the accepted schema.

- [ ] **Step 6: Run the full Apps Script suite and bundle**

Run: `pnpm vitest run tests/apps-script && pnpm gas:build`

Expected: all Apps Script tests pass and the bundle builds.

- [ ] **Step 7: Commit attempt and completion logic**

```bash
git add apps-script/src tests/apps-script
git commit -m "feat: add idempotent brushing completion"
```

## Task 6: Build the Browser API and Device Session Adapters

**Files:**
- Create: `src/lib/api/apps-script-client.ts`
- Create: `src/lib/api/api-error.ts`
- Create: `src/lib/device-session/device-session-store.ts`
- Test: `tests/lib/api/apps-script-client.test.ts`
- Test: `tests/lib/device-session/device-session-store.test.ts`

**Interfaces:**
- Consumes: shared schemas from Task 2 and `getClientConfig` from Task 1.
- Produces: `AppsScriptClient.request<T>(action, payload, schema, options?: { deviceToken?: string }): Promise<T>`, `DeviceSessionStore.get(challengeId)`, `.set(challengeId, token)`, and `.clear(challengeId)`.

- [ ] **Step 1: Write failing HTTP and storage tests**

```ts
it("posts a simple text/plain request and validates the response", async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, data: challengeFixture() })));
  await client.request("challenge.get", { challengeId: "ABC123" }, ChallengeSchema);
  expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
  }));
});

it("stores no student name or progress", () => {
  store.set("ABC123", "opaque-token");
  expect(localStorage.getItem("brush-king:session:ABC123")).toBe("opaque-token");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm vitest run tests/lib/api tests/lib/device-session`

Expected: FAIL because client and store modules do not exist.

- [ ] **Step 3: Implement typed response validation and safe errors**

The client sends `{ action, auth: options?.deviceToken ? { deviceToken: options.deviceToken } : undefined, payload }`, parses the `{ ok, data, error }` envelope, validates `data` with the supplied schema, maps network failures to `NETWORK_UNAVAILABLE`, and never includes the request body in thrown messages.

```ts
async request<T>(action: string, payload: unknown, schema: z.ZodType<T>, options: { deviceToken?: string } = {}) {
  const response = await fetch(this.url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, auth: options.deviceToken ? { deviceToken: options.deviceToken } : undefined, payload }),
  });
  return parseApiEnvelope(await response.json(), schema);
}
```

- [ ] **Step 4: Implement challenge-scoped token storage**

Use the key `brush-king:session:${challengeId}`. Reject tokens shorter than 20 characters, clear malformed stored values, and make all calls safe when `window` is unavailable during server rendering.

```ts
const sessionKey = (challengeId: string) => `brush-king:session:${challengeId}`;

export const DeviceSessionStore = {
  get(challengeId: string) { return typeof window === "undefined" ? null : localStorage.getItem(sessionKey(challengeId)); },
  set(challengeId: string, token: string) { if (token.length < 20) throw new Error("INVALID_DEVICE_TOKEN"); localStorage.setItem(sessionKey(challengeId), token); },
  clear(challengeId: string) { localStorage.removeItem(sessionKey(challengeId)); },
};
```

- [ ] **Step 5: Add expired-token behavior**

Test that an `UNAUTHENTICATED` API result clears only the matching challenge token and returns control to the student-entry flow.

- [ ] **Step 6: Run tests and commit adapters**

Run: `pnpm vitest run tests/lib/api tests/lib/device-session && pnpm lint`

```bash
git add src/lib/api src/lib/device-session tests/lib/api tests/lib/device-session
git commit -m "feat: add browser API and device session adapters"
```

## Task 7: Implement QR Entry, Student Join, Resume, and Dashboard

**Files:**
- Create: `src/features/student-session/student-entry.tsx`
- Create: `src/features/student-session/use-student-session.ts`
- Create: `src/features/challenge/student-dashboard.tsx`
- Create: `src/features/challenge/challenge-state.ts`
- Modify: `src/app/page.tsx`
- Create: `src/app/page.module.css`
- Test: `tests/features/student-session/student-entry.test.tsx`
- Test: `tests/features/challenge/student-dashboard.test.tsx`

**Interfaces:**
- Consumes: `AppsScriptClient`, `DeviceSessionStore`, `Challenge`, and `StudentProgress` from Tasks 2 and 6.
- Produces: `useStudentSession(challengeId)` states `loading | needsIdentity | authenticated | error`, and `StudentDashboard` navigation to `/brush?challenge=...`.

- [ ] **Step 1: Write failing UI tests for resume and manual entry**

```tsx
it("resumes and offers a different-student action", async () => {
  render(<StudentEntry challengeId="ABC123" services={resumingServices} />);
  expect(await screen.findByText("2학년 3반 12번 김○○ 학생으로 계속하기")).toBeVisible();
  expect(screen.getByRole("button", { name: "다른 학생으로 참여하기" })).toBeVisible();
});

it("shows the four required fields when no valid token exists", async () => {
  render(<StudentEntry challengeId="ABC123" services={unauthenticatedServices} />);
  for (const label of ["학년", "반", "번호", "이름"]) expect(await screen.findByLabelText(label)).toBeVisible();
});
```

- [ ] **Step 2: Run feature tests to verify failure**

Run: `pnpm vitest run tests/features/student-session tests/features/challenge`

Expected: FAIL because the UI modules do not exist.

- [ ] **Step 3: Implement the session hook as an explicit state machine**

On mount, validate the challenge query, load challenge metadata, attempt resume when a token exists, and otherwise expose the identity form. `join` saves the returned token only after a validated success. `switchStudent` clears only the current challenge token.

```ts
type StudentSessionState =
  | { status: "loading" }
  | { status: "needsIdentity"; challenge: Challenge }
  | { status: "authenticated"; challenge: Challenge; progress: StudentProgress; deviceToken: string }
  | { status: "error"; code: string };
```

- [ ] **Step 4: Implement accessible mobile identity and dashboard UI**

Use native labels and inputs with `inputMode="numeric"` for grade, class, and number. Disable double submission while joining. The dashboard shows challenge name, accepted-day count, target days, next action, and a large `오늘의 양치 도전하기` link.

```tsx
<label>번호<input name="studentNo" inputMode="numeric" required /></label>
<button type="submit" disabled={state.status === "joining"}>챌린지 참여하기</button>
```

- [ ] **Step 5: Add invalid QR and challenge-window tests**

Test missing challenge IDs, inactive challenges, pre-start copy, ended challenge read-only progress, and names containing leading/trailing whitespace.

- [ ] **Step 6: Run tests, lint, and build**

Run: `pnpm vitest run tests/features/student-session tests/features/challenge && pnpm lint && pnpm build`

Expected: all pass and `/` builds without browser globals during server render.

- [ ] **Step 7: Commit the entry flow**

```bash
git add src/app src/features/student-session src/features/challenge tests/features
git commit -m "feat: add student join and resume flow"
```

## Task 8: Implement Camera Permission and the Brushing Timer

**Files:**
- Create: `src/lib/camera/camera-controller.ts`
- Create: `src/features/brushing-session/brushing-machine.ts`
- Create: `src/features/brushing-session/use-brushing-session.ts`
- Create: `src/features/brushing-session/camera-preview.tsx`
- Create: `src/features/brushing-session/brushing-screen.tsx`
- Create: `src/app/brush/page.tsx`
- Create: `src/app/brush/brush.module.css`
- Test: `tests/lib/camera/camera-controller.test.ts`
- Test: `tests/features/brushing-session/brushing-machine.test.ts`
- Test: `tests/features/brushing-session/brushing-screen.test.tsx`

**Interfaces:**
- Consumes: authenticated session and `brushing.start` API from Tasks 5–7.
- Produces: `CameraController.start(): Promise<{ mode: "camera" | "timer-only"; stream: MediaStream | null }>`, `.stop()`, and brushing states `choosing | explaining | requestingCamera | running | readyToSubmit`.

- [ ] **Step 1: Write failing timer transition and camera-denial tests**

```ts
it("does not become submittable before zero", () => {
  const machine = createBrushingMachine({ durationSec: 60, startedAtMs: 0 });
  expect(machine.at(59_999).state).toBe("running");
  expect(machine.at(60_000).state).toBe("readyToSubmit");
});

it("falls back to timer-only when permission is denied", async () => {
  mediaDevices.getUserMedia.mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
  await expect(controller.start()).resolves.toEqual({ mode: "timer-only", stream: null });
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `pnpm vitest run tests/lib/camera tests/features/brushing-session`

Expected: FAIL because the camera controller and state machine do not exist.

- [ ] **Step 3: Implement camera start/stop with guaranteed cleanup**

Request `{ video: { facingMode: "user" }, audio: false }`. Treat `NotAllowedError`, `NotFoundError`, and insecure/unavailable media devices as timer-only. `stop()` calls `stop()` on every current stream track and clears the stored stream.

```ts
async start() {
  try {
    this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
    return { mode: "camera" as const, stream: this.stream };
  } catch {
    return { mode: "timer-only" as const, stream: null };
  }
}
```

- [ ] **Step 4: Implement the monotonic timer state machine**

Use `performance.now()` deltas, not decrementing interval counts. Preserve `attemptToken`, `attemptId`, selected duration, elapsed active time, and `cameraMode`. The UI interval only causes repaint; readiness is derived from timestamps.

```ts
export function timerState(startedAtMs: number, nowMs: number, durationSec: 60 | 180) {
  const elapsedSec = Math.min(durationSec, Math.floor((nowMs - startedAtMs) / 1000));
  return { elapsedSec, remainingSec: durationSec - elapsedSec, ready: elapsedSec >= durationSec };
}
```

- [ ] **Step 5: Implement the privacy notice, duration choice, and camera screen**

Show the exact notice: `카메라는 AR 스킨 표시와 챌린지 진행을 위해 사용됩니다. 카메라 영상과 얼굴 이미지는 저장되지 않습니다.` Request permission only after the student confirms. Show a large countdown away from the central face area and keep completion disabled until ready.

```tsx
<p>카메라는 AR 스킨 표시와 챌린지 진행을 위해 사용됩니다. 카메라 영상과 얼굴 이미지는 저장되지 않습니다.</p>
<button type="button" onClick={requestCamera}>확인하고 시작하기</button>
```

- [ ] **Step 6: Add visibility, unmount, and timer-only tests**

Test that tracks stop on unmount, hidden-tab time is recorded separately, timer-only reaches submission, and the rendered DOM contains no canvas capture or download action.

- [ ] **Step 7: Run tests, lint, build, and commit**

Run: `pnpm vitest run tests/lib/camera tests/features/brushing-session && pnpm lint && pnpm build`

```bash
git add src/lib/camera src/features/brushing-session src/app/brush tests/lib/camera tests/features/brushing-session
git commit -m "feat: add camera brushing timer"
```

## Task 9: Add Durable Completion Submission and Retry

**Files:**
- Create: `src/features/completion/pending-completion-store.ts`
- Create: `src/features/completion/completion-service.ts`
- Create: `src/features/completion/completion-screen.tsx`
- Create: `src/app/completion/page.tsx`
- Create: `src/app/completion/completion.module.css`
- Test: `tests/features/completion/pending-completion-store.test.ts`
- Test: `tests/features/completion/completion-service.test.ts`
- Test: `tests/features/completion/completion-screen.test.tsx`

**Interfaces:**
- Consumes: `SubmitCompletionInput`, `AppsScriptClient`, authenticated device token, and `readyToSubmit` brushing snapshot.
- Produces: `PendingCompletionStore.save/load/clear`, `submitOrQueue(input): Promise<CompletionOutcome>`, and the completion page navigation back to the dashboard.

- [ ] **Step 1: Write failing lost-response and double-click tests**

```ts
it("reuses the same idempotency key after a lost response", async () => {
  api.submit.mockRejectedValueOnce(new Error("NETWORK_UNAVAILABLE"));
  await expect(service.submitOrQueue(input)).resolves.toMatchObject({ status: "pending" });
  api.submit.mockResolvedValueOnce(successResult);
  await service.retryPending();
  expect(api.submit.mock.calls[1][0].idempotencyKey).toBe(input.idempotencyKey);
  expect(store.load(input.challengeId)).toBeNull();
});

it("ignores a second submit click while the first is pending", async () => {
  render(<CompletionScreen services={deferredServices} />);
  await user.click(screen.getByRole("button", { name: "챌린지 완료하고 제출하기" }));
  expect(screen.getByRole("button", { name: "제출 중" })).toBeDisabled();
});
```

- [ ] **Step 2: Run completion tests and verify failure**

Run: `pnpm vitest run tests/features/completion`

Expected: FAIL because completion modules do not exist.

- [ ] **Step 3: Implement the minimal local outbox**

Store one strict `SubmitCompletionInput` under `brush-king:pending:${challengeId}`. Never store student name, progress, video, image, or landmarks. Clear malformed entries. A new completed session may replace an older pending envelope only after the UI warns and retries the older one.

```ts
const pendingKey = (challengeId: string) => `brush-king:pending:${challengeId}`;
save(input: SubmitCompletionInput) {
  localStorage.setItem(pendingKey(input.challengeId), JSON.stringify(SubmitCompletionInputSchema.parse(input)));
}
```

- [ ] **Step 4: Implement submit, retry, and success reconciliation**

Save before the first network call. On validated success, clear the outbox and refresh `progress.get`. On network failure, retain the envelope and show `기록 전송이 보류되었습니다` with a retry button. On `UNAUTHENTICATED`, keep the envelope, clear the session token, and route through identity recovery before retrying.

```ts
async submitOrQueue(input: SubmitCompletionInput) {
  this.store.save(input);
  try {
    const result = await this.api.submit(input);
    this.store.clear(input.challengeId);
    return { status: "submitted" as const, result };
  } catch (error) {
    if (isNetworkError(error)) return { status: "pending" as const };
    throw error;
  }
}
```

- [ ] **Step 5: Implement the success screen without Phase 2 animation**

Show `양치 완료!`, the server-confirmed accepted-day count, whether today was newly accepted or already recorded, and a return-to-home button. Do not add stamps, rewards, confetti packages, or skin UI in this phase.

```tsx
<h1>양치 완료!</h1>
<p>{result.acceptedDays} / {result.targetDays}일</p>
<Link href={`/?challenge=${result.challengeId}`}>홈으로 돌아가기</Link>
```

- [ ] **Step 6: Run completion tests and the full unit suite**

Run: `pnpm vitest run tests/features/completion && pnpm test`

Expected: lost-response retry, duplicate click, expired token recovery, malformed outbox, and success reconciliation all pass.

- [ ] **Step 7: Commit reliable completion**

```bash
git add src/features/completion src/app/completion tests/features/completion
git commit -m "feat: add durable completion submission"
```

## Task 10: Prove the MVP End to End and Document Deployment

**Files:**
- Create: `e2e/student-mvp.spec.ts`
- Create: `e2e/fixtures/apps-script-mock.ts`
- Create: `.env.example`
- Create: `docs/deployment/phase-1.md`
- Create: `README.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: all Phase 1 browser and Apps Script interfaces.
- Produces: repeatable browser acceptance coverage, a complete deploy checklist, and one `pnpm verify` command.

- [ ] **Step 1: Write the failing Playwright journey**

```ts
test("student joins, completes, and resumes progress", async ({ page }) => {
  await mockAppsScript(page, { challenge: fiveDayChallenge(), acceptedDays: 0 });
  await page.goto("/?challenge=ABC123");
  await page.getByLabel("학년").fill("2");
  await page.getByLabel("반").fill("3");
  await page.getByLabel("번호").fill("12");
  await page.getByLabel("이름").fill("김민지");
  await page.getByRole("button", { name: "챌린지 참여하기" }).click();
  await page.getByRole("link", { name: "오늘의 양치 도전하기" }).click();
  await page.getByRole("button", { name: "1분 양치" }).click();
  await page.clock.fastForward("01:00");
  await page.getByRole("button", { name: "챌린지 완료하고 제출하기" }).click();
  await expect(page.getByText("양치 완료!")).toBeVisible();
  await page.goto("/?challenge=ABC123");
  await expect(page.getByText("1 / 5일")).toBeVisible();
});
```

- [ ] **Step 2: Run the journey to expose missing test seams**

Run: `pnpm playwright test e2e/student-mvp.spec.ts`

Expected: FAIL until API routing, browser clock, and camera injection seams are wired for tests.

- [ ] **Step 3: Add deterministic E2E seams and the review-focus scenarios**

The mock intercepts only the configured Apps Script URL. Add cases for invalid QR, expired token, camera denial, server-saved/lost-response retry, and two rapid completion clicks. Never add production query flags that bypass the timer.

- [ ] **Step 4: Add deployment documentation with exact checks**

Document: create the four Phase 1 tabs with headers from `SHEET_SCHEMAS`; set `SPREADSHEET_ID` and `ATTEMPT_SIGNING_SECRET`; build and upload the Apps Script bundle; deploy as the owner with student access; set `NEXT_PUBLIC_APPS_SCRIPT_URL`; deploy Next.js over HTTPS; run iPhone Safari and Android Chrome camera-denial and normal-camera smoke tests; verify Sheets contains no media or landmark columns.

- [ ] **Step 5: Add one full verification command**

```json
{
  "scripts": {
    "verify": "pnpm lint && pnpm test && pnpm gas:build && pnpm build && pnpm test:e2e"
  }
}
```

- [ ] **Step 6: Run complete verification**

Run: `pnpm verify`

Expected: lint, unit/component tests, Apps Script bundle, production build, and Playwright pass with exit code 0.

- [ ] **Step 7: Inspect privacy-sensitive outputs**

Run: `rg -n "landmark|base64|data:image|videoBlob|faceImage" src apps-script/src .next/server docs/deployment/phase-1.md`

Expected: no runtime API payload, persistence, or log path contains prohibited data; explanatory privacy copy and tests may match.

- [ ] **Step 8: Commit the verified MVP plan endpoint**

```bash
git add e2e .env.example docs/deployment/phase-1.md README.md package.json
git commit -m "test: verify phase one student journey"
```

## Completion Gate

Phase 1 is complete only when all of the following are true:

- `pnpm verify` passes from a clean checkout.
- The Apps Script bundle deploys and creates/reads Phase 1 Sheets rows with the documented headers.
- A physical iPhone Safari and Android Chrome can complete the timer with camera allowed.
- Camera denial completes through timer-only mode.
- Retrying a lost completion response creates no duplicate row.
- Reopening the QR on the same phone restores the accepted-day count without asking for student information.
- Network and application logs contain no student name, raw token, image, video, or face-coordinate data.
