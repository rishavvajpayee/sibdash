import { DAYS, type Day, type Slot } from "@/lib/dashboard/constants"
import { fmtWeekRange } from "@/lib/dashboard/merge-remote"
import { tmin } from "@/lib/dashboard/schedule-utils"
import { formatIstDate, formatYmd, getIstYmd } from "@/lib/time"

export type SessionWithMeta = Slot & {
  day: Day
  weekKey: string
  slotDate: string
}

export function getMonthOptions(weekKeys: string[]): string[] {
  const months = new Set<string>()
  weekKeys.forEach((wk) => {
    const d = new Date(`${wk}T00:00:00`)
    months.add(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    )
  })
  months.add(getIstYmd().slice(0, 7))
  return [...months].sort().reverse()
}

export function fmtMonthLabel(ym: string): string {
  const [y, m] = ym.split("-")
  return formatIstDate(new Date(+y!, +m! - 1, 1), {
    month: "long",
    year: "numeric",
  })
}

export function getAllSessionsForMonth(
  userWeeks: Record<string, Record<Day, Slot[]>>,
  ym: string
): SessionWithMeta[] {
  const [y, m] = ym.split("-").map(Number)
  const results: SessionWithMeta[] = []
  Object.keys(userWeeks).forEach((wk) => {
    const wkDate = new Date(`${wk}T00:00:00`)
    let hasDay = false
    for (let i = 0; i < 7; i++) {
      const d2 = new Date(wkDate)
      d2.setDate(wkDate.getDate() + i)
      if (d2.getFullYear() === y && d2.getMonth() + 1 === m) {
        hasDay = true
        break
      }
    }
    if (!hasDay) return
    const weekSched = userWeeks[wk]
    if (!weekSched) return
    DAYS.forEach((day, di) => {
      ;(weekSched[day] ?? []).forEach((s) => {
        if (!s.learner) return
        const slotDate = new Date(wkDate)
        slotDate.setDate(wkDate.getDate() + di)
        if (
          slotDate.getFullYear() !== y ||
          slotDate.getMonth() + 1 !== m
        ) {
          return
        }
        results.push({
          ...s,
          day,
          weekKey: wk,
          slotDate: formatYmd(slotDate),
        })
      })
    })
  })
  return results.sort(
    (a, b) =>
      a.slotDate.localeCompare(b.slotDate) || tmin(a.time) - tmin(b.time)
  )
}

export function fmtWeekRangeLabel(weekKey: string): string {
  return fmtWeekRange(weekKey)
}
