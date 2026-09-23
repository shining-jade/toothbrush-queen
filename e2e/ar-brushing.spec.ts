import { expect, test, type Page } from "@playwright/test";

import { denyCamera, mockAppsScript } from "./fixtures/apps-script-mock";

async function join(page: Page) {
  await denyCamera(page);
  await page.goto("/?challenge=ABC123");
  await page.getByLabel("학년").fill("2");
  await page.getByLabel("반").fill("3");
  await page.getByLabel("번호").fill("12");
  await page.getByLabel("이름").fill("김민지");
  await page.getByRole("button", { name: "챌린지 참여하기" }).click();
  await page.getByRole("link", { name: "오늘의 양치 도전하기" }).click();
}

test("student chooses a skin and free brushing records measured time", async ({ page }) => {
  const mock = await mockAppsScript(page, { durationMode: "choice", acceptedDays: 2 });
  await page.clock.install({ time: new Date("2026-09-23T03:00:00Z") });
  await join(page);
  await page.getByRole("button", { name: "자유 양치" }).click();
  await page.getByRole("radio", { name: "반짝 토끼" }).click();
  await page.screenshot({ path: "docs/screenshots/ar-animal-selection.png", fullPage: true });
  await page.getByRole("button", { name: "이 스킨으로 시작하기" }).click();
  await page.getByRole("button", { name: "확인하고 시작하기" }).click();
  await expect(page.getByText("00:00")).toBeVisible();
  await page.clock.fastForward(60_000);
  await expect(page.getByText("01:00")).toBeVisible();
  await page.getByRole("button", { name: "양치 완료 기록하기" }).click();
  await expect(page.getByText("총 1분 0초 동안 양치했어요.")).toBeVisible();
  await page.getByRole("button", { name: "챌린지 완료하고 제출하기" }).click();
  await expect(page.getByRole("heading", { name: "양치 완료!" })).toBeVisible();
  expect(mock.completionPayloads()[0]).toEqual(expect.objectContaining({ elapsedSec: 60, cameraMode: "timer-only" }));
});

test("last challenge day forces the crown", async ({ page }) => {
  await mockAppsScript(page, { durationMode: "choice", acceptedDays: 4 });
  await join(page);
  await page.getByRole("button", { name: "60초" }).click();
  await expect(page.getByText("마지막 도전! 양치왕 왕관이 자동으로 적용돼요.")).toBeVisible();
  const crown = page.getByAltText("양치왕 왕관");
  await expect(crown).toBeVisible();
  await expect.poll(() => crown.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(page.getByRole("radio")).toHaveCount(0);
  await page.screenshot({ path: "docs/screenshots/ar-crown-final-day.png", fullPage: true });
});
