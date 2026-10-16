/**
 * Lazy entry for react-syntax-highlighter's Prism component. Prism registers every
 * language grammar (including `diff`), so a static import from a cold-path
 * component drags all of them into the entry chunk. The code renders as plain
 * preformatted text until the highlighter loads.
 */
import { type ComponentProps, lazy, Suspense } from "react";
import type { Prism as PrismType } from "react-syntax-highlighter";

const PrismImpl = lazy(() =>
  import("react-syntax-highlighter").then((m) => ({ default: m.Prism })),
);

export function LazySyntaxHighlighter(props: ComponentProps<typeof PrismType>) {
  const children = props.children;
  const text = typeof children === "string" ? children : "";
  return (
    <Suspense fallback={<pre className="whitespace-pre overflow-auto">{text}</pre>}>
      <PrismImpl {...props} />
    </Suspense>
  );
}
