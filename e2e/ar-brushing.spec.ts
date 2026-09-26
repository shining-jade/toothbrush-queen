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

async function allowSyntheticCamera(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = 480;
          const context = canvas.getContext("2d");
          context?.fillRect(0, 0, canvas.width, canvas.height);
          return canvas.captureStream(5);
        },
      },
    });
  });
}

async function joinWithCamera(page: Page) {
  await allowSyntheticCamera(page);
  await page.goto("/?challenge=ABC123");
  await page.getByLabel("학년").fill("2");
  await page.getByLabel("반").fill("3");
  await page.getByLabel("번호").fill("12");
  await page.getByLabel("이름").fill("김민지");
  await page.getByRole("button", { name: "챌린지 참여하기" }).click();
}

test("student chooses a skin and free brushing records measured time", async ({ page }) => {
  const mock = await mockAppsScript(page, { durationMode: "choice", acceptedDays: 2 });
  await page.clock.install({ time: new Date("2026-09-23T03:00:00Z") });
  await join(page);
  await page.getByRole("button", { name: "자유 양치" }).click();
  for (const card of await page.getByRole("radio").all()) {
    const cardBox = await card.boundingBox();
    const imageBox = await card.locator("img").boundingBox();
    expect(cardBox).not.toBeNull();
    expect(imageBox).not.toBeNull();
    expect(imageBox!.x).toBeGreaterThanOrEqual(cardBox!.x + 8);
    expect(imageBox!.x + imageBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width - 8);
  }
  await page.getByRole("radio", { name: "반짝 토끼" }).click();
  if (process.env.CAPTURE_VISUALS === "1") {
    await page.screenshot({ path: "docs/screenshots/ar-animal-selection.png", fullPage: true });
  }
  const previewButton = page.getByRole("button", { name: "반짝 토끼 스킨 미리보기" });
  await expect(previewButton).toBeVisible();
  const previewButtonBox = await previewButton.boundingBox();
  expect(previewButtonBox).not.toBeNull();
  expect(previewButtonBox!.y + previewButtonBox!.height).toBeLessThanOrEqual(
    (await page.viewportSize())!.height,
  );
  await previewButton.click();
  await page.getByRole("button", { name: "확인하고 시작하기" }).click();
  await expect(page.getByText("00:00")).toBeVisible();
  const stageBox = await page.locator(".brushing-stage").boundingBox();
  const timerBox = await page.locator(".adjustable-countdown").boundingBox();
  expect(stageBox).not.toBeNull();
  expect(timerBox).not.toBeNull();
  expect(timerBox!.y).toBeLessThan(stageBox!.y + stageBox!.height * 0.25);
  expect(timerBox!.x + timerBox!.width).toBeGreaterThan(stageBox!.x + stageBox!.width * 0.7);
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
  await page.clock.install({ time: new Date("2026-09-23T03:00:00Z") });
  await join(page);
  await page.getByRole("button", { name: "1분" }).click();
  await expect(page.getByText("마지막 도전! 양치왕 왕관이 자동으로 적용돼요.")).toBeVisible();
  const crown = page.getByAltText("양치왕 왕관");
  await expect(crown).toBeVisible();
  await expect.poll(() => crown.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(page.getByRole("radio")).toHaveCount(0);
  if (process.env.CAPTURE_VISUALS === "1") {
    await page.screenshot({ path: "docs/screenshots/ar-crown-final-day.png", fullPage: true });
  }
  await page.getByRole("button", { name: "양치왕 왕관 스킨 미리보기" }).click();
  await page.getByRole("button", { name: "확인하고 시작하기" }).click();
  await page.clock.fastForward(60_000);
  await page.getByRole("button", { name: "양치 완료 기록하기" }).click();
  await page.getByRole("button", { name: "챌린지 완료하고 제출하기" }).click();
  await expect(page.getByRole("heading", { name: "완주 소감을 남겨주세요" })).toBeVisible();
  await expect(page.getByRole("link", { name: "홈으로 돌아가기" })).toBeHidden();
  await page.getByLabel("완주 소감").fill("매일 양치하는 습관이 생겼어요.");
  await page.getByRole("button", { name: "소감 제출하기" }).click();
  await expect(page.getByText("소감을 한 번만 안전하게 저장했어요.")).toBeVisible();
  await expect(page.getByRole("link", { name: "홈으로 돌아가기" })).toBeVisible();
});

test("camera flow permits skin reselection, readiness skip, and fits mobile widths", async ({ page }) => {
  await mockAppsScript(page, { durationMode: "choice", acceptedDays: 2 });
  await page.clock.install({ time: new Date("2026-09-23T03:00:00Z") });
  await joinWithCamera(page);

  await page.getByRole("link", { name: "오늘의 양치 도전하기" }).click();
  await page.getByRole("button", { name: "1분" }).click();
  await page.getByRole("button", { name: "냥냥 볼터치 스킨 미리보기" }).click();
  await page.getByRole("button", { name: "확인하고 시작하기" }).click();

  const cameraLoading = page.getByRole("progressbar", { name: "양치 도전을 준비하고 있어요." });
  await expect(cameraLoading).toHaveAttribute("aria-valuenow", "100");
  await expect(page.getByRole("button", { name: "냥냥 볼터치 스킨으로 진행하기" })).toBeVisible();
  await page.getByRole("button", { name: "다른 스킨 고르기" }).click();
  await expect(page.getByRole("radio", { name: "냥냥 볼터치" })).toBeChecked();
  await page.getByRole("radio", { name: "반짝 토끼" }).click();
  await page.getByRole("button", { name: "반짝 토끼 스킨 미리보기" }).click();
  await page.getByRole("button", { name: "확인하고 시작하기" }).click();
  await expect(page.getByRole("button", { name: "반짝 토끼 스킨으로 진행하기" })).toBeVisible();
  await page.getByRole("button", { name: "반짝 토끼 스킨으로 진행하기" }).click();
  await expect(page.getByRole("button", { name: "바로 시작하기" })).toBeVisible();
  await page.getByRole("button", { name: "바로 시작하기" }).click();
  await expect(page.getByText("01:00")).toBeVisible();
  await expect(page.getByRole("button", { name: "양치 완료 기록하기" })).toBeEnabled();

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(viewport);
    const stage = await page.locator(".brushing-stage").boundingBox();
    expect(stage).not.toBeNull();
    expect(stage!.x).toBeGreaterThanOrEqual(0);
    expect(stage!.x + stage!.width).toBeLessThanOrEqual(viewport.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  }
});
