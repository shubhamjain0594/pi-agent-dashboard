/**
 * Draggable divider used by both split-workspace dividers (outer chat/editor
 * and inner browse-rail↔viewer). Presentational + drag lifecycle only: it
 * reports the pointer client coordinate on each frame; the parent decides how
 * to interpret it (ratio vs pixel width). Orientation-aware cursor.
 *
 * Always-visible dotted grip (the shared seam signifier). An optional collapse
 * knob uses the same floating chrome as the session-rail seam; its mousedown
 * stops so a click never starts a drag. See change: redesign-split-layout-controls
 * (was: split-editor-workspace).
 */

import { Icon } from "@mdi/react";
import type React from "react";
import { useCallback, useEffect, useRef } from "react";
import { useBodyDragStyle } from "../../hooks/useBodyDragStyle.js";
import type { SplitOrientation } from "../../lib/layout/split-state.js";
import { SeamGrip } from "./SeamGrip.js";

interface SplitDividerProps {
  /** `h` = side-by-side split → vertical bar, `col-resize`. `v` = stacked → row-resize. */
  orientation: SplitOrientation;
  /** Called on each drag frame with the pointer client coordinate (X for `h`, Y for `v`). */
  onResize: (clientPos: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  /** Extra classes for size/color per divider (outer vs inner rail). */
  className?: string;
  title?: string;
  "data-testid"?: string;
  /**
   * Floating seam knob. Same chrome as the session-rail collapse button.
   * Omitted on the inner browse-rail divider, which stays resize-only.
   */
  collapse?: {
    icon: string;
    title: string;
    testId: string;
    onClick: () => void;
  };
}

export function SplitDivider({
  orientation,
  onResize,
  onResizeStart,
  onResizeEnd,
  className = "",
  title,
  "data-testid": testId,
  collapse,
}: SplitDividerProps) {
  const dragging = useRef(false);
  const cursor = orientation === "h" ? "col-resize" : "row-resize";
  const { beginBodyDrag, endBodyDrag } = useBodyDragStyle();

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      beginBodyDrag(cursor);
      onResizeStart?.();
    },
    [cursor, onResizeStart, beginBodyDrag],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      onResize(orientation === "h" ? e.clientX : e.clientY);
    };
    const handleMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      endBodyDrag();
      onResizeEnd?.();
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [orientation, onResize, onResizeEnd, endBodyDrag]);

  const base =
    orientation === "h"
      ? "w-2.5 cursor-col-resize"
      : "h-2.5 w-full cursor-row-resize";

  return (
    <div
      // Resize handle: `aria-orientation` describes the drag axis. Not a
      // valued `separator` role (no aria-valuenow), so the role is omitted.
      aria-orientation={orientation === "h" ? "vertical" : "horizontal"}
      onMouseDown={handleMouseDown}
      title={title}
      data-testid={testId}
      className={`relative flex shrink-0 items-center justify-center bg-[var(--border-primary)] transition-colors hover:bg-blue-500/40 active:bg-blue-500/60 ${base} ${className}`}
    >
      <SeamGrip dots={4} data-testid={testId ? `${testId}-grip` : undefined} />
      {collapse && (
        <button
          type="button"
          onClick={collapse.onClick}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute left-1/2 top-1/2 z-sidebar flex h-[22px] w-[18px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border border-[var(--border-secondary)] bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] shadow-md transition-colors cursor-pointer hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
          title={collapse.title}
          aria-label={collapse.title}
          data-testid={collapse.testId}
        >
          <Icon path={collapse.icon} size={0.55} />
        </button>
      )}
    </div>
  );
}
