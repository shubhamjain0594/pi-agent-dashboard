# SplitDivider.tsx — index

Draggable divider (outer chat/editor + inner rail). Reports pointer coord; orientation-aware cursor. Optional `collapse` seam knob (same chrome as the session rail; `stopPropagation` so a click never starts a drag; testid caller-owned, outer split uses `split-collapse-editor` → `closed`). Inner rail omits it. Body drag styles delegate to `useBodyDragStyle()` (orientation-aware cursor kept). See change: split-editor-workspace. See change: editor-layout-modes. See change: fix-long-session-ux-degradation.
