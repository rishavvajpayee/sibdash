import {
  type Day,
  DAYS,
  DEFAULT_TRAINERS,
  emptyWeekSchedule,
  ensureWeekStore,
  type EditHistoryEntry,
  type ExtensionRecord,
  type NoteEntry,
  type Slot,
  type TrashEntry,
  type WeekStore,
  type WorkspacePayload,
} from "@/lib/dashboard/constants"
import { formatIstDate, formatYmd, getIstYmd } from "@/lib/time"

export type DashboardPersisted = Omit<WorkspacePayload, "_savedAt">

export function previousWeekKey(weekKey: string): string {
  const d = new Date(`${weekKey}T00:00:00`)
  d.setDate(d.getDate() - 7)
  return getWeekKey(formatYmd(d))
}

export function getWeekKey(d?: string): string {
  const dt = new Date(`${d ?? getIstYmd()}T00:00:00`)
  const day = dt.getDay()
  const diff = dt.getDate() - (day === 0 ? 6 : day - 1)
  const mon = new Date(dt)
  mon.setDate(diff)
  return formatYmd(mon)
}

/**
 * Pads date segments and snaps to the Monday-based week key used by the app,
 * so `userWeeks` / `allWeekData` keys still match after imports or legacy data.
 */
export function normalizeWeekKeyForLookup(wk: string): string {
  const t = wk.trim()
  const m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!m) return t
  const [, y, mo, da] = m
  const iso = `${y}-${mo.padStart(2, "0")}-${da.padStart(2, "0")}`
  return getWeekKey(iso)
}

export function fmtWeekRange(key: string): string {
  const mon = new Date(`${key}T00:00:00`)
  const sat = new Date(mon)
  sat.setDate(mon.getDate() + 5)
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
  }
  return `${formatIstDate(mon, opts)}  ${formatIstDate(sat, opts)}`
}

export function defaultPersistedState(): DashboardPersisted {
  const weekKey = getWeekKey()
  const scheduleByWeek: Record<string, Record<Day, Slot[]>> = {
    [weekKey]: emptyWeekSchedule(),
  }
  return {
    trainers: [...DEFAULT_TRAINERS],
    userWeeks: scheduleByWeek,
    allWeekData: {},
    learnerNotes: {},
    notifications: {},
    editHistory: [],
    extRecords: [],
    extId: 0,
    trashBin: [],
    slotId: 1101,
    msgId: 200,
    trackerId: 100,
    taskId: 1,
    deletedSlotIds: [],
  }
}

export function persistedFromRemote(raw: unknown): DashboardPersisted {
  const base = defaultPersistedState()
  if (!raw || typeof raw !== "object") return base

  const data = raw as Partial<WorkspacePayload>

  if (data.trainers && Array.isArray(data.trainers) && data.trainers.length) {
    base.trainers = data.trainers
  }

  const deleted = new Set<number>()
  base.deletedSlotIds.forEach((id) => deleted.add(Number(id)))
  if (data.deletedSlotIds && Array.isArray(data.deletedSlotIds)) {
    data.deletedSlotIds.forEach((id) => deleted.add(Number(id)))
  }
  base.deletedSlotIds = [...deleted]

  if (data.userWeeks && Object.keys(data.userWeeks).length) {
    Object.keys(data.userWeeks).forEach((wk) => {
      const remoteWeek = data.userWeeks![wk]
      if (!remoteWeek) return
      base.userWeeks[wk] = emptyWeekSchedule()
      DAYS.forEach((day) => {
        const arr = remoteWeek[day] ?? []
        base.userWeeks[wk][day] = arr.filter(
          (s: Slot | null | undefined) =>
            s && !deleted.has(Number((s as Slot).id))
        ) as Slot[]
      })
    })
  }

  if (data.allWeekData) {
    Object.keys(data.allWeekData).forEach((wk) => {
      if (data.allWeekData![wk]) {
        base.allWeekData[wk] = ensureWeekStore(
          data.allWeekData![wk] as Partial<WeekStore>
        )
      }
    })
  }

  if (data.learnerNotes && typeof data.learnerNotes === "object") {
    base.learnerNotes = data.learnerNotes as Record<string, NoteEntry[]>
  }

  if (data.notifications && typeof data.notifications === "object") {
    base.notifications = data.notifications as Record<string, unknown[]>
  }

  if (data.editHistory && Array.isArray(data.editHistory)) {
    const existingIds = new Set(base.editHistory.map((e) => e.id))
    ;(data.editHistory as EditHistoryEntry[]).forEach((e) => {
      if (!existingIds.has(e.id)) base.editHistory.push(e)
    })
    base.editHistory.sort((a, b) => b.id.localeCompare(a.id))
    if (base.editHistory.length > 500) base.editHistory.length = 500
  }

  if (typeof data.slotId === "number" && data.slotId > base.slotId)
    base.slotId = data.slotId
  if (typeof data.msgId === "number" && data.msgId > base.msgId)
    base.msgId = data.msgId
  if (typeof data.trackerId === "number" && data.trackerId > base.trackerId)
    base.trackerId = data.trackerId
  if (typeof data.taskId === "number" && data.taskId > base.taskId)
    base.taskId = data.taskId
  if (typeof data.extId === "number") base.extId = data.extId
  if (data.extRecords && Array.isArray(data.extRecords))
    base.extRecords = data.extRecords as ExtensionRecord[]
  if (data.trashBin && Array.isArray(data.trashBin))
    base.trashBin = data.trashBin as TrashEntry[]

  return base
}

/** Merge a remote payload into current local state (multi-tab / realtime). */
export function mergeRemoteIntoLocal(
  local: DashboardPersisted,
  remote: unknown
): DashboardPersisted {
  if (!remote || typeof remote !== "object") return local
  const data = remote as Partial<WorkspacePayload>
  const base = structuredClone(local)

  if (data.trainers && Array.isArray(data.trainers) && data.trainers.length) {
    base.trainers = data.trainers
  }

  const deleted = new Set(base.deletedSlotIds)
  if (data.deletedSlotIds && Array.isArray(data.deletedSlotIds)) {
    data.deletedSlotIds.forEach((id) => deleted.add(Number(id)))
  }
  base.deletedSlotIds = [...deleted]

  if (data.userWeeks && Object.keys(data.userWeeks).length) {
    Object.keys(data.userWeeks).forEach((wk) => {
      const remoteWeek = data.userWeeks![wk]
      if (!remoteWeek) return
      if (!base.userWeeks[wk]) base.userWeeks[wk] = emptyWeekSchedule()
      DAYS.forEach((day) => {
        base.userWeeks[wk][day] = (remoteWeek[day] ?? []).filter(
          (s: Slot | null | undefined) =>
            s && !deleted.has(Number((s as Slot).id))
        ) as Slot[]
      })
    })
  }

  if (data.allWeekData) {
    Object.keys(data.allWeekData).forEach((wk) => {
      if (data.allWeekData![wk]) {
        base.allWeekData[wk] = ensureWeekStore(
          data.allWeekData![wk] as Partial<WeekStore>
        )
      }
    })
  }

  if (data.learnerNotes && typeof data.learnerNotes === "object") {
    base.learnerNotes = data.learnerNotes as Record<string, NoteEntry[]>
  }

  if (data.notifications && typeof data.notifications === "object") {
    base.notifications = data.notifications as Record<string, unknown[]>
  }

  if (data.editHistory && Array.isArray(data.editHistory)) {
    const existingIds = new Set(base.editHistory.map((e) => e.id))
    ;(data.editHistory as EditHistoryEntry[]).forEach((e) => {
      if (!existingIds.has(e.id)) base.editHistory.push(e)
    })
    base.editHistory.sort((a, b) => b.id.localeCompare(a.id))
    if (base.editHistory.length > 500) base.editHistory.length = 500
  }

  if (data.slotId && data.slotId > base.slotId) base.slotId = data.slotId
  if (data.msgId && data.msgId > base.msgId) base.msgId = data.msgId
  if (data.trackerId && data.trackerId > base.trackerId)
    base.trackerId = data.trackerId
  if (data.taskId && data.taskId > base.taskId) base.taskId = data.taskId
  if (typeof data.extId === "number") base.extId = data.extId
  if (data.extRecords && Array.isArray(data.extRecords))
    base.extRecords = data.extRecords as ExtensionRecord[]
  if (data.trashBin && Array.isArray(data.trashBin))
    base.trashBin = data.trashBin as TrashEntry[]

  return base
}

export function buildPayload(persisted: DashboardPersisted): WorkspacePayload {
  const deleted = new Set(persisted.deletedSlotIds)
  const userWeeks: Record<string, Record<Day, Slot[]>> = {}
  Object.keys(persisted.userWeeks).forEach((wk) => {
    userWeeks[wk] = emptyWeekSchedule()
    DAYS.forEach((d) => {
      userWeeks[wk][d] = (persisted.userWeeks[wk]?.[d] ?? []).filter(
        (s) => s && !deleted.has(Number(s.id))
      )
    })
  })

  return {
    trainers: persisted.trainers,
    userWeeks,
    allWeekData: persisted.allWeekData as WorkspacePayload["allWeekData"],
    learnerNotes: persisted.learnerNotes,
    notifications: persisted.notifications,
    editHistory: persisted.editHistory,
    extRecords: persisted.extRecords,
    extId: persisted.extId,
    trashBin: persisted.trashBin,
    slotId: persisted.slotId,
    msgId: persisted.msgId,
    trackerId: persisted.trackerId,
    taskId: persisted.taskId,
    deletedSlotIds: [...persisted.deletedSlotIds],
    _savedAt: Date.now(),
  }
}
