"use client"

import * as React from "react"

import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DAYS,
  type Day,
  type WeekStore,
  ensureWeekStore,
} from "@/lib/dashboard/constants"
import { initials, trainerHex } from "@/lib/dashboard/trainer-colors"
import { fmtWeekRange } from "@/lib/dashboard/merge-remote"
import {
  fmtMonthLabel,
  getAllSessionsForMonth,
  getMonthOptions,
  type SessionWithMeta,
} from "@/lib/dashboard/trainer-report"
import {
  getSlotWeekData,
  resolveWeekAttStore,
  tmin,
  weekKeyForCalendarDate,
} from "@/lib/dashboard/schedule-utils"
import { cn } from "@/lib/utils"

type View = "day" | "month"

function attBadge(att: string) {
  if (att === "P")
    return (
      <Badge className="border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
        P
      </Badge>
    )
  if (att === "A")
    return (
      <Badge className="border-red-500/40 bg-red-500/15 text-red-400">A</Badge>
    )
  if (att === "NC")
    return (
      <Badge className="border-amber-500/40 bg-amber-500/15 text-amber-400">
        NC
      </Badge>
    )
  if (att === "RS")
    return (
      <Badge className="border-purple-500/40 bg-purple-500/15 text-purple-300">
        RS
      </Badge>
    )
  return <span className="text-muted-foreground text-xs">—</span>
}

function weekStoreForMonthlySession(
  allWeekData: Record<string, Partial<WeekStore>>,
  s: SessionWithMeta
): WeekStore | null {
  const raw =
    resolveWeekAttStore(allWeekData, s.weekKey) ??
    (s.slotDate
      ? resolveWeekAttStore(allWeekData, weekKeyForCalendarDate(s.slotDate))
      : undefined)
  return raw ? ensureWeekStore(raw) : null
}

export function TrainerLogTab() {
  const {
    persisted,
    schedule,
    weekStore,
    currentWeekKey,
    fmtWeekRange,
    shiftWeek,
    trainers,
  } = useDashboard()

  const [view, setView] = React.useState<View>("day")
  const [filterTrainer, setFilterTrainer] = React.useState("")
  const [monthYm, setMonthYm] = React.useState("")
  const [monthTrainer, setMonthTrainer] = React.useState("")

  const weekKeys = React.useMemo(
    () => Object.keys(persisted.userWeeks),
    [persisted.userWeeks]
  )

  const monthOptions = React.useMemo(() => getMonthOptions(weekKeys), [weekKeys])

  const selectedYm = monthYm || monthOptions[0] || ""

  const monthSessions = React.useMemo(() => {
    if (!selectedYm) return []
    return getAllSessionsForMonth(persisted.userWeeks, selectedYm)
  }, [persisted.userWeeks, selectedYm])

  const filteredMonthSessions = React.useMemo(() => {
    if (!monthTrainer) return monthSessions
    return monthSessions.filter(
      (s) => s.trainer === monthTrainer || s.coTrainer === monthTrainer
    )
  }, [monthSessions, monthTrainer])

  const logRows = React.useMemo(() => {
    const f = filterTrainer
    const all = DAYS.flatMap((d) =>
      (schedule[d] ?? []).map((s) => ({ ...s, day: d as Day }))
    )
    return all
      .filter(
        (s) =>
          s.learner &&
          (!f || s.trainer === f || s.coTrainer === f || s.trainer === "All")
      )
      .sort(
        (a, b) =>
          DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || tmin(a.time) - tmin(b.time)
      )
  }, [schedule, filterTrainer])

  const shownTrainers = filterTrainer
    ? trainers.filter((t) => t === filterTrainer)
    : trainers

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="bg-muted/40 flex rounded-lg border p-0.5">
          <Button
            type="button"
            variant={view === "day" ? "default" : "ghost"}
            size="sm"
            className="rounded-md"
            onClick={() => setView("day")}
          >
            Day-wise
          </Button>
          <Button
            type="button"
            variant={view === "month" ? "default" : "ghost"}
            size="sm"
            className="rounded-md"
            onClick={() => setView("month")}
          >
            Monthly
          </Button>
        </div>

        {view === "day" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={filterTrainer || "__all__"}
              onValueChange={(v) => setFilterTrainer(v === "__all__" ? "" : v)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All trainers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All trainers</SelectItem>
                {trainers.map((t: string) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground text-sm">
              Week of{" "}
              <strong className="text-foreground">{fmtWeekRange(currentWeekKey)}</strong>
            </span>
            <div className="ml-auto flex gap-1">
              <Button variant="outline" size="sm" onClick={() => shiftWeek(-1)}>
                Prev week
              </Button>
              <Button variant="outline" size="sm" onClick={() => shiftWeek(1)}>
                Next week
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedYm} onValueChange={setMonthYm}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((ym) => (
                  <SelectItem key={ym} value={ym}>
                    {fmtMonthLabel(ym)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={monthTrainer || "__all__"}
              onValueChange={(v) => setMonthTrainer(v === "__all__" ? "" : v)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All trainers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All trainers</SelectItem>
                {trainers.map((t: string) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {view === "day" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {shownTrainers.map((t: string) => {
              const col = trainerHex(trainers, t)
              const all = DAYS.flatMap((d) =>
                (schedule[d] ?? []).filter(
                  (s) =>
                    s.learner &&
                    (s.trainer === t || s.trainer === "All" || s.coTrainer === t)
                )
              )
              const tot = all.length
              const p = all.filter(
                (s) => getSlotWeekData(weekStore, s.id).att === "P"
              ).length
              const a = all.filter(
                (s) => getSlotWeekData(weekStore, s.id).att === "A"
              ).length
              const coCount = DAYS.flatMap((d) =>
                (schedule[d] ?? []).filter((s) => s.coTrainer === t && s.learner)
              ).length
              return (
                <Card key={t} className="border-border/80 overflow-hidden">
                  <div className="h-0.5 w-full" style={{ background: col }} />
                  <CardContent className="space-y-3 pt-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{ background: col }}
                      >
                        {initials(t)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{t}</div>
                        <div className="text-muted-foreground text-xs">
                          Trainer
                          {coCount > 0 ? (
                            <span className="text-brand-cyan">
                              {" "}
                              · {coCount} co-sessions
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-muted/40 rounded-md py-2">
                        <div className="text-lg font-bold">{tot}</div>
                        <div className="text-muted-foreground text-[10px] uppercase tracking-wide">
                          Sessions
                        </div>
                      </div>
                      <div className="bg-muted/40 rounded-md py-2">
                        <div className="text-lg font-bold text-emerald-400">{p}</div>
                        <div className="text-muted-foreground text-[10px] uppercase tracking-wide">
                          Present
                        </div>
                      </div>
                      <div className="bg-muted/40 rounded-md py-2">
                        <div className="text-lg font-bold text-red-400">{a}</div>
                        <div className="text-muted-foreground text-[10px] uppercase tracking-wide">
                          Absent
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 border-t pt-2">
                      {DAYS.map((d) => {
                        const daySessions = (schedule[d] ?? []).filter(
                          (s) =>
                            s.learner &&
                            (s.trainer === t ||
                              s.trainer === "All" ||
                              s.coTrainer === t)
                        )
                        if (!daySessions.length) return null
                        const dp = daySessions.filter(
                          (s) => getSlotWeekData(weekStore, s.id).att === "P"
                        ).length
                        return (
                          <span
                            key={d}
                            className="bg-muted/60 text-muted-foreground rounded px-1.5 py-0.5 text-[10px]"
                          >
                            {d.slice(0, 3)}:{" "}
                            <strong className="text-foreground">
                              {daySessions.length}
                            </strong>
                            {dp > 0 ? (
                              <span className="text-emerald-400"> {dp}P</span>
                            ) : null}
                          </span>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="border-b px-4 py-3">
                <h3 className="font-heading text-sm font-bold uppercase tracking-wide">
                  Trainer session log
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="bg-muted/30 text-muted-foreground border-b text-left text-[10px] uppercase tracking-wider">
                      <th className="px-3 py-2">Day</th>
                      <th className="px-3 py-2">Time</th>
                      <th className="px-3 py-2">Learner</th>
                      <th className="px-3 py-2">Trainer</th>
                      <th className="px-3 py-2">Attendance</th>
                      <th className="px-3 py-2">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!logRows.length ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="text-muted-foreground px-4 py-10 text-center italic"
                        >
                          No sessions found.
                        </td>
                      </tr>
                    ) : (
                      logRows.map((s) => {
                        const att = getSlotWeekData(weekStore, s.id).att
                        const col = trainerHex(trainers, s.trainer || "")
                        return (
                          <tr
                            key={`${s.day}-${s.id}`}
                            className="border-border/60 border-b last:border-0"
                          >
                            <td className="text-muted-foreground px-3 py-2">
                              {s.day.slice(0, 3)}
                            </td>
                            <td className="px-3 py-2 font-semibold">{s.time}</td>
                            <td className="px-3 py-2">{s.learner}</td>
                            <td className="px-3 py-2">
                              <span className="inline-flex flex-wrap items-center gap-1">
                                <span
                                  className="inline-block size-2 shrink-0 rounded-full"
                                  style={{ background: col }}
                                />
                                {s.trainer || "—"}
                                {s.coTrainer ? (
                                  <Badge variant="outline" className="text-[10px]">
                                    +{s.coTrainer}
                                  </Badge>
                                ) : null}
                              </span>
                            </td>
                            <td className="px-3 py-2">{attBadge(att)}</td>
                            <td className="text-muted-foreground px-3 py-2">
                              <span className="bg-muted rounded px-1.5 py-0.5 text-xs">
                                {s.type || "Regular"}
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <MonthlyTrainerBody
          trainers={trainers}
          monthYm={selectedYm}
          sessions={filteredMonthSessions}
          allWeekData={persisted.allWeekData}
          monthTrainer={monthTrainer}
        />
      )}
    </div>
  )
}

function MonthlyTrainerBody({
  trainers,
  monthYm,
  sessions,
  allWeekData,
  monthTrainer,
}: {
  trainers: string[]
  monthYm: string
  sessions: SessionWithMeta[]
  allWeekData: Record<string, Partial<WeekStore>>
  monthTrainer: string
}) {
  const shownTrainers = monthTrainer ? [monthTrainer] : trainers

  const cards = shownTrainers
    .map((t: string) => {
      const col = trainerHex(trainers, t)
      const tSessions = sessions.filter(
        (s) =>
          s.trainer === t || s.trainer === "All" || s.coTrainer === t
      )
      const tot = tSessions.length
      const attData = tSessions.map((s) => {
        const wkStore = weekStoreForMonthlySession(allWeekData, s)
        return getSlotWeekData(wkStore ?? undefined, s.id).att || ""
      })
      const p = attData.filter((a) => a === "P").length
      const a = attData.filter((x) => x === "A").length
      const nc = attData.filter((x) => x === "NC").length
      const rs = attData.filter((x) => x === "RS").length
      const pct = tot > 0 ? Math.round((p / tot) * 100) : 0
      const barColor =
        pct >= 75 ? "#22c55e" : pct >= 50 ? "#F7C325" : "#ef4444"
      return (
        <Card key={t} className="border-border/80 overflow-hidden">
          <div className="h-0.5 w-full" style={{ background: col }} />
          <CardContent className="space-y-3 pt-4">
            <div className="flex items-center gap-2">
              <div
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ background: col }}
              >
                {initials(t)}
              </div>
              <div>
                <div className="font-semibold">{t}</div>
                <div className="text-muted-foreground text-xs">
                  {monthYm ? fmtMonthLabel(monthYm) : ""}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-muted/40 rounded-md py-2">
                <div className="text-lg font-bold">{tot}</div>
                <div className="text-muted-foreground text-[10px] uppercase">
                  Sessions
                </div>
              </div>
              <div className="bg-muted/40 rounded-md py-2">
                <div className="text-lg font-bold text-emerald-400">{p}</div>
                <div className="text-muted-foreground text-[10px] uppercase">
                  Present
                </div>
              </div>
              <div className="bg-muted/40 rounded-md py-2">
                <div className="text-lg font-bold text-red-400">{a}</div>
                <div className="text-muted-foreground text-[10px] uppercase">
                  Absent
                </div>
              </div>
            </div>
            <div className="space-y-1 border-t pt-2">
              <div className="text-muted-foreground flex justify-between text-[10px] uppercase">
                <span>Attendance rate</span>
                <span className="font-bold" style={{ color: barColor }}>
                  {pct}%
                </span>
              </div>
              <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: barColor }}
                />
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                {nc > 0 ? (
                  <Badge variant="outline" className="text-[10px] text-amber-400">
                    {nc} NC
                  </Badge>
                ) : null}
                {rs > 0 ? (
                  <Badge variant="outline" className="text-[10px] text-purple-300">
                    {rs} RS
                  </Badge>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      )
    })
    .filter(Boolean)

  const byWeek: Record<string, SessionWithMeta[]> = {}
  sessions.forEach((s) => {
    if (!byWeek[s.weekKey]) byWeek[s.weekKey] = []
    byWeek[s.weekKey]!.push(s)
  })

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards}
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <h3 className="font-heading text-sm font-bold uppercase tracking-wide">
              Monthly session log
            </h3>
            <Badge variant="secondary">
              {sessions.length} sessions
              {monthYm ? ` · ${fmtMonthLabel(monthYm)}` : ""}
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="bg-muted/30 text-muted-foreground border-b text-left text-[10px] uppercase tracking-wider">
                  <th className="px-3 py-2">Week</th>
                  <th className="px-3 py-2">Day</th>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Learner</th>
                  <th className="px-3 py-2">Trainer</th>
                  <th className="px-3 py-2">Attendance</th>
                  <th className="px-3 py-2">Type</th>
                </tr>
              </thead>
              <tbody>
                {!sessions.length ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-muted-foreground px-4 py-10 text-center italic"
                    >
                      No sessions found for this month.
                    </td>
                  </tr>
                ) : (
                  Object.keys(byWeek)
                    .sort()
                    .flatMap((wk) => {
                      const wkSessions = byWeek[wk]!
                      const weekLabel = fmtWeekRange(wk)
                      return wkSessions.map((s, rowIdx) => {
                        const wkStore = weekStoreForMonthlySession(allWeekData, s)
                        const att =
                          getSlotWeekData(wkStore ?? undefined, s.id).att || ""
                        const col = trainerHex(trainers, s.trainer || "")
                        return (
                          <tr
                            key={`${wk}-${s.id}-${s.slotDate}`}
                            className={cn(
                              "border-border/60 border-b last:border-0",
                              rowIdx === 0 && "border-t-2 border-t-border"
                            )}
                          >
                            {rowIdx === 0 ? (
                              <td
                                rowSpan={wkSessions.length}
                                className="text-brand-cyan align-top px-3 py-2 text-xs font-semibold whitespace-nowrap"
                              >
                                {weekLabel}
                              </td>
                            ) : null}
                            <td className="text-muted-foreground px-3 py-2">
                              {s.day.slice(0, 3)}{" "}
                              {s.slotDate.slice(5).replace("-", "/")}
                            </td>
                            <td className="px-3 py-2 font-semibold">{s.time}</td>
                            <td className="px-3 py-2">{s.learner}</td>
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center gap-1">
                                <span
                                  className="inline-block size-2 rounded-full"
                                  style={{ background: col }}
                                />
                                {s.trainer || ""}
                                {s.coTrainer ? (
                                  <Badge variant="outline" className="text-[10px]">
                                    +{s.coTrainer}
                                  </Badge>
                                ) : null}
                              </span>
                            </td>
                            <td className="px-3 py-2">{attBadge(att)}</td>
                            <td className="text-muted-foreground px-3 py-2">
                              <span className="bg-muted rounded px-1.5 text-xs">
                                {s.type || "Regular"}
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
