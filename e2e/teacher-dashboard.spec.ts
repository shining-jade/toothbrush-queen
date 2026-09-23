import { expect, test } from "@playwright/test";

import { mockAppsScript } from "./fixtures/apps-script-mock";

test("teacher logs in, filters participation, saves settings, and gets a student QR", async ({ page }) => {
  await mockAppsScript(page, { adminPassword: "test-admin-password" });
  await page.goto("/admin");
  await page.getByLabel("관리자 비밀번호").fill("test-admin-password");
  await page.getByRole("button", { name: "로그인" }).click();

  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.getByRole("article", { name: "전체 학생" })).toContainText("3명");
  await expect(page.getByRole("img", { name: "학생 참여 QR 코드" })).toBeVisible();
  await expect(page.getByLabel("학생 참여 링크")).toHaveValue(/\?challenge=BRUSH5$/);

  await page.getByLabel("학년 필터").selectOption("3");
  await expect(page.getByText("박지우")).toBeVisible();
  await expect(page.getByText("김민지")).toBeHidden();

  await page.getByRole("button", { name: "30일" }).click();
  await expect(page.getByLabel("종료일")).toHaveValue("2026-10-19");
  await page.getByRole("button", { name: "챌린지 설정 저장" }).click();
  await expect(page.getByRole("status")).toHaveText("챌린지 설정을 저장했어요.");
  await expect(page.getByLabel("목표 일수")).toHaveValue("30");
  await expect(page.getByRole("link", { name: "AR 스킨 관리" })).toBeVisible();
});

test("teacher permanently deletes a student after confirming", async ({ page }) => {
  await mockAppsScript(page, { adminPassword: "test-admin-password" });
  await page.goto("/admin");
  await page.getByLabel("관리자 비밀번호").fill("test-admin-password");
  await page.getByRole("button", { name: "로그인" }).click();

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("도장 기록, 소감, 자동로그인 정보");
    await dialog.accept();
  });
  await page.getByRole("button", { name: "김민지 학생 삭제" }).click();

  await expect(page.getByRole("status")).toHaveText("김민지 학생과 모든 기록을 삭제했어요.");
  await expect(page.getByRole("article", { name: "전체 학생" })).toContainText("2명");
  await expect(page.getByRole("button", { name: "김민지 학생 삭제" })).toBeHidden();
});
