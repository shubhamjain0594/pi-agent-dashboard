/** Mobile diff: builds a unified patch with npm `diff`, then renders it. Lazy-loaded from EditToolRenderer. */
import { createTwoFilesPatch } from "diff";
import { UnifiedDiffView } from "./UnifiedDiffView.js";

export function HomegrownDiff({ oldText, newText, filePath }: { oldText: string; newText: string; filePath: string }) {
  const patch = createTwoFilesPatch(filePath, filePath, oldText, newText, "before", "after", { context: 3 });
  return <UnifiedDiffView diff={patch} />;
}
