# Teacher Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자 로그인 뒤 한 개의 활성 챌린지를 설정하고 학생 참여를 학년·반·상태별로 조회할 수 있는 교사 대시보드를 제공한다.

**Architecture:** Apps Script에 관리자 전용 집계·챌린지 저장 API를 추가하고 기존 Google Sheets 저장소를 확장한다. Next.js 교사 화면은 관리자 세션 토큰으로 데이터를 불러오며 요약 카드, 필터 표, 챌린지 설정, 참여 링크·QR을 한 페이지에 제공한다.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod, Google Apps Script, Google Sheets, Vitest, Testing Library, Playwright, `qrcode`

**Spec:** `docs/superpowers/specs/2026-09-23-brush-king-ar-challenge-design.md`

## Global Constraints

- 학생 Google 로그인은 사용하지 않고 관리자 비밀번호 세션만 사용한다.
- 학생 이름·학년·반·번호 외의 개인정보를 새로 저장하지 않는다.
- 카메라 영상·얼굴 이미지·랜드마크는 관리자 API에 포함하지 않는다.
- 한 개의 활성 챌린지를 편집하며 종료 기록은 읽기 전용으로 유지한다.
- 5일, 10일, 직접 설정 목표 일수와 1분, 3분, 학생 선택 시간 모드를 지원한다.
- 관리자 세션이 만료되면 `/admin?returnTo=/admin/dashboard`로 이동한다.

## Review Focus

- 완료 기록이 없는 학생은 `아직 기록 없음`으로 집계되고 오늘 미참여 수에도 포함되어야 한다.
- 오늘 완료와 완주가 동시에 참이면 완주 상태가 우선되어야 한다.
- 다른 챌린지의 학생·완료 기록이 선택 챌린지 집계에 섞이지 않아야 한다.
- 종료일이 시작일보다 빠르거나 목표 일수가 기간보다 크면 저장을 거부해야 한다.
- 관리자 세션 만료 시 입력을 서버로 보내지 않고 로그인 화면으로 돌아가야 한다.

---

### Task 1: 관리자 대시보드 집계 API

**Files:**
- Modify: `src/shared/contracts.ts`
- Modify: `apps-script/src/repositories/student-repository.ts`
- Modify: `apps-script/src/repositories/completion-repository.ts`
- Create: `apps-script/src/domain/admin-dashboard-service.ts`
- Modify: `apps-script/src/router.ts`
- Test: `tests/apps-script/admin-dashboard-service.test.ts`
- Test: `tests/apps-script/router.test.ts`

**Interfaces:**
- Consumes: 기존 `ChallengeRepository`, `StudentRepository`, `CompletionRepository`, `AdminAuthService.requireSession`.
- Produces: `AdminDashboardResult`, `AdminStudentSummary`, `admin.dashboard.get`.

- [ ] **Step 1: Write the failing domain and router tests**

```ts
expect(result.summary).toEqual({ totalStudents: 4, completedToday: 2, missingToday: 2, completedChallenge: 1 });
expect(result.students.map((row) => row.participationStatus)).toEqual([
  "completed", "completedToday", "missingToday", "noRecord",
]);
expect(router({ action: "admin.dashboard.get", auth: { adminToken: "valid" }, payload: { challengeId: "ABC123" } })).toMatchObject({ ok: true });
```

- [ ] **Step 2: Run tests and verify RED**

Run: `.\\node_modules\\.bin\\vitest.CMD run tests/apps-script/admin-dashboard-service.test.ts tests/apps-script/router.test.ts`

Expected: FAIL because `AdminDashboardService` and `admin.dashboard.get` do not exist.

- [ ] **Step 3: Implement contracts, repository list methods, service, and route**

```ts
export const AdminStudentSummarySchema = z.object({
  studentId: z.string(), grade: z.string(), classNo: z.string(), studentNo: z.string(), name: z.string(),
  acceptedDays: z.number().int().nonnegative(), targetDays: z.number().int().positive(),
  completedToday: z.boolean(), lastParticipationDate: z.string().date().nullable(),
  participationStatus: z.enum(["completed", "completedToday", "missingToday", "noRecord"]),
}).strict();
```

The service must filter all students and completions by `challengeId`, count distinct accepted participation dates, and use the challenge timezone for today's date.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `.\\node_modules\\.bin\\vitest.CMD run tests/apps-script/admin-dashboard-service.test.ts tests/apps-script/router.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/contracts.ts apps-script/src tests/apps-script
git commit -m "feat: add teacher participation dashboard api"
```

### Task 2: 활성 챌린지 설정 저장 API

**Files:**
- Modify: `src/shared/contracts.ts`
- Modify: `apps-script/src/repositories/challenge-repository.ts`
- Create: `apps-script/src/domain/admin-challenge-service.ts`
- Modify: `apps-script/src/router.ts`
- Test: `tests/apps-script/admin-challenge-service.test.ts`
- Test: `tests/apps-script/repositories.test.ts`

**Interfaces:**
- Consumes: `AdminAuthService.requireSession`, `ChallengeRepository.findById`.
- Produces: `AdminChallengeSaveInput`, `AdminChallengeService.save`, `admin.challenge.save`.

- [ ] **Step 1: Write failing update and validation tests**

```ts
expect(service.save("token", { challengeId: "ABC123", name: "10일 양치왕", startDate: "2026-10-01", endDate: "2026-10-14", targetDays: 10, durationMode: "choice" }).targetDays).toBe(10);
expect(() => service.save("token", { challengeId: "ABC123", name: "오류", startDate: "2026-10-10", endDate: "2026-10-01", targetDays: 5, durationMode: 60 })).toThrow("INVALID_CHALLENGE_PERIOD");
```

- [ ] **Step 2: Run tests and verify RED**

Run: `.\\node_modules\\.bin\\vitest.CMD run tests/apps-script/admin-challenge-service.test.ts tests/apps-script/repositories.test.ts`

Expected: FAIL because update and service do not exist.

- [ ] **Step 3: Implement repository update and authenticated save**

```ts
save(token: string, input: AdminChallengeSaveInput) {
  this.auth.requireSession(token);
  if (input.endDate < input.startDate) throw new Error("INVALID_CHALLENGE_PERIOD");
  const existing = this.challenges.findById(input.challengeId);
  if (!existing || existing.status !== "active") throw new Error("CHALLENGE_NOT_EDITABLE");
  return this.challenges.update({ ...existing, ...input, updatedAt: this.now().toISOString() });
}
```

- [ ] **Step 4: Run tests and verify GREEN**

Run: `.\\node_modules\\.bin\\vitest.CMD run tests/apps-script/admin-challenge-service.test.ts tests/apps-script/repositories.test.ts tests/apps-script/router.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/contracts.ts apps-script/src tests/apps-script
git commit -m "feat: add active challenge settings api"
```

### Task 3: 교사 대시보드 화면과 필터

**Files:**
- Create: `src/app/admin/dashboard/page.tsx`
- Create: `src/features/admin/dashboard/teacher-dashboard.tsx`
- Create: `src/features/admin/dashboard/dashboard-summary.tsx`
- Create: `src/features/admin/dashboard/student-participation-table.tsx`
- Create: `src/features/admin/dashboard/challenge-settings-form.tsx`
- Create: `src/features/admin/dashboard/teacher-dashboard.module.css`
- Test: `tests/features/admin/dashboard/teacher-dashboard.test.tsx`
- Test: `tests/features/admin/dashboard/student-participation-table.test.tsx`

**Interfaces:**
- Consumes: `AdminDashboardResultSchema`, `AdminChallengeSaveInputSchema`, `AdminSessionStore`, `AppsScriptClient`.
- Produces: `/admin/dashboard` with summaries, filters, settings form, loading/error states.

- [ ] **Step 1: Write failing component tests**

```tsx
expect(await screen.findByText("전체 학생 4명")).toBeVisible();
fireEvent.change(screen.getByLabelText("학년 필터"), { target: { value: "2" } });
fireEvent.change(screen.getByLabelText("반 필터"), { target: { value: "3" } });
expect(screen.getByText("김민지")).toBeVisible();
expect(screen.queryByText("이학생")).not.toBeInTheDocument();
fireEvent.click(screen.getByRole("button", { name: "10일" }));
expect(screen.getByLabelText("목표 일수")).toHaveValue(10);
```

- [ ] **Step 2: Run tests and verify RED**

Run: `.\\node_modules\\.bin\\vitest.CMD run tests/features/admin/dashboard`

Expected: FAIL because dashboard components do not exist.

- [ ] **Step 3: Implement loading, summary, filtering, and settings save**

The table exposes independent `학년 필터`, `반 필터`, `참여 상태 필터`, and `학생 검색` controls. The settings form exposes presets 5 and 10 plus numeric custom entry, start/end dates, and duration mode. Save replaces dashboard challenge data with the validated API response and shows `챌린지 설정을 저장했어요.`.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `.\\node_modules\\.bin\\vitest.CMD run tests/features/admin/dashboard`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/dashboard src/features/admin/dashboard tests/features/admin/dashboard
git commit -m "feat: build teacher operations dashboard"
```

### Task 4: 로그인 연결, QR, 운영 브라우저 흐름

**Files:**
- Modify: `src/features/admin/admin-login-form.tsx`
- Modify: `tests/features/admin/admin-login-form.test.tsx`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/features/admin/dashboard/challenge-qr.tsx`
- Test: `tests/features/admin/dashboard/challenge-qr.test.tsx`
- Create: `e2e/teacher-dashboard.spec.ts`
- Modify: `e2e/fixtures/apps-script-mock.ts`

**Interfaces:**
- Consumes: dashboard path and active challenge ID from Tasks 1–3.
- Produces: login redirect to dashboard, student URL/QR download, end-to-end teacher flow.

- [ ] **Step 1: Write failing redirect, QR, and browser tests**

```ts
expect(services.navigate).toHaveBeenCalledWith("/admin/dashboard");
expect(await screen.findByRole("img", { name: "학생 참여 QR 코드" })).toHaveAttribute("src", expect.stringContaining("data:image/png"));
await page.getByLabel("학년 필터").selectOption("2");
await expect(page.getByRole("row", { name: /2학년 3반 12번/ })).toBeVisible();
```

- [ ] **Step 2: Run tests and verify RED**

Run: `.\\node_modules\\.bin\\vitest.CMD run tests/features/admin/admin-login-form.test.tsx tests/features/admin/dashboard/challenge-qr.test.tsx`

Expected: FAIL because the redirect and QR do not exist.

- [ ] **Step 3: Install QR dependency and implement QR/download/navigation**

Run: `pnpm add qrcode && pnpm add -D @types/qrcode`

```tsx
const studentUrl = `${window.location.origin}/?challenge=${encodeURIComponent(challengeId)}`;
const dataUrl = await QRCode.toDataURL(studentUrl, { width: 320, margin: 2 });
```

The dashboard header links to `/admin/skins`. Expired sessions navigate to `/admin?returnTo=/admin/dashboard`; successful login honors a safe same-origin `returnTo` path and otherwise uses `/admin/dashboard`.

- [ ] **Step 4: Run unit and browser tests and verify GREEN**

Run: `.\\node_modules\\.bin\\vitest.CMD run tests/features/admin && .\\node_modules\\.bin\\playwright.CMD test e2e/teacher-dashboard.spec.ts`

Expected: PASS.

- [ ] **Step 5: Run full verification and commit**

Run: `pnpm verify`

Expected: lint has zero errors, all Vitest tests pass, Apps Script and Next builds pass, all Playwright tests pass.

```bash
git add src/features/admin package.json pnpm-lock.yaml tests/features/admin e2e
git commit -m "feat: connect teacher dashboard qr workflow"
```
