import {
  DAYS,
  normLearnerKey,
  type Day,
  type Slot,
  type TrackerEntry,
} from "@/lib/dashboard/constants"

export function normLearnerName(n: string | undefined): string {
  return normLearnerKey(n)
}

/** Robust learner match between schedule row and tracker row */
export function learnersMatch(schedName: string, trackerName: string): boolean {
  const a = normLearnerName(schedName)
  const b = normLearnerName(trackerName)
  if (!a || !b) return false
  if (a === b) return true
  const wa = a.split(" ").filter(Boolean)
  const wb = b.split(" ").filter(Boolean)
  const fa = wa[0] || ""
  const fb = wb[0] || ""
  const sa = wa[1] || ""
  const sb = wb[1] || ""
  if (fa === fb && fa.length >= 3) {
    if (sa && sb && sa === sb) return true
    if (!sa && !sb) return true
    if (!sa && wb.length >= 1) return false
    if (!sb && wa.length >= 1) return false
  }
  return false
}

export function getSlotsForLearner(
  schedule: Record<Day, Slot[]>,
  trackerName: string
): number[] {
  const ids: number[] = []
  DAYS.forEach((day) => {
    ;(schedule[day] ?? []).forEach((s) => {
      if (learnersMatch(s.learner, trackerName)) ids.push(s.id)
    })
  })
  return ids
}

const SESSION_TYPE_SKIP =
  /^(intro|portfolio|garment|mood board|exam|range|revision|double trouble|all)/i

export function buildTrackerRowsFromSchedule(
  schedule: Record<Day, Slot[]>,
  weekRangeLabel: string
): Omit<TrackerEntry, "id">[] {
  const seen: Record<
    string,
    {
      name: string
      trainer: string
      batch: string
      week: string
      target: number
      notes: string
    }
  > = {}
  DAYS.forEach((day) => {
    ;(schedule[day] ?? []).forEach((s) => {
      const name = s.learner.trim()
      if (!name) return
      if (SESSION_TYPE_SKIP.test(name)) return
      const key = name.toLowerCase()
      if (!seen[key]) {
        seen[key] = {
          name,
          trainer: s.trainer || "",
          batch: "",
          week: weekRangeLabel,
          target: 1,
          notes: "",
        }
      } else {
        seen[key].target++
        if (!seen[key].trainer && s.trainer) seen[key].trainer = s.trainer
      }
    })
  })
  return Object.values(seen)
}

export function mergeTrackerFromSchedule(
  existing: TrackerEntry[],
  trackerId: number,
  schedule: Record<Day, Slot[]>,
  weekRangeLabel: string,
  excludedFromSync: Iterable<string> = []
): { next: TrackerEntry[]; nextId: number; changed: boolean } {
  const excluded = new Set(
    [...excludedFromSync].map((n) => normLearnerKey(n)).filter(Boolean)
  )
  const fromSched = buildTrackerRowsFromSchedule(schedule, weekRangeLabel)
  const existingNames = new Set(existing.map((l) => l.name.toLowerCase()))
  let nextId = trackerId
  let changed = false
  const next = [...existing]
  for (const row of fromSched) {
    if (excluded.has(normLearnerKey(row.name))) continue
    if (!existingNames.has(row.name.toLowerCase())) {
      nextId += 1
      next.push({
        id: nextId,
        name: row.name,
        trainer: row.trainer,
        batch: row.batch,
        week: row.week,
        target: row.target,
        notes: row.notes,
      })
      existingNames.add(row.name.toLowerCase())
      changed = true
    }
  }
  return { next, nextId, changed }
}
