import {
  type Day,
  DAYS,
  FIXED_TIMES,
  type Slot,
  type WeekStore,
} from "@/lib/dashboard/constants"
import {
  getWeekKey,
  normalizeWeekKeyForLookup,
} from "@/lib/dashboard/merge-remote"
import { learnersMatch } from "@/lib/dashboard/tracker-utils"

/** Schedule time sort — mirrors index.html tmin() */
export function tmin(t: string): number {
  if (!t) return 9999
  const c = t.replace(/\s*(am|pm)/i, "")
  const p = c.split(":")
  let h = parseInt(p[0], 10) || 0
  const m = parseInt(p[1], 10) || 0
  if (h < 10 && h !== 0) h += 12
  return h * 60 + m
}

function tminMsg(t: string): number {
  if (!t) return -1
  const trimmed = t.trim().toLowerCase()
  const pm = trimmed.includes("pm")
  const am = trimmed.includes("am")
  const clean = trimmed.replace(/[apm]/g, "").trim()
  const parts = clean.split(":")
  let h = parseInt(parts[0], 10) || 0
  const m = parseInt(parts[1], 10) || 0
  if (pm && h !== 12) h += 12
  if (am && h === 12) h = 0
  return h * 60 + m
}

export function findSlotInWeek(
  scheduleByWeek: Record<string, Partial<Record<Day, Slot[]>>>,
  weekKey: string,
  id: number
): Slot | null {
  const w = scheduleByWeek[weekKey]
  if (!w) return null
  for (const d of DAYS) {
    const s = (w[d] ?? []).find((x) => x.id === id)
    if (s) return s
  }
  return null
}

export function setSlotWeekAtt(
  store: WeekStore,
  slotId: number,
  att: string
): WeekStore {
  const next = { ...store, attData: { ...store.attData } }
  const prev = next.attData[slotId] ?? { att: "", note: "" }
  next.attData[slotId] = { ...prev, att }
  return next
}

/** Resolve per-week payload when keys differ slightly between schedule and stores. */
export function resolveWeekAttStore(
  allWeekData: Record<string, Partial<WeekStore>> | undefined,
  weekKey: string
): Partial<WeekStore> | undefined {
  if (!allWeekData || !weekKey) return undefined
  const direct = allWeekData[weekKey]
  if (direct) return direct
  const norm = normalizeWeekKeyForLookup(weekKey)
  const byNorm = allWeekData[norm]
  if (byNorm) return byNorm
  for (const k of Object.keys(allWeekData)) {
    if (normalizeWeekKeyForLookup(k) === norm) return allWeekData[k]
  }
  return undefined
}

export function getSlotWeekData(
  store: WeekStore | undefined,
  slotId: number | string
): { att: string; note: string } {
  const ad = store?.attData ?? {}
  const n = typeof slotId === "number" ? slotId : Number(slotId)
  const candidates: (string | number)[] = []
  if (typeof slotId === "string") candidates.push(slotId)
  if (Number.isFinite(n)) {
    candidates.push(n, String(n))
  }
  let row: unknown
  for (const k of candidates) {
    if (k in ad) {
      row = (ad as Record<string | number, unknown>)[k]
      break
    }
  }
  if (row == null) return { att: "", note: "" }
  if (typeof row === "string") return { att: row, note: "" }
  const o = row as { att?: string; note?: string }
  return { att: o.att ?? "", note: o.note ?? "" }
}

export function getMsgSlotConflict(
  weekStore: WeekStore | undefined,
  trainerName: string,
  day: Day,
  sessionTimeStr: string
): { from: string; to: string } | null {
  if (!trainerName || !day || !sessionTimeStr || !weekStore) return null
  const msgSlotsForDay = weekStore.msgSlots?.[day] ?? []

  function sessionToMin(t: string): number {
    if (!t) return -1
    const ts = t.toString().trim()
    if (/[ap]m/i.test(ts)) return tminMsg(ts)
    const parts = ts.split(":")
    let h = parseInt(parts[0], 10) || 0
    const m = parseInt(parts[1], 10) || 0
    if (h >= 1 && h <= 9) h += 12
    return h * 60 + m
  }

  const sessionMin = sessionToMin(sessionTimeStr)

  const hit = msgSlotsForDay.find((ms) => {
    let tArr: string[] = []
    if (ms.trainers && Array.isArray(ms.trainers) && ms.trainers.length > 0) {
      tArr = ms.trainers
    } else if (
      ms.trainer &&
      typeof ms.trainer === "string" &&
      ms.trainer.trim()
    ) {
      tArr = ms.trainer
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    }
    if (tArr.length === 0) return false
    if (!tArr.includes(trainerName)) return false

    const fromMin = tminMsg(ms.from)
    const toMin = tminMsg(ms.to)
    if (fromMin < 0 || toMin < 0) return false

    if (fromMin > toMin) {
      return sessionMin >= fromMin || sessionMin < toMin
    }
    return sessionMin >= fromMin && sessionMin < toMin
  })

  return hit ? { from: hit.from, to: hit.to } : null
}

export function mergeScheduleTimesForDay(slots: Slot[]): string[] {
  const extraTimes = slots
    .map((s) => s.time)
    .filter(
      (t) => !FIXED_TIMES.includes(t as (typeof FIXED_TIMES)[number])
    )
  return [...new Set([...FIXED_TIMES, ...extraTimes])].sort(
    (a, b) => tmin(a) - tmin(b)
  )
}

export function normLearner(n: string): string {
  return (n || "")
    .toLowerCase()
    .replace(/[_\-()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function findDuplicateSlots(
  scheduleForWeek: Record<Day, Slot[]>,
  learnerName: string
): Array<Slot & { day: Day }> {
  const found: Array<Slot & { day: Day }> = []
  DAYS.forEach((day) => {
    ;(scheduleForWeek[day] ?? []).forEach((s) => {
      if (!s.learner?.trim()) return
      if (learnersMatch(s.learner, learnerName)) {
        found.push({ ...s, day })
      }
    })
  })
  return found
}

/** Monday-based week key for a calendar date YYYY-MM-DD */
export function weekKeyForCalendarDate(dateVal: string): string {
  return getWeekKey(dateVal)
}

export function dayNameFromDateStr(dateVal: string): Day {
  const d = new Date(`${dateVal}T00:00:00`)
  const names: Day[] = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ]
  return names[d.getDay()] as Day
}
