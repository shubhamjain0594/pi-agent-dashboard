# SplitWorkspace.tsx — index

Pure layout, 3 modes via `mode` prop: `closed` (chat + right-edge Editor peek), `split` (chat+divider+editor; seam knob `split-collapse-editor` → `closed`), `full` (editor + leading Chat peek; ChatView kept mounted hidden). Stable chat/editor keys → no remount. `onModeChange` for the seam knob and peeks. See change: split-editor-workspace. See change: editor-layout-modes.

See change: fix-popover-container-clip — chat pane div gains `chatPaneRef`; wraps `{chat}` in `PopoverBoundaryProvider value={chatPaneRef}` so descendant popovers flip/clamp against this offset overflow-hidden pane.
