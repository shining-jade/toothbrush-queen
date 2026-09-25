import { expect, test, type Page } from "@playwright/test";

import { mockAppsScript } from "./fixtures/apps-script-mock";

async function login(page: Page) {
  await page.goto("/admin?returnTo=/admin/skins");
  await page.getByLabel("관리자 비밀번호").fill("test-admin-password");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByRole("heading", { name: "AR 스킨 관리" })).toBeVisible();
}

async function selectDraft(page: Page, filePath = "e2e/fixtures/flower-skin.png") {
  const fileInput = page.locator('input[type="file"]');
  await expect(fileInput).toBeEnabled();
  await fileInput.setInputFiles(filePath);
  await expect(page.getByAltText("업로드한 스킨 미리보기")).toBeVisible();
  await page.getByLabel("스킨 이름").fill("꽃님 사진관");
  await page.getByLabel("크기").fill("1.5");
}

test("administrator uploads, calibrates, activates, and exposes a skin", async ({ page }) => {
  await mockAppsScript(page, { adminPassword: "test-admin-password" });
  await page.clock.install({ time: new Date("2026-09-23T03:00:00Z") });
  await login(page);
  await selectDraft(page);
  await page.getByRole("button", { name: "저장하고 활성화" }).click();
  await expect(page.getByText("활성화됨")).toBeVisible();

  await page.goto("/?challenge=ABC123");
  await page.getByLabel("학년").fill("2");
  await page.getByLabel("반").fill("3");
  await page.getByLabel("번호").fill("12");
  await page.getByLabel("이름").fill("김민지");
  await page.getByRole("button", { name: "챌린지 참여하기" }).click();
  await page.getByRole("link", { name: "오늘의 양치 도전하기" }).click();
  await page.getByRole("button", { name: "60초" }).click();
  await expect(page.getByRole("radio", { name: "꽃님 사진관" })).toBeVisible();
});

test("expired administrator session restores calibration but not the file", async ({ page }) => {
  await mockAppsScript(page, { adminPassword: "test-admin-password", expireFirstAdminUpload: true });
  await login(page);
  await selectDraft(page);
  const save = page.getByRole("button", { name: "저장하고 활성화" });
  await expect(save).toBeEnabled();
  await save.dispatchEvent("click");
  await expect(page.getByRole("heading", { name: "관리자 로그인" })).toBeVisible();
  await page.getByLabel("관리자 비밀번호").fill("test-admin-password");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByLabel("스킨 이름")).toHaveValue("꽃님 사진관");
  await expect(page.getByLabel("크기")).toHaveValue("1.5");
  await expect(page.locator('input[type="file"]')).toHaveValue("");
});

test("calibration editor stacks on mobile and uses two columns on desktop", async ({ page }) => {
  await mockAppsScript(page, { adminPassword: "test-admin-password" });
  await login(page);
  const preview = page.getByLabel("스킨 미리보기");
  const form = page.getByLabel("스킨 설정");
  const mobilePreview = await preview.boundingBox();
  const mobileForm = await form.boundingBox();
  expect(mobileForm!.y).toBeGreaterThan(mobilePreview!.y + mobilePreview!.height - 4);
  expect((await page.screenshot()).byteLength).toBeGreaterThan(10_000);

  await page.setViewportSize({ width: 1280, height: 900 });
  const desktopPreview = await preview.boundingBox();
  const desktopForm = await form.boundingBox();
  expect(Math.abs(desktopPreview!.y - desktopForm!.y)).toBeLessThan(8);
  expect(desktopForm!.x).toBeGreaterThan(desktopPreview!.x + desktopPreview!.width - 4);
});
