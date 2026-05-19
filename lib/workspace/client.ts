/** Browser-side workspace API client (granular mutations). */

async function api<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  })
  if (!res.ok) {
    const text = await res.text()
    let message = text || res.statusText
    try {
      const parsed = JSON.parse(text) as { error?: string }
      if (parsed.error) message = parsed.error
    } catch {
      /* use raw text */
    }
    throw new Error(message)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const workspaceClient = {
  fetchBootstrap: () =>
    api<{ payload: unknown; updated_at: string | null }>("/api/workspace"),

  addTrainer: (name: string) =>
    api("/api/workspace/trainers", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  removeTrainer: (name: string) =>
    api("/api/workspace/trainers", {
      method: "DELETE",
      body: JSON.stringify({ name }),
    }),

  createSlot: (body: Record<string, unknown>) =>
    api<{ slot: Record<string, unknown> }>("/api/workspace/slots", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  patchSlot: (body: Record<string, unknown>) =>
    api("/api/workspace/slots", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteSlot: (body: Record<string, unknown>) =>
    api("/api/workspace/slots", {
      method: "DELETE",
      body: JSON.stringify(body),
    }),

  patchAttendance: (body: Record<string, unknown>) =>
    api("/api/workspace/attendance", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  addLearnerNote: (body: Record<string, unknown>) =>
    api("/api/workspace/learner-notes", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deleteLearnerNote: (body: Record<string, unknown>) =>
    api("/api/workspace/learner-notes", {
      method: "DELETE",
      body: JSON.stringify(body),
    }),

  upsertTracker: (body: Record<string, unknown>) =>
    api("/api/workspace/tracker", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  removeTracker: (body: Record<string, unknown>) =>
    api("/api/workspace/tracker", {
      method: "DELETE",
      body: JSON.stringify(body),
    }),

  syncTracker: (body: Record<string, unknown>) =>
    api("/api/workspace/tracker/sync", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  createMsgSlot: (body: Record<string, unknown>) =>
    api<{ id: string }>("/api/workspace/msg-slots", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  patchMsgSlot: (body: Record<string, unknown>) =>
    api("/api/workspace/msg-slots", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteMsgSlot: (body: Record<string, unknown>) =>
    api("/api/workspace/msg-slots", {
      method: "DELETE",
      body: JSON.stringify(body),
    }),

  patchMsgDone: (body: Record<string, unknown>) =>
    api("/api/workspace/msg-done", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  upsertTask: (body: Record<string, unknown>) =>
    api<{ id: string }>("/api/workspace/tasks", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  patchTask: (body: Record<string, unknown>) =>
    api("/api/workspace/tasks", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteTask: (body: Record<string, unknown>) =>
    api("/api/workspace/tasks", {
      method: "DELETE",
      body: JSON.stringify(body),
    }),

  upsertExtension: (body: Record<string, unknown>) =>
    api<{ id: string }>("/api/workspace/extensions", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  patchExtension: (body: Record<string, unknown>) =>
    api("/api/workspace/extensions", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteExtension: (body: Record<string, unknown>) =>
    api("/api/workspace/extensions", {
      method: "DELETE",
      body: JSON.stringify(body),
    }),

  restoreTrash: (trashId: string) =>
    api("/api/workspace/trash", {
      method: "POST",
      body: JSON.stringify({ action: "restore", trashId }),
    }),

  purgeTrash: (trashId: string) =>
    api("/api/workspace/trash", {
      method: "POST",
      body: JSON.stringify({ action: "purge", trashId }),
    }),

  emptyTrash: () =>
    api("/api/workspace/trash", {
      method: "POST",
      body: JSON.stringify({ action: "empty" }),
    }),

  copyWeek: (fromWeekKey: string, toWeekKey: string) =>
    api("/api/workspace/weeks/copy", {
      method: "POST",
      body: JSON.stringify({ fromWeekKey, toWeekKey }),
    }),
}
