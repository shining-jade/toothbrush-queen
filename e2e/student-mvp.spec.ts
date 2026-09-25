import { expect, test } from "@playwright/test";

import { denyCamera, mockAppsScript } from "./fixtures/apps-script-mock";

test("participant type choices remain compact on a mobile screen", async ({ page }) => {
  await mockAppsScript(page);
  await page.goto("/?challenge=ABC123");

  const studentRadio = page.getByRole("radio", { name: "학생" });
  const staffRadio = page.getByRole("radio", { name: "교직원" });
  await expect(studentRadio).toHaveCSS("width", "18px");
  await expect(staffRadio).toHaveCSS("width", "18px");
  await expect(studentRadio.locator("..")).toHaveCSS("min-height", "40px");
});

async function joinAndStart(page: import("@playwright/test").Page) {
  await denyCamera(page);
  await page.clock.install({ time: new Date("2026-09-23T03:00:00Z") });
  await page.goto("/?challenge=ABC123");
  await page.getByLabel("학년").fill("2");
  await page.getByLabel("반").fill("3");
  await page.getByLabel("번호").fill("12");
  await page.getByLabel("이름").fill("김민지");
  await page.getByRole("button", { name: "챌린지 참여하기" }).click();
  await page.getByRole("link", { name: "오늘의 양치 도전하기" }).click();
  await page.getByRole("button", { name: "60초" }).click();
  await page.getByRole("radio", { name: "냥냥 볼터치" }).click();
  await page.getByRole("button", { name: "냥냥 볼터치 스킨 미리보기" }).click();
  await page.getByRole("button", { name: "확인하고 시작하기" }).click();
  await expect(page.getByText("카메라 없이 타이머로 진행 중이에요.")).toBeVisible();
}

test("student joins, completes with camera denied, and resumes progress", async ({ page }) => {
  await mockAppsScript(page);
  await joinAndStart(page);

  await page.clock.fastForward(60_000);
  await page.getByRole("button", { name: "양치 완료 기록하기" }).click();
  await page.getByRole("button", { name: "챌린지 완료하고 제출하기" }).click();
  await expect(page.getByRole("heading", { name: "양치 완료!" })).toBeVisible();
  await expect(page.getByLabel("도장판: 5일 중 1일 완료")).toBeVisible();
  await expect(page.getByRole("listitem", { name: "1일차 완료" })).toHaveAttribute(
    "data-fresh",
    "true",
  );

  await page.goto("/?challenge=ABC123");
  await expect(page.getByText("1 / 5일")).toBeVisible();
  await expect(page.getByLabel("도장판: 5일 중 1일 완료")).toBeVisible();
  await expect(page.getByRole("listitem", { name: "1일차 완료" })).not.toHaveAttribute(
    "data-fresh",
    "true",
  );
});

test("lost completion response retries with one accepted day", async ({ page }) => {
  const mock = await mockAppsScript(page, { loseFirstCompletionResponse: true });
  await joinAndStart(page);
  await page.clock.fastForward(60_000);
  await page.getByRole("button", { name: "양치 완료 기록하기" }).click();
  await page.getByRole("button", { name: "챌린지 완료하고 제출하기" }).click();
  await expect(page.getByText("기록 전송이 보류되었습니다")).toBeVisible();
  await page.getByRole("button", { name: "다시 전송하기" }).click();

  await expect(page.getByText("1 / 5일")).toBeVisible();
  expect(mock.completionRequests()).toBe(2);
});

test("invalid QR is rejected and an expired token returns to entry", async ({ page }) => {
  await mockAppsScript(page);
  await page.goto("/");
  await expect(page.getByText("올바르지 않은 QR 코드예요.")).toBeVisible();

  await page.goto("/?challenge=ABC123");
  await page.evaluate(() =>
    localStorage.setItem(
      "brush-king:session:ABC123",
      "expired-device-token-123456789",
    ),
  );
  await page.reload();
  await expect(page.getByLabel("이름")).toBeVisible();
});
