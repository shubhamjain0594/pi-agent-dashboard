import { expect, test } from "./fixtures.js";
import { sendPrompt, spawnFreshGitSession } from "./helpers/index.js";

async function openConversation(page: import("@playwright/test").Page) {
  const card = await spawnFreshGitSession(page);
  await card.click();
  await expect(page.getByTestId("conversation-composer-host")).toBeVisible();
}

async function geometry(page: import("@playwright/test").Page) {
  return page.getByTestId("chat-scroll-container").evaluate((el) => {
    const footer = el.querySelector<HTMLElement>('[data-testid="conversation-composer-host"]')!;
    const composer = footer.querySelector<HTMLElement>('[data-testid="composer-root"]')!;
    const content = el.querySelector<HTMLElement>('[data-testid="chat-transcript-content"]')!;
    return {
      railBottom: el.getBoundingClientRect().bottom,
      footerTop: footer.getBoundingClientRect().top,
      footerBottom: footer.getBoundingClientRect().bottom,
      readingHeight: el.clientHeight - footer.getBoundingClientRect().height,
      composerHeight: composer.getBoundingClientRect().height,
      contentBottom: content.getBoundingClientRect().bottom,
      distanceFromBottom: el.scrollHeight - el.scrollTop - el.clientHeight,
    };
  });
}

test.describe("full-height conversation scrolling", () => {
  test("native rail reaches beside the composer, including an expanded draft", async ({ page }) => {
    await openConversation(page);
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 640 }]) {
      await page.setViewportSize(viewport);
      const input = page.locator('textarea[placeholder*="Message"]');
      await input.fill(Array.from({ length: 40 }, (_, i) => `Draft line ${i + 1}`).join("\n"));
      await expect.poll(async () => {
        const g = await geometry(page);
        return Math.abs(g.railBottom - g.footerBottom);
      }).toBeLessThan(1);
      const g = await geometry(page);
      expect(g.composerHeight).toBeGreaterThanOrEqual(72);
      expect(g.readingHeight).toBeGreaterThanOrEqual(15);
    }
  });

  test("composer stays anchored while browsing a long transcript and latest remains unobscured", async ({ page }) => {
    test.setTimeout(300_000);
    await openConversation(page);
    await sendPrompt(page, "[[faux:long-transcript-nav]] go");
    await expect(page.getByText("long-transcript complete").last()).toBeVisible({ timeout: 240_000 });
    const scroll = page.getByTestId("chat-scroll-container");
    for (const position of [0, 0.5, 1]) {
      await scroll.evaluate((el, ratio) => {
        el.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, bubbles: true }));
        el.scrollTop = (el.scrollHeight - el.clientHeight) * ratio;
      }, position);
      await expect.poll(async () => {
        const g = await geometry(page);
        return Math.abs(g.railBottom - g.footerBottom);
      }).toBeLessThan(1);
    }
    await page.locator('textarea[placeholder*="Message"]').fill("A longer\nfollow-up draft\nwith several lines");
    await expect.poll(async () => (await geometry(page)).distanceFromBottom).toBeLessThan(2);
    const g = await geometry(page);
    expect(g.contentBottom).toBeLessThanOrEqual(g.footerTop + 2);
  });
});
