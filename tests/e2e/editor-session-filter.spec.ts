import { expect, test } from "./fixtures.js";
import { spawnFreshGitSession } from "./helpers/index.js";

test("editor session-only filter hides unrelated folders and preserves readable diffs", async ({ page }) => {
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
  await page.getByTestId("session-review-file").first().click();
  const treeToggle = page.getByTestId("tree-toggle");
  if (await treeToggle.getAttribute("aria-pressed") !== "true") await treeToggle.click();
  const tree = page.locator("[data-file-rail]");
  await expect(tree.locator('[data-row=".github"]')).toBeVisible();

  const sessionOnly = page.getByTestId("session-only-toggle").getByRole("checkbox");
  await sessionOnly.check();
  await expect(tree.locator('[data-row="src/navigation.ts"]')).toBeVisible();
  await expect(tree.locator('[data-row=".github"]')).toHaveCount(0);
  await expect(tree.locator('[data-row="unrelated.txt"]')).toHaveCount(0);
  await sessionOnly.uncheck();
  await expect(tree.locator('[data-row=".github"]')).toBeVisible();

  const diff = page.locator(".code-diff-panel");
  await expect(diff.locator(".unified-diff-view-normal")).toBeVisible();
  await expect(diff.locator(".diff-table-scroll-container")).toHaveCSS("font-size", "13px");
  await expect(diff.locator(".code-diff-toolbar")).toHaveCSS("font-size", "11px");
  await diff.getByRole("button", { name: "Split", exact: true }).click();
  await expect(diff.locator(".split-diff-view-normal")).toBeVisible();
});
