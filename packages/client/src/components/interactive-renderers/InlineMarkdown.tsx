import { lazy, Suspense } from "react";

// Static import pulls react-markdown into the entry. That chunk imports
// entry-owned helpers at module init and the shell never mounts.
const ReactMarkdown = lazy(() => import("react-markdown"));

interface Props {
  content: string;
}

/**
 * Renders markdown restricted to inline elements only (strong, em, code, a).
 * Block elements like <p>, <ul>, <h1> are unwrapped to their text content,
 * keeping the output suitable for single-line compact layouts.
 */
export function InlineMarkdown({ content }: Props) {
  return (
    <Suspense fallback={<span className="whitespace-pre-wrap">{content}</span>}>
      <ReactMarkdown
        allowedElements={["strong", "em", "code", "a"]}
        unwrapDisallowed={true}
        components={{
          code({ children, ...props }) {
            return (
              <code
                className="bg-[var(--bg-surface)] px-1 py-0.5 rounded text-[length:inherit] font-mono"
                {...props}
              >
                {children}
              </code>
            );
          },
          a({ children, href, ...props }) {
            return (
              <a
                href={href}
                className="text-blue-400 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </Suspense>
  );
}
