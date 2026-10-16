/**
 * Cold-landing boundary for `MarkdownContent`. The renderer pulls react-markdown,
 * remark/rehype and the syntax highlighter; a static import from the shell keeps
 * them (and, through `remark-math`/`katex`, the math path) on the entry graph.
 * Until the chunk loads, the raw source renders as plain text with the same props.
 * See change: shrink-client-entry-lazy-islands.
 */
import { lazy, Suspense } from "react";
import type { MarkdownContentProps } from "./MarkdownContent.js";

const MarkdownContentImpl = lazy(() =>
  import("./MarkdownContent.js").then((m) => ({ default: m.MarkdownContent })),
);

export function MarkdownContent(props: MarkdownContentProps) {
  return (
    <Suspense fallback={<div className="whitespace-pre-wrap">{props.content}</div>}>
      <MarkdownContentImpl {...props} />
    </Suspense>
  );
}
