# Full-height conversation scrolling

## Direction

One native scrollbar spans transcript and anchored composer.
No synchronized rail. No global smooth-scroll rule.
Composer portals into a stable host so typing does not invalidate ChatView's memo boundary.

## Surfaces and tokens

| Surface | Tokens / existing contract | States |
|---|---|---|
| Native scrollbar | `--text-tertiary`, transparent track; hover `--text-secondary` | Dark, light, runtime palettes, forced colors |
| Composer host | `--bg-secondary`; existing CommandInput card tokens | Compact, expanded draft, queue, read-only |
| Transcript | Existing `.conversation-transcript` reading column | Long, short, empty, streaming, scroll-locked |
| Navigation overlays | Existing button tokens; clearance from measured footer height | Jump top/latest, replay, pending prompt |

## Protected behavior

- One DOM scroll owner; browser anchoring remains off.
- Keep row measurement, selection retention, history restoration and follow cancellation.
- No composer prop churn into the memoized transcript.
- Last message remains above composer at the bottom.
- Composer remains anchored at every scroll position.
- Standalone ChatView keeps working without a composer host.
- Short-height layout caps composer furniture rather than clipping it below the pane.

## Verification

Real React source preview: `index.html` + `preview.tsx`, served through isolated Vite.
Controls cover short/long/empty history, queue, read-only, streaming, appended replies and expanded drafts.
Browser checks cover desktop/tablet/mobile, Base dark/light, and Nord; no live backend or model calls.
Grounding: Nielsen consistency/standards and user control; WCAG focus, contrast and reduced motion. See `packages/mockup-loop/references/ux-best-practices.md`.

## Run preview

From repo root:

```sh
HOME=$(mktemp -d) PI_DASHBOARD_PORT=18987 node node_modules/vite/bin/vite.js --config mockups/conversation-scroll/vite.config.ts
```

Open `/mockups/conversation-scroll/index.html` on port 5187. The unused backend port keeps this source preview away from live sessions. No production build output changes.

## Verified edges

- Nine viewport/theme combinations: desktop, tablet, mobile × Base dark/light and Nord.
- Full-height rail, anchored composer at top/middle/bottom, bounded virtual rows, no horizontal overflow.
- Scroll-locked reader stays put when replies append; jump latest arrives; expanded draft keeps final reply visible.
- Real Queue delivery mode and host survive A → B → A.
- At 1280×360 with a tall header, adding Queue and expanding native tools while the footer is already capped preserves composer access. Observe direct furniture rows plus root additions/removals; observing only the capped host misses this case.
- Native focus/input capture attributes autosize scrolling before ResizeObserver; native wheel/touch capture includes portaled composer gestures.
- Docker-backed app E2E scenarios live in `tests/e2e/conversation-scroll.spec.ts`; isolated preview checks do not substitute for that harness.
