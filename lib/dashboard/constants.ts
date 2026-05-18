import { z } from "zod"

export const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const

export type Day = (typeof DAYS)[number]

/** Normalised learner name key — keep in sync with tracker matching / exclusions */
export function normLearnerKey(n: string | undefined): string {
  return (n || "")
    .toLowerCase()
    .replace(/[_\-()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export const FIXED_TIMES = [
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "1:00",
  "1:30",
  "2:00",
  "2:45",
  "3:00",
  "3:30",
  "4:00",
  "4:30",
  "5:00",
  "5:30",
  "6:00",
  "6:30",
  "7:00",
  "7:30",
  "8:00",
] as const

export const STYPES = [
  "Regular",
  "Intro Session",
  "Garment Review",
  "Portfolio Meeting",
  "Exam Meeting",
  "Range Board",
  "Mood Board",
  "Revision",
  "Double Trouble",
  "Offline",
] as const

export const TCOLORS = [
  "#29ABE2",
  "#F26522",
  "#F7C325",
  "#9EA3A8",
  "#22c55e",
  "#a78bfa",
  "#2dd4bf",
  "#ef4444",
  "#60a5fa",
  "#fb923c",
  "#34d399",
  "#e879f9",
  "#facc15",
  "#94a3b8",
  "#38bdf8",
] as const

export const DEFAULT_TRAINERS = [
  "Priya",
  "Riya",
  "Ruchi",
  "Nandini",
  "Disha",
  "Shiuli",
  "Priyanka G",
  "Jagriti",
  "Sneha",
  "Akansha",
]

export type Slot = {
  id: number
  time: string
  learner: string
  trainer: string
  coTrainer?: string
  type: string
  note?: string
  addedBy?: string
  addedAt?: string
}

export type NoteEntry = {
  authorEmail?: string
  email?: string
  trainer?: string
  text: string
  ts?: string
}

export type EditHistoryEntry = {
  id: string
  ts: string
  user: string
  /** Full sign-in email when available (newer entries). */
  actorEmail?: string
  section: string
  action: string
  detail: string
}

export type TrashEntry = {
  id: string
  slot: Slot
  day: Day
  weekKey: string
  deletedAt?: string
  deletedBy?: string
}

export type MsgSlot = {
  id?: number | string
  trainer?: string
  trainers?: string[]
  from: string
  to: string
  day?: Day
  notes?: string
}

export type TrackerEntry = {
  id: number
  name: string
  trainer?: string
  batch?: string
  week?: string
  target?: number
  notes?: string
}

export type TaskStatus = "pending" | "inprogress" | "done"

export type DashboardTask = {
  id: string
  name: string
  assign: string
  date: string
  status: TaskStatus
  delay: string
  createdBy?: string
}

export type ExtensionRecord = {
  id: string
  name: string
  number?: string
  email?: string
  type?: string
  charges?: string
  duration?: string
  approvedBy?: string
  reason?: string
  status?: string
  mailSent?: boolean
  createdBy?: string
  createdAt?: string
}

export const TASK_CATEGORY_KEYS = [
  "training",
  "operations",
  "marketing",
  "admin",
  "other",
] as const

export type TaskCategory = (typeof TASK_CATEGORY_KEYS)[number]

export type WeekStore = {
  msgSlots: Record<Day, MsgSlot[]>
  tasks: Record<TaskCategory, DashboardTask[]>
  tracker: TrackerEntry[]
  /** Normalised learner names removed from tracker; schedule sync must not re-add them */
  trackerSyncExcludedNames: string[]
  attData: Record<number | string, { att?: string; note?: string }>
  msgDoneData: Record<
    string | number,
    { done: boolean; doneAt: string | null }
  >
}

export type WeekSchedule = Record<Day, Slot[]>

export type WorkspacePayload = {
  trainers: string[]
  userWeeks: Record<string, WeekSchedule>
  allWeekData: Record<string, Partial<WeekStore>>
  learnerNotes: Record<string, NoteEntry[]>
  notifications: Record<string, unknown[]>
  editHistory: EditHistoryEntry[]
  extRecords: ExtensionRecord[]
  extId: number
  trashBin: TrashEntry[]
  slotId: number
  msgId: number
  trackerId: number
  taskId: number
  deletedSlotIds: number[]
  _savedAt?: number
}

const slotSchema = z
  .object({
    id: z.coerce.number(),
    time: z.coerce.string().default(""),
    learner: z.coerce.string().default(""),
    trainer: z.coerce.string().optional().default(""),
    coTrainer: z.coerce.string().optional().default(""),
    type: z.coerce.string().optional().default("Regular"),
    note: z.coerce.string().optional().default(""),
    addedBy: z.coerce.string().optional(),
    addedAt: z.coerce.string().optional(),
  })
  .passthrough()

/** Loose runtime validation — forwards compat with evolving payload */
export const workspacePayloadSchema = z.object({
  trainers: z.array(z.string()),
  userWeeks: z.record(z.string(), z.record(z.string(), z.array(slotSchema))),
  allWeekData: z.record(z.string(), z.record(z.string(), z.unknown())),
  learnerNotes: z.record(z.string(), z.array(z.unknown())),
  notifications: z.record(z.string(), z.array(z.unknown())),
  editHistory: z.array(z.unknown()),
  extRecords: z.array(z.unknown()),
  extId: z.number(),
  trashBin: z.array(z.unknown()),
  slotId: z.number(),
  msgId: z.number(),
  trackerId: z.number(),
  taskId: z.number(),
  deletedSlotIds: z.array(z.coerce.number()),
  _savedAt: z.number().optional(),
})

export type ParsedWorkspacePayload = z.infer<typeof workspacePayloadSchema>

export function emptyWeekSchedule(): Record<Day, Slot[]> {
  return {
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
    Sunday: [],
  }
}

export function ensureWeekStore(raw: Partial<WeekStore> | undefined): WeekStore {
  const s = raw ?? {}
  const tasks = { ...(s.tasks ?? {}) } as WeekStore["tasks"]
  TASK_CATEGORY_KEYS.forEach((k) => {
    if (!Array.isArray(tasks[k])) tasks[k] = []
    else {
      tasks[k] = (tasks[k] as unknown[]).map((raw) => {
        const t = raw as Record<string, unknown>
        const st = String(t.status ?? "pending")
        const status: TaskStatus =
          st === "done" || st === "inprogress" || st === "pending"
            ? st
            : "pending"
        return {
          id: String(t.id ?? ""),
          name: String(t.name ?? ""),
          assign: String(t.assign ?? ""),
          date: String(t.date ?? ""),
          status,
          delay: String(t.delay ?? ""),
          createdBy:
            t.createdBy != null ? String(t.createdBy) : undefined,
        }
      })
    }
  })
  const msgSlots = { ...(s.msgSlots ?? {}) } as Record<Day, MsgSlot[]>
  DAYS.forEach((d) => {
    if (!Array.isArray(msgSlots[d])) msgSlots[d] = []
  })
  const excludedRaw = s.trackerSyncExcludedNames
  const trackerSyncExcludedNames = Array.isArray(excludedRaw)
    ? Array.from(
        new Set(
          (excludedRaw as unknown[])
            .map((x) => normLearnerKey(String(x ?? "")))
            .filter(Boolean)
        )
      )
    : []

  return {
    msgSlots,
    tasks,
    tracker: Array.isArray(s.tracker)
      ? (s.tracker as unknown[]).map((row) => {
          const r = row as Record<string, unknown>
          const id = Number(r.id)
          return {
            id: Number.isFinite(id) && id > 0 ? id : Date.now(),
            name: String(r.name ?? ""),
            trainer: r.trainer != null ? String(r.trainer) : undefined,
            batch: r.batch != null ? String(r.batch) : undefined,
            week: r.week != null ? String(r.week) : undefined,
            target:
              typeof r.target === "number" ? r.target : Number(r.target) || 5,
            notes: r.notes != null ? String(r.notes) : undefined,
          }
        })
      : [],
    trackerSyncExcludedNames,
    attData: typeof s.attData === "object" && s.attData ? s.attData : {},
    msgDoneData:
      typeof s.msgDoneData === "object" && s.msgDoneData ? s.msgDoneData : {},
  }
}
