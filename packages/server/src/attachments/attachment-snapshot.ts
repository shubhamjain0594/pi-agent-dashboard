import type { DashboardEvent } from "@blackbelt-technology/pi-dashboard-shared/types.js";

export interface AttachmentResolution {
  attachmentId: string;
  data: string;
  state: "ready" | "failed";
  mimeType?: string;
  /** Settled message reference; its bounded derivative is served separately. */
  reference?: boolean;
}

function content(event: DashboardEvent): Array<Record<string, unknown>> {
  const message = event.data?.message as { content?: unknown } | undefined;
  return Array.isArray(message?.content) ? message.content : [];
}

/** Only the attachment sidecar and message's own settled image blocks are authoritative. */
export function attachmentResolutions(
  event: DashboardEvent,
): AttachmentResolution[] {
  const blocks: Array<Record<string, unknown>> =
    event.eventType === "attachment_fitted"
      ? [event.data]
      : content(event)
          .filter((block) => block?.type === "image")
          .map((block) => ({ ...block, state: block.attachmentState }));
  return blocks.flatMap((block) => {
    if (
      !block ||
      typeof block.attachmentId !== "string" ||
      !block.attachmentId ||
      (block.state !== "ready" && block.state !== "failed")
    )
      return [];
    const data = typeof block.data === "string" ? block.data : "";
    const reference =
      event.eventType !== "attachment_fitted" &&
      block.state === "ready" &&
      !data;
    return [
      {
        attachmentId: block.attachmentId,
        data: block.state === "failed" ? "" : data,
        state:
          block.state === "failed" || (!data && !reference)
            ? "failed"
            : "ready",
        ...(reference ? { reference: true } : {}),
        ...(typeof block.mimeType === "string"
          ? { mimeType: block.mimeType }
          : {}),
      } as AttachmentResolution,
    ];
  });
}

export function pendingAttachmentIds(event: DashboardEvent): Set<string> {
  return new Set(
    content(event).flatMap((block) =>
      block?.type === "image" &&
      block.attachmentState === "pending" &&
      typeof block.attachmentId === "string"
        ? [block.attachmentId]
        : [],
    ),
  );
}

/** Copy-on-write: resident transcript rows must not depend on a separately retained patch. */
export function resolveAttachmentSnapshot(
  event: DashboardEvent,
  resolution: AttachmentResolution,
  exceedsLimit: (data: unknown) => boolean,
): DashboardEvent {
  const blocks = content(event);
  let changed = false;
  const patch = (reference: boolean) =>
    blocks.map((block) => {
      if (
        block?.type !== "image" ||
        block.attachmentId !== resolution.attachmentId
      )
        return block;
      const data = reference ? "" : resolution.data;
      const state = resolution.state;
      const mimeType = reference
        ? block.mimeType
        : (resolution.mimeType ?? block.mimeType);
      if (
        block.data === data &&
        block.attachmentState === state &&
        block.mimeType === mimeType
      )
        return block;
      changed = true;
      return { ...block, data, attachmentState: state, mimeType };
    });
  const replace = (next: Array<Record<string, unknown>>): DashboardEvent => ({
    ...event,
    data: {
      ...event.data,
      message: { ...(event.data.message as object), content: next },
    },
  });
  const next = patch(resolution.reference === true);
  if (!changed) return event;
  const candidate = replace(next);
  if (!exceedsLimit(candidate.data)) return candidate;
  // A successful fit must not become a failure merely because several image
  // payloads exceed ONE message's ceiling. Keep a settled reference instead;
  // normal rendering reads its bounded derivative from the display endpoint.
  // Preserve the original metadata and check even this smaller replacement.
  const referenced = replace(patch(true));
  return exceedsLimit(referenced.data) ? event : referenced;
}
