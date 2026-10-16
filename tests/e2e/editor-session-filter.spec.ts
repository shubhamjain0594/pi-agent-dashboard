import { expect, test } from "./fixtures.js";
import { spawnFreshGitSession } from "./helpers/index.js";

test("review scope stays separate from the full-width file viewer", async ({ page }) => {
  await page.route("**/api/preferences/display", (route) => route.fulfill({ json: {
    displayPrefs: { tokenStatsBar: true, contextUsageBar: true },
  } }));
  // Deterministic filesystem/diff boundary; use the real app, editor and renderer.
  await page.route("**/api/session-diff?*", (route) => route.fulfill({ json: {
    success: true,
    data: {
      isGitRepo: true,
      baseLabel: "HEAD",
      files: [{
        path: "src/navigation.ts",
        changes: [{ type: "edit", timestamp: 1 }],
        gitDiff: "diff --git a/src/navigation.ts b/src/navigation.ts\n--- a/src/navigation.ts\n+++ b/src/navigation.ts\n@@ -1 +1 @@\n-export const view = 'old';\n+export const view = 'new';\n",
      }],
      otherChanges: [{ path: "unrelated.txt", changes: [] }],
    },
  } }));
  await page.route("**/api/file/tree?*", (route) => route.fulfill({ json: {
    success: true,
    data: { entries: [{ name: ".github", isDir: true }, { name: "src", isDir: true }, { name: "unrelated.txt", isDir: false }] },
  } }));

  const card = await spawnFreshGitSession(page);
  await card.click();
  await page.getByTestId("layout-mode-split").click();
  await page.getByTestId("inspector-changes").click();
  const review = page.getByTestId("session-changes-panel");
  const tree = review.locator(".review-sidebar [data-file-rail]");
  const sessionOnly = review.getByRole("checkbox", { name: "This session only" });
  await expect(sessionOnly).toBeChecked();
  await expect(tree.locator('[data-row="src/navigation.ts"]')).toBeVisible();
  await expect(tree.locator('[data-row=".github"]')).toHaveCount(0);
  await expect(tree.locator('[data-row="unrelated.txt"]')).toHaveCount(0);
  await sessionOnly.uncheck();
  await expect(tree.locator('[data-row="unrelated.txt"]')).toBeVisible();
  await sessionOnly.check();
  await expect(tree.locator('[data-row="unrelated.txt"]')).toHaveCount(0);
  const search = review.getByRole("searchbox", { name: "Search changed files" });
  await search.fill("no-match");
  await expect(review.getByTestId("session-review-file")).toHaveCount(0);
  await search.fill("");
  await review.getByTestId("session-review-open-diff").first().click();
  await expect(page.getByTestId("layout-mode-full")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("tree-toggle")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".editor-workspace [data-file-rail]")).toHaveCount(0);

  const diff = page.locator(".editor-workspace .code-diff-panel");
  // Desktop session chrome uses one session row and one inspector toolbar.
  await expect(page.locator(".workbench-titlebar")).toHaveCount(0);
  await expect(page.locator(".editor-workspace-header")).toHaveCount(0);
  expect((await page.locator(".conversation-session-header").boundingBox())!.height).toBeLessThanOrEqual(40);
  expect((await page.locator(".session-work-tabs").boundingBox())!.height).toBeLessThanOrEqual(36);
  const beforeUsage = await diff.boundingBox();
  await page.locator(".conversation-session-header .conversation-usage > summary").click();
  await expect(page.locator(".conversation-usage-content")).toBeVisible();
  expect((await diff.boundingBox())!.y).toBe(beforeUsage!.y);
  await page.keyboard.press("Escape");
  await expect(page.locator(".conversation-usage")).not.toHaveAttribute("open");
  await page.getByRole("button", { name: "Quick open", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(diff.locator(".unified-diff-view-normal")).toBeVisible();
  await expect(diff.locator(".diff-table-scroll-container")).toHaveCSS("font-size", "13px");
  await expect(diff.locator(".code-diff-toolbar")).toHaveCSS("font-size", "11px");
  await diff.getByRole("button", { name: "Split", exact: true }).click();
  await expect(diff.locator(".split-diff-view-normal")).toBeVisible();
});
