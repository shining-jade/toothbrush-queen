# Administrator AR Skin Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the sole administrator sign in with a password, upload and calibrate PNG/WebP AR skins in Google Drive, activate them without redeploying, and expose active skins safely in the student AR picker.

**Architecture:** Shared Zod contracts define public skins and administrator requests. Apps Script owns password verification, short-lived admin sessions, Drive writes, and `Assets`/`Skins` sheet metadata; the Next.js administrator UI keeps only the issued token and sends calibrated values through the existing `text/plain` JSON client. Student screens merge valid active remote skins after the three bundled fallback skins and reuse one overlay-style calculation in both the administrator preview and live AR view.

**Tech Stack:** Next.js 16, React, TypeScript, Zod, Google Apps Script, Google Drive, Google Sheets, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-23-admin-skin-upload-design.md`

## Global Constraints

- Administrator access uses one password; do not add Google or school-account login.
- Store only salted password hashes in Script Properties and only admin-token hashes in CacheService for four hours.
- Accept decoded files no larger than 2 MiB and only static PNG or WebP; reject SVG, HTML, GIF, and mismatched signatures.
- Never log or persist the password, raw admin token, or uploaded Base64 body in Sheets or error responses.
- Store image bytes only in the dedicated Drive folder; Sheets store metadata and calibration values only.
- New skins default to disabled unless the administrator explicitly chooses `저장하고 활성화`.
- Do not delete skin metadata or Drive files from the UI; disabling preserves future reward references.
- Bundled cat, rabbit, and bear skins must remain usable when Drive or the remote catalog fails.
- This plan does not implement reward rules, student ownership, permanent crowns, or completion feedback.

## Review Focus

- A file whose extension/MIME says PNG but whose decoded signature is not PNG must be rejected before Drive receives bytes; pinned in Task 2.
- A valid token that expires between editing and saving must return `ADMIN_SESSION_EXPIRED` without losing non-file draft fields; pinned in Tasks 3 and 6.
- Drive creation followed by a sheet-write failure must trash the newly created orphan file; pinned in Task 4.
- Malformed or unreachable remote skins must not remove or block the three bundled student skins; pinned in Task 7.
- Concurrent double-clicks on upload/save must create one asset/skin and keep the submit controls locked until the request settles; pinned in Tasks 4 and 6.

---

### Task 1: Define public skin and administrator API contracts

**Files:**
- Modify: `src/shared/contracts.ts`
- Modify: `src/lib/api/apps-script-client.ts`
- Modify: `tests/shared/contracts.test.ts`
- Modify: `tests/lib/api/apps-script-client.test.ts`

**Interfaces:**
- Produces: `PublicSkin`, `AdminLoginInput`, `AdminLoginResult`, `AdminSkinDraft`, `AdminAssetUploadInput`, and response schemas.
- Produces: `AppsScriptClient.request(..., { adminToken })` alongside the existing `deviceToken` option.

- [ ] **Step 1: Write failing contract tests**

```ts
expect(PublicSkinSchema.parse({
  skinId: "skin-flower-1", name: "꽃님 사진관", imageUrl: "https://drive.google.com/uc?id=file-1",
  anchorX: 0, anchorY: -0.42, scale: 1.4, rotationOffset: 0, version: 1, sortOrder: 10,
})).toMatchObject({ skinId: "skin-flower-1", scale: 1.4 });
expect(() => AdminAssetUploadInputSchema.parse({
  name: "bad", fileName: "bad.svg", mimeType: "image/svg+xml", byteSize: 20, base64: "PHN2Zz4=",
})).toThrow();
expect(ApiRequestSchema.parse({ action: "admin.skin.list", auth: { adminToken: "a".repeat(32) }, payload: {} }))
  .toMatchObject({ auth: { adminToken: "a".repeat(32) } });
```

- [ ] **Step 2: Run the contracts and API client tests to verify RED**

Run: `pnpm test tests/shared/contracts.test.ts tests/lib/api/apps-script-client.test.ts`

Expected: FAIL because the schemas and `adminToken` request option do not exist.

- [ ] **Step 3: Add exact schemas and inferred types**

```ts
export const PublicSkinSchema = z.object({
  skinId: z.string().regex(/^skin-[a-z0-9-]{3,48}$/),
  name: z.string().trim().min(1).max(40),
  imageUrl: z.string().url().refine((url) => url.startsWith("https://")),
  anchorX: z.number().min(-1).max(1),
  anchorY: z.number().min(-1).max(1),
  scale: z.number().min(0.2).max(3),
  rotationOffset: z.number().min(-180).max(180),
  version: z.number().int().positive(),
  sortOrder: z.number().int().min(0).max(10_000),
}).strict();

export const AdminLoginInputSchema = z.object({ password: z.string().min(8).max(256) }).strict();
export const AdminLoginResultSchema = z.object({ adminToken: z.string().min(32), expiresAtMs: z.number().int() }).strict();
export const AdminAssetUploadInputSchema = z.object({
  name: z.string().trim().min(1).max(40), fileName: z.string().trim().min(1).max(120),
  mimeType: z.enum(["image/png", "image/webp"]), byteSize: z.number().int().positive().max(2 * 1024 * 1024),
  base64: z.string().min(4),
}).strict();
export const AdminSkinDraftSchema = z.object({
  assetId: z.string().min(1).max(64), name: z.string().trim().min(1).max(40),
  anchorX: z.number().min(-1).max(1), anchorY: z.number().min(-1).max(1),
  scale: z.number().min(.2).max(3), rotationOffset: z.number().min(-180).max(180),
  enabled: z.boolean(), sortOrder: z.number().int().min(0).max(10_000),
}).strict();
```

Extend `ChallengeSchema` with `skins: z.array(PublicSkinSchema).max(100).optional()` so existing stored challenges remain compatible. Add `adminToken?: string` to `ApiRequestSchema.auth` and make `AppsScriptClient` emit either or both token fields without changing its safe error behavior.

- [ ] **Step 4: Run focused tests**

Run: `pnpm test tests/shared/contracts.test.ts tests/lib/api/apps-script-client.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/contracts.ts src/lib/api/apps-script-client.ts tests/shared/contracts.test.ts tests/lib/api/apps-script-client.test.ts
git commit -m "feat: define administrator skin contracts"
```

### Task 2: Validate uploaded image bytes and persist skin metadata

**Files:**
- Modify: `apps-script/src/schema.ts`
- Create: `apps-script/src/domain/image-upload.ts`
- Create: `apps-script/src/repositories/asset-repository.ts`
- Create: `apps-script/src/repositories/skin-repository.ts`
- Modify: `tests/apps-script/in-memory-sheet-gateway.ts`
- Create: `tests/apps-script/image-upload.test.ts`
- Create: `tests/apps-script/skin-repositories.test.ts`

**Interfaces:**
- Produces: `decodeAndValidateImage(input): ValidatedImage` with decoded bytes and canonical MIME.
- Produces: `AssetRepository` and `SkinRepository`; `SkinRepository.listEnabledPublic()` returns `PublicSkin[]`.
- Adds exact `Assets` and `Skins` sheet headers from the design spec.

- [ ] **Step 1: Write failing byte-validation and repository tests**

```ts
expect(decodeAndValidateImage({
  name: "cat", fileName: "cat.png", mimeType: "image/png", byteSize: 8,
  base64: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("base64"),
}, decode)).toMatchObject({ mimeType: "image/png" });
expect(() => decodeAndValidateImage({
  name: "fake", fileName: "fake.png", mimeType: "image/png", byteSize: 4,
  base64: Buffer.from("<svg").toString("base64"),
}, decode)).toThrow("INVALID_IMAGE_SIGNATURE");
expect(skins.listEnabledPublic()).toEqual([expect.objectContaining({ skinId: "skin-cat-1" })]);
```

- [ ] **Step 2: Run focused tests to verify RED**

Run: `pnpm test tests/apps-script/image-upload.test.ts tests/apps-script/skin-repositories.test.ts`

Expected: FAIL because validation, repositories, and tabs do not exist.

- [ ] **Step 3: Add signature validation and sheet mappings**

```ts
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const isWebP = (bytes: number[]) => ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP";
if (input.byteSize !== bytes.length || bytes.length > 2 * 1024 * 1024) throw new Error("INVALID_IMAGE_SIZE");
if (input.mimeType === "image/png" && !startsWith(bytes, PNG)) throw new Error("INVALID_IMAGE_SIGNATURE");
if (input.mimeType === "image/webp" && !isWebP(bytes)) throw new Error("INVALID_IMAGE_SIGNATURE");
```

Map `Assets` and `Skins` rows exactly as specified. Validate every stored calibration value through `PublicSkinSchema` before exposing it publicly; invalid rows are omitted from `listEnabledPublic()` rather than breaking the complete catalog.

- [ ] **Step 4: Run focused tests and the Apps Script build**

Run: `pnpm test tests/apps-script/image-upload.test.ts tests/apps-script/skin-repositories.test.ts && pnpm gas:build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps-script/src/schema.ts apps-script/src/domain/image-upload.ts apps-script/src/repositories/asset-repository.ts apps-script/src/repositories/skin-repository.ts tests/apps-script
git commit -m "feat: store validated AR skin metadata"
```

### Task 3: Implement password login, rate limiting, and four-hour admin sessions

**Files:**
- Create: `apps-script/src/domain/admin-auth-service.ts`
- Create: `apps-script/src/platform/admin-session-store.ts`
- Modify: `apps-script/src/platform/security.ts`
- Create: `tests/apps-script/admin-auth-service.test.ts`

**Interfaces:**
- Produces: `AdminAuthService.login(password): AdminLoginResult`.
- Produces: `AdminAuthService.requireSession(rawToken): void` throwing `ADMIN_SESSION_EXPIRED`.
- Consumes Script Properties `ADMIN_PASSWORD_SALT` and `ADMIN_PASSWORD_HASH`; cache entries live for `14_400` seconds.

- [ ] **Step 1: Write failing auth tests**

```ts
expect(auth.login("correct horse battery staple")).toMatchObject({ adminToken: expect.any(String) });
expect(cache.ttl).toBe(14_400);
expect(() => auth.login("wrong-password")).toThrow("ADMIN_LOGIN_FAILED");
for (let index = 0; index < 5; index += 1) attemptWrongPassword();
expect(() => auth.login("correct horse battery staple")).toThrow("ADMIN_LOGIN_RATE_LIMITED");
clock.advance(14_400_001);
expect(() => auth.requireSession(issuedToken)).toThrow("ADMIN_SESSION_EXPIRED");
```

- [ ] **Step 2: Run the test to verify RED**

Run: `pnpm test tests/apps-script/admin-auth-service.test.ts`

Expected: FAIL because the service and cache abstraction do not exist.

- [ ] **Step 3: Implement constant-time verification and hashed sessions**

```ts
const candidate = security.sha256(`${salt}:${password}`);
if (!security.safeEqual(candidate, configuredHash)) {
  limiter.recordFailure();
  throw new Error("ADMIN_LOGIN_FAILED");
}
const token = security.randomToken();
sessions.put(security.sha256(token), 14_400);
return { adminToken: token, expiresAtMs: nowMs() + 14_400_000 };
```

Add `safeEqual(left, right)` to the security provider. Implement CacheService adapters for the hashed session and a global single-admin failure counter limited to five failures per ten minutes. Successful login clears the failure counter. Error objects and return values never include the password or raw cached hash.

- [ ] **Step 4: Run focused tests and build**

Run: `pnpm test tests/apps-script/admin-auth-service.test.ts && pnpm gas:build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps-script/src/domain/admin-auth-service.ts apps-script/src/platform/admin-session-store.ts apps-script/src/platform/security.ts tests/apps-script/admin-auth-service.test.ts
git commit -m "feat: authenticate the sole administrator"
```

### Task 4: Add Drive upload and administrator skin API routes

**Files:**
- Create: `apps-script/src/platform/skin-file-store.ts`
- Create: `apps-script/src/domain/admin-skin-service.ts`
- Modify: `apps-script/src/router.ts`
- Modify: `tests/apps-script/router.test.ts`
- Create: `tests/apps-script/admin-skin-service.test.ts`

**Interfaces:**
- Produces routes: `admin.login`, `admin.session.get`, `admin.asset.upload`, `admin.skin.save`, `admin.skin.list`, `admin.skin.setEnabled`.
- Produces: `SkinFileStore.create(validatedImage): { driveFileId; publicUrl }` and `trash(driveFileId): void`.
- Consumes Script Property `SKIN_ASSET_FOLDER_ID`.

- [ ] **Step 1: Write failing service and router tests**

```ts
expect(router({ action: "admin.skin.list", auth: {}, payload: {} }))
  .toEqual({ ok: false, error: { code: "ADMIN_SESSION_EXPIRED", message: "관리자 로그인이 필요합니다." } });
expect(router({ action: "admin.login", payload: { password: "valid-password" } }))
  .toMatchObject({ ok: true, data: { adminToken: expect.any(String) } });
await expect(service.uploadAsset(adminToken, input)).rejects.toThrow("SHEET_WRITE_FAILED");
expect(fileStore.trash).toHaveBeenCalledWith("drive-file-1");
```

- [ ] **Step 2: Run tests to verify RED**

Run: `pnpm test tests/apps-script/admin-skin-service.test.ts tests/apps-script/router.test.ts`

Expected: FAIL because the service and routes are absent.

- [ ] **Step 3: Implement file storage, compensation, and routing**

```ts
uploadAsset(adminToken: string, input: AdminAssetUploadInput) {
  this.auth.requireSession(adminToken);
  const image = decodeAndValidateImage(input, this.decodeBase64);
  const file = this.files.create(image);
  try {
    return this.assets.insert({ ...file, name: input.name, mimeType: image.mimeType, byteSize: image.bytes.length });
  } catch (error) {
    this.files.trash(file.driveFileId);
    throw error;
  }
}
```

Use `LockService` around upload-and-save to prevent duplicate rows from simultaneous clicks. Map known admin errors explicitly in the router without echoing request data. Production Drive setup creates a blob, puts it in `SKIN_ASSET_FOLDER_ID`, sets link-view permission, and returns an HTTPS direct-view URL.

- [ ] **Step 4: Run focused tests, Apps Script build, and router regression tests**

Run: `pnpm test tests/apps-script/admin-skin-service.test.ts tests/apps-script/router.test.ts && pnpm gas:build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps-script/src/platform/skin-file-store.ts apps-script/src/domain/admin-skin-service.ts apps-script/src/router.ts tests/apps-script
git commit -m "feat: expose administrator skin APIs"
```

### Task 5: Build administrator token storage and login screen

**Files:**
- Create: `src/lib/admin/admin-session-store.ts`
- Create: `src/features/admin/admin-login-form.tsx`
- Create: `src/features/admin/admin.module.css`
- Create: `src/app/admin/page.tsx`
- Create: `tests/lib/admin/admin-session-store.test.ts`
- Create: `tests/features/admin/admin-login-form.test.tsx`

**Interfaces:**
- Produces: `AdminSessionStore.get()`, `set(session)`, and `clear()` backed by sessionStorage.
- Produces: login screen that navigates to `/admin/skins` only after a parsed `AdminLoginResult`.

- [ ] **Step 1: Write failing store and form tests**

```ts
fireEvent.change(screen.getByLabelText("관리자 비밀번호"), { target: { value: "wrong-password" } });
fireEvent.click(screen.getByRole("button", { name: "로그인" }));
expect(await screen.findByRole("alert")).toHaveTextContent("비밀번호를 확인해 주세요.");
expect(JSON.stringify(sessionStorage)).not.toContain("wrong-password");
```

- [ ] **Step 2: Run tests to verify RED**

Run: `pnpm test tests/lib/admin/admin-session-store.test.ts tests/features/admin/admin-login-form.test.tsx`

Expected: FAIL because the store and form do not exist.

- [ ] **Step 3: Implement session storage and accessible login UI**

```ts
async function submit() {
  if (submitting) return;
  setSubmitting(true);
  try {
    const session = await client.request("admin.login", { password }, AdminLoginResultSchema);
    store.set(session);
    router.push("/admin/skins");
  } catch (error) {
    setMessage(loginMessage(error));
  } finally {
    setSubmitting(false);
  }
}
```

Use `type="password"`, autocomplete `current-password`, a 44px minimum action, Korean error copy, and no password persistence. The page remains usable at 390px and desktop widths.

- [ ] **Step 4: Run focused tests, lint, and build**

Run: `pnpm test tests/lib/admin/admin-session-store.test.ts tests/features/admin/admin-login-form.test.tsx && pnpm lint && pnpm build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin src/features/admin src/app/admin tests/lib/admin tests/features/admin
git commit -m "feat: add administrator login screen"
```

### Task 6: Build upload, calibration preview, listing, and activation UI

**Files:**
- Create: `src/features/admin/skin-upload/file-validation.ts`
- Create: `src/features/admin/skin-upload/skin-calibration.ts`
- Create: `src/features/admin/skin-upload/skin-preview.tsx`
- Create: `src/features/admin/skin-upload/skin-editor.tsx`
- Create: `src/features/admin/skin-upload/skin-list.tsx`
- Create: `src/features/admin/skin-upload/skin-upload.module.css`
- Create: `src/app/admin/skins/page.tsx`
- Create: `tests/features/admin/skin-upload/file-validation.test.ts`
- Create: `tests/features/admin/skin-upload/skin-calibration.test.ts`
- Create: `tests/features/admin/skin-upload/skin-editor.test.tsx`

**Interfaces:**
- Produces: `validateAdminSkinFile(file): Promise<ValidatedBrowserFile>`.
- Produces: shared `skinOverlayStyle(pose, calibration)` consumed by preview and live AR in Task 7.
- Produces responsive editor with inactive-save and active-save operations.

- [ ] **Step 1: Write failing validation, geometry, and form tests**

```ts
await expect(validateAdminSkinFile(svgFile)).rejects.toThrow("지원하지 않는 파일 형식이에요.");
await expect(validateAdminSkinFile(fileOfSize(2 * 1024 * 1024 + 1))).rejects.toThrow("2MB");
expect(skinOverlayStyle({ centerX: .5, centerY: .3, width: .2, rotationDeg: 5 }, {
  anchorX: .1, anchorY: -.4, scale: 1.5, rotationOffset: 10,
})).toMatchObject({ left: "52%", top: "22%", width: "30%", transform: expect.stringContaining("15deg") });
fireEvent.dblClick(screen.getByRole("button", { name: "저장하고 활성화" }));
expect(upload).toHaveBeenCalledOnce();
```

- [ ] **Step 2: Run component tests to verify RED**

Run: `pnpm test tests/features/admin/skin-upload`

Expected: FAIL because editor modules do not exist.

- [ ] **Step 3: Implement validation, draft recovery, editor, and list**

```ts
const DEFAULT_CALIBRATION = { anchorX: 0, anchorY: -0.4, scale: 1.4, rotationOffset: 0 };
const sliders = [
  { key: "anchorX", label: "좌우 위치", min: -1, max: 1, step: .01 },
  { key: "anchorY", label: "상하 위치", min: -1, max: 1, step: .01 },
  { key: "scale", label: "크기", min: .2, max: 3, step: .01 },
  { key: "rotationOffset", label: "회전", min: -180, max: 180, step: 1 },
] as const;
```

Read files through `FileReader`, strip the data-URL prefix, and send exact `byteSize`. Render a CSS face guide with the same pose/calculation used by live AR. Save only name/calibration/enabled in sessionStorage; never save Base64. On `ADMIN_SESSION_EXPIRED`, preserve those fields, clear the token, and link back to `/admin` with `returnTo=/admin/skins`.

- [ ] **Step 4: Run focused tests, lint, and build**

Run: `pnpm test tests/features/admin/skin-upload && pnpm lint && pnpm build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/skin-upload src/app/admin/skins tests/features/admin/skin-upload
git commit -m "feat: add AR skin upload and calibration UI"
```

### Task 7: Merge active remote skins into the student AR experience

**Files:**
- Modify: `apps-script/src/router.ts`
- Modify: `src/features/ar-skins/skin-registry.ts`
- Modify: `src/features/ar-skins/skin-selector.tsx`
- Modify: `src/features/ar-skins/ar-camera-preview.tsx`
- Modify: `src/features/brushing-session/brushing-screen.tsx`
- Modify: `tests/apps-script/router.test.ts`
- Modify: `tests/features/ar-skins/skin-registry.test.ts`
- Modify: `tests/features/ar-skins/skin-selector.test.tsx`
- Modify: `tests/features/ar-skins/ar-camera-preview.test.tsx`
- Modify: `tests/features/brushing-session/brushing-screen.test.tsx`

**Interfaces:**
- Consumes: `Challenge.skins?: PublicSkin[]` and `skinOverlayStyle` from Task 6.
- Produces: a runtime `ArSkin` shape with arbitrary server `skinId` values and safe bundled fallbacks.

- [ ] **Step 1: Write failing catalog and fallback tests**

```ts
const catalog = mergeSkinCatalog([remoteFlowerSkin]);
expect(catalog.map((skin) => skin.id)).toEqual(["cat", "rabbit", "bear", "skin-flower-1"]);
render(<SkinSelector skins={catalog} value="skin-flower-1" onChange={onChange} />);
expect(screen.getByRole("radio", { name: "꽃님 사진관" })).toBeVisible();
fireEvent.error(screen.getByAltText("꽃님 사진관"));
expect(screen.getByRole("radio", { name: "냥냥 볼터치" })).toBeVisible();
```

- [ ] **Step 2: Run student component tests to verify RED**

Run: `pnpm test tests/features/ar-skins tests/features/brushing-session/brushing-screen.test.tsx tests/apps-script/router.test.ts`

Expected: FAIL because skins are still a static union and `challenge.get` omits remote skins.

- [ ] **Step 3: Generalize the registry and expose active skins**

```ts
export type ArSkin = {
  id: string; label: string; src: string;
  calibration: { anchorX: number; anchorY: number; scale: number; rotationOffset: number };
  bundled: boolean;
};
export function mergeSkinCatalog(remote: PublicSkin[] = []): ArSkin[] {
  return [...BASIC_SKINS, ...remote.map(toArSkin)];
}
```

Keep the crown override internal and automatic on the final day. For ordinary days, pass the merged catalog to `SkinSelector`; use a plain `<img>` with error removal for remote URLs so Next image-host configuration is unnecessary. `createProductionRouter().getChallenge()` includes `skins.listEnabledPublic()` but catches catalog read errors and returns `skins: []`, preserving the public challenge and bundled skins.

- [ ] **Step 4: Run focused tests and full unit suite**

Run: `pnpm test tests/features/ar-skins tests/features/brushing-session/brushing-screen.test.tsx tests/apps-script/router.test.ts && pnpm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps-script/src/router.ts src/features/ar-skins src/features/brushing-session/brushing-screen.tsx tests/apps-script/router.test.ts tests/features/ar-skins tests/features/brushing-session/brushing-screen.test.tsx
git commit -m "feat: show active uploaded skins to students"
```

### Task 8: Verify administrator-to-student browser journeys and deployment setup

**Files:**
- Modify: `e2e/fixtures/apps-script-mock.ts`
- Create: `e2e/fixtures/flower-skin.png`
- Create: `e2e/admin-skin-upload.spec.ts`
- Modify: `e2e/ar-brushing.spec.ts`
- Modify: `README.md`
- Modify: `docs/deployment/phase-1.md`

**Interfaces:**
- Consumes: all Tasks 1–7.
- Produces: deterministic upload/calibration/activation/student-selection browser coverage without storing real passwords or image Base64 in snapshots.

- [ ] **Step 1: Write failing browser journeys**

```ts
test("administrator uploads, calibrates, activates, and exposes a skin", async ({ page }) => {
  await mockAppsScript(page, { adminPassword: "test-admin-password" });
  await page.goto("/admin");
  await page.getByLabel("관리자 비밀번호").fill("test-admin-password");
  await page.getByRole("button", { name: "로그인" }).click();
  await page.setInputFiles('input[type="file"]', "e2e/fixtures/flower-skin.png");
  await page.getByLabel("스킨 이름").fill("꽃님 사진관");
  await page.getByLabel("크기").fill("1.5");
  await page.getByRole("button", { name: "저장하고 활성화" }).click();
  await expect(page.getByText("활성화됨")).toBeVisible();
  await openStudentBrushPage(page);
  await expect(page.getByRole("radio", { name: "꽃님 사진관" })).toBeVisible();
});
```

Add a session-expiry journey proving draft calibration is restored but the file input is empty after re-login. Add a 390×844 screenshot check and a desktop check for the two-column editor.

- [ ] **Step 2: Run E2E tests to verify RED**

Run: `pnpm test:e2e`

Expected: new administrator journeys FAIL until the fixture routes and UI integration are complete.

- [ ] **Step 3: Extend fixtures and document setup**

Add mock actions without retaining the uploaded Base64 after the request assertion. Document exact Script Properties:

```text
SPREADSHEET_ID=<Google Sheet ID>
SKIN_ASSET_FOLDER_ID=<dedicated public-link-readable Drive folder ID>
ADMIN_PASSWORD_SALT=<random salt>
ADMIN_PASSWORD_HASH=<SHA-256 of salt:password>
ATTEMPT_SIGNING_SECRET=<existing 32+ character secret>
```

Document `Assets` and `Skins` header rows and the fact that account policy must permit link-view Drive assets.

- [ ] **Step 4: Run privacy scan and complete verification**

Run:

```bash
rg -n "password|adminToken|base64" apps-script/src src --glob "*.ts" --glob "*.tsx"
pnpm verify
git diff --check
git status --short
```

Expected: references exist only in input/auth handling; no logging or Sheets row includes secrets or Base64. Lint, all Vitest suites, Apps Script build, Next production build, and all Playwright journeys pass.

- [ ] **Step 5: Commit**

```bash
git add e2e README.md docs/deployment/phase-1.md
git commit -m "test: verify administrator skin upload journey"
```

### Task 9: Final security review and handoff

**Files:**
- No new production files.

**Interfaces:**
- Consumes: complete administrator upload feature.
- Produces: verified detached-worktree handoff with setup requirements and preview evidence.

- [ ] **Step 1: Run the complete gate on the committed tree**

Run: `pnpm verify`

Expected: exit 0 with no lint, unit, build, or browser failures.

- [ ] **Step 2: Review the full feature diff**

Review from commit `f82b943` to the final implementation HEAD against the spec. Fix every Critical or Important issue with a failing regression test; record any deferred Minor issue.

- [ ] **Step 3: Confirm privacy and Git state**

Run:

```bash
rg -n "console\.|Logger\.|appendRow" apps-script/src src
git diff --check
git status --short
git log --oneline -10
```

Expected: no secret/file-body logging, no malformed diff, and a clean worktree with the planned commits.

- [ ] **Step 4: Report delivered behavior**

Report the administrator login/session behavior, accepted upload formats and size, Drive/Sheets setup, calibration controls, activation behavior, student fallback behavior, test counts, worktree path, commit IDs, and visual preview paths. State that reward rules, ownership, permanent crowns, and completion feedback remain separate follow-up work.
