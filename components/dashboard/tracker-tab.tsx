"use client"

import * as React from "react"
import { CalendarDays, Search, Trash2 } from "lucide-react"

import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  DAYS,
  type Day,
  type Slot,
  type TrackerEntry,
  type WeekStore,
} from "@/lib/dashboard/constants"
import { trainerHex } from "@/lib/dashboard/trainer-colors"
import { getSlotWeekData } from "@/lib/dashboard/schedule-utils"
import { learnersMatch } from "@/lib/dashboard/tracker-utils"
import { cn } from "@/lib/utils"

const dayCellClass =
  "relative flex h-9 w-9 shrink-0 cursor-default items-center justify-center rounded-lg border text-xs font-semibold tabular-nums"

export function TrackerTab() {
  const {
    schedule,
    weekStore,
    persisted,
    currentWeekKey,
    fmtWeekRange,
    trainers,
    syncTrackerFromSchedule,
    addOrUpdateTrackerLearner,
    removeTrackerLearner,
    updateSlotSessionNote,
  } = useDashboard()

  const [search, setSearch] = React.useState("")
  const [trainerF, setTrainerF] = React.useState("")
  const [trackerDay, setTrackerDay] = React.useState<Day | "">("")

  const [name, setName] = React.useState("")
  const [trainer, setTrainer] = React.useState("")
  const [batch, setBatch] = React.useState("")
  const [formWeekKey, setFormWeekKey] = React.useState(currentWeekKey)
  const [target, setTarget] = React.useState("5")

  const [sessionNoteOpen, setSessionNoteOpen] = React.useState(false)
  const [sessionNoteSlotId, setSessionNoteSlotId] = React.useState<
    number | null
  >(null)
  const [sessionNoteDraft, setSessionNoteDraft] = React.useState("")

  const weekPickerKeys = React.useMemo(() => {
    const keys = new Set<string>(Object.keys(persisted.userWeeks))
    keys.add(currentWeekKey)
    return Array.from(keys).sort()
  }, [persisted.userWeeks, currentWeekKey])

  React.useEffect(() => {
    syncTrackerFromSchedule()
  }, [syncTrackerFromSchedule, schedule, currentWeekKey])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset week picker when dashboard week changes
    setFormWeekKey(currentWeekKey)
  }, [currentWeekKey])

  const rows = React.useMemo(() => {
    let data = [...weekStore.tracker]
    const q = search.toLowerCase()
    if (q) {
      data = data.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.batch || "").toLowerCase().includes(q)
      )
    }
    if (trainerF) data = data.filter((l) => l.trainer === trainerF)
    if (trackerDay) {
      data = data.filter((l) =>
        (schedule[trackerDay] ?? []).some((s) =>
          learnersMatch(s.learner, l.name)
        )
      )
    }
    return data
  }, [weekStore.tracker, search, trainerF, trackerDay, schedule])

  function openSessionNote(slotId: number) {
    const cur = getSlotWeekData(weekStore, slotId).note
    setSessionNoteSlotId(slotId)
    setSessionNoteDraft(cur)
    setSessionNoteOpen(true)
  }

  function submitSessionNote() {
    if (sessionNoteSlotId == null) return
    updateSlotSessionNote(sessionNoteSlotId, sessionNoteDraft)
    setSessionNoteOpen(false)
  }

  function onAddTracker(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const weekKeyForLabel = weekPickerKeys.includes(formWeekKey)
      ? formWeekKey
      : currentWeekKey
    addOrUpdateTrackerLearner({
      name: name.trim(),
      trainer,
      batch: batch.trim(),
      week: fmtWeekRange(weekKeyForLabel),
      target: parseInt(target, 10) || 5,
      notes: "",
    })
    setName("")
    setBatch("")
    setTarget("5")
    setTrainer("")
  }

  const daysToShow: (Day | "")[] = trackerDay ? [trackerDay] : [...DAYS]
  const daysOnly = daysToShow.filter(Boolean) as Day[]

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden rounded-2xl border shadow-sm">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-widest">
                Lecture tracker
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-background inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium shadow-xs">
                  <CalendarDays className="text-muted-foreground size-4 shrink-0" />
                  <span className="tabular-nums">{fmtWeekRange(currentWeekKey)}</span>
                </span>
                <span className="text-muted-foreground text-sm">
                  {rows.length} learner{rows.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
            <div className="flex w-full min-w-0 flex-col gap-2 sm:max-w-md sm:flex-row sm:items-center lg:max-w-lg">
              <div className="relative min-w-0 flex-1">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  className="h-10 rounded-xl pl-10"
                  placeholder="Search learner…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select
                value={trainerF || "__all__"}
                onValueChange={(v) => setTrainerF(v === "__all__" ? "" : v)}
              >
                <SelectTrigger className="h-10 w-full rounded-xl sm:w-[180px]">
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
          </div>

          <div className="bg-muted/50 -mx-1 flex gap-1 overflow-x-auto rounded-xl border p-1 sm:mx-0">
            <Button
              type="button"
              variant={trackerDay === "" ? "default" : "ghost"}
              size="sm"
              className={cn(
                "shrink-0 rounded-lg px-3",
                trackerDay === "" && "shadow-sm"
              )}
              onClick={() => setTrackerDay("")}
            >
              All days
            </Button>
            {DAYS.map((d) => (
              <Button
                key={d}
                type="button"
                variant={trackerDay === d ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "shrink-0 rounded-lg px-3 font-medium",
                  trackerDay === d && "shadow-sm"
                )}
                onClick={() => setTrackerDay(d)}
              >
                {d.slice(0, 3)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-dashed border-muted-foreground/20 bg-muted/10">
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="font-heading text-base">
            Add or update learner
          </CardTitle>
          <p className="text-muted-foreground text-xs">
            Names should match the schedule so day cells link to the right
            sessions.
          </p>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={onAddTracker}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
          >
            <div className="space-y-1.5 xl:col-span-2">
              <Label className="text-xs">Learner name</Label>
              <Input
                className="h-10 rounded-xl"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name (match schedule)"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Trainer</Label>
              <Select value={trainer || "__none__"} onValueChange={(v) => setTrainer(v === "__none__" ? "" : v)}>
                <SelectTrigger className="h-10 w-full rounded-xl">
                  <SelectValue placeholder="Select trainer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {trainers.map((t: string) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Batch / programme</Label>
              <Input
                className="h-10 rounded-xl"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Week</Label>
              <Select
                value={
                  weekPickerKeys.includes(formWeekKey)
                    ? formWeekKey
                    : currentWeekKey
                }
                onValueChange={setFormWeekKey}
              >
                <SelectTrigger className="h-10 w-full rounded-xl">
                  <SelectValue placeholder="Select week" />
                </SelectTrigger>
                <SelectContent>
                  {weekPickerKeys.map((wk) => (
                    <SelectItem key={wk} value={wk}>
                      {fmtWeekRange(wk)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Target / week</Label>
              <Input
                className="h-10 rounded-xl"
                type="number"
                min={1}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-6">
              <Button type="submit" className="rounded-xl">
                Save to tracker
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setName("")
                  setBatch("")
                  setFormWeekKey(currentWeekKey)
                  setTarget("5")
                  setTrainer("")
                }}
              >
                Clear
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section aria-label="Learner tracker list">
        {!rows.length ? (
          <Card className="rounded-2xl border shadow-sm">
            <CardContent className="text-muted-foreground px-4 py-14 text-center text-sm">
              No learners match your filters.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {rows.map((l) => (
              <TrackerLearnerCard
                key={l.id}
                entry={l}
                schedule={schedule}
                weekStore={weekStore}
                trainers={trainers}
                daysToShow={daysOnly}
                onDelete={() => removeTrackerLearner(l.id)}
                onOpenSessionNote={openSessionNote}
              />
            ))}
          </div>
        )}
      </section>

      <Dialog open={sessionNoteOpen} onOpenChange={setSessionNoteOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Session note</DialogTitle>
          </DialogHeader>
          <Textarea
            value={sessionNoteDraft}
            onChange={(e) => setSessionNoteDraft(e.target.value)}
            rows={3}
            className="rounded-xl"
          />
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setSessionNoteOpen(false)}
            >
              Cancel
            </Button>
            <Button className="rounded-xl" onClick={submitSessionNote}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TrackerLearnerCard({
  entry,
  schedule,
  weekStore,
  trainers,
  daysToShow,
  onDelete,
  onOpenSessionNote,
}: {
  entry: TrackerEntry
  schedule: Record<Day, Slot[]>
  weekStore: WeekStore
  trainers: string[]
  daysToShow: Day[]
  onDelete: () => void
  onOpenSessionNote: (slotId: number) => void
}) {
  const l = entry
  const tcolor = trainerHex(trainers, l.trainer || "")

  const totalPresent = React.useMemo(() => {
    let t = 0
    for (const day of daysToShow) {
      const daySessions = (schedule[day] ?? []).filter((s) =>
        learnersMatch(s.learner, l.name)
      )
      t += daySessions.filter(
        (s) => getSlotWeekData(weekStore, s.id).att === "P"
      ).length
    }
    return t
  }, [daysToShow, schedule, weekStore, l.name])

  const rsAllDays = DAYS.reduce((acc, day) => {
    return (
      acc +
      (schedule[day] ?? []).filter(
        (s) =>
          learnersMatch(s.learner, l.name) &&
          getSlotWeekData(weekStore, s.id).att === "RS"
      ).length
    )
  }, 0)

  const target = l.target && l.target > 0 ? l.target : 5
  const pct = Math.min(100, Math.round((totalPresent / target) * 100))
  const bc = pct >= 100 ? "#22c55e" : pct >= 60 ? "#F7C325" : "#ef4444"
  let statusLabel = ""
  let statusVariant: "ok" | "mid" | "low" = "low"
  if (pct >= 100) {
    statusLabel = "On track"
    statusVariant = "ok"
  } else if (pct >= 60) {
    statusLabel = `${totalPresent}/${target}`
    statusVariant = "mid"
  } else {
    statusLabel = `${totalPresent}/${target}`
    statusVariant = "low"
  }

  const badgeClass =
    statusVariant === "ok"
      ? "border-emerald-500/50 bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
      : statusVariant === "mid"
        ? "border-amber-500/50 bg-amber-500/12 text-amber-700 dark:text-amber-400"
        : "border-red-500/50 bg-red-500/12 text-red-600 dark:text-red-400"

  const detailLabel =
    pct >= 100
      ? "All sessions done"
      : pct >= 60
        ? "Most sessions done"
        : `Target ${target} / week`

  return (
    <Card
      className={cn(
        "rounded-2xl border shadow-sm transition-colors duration-200",
        "motion-reduce:transition-none",
        "hover:border-border/90 hover:bg-muted/20"
      )}
    >
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 gap-3">
            <div
              className="w-1 shrink-0 self-stretch rounded-full"
              style={{
                backgroundColor: l.trainer ? tcolor : "hsl(var(--border))",
              }}
              aria-hidden
            />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="truncate font-semibold tracking-tight">{l.name}</div>
              <div className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
                {l.trainer ? (
                  <>
                    <span
                      className="inline-block size-1.5 shrink-0 rounded-full"
                      style={{ background: tcolor }}
                    />
                    <span className="truncate" style={{ color: tcolor }}>
                      {l.trainer}
                    </span>
                  </>
                ) : null}
                {l.batch ? (
                  <span className="text-muted-foreground/80 max-w-[12rem] truncate">
                    {l.batch}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive size-9 shrink-0 rounded-xl"
            onClick={onDelete}
            aria-label={`Remove ${l.name} from tracker`}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-end justify-center gap-x-1 gap-y-3 sm:justify-between">
          {daysToShow.map((day) => (
            <DayColumn
              key={day}
              day={day}
              schedule={schedule}
              weekStore={weekStore}
              learnerName={l.name}
              onOpenSessionNote={onOpenSessionNote}
            />
          ))}
          <div className="flex flex-col items-center gap-1">
            <span className="text-muted-foreground text-[9px] font-semibold tracking-wide uppercase">
              RS
            </span>
            <div
              className={cn(
                dayCellClass,
                rsAllDays > 0
                  ? "border-purple-500/45 bg-purple-500/12 text-purple-300"
                  : "text-muted-foreground/50 border-border/40 bg-transparent font-normal"
              )}
            >
              {rsAllDays > 0 ? rsAllDays : "—"}
            </div>
          </div>
        </div>

        <div className="border-border/60 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="text-muted-foreground flex items-center justify-between gap-2 text-[10px] font-medium uppercase tracking-wide">
              <span>Progress</span>
              <span className="tabular-nums">
                {totalPresent} / {target}
              </span>
            </div>
            <div
              className="bg-muted/80 h-1.5 w-full overflow-hidden rounded-full"
              title={detailLabel}
            >
              <div
                className="h-full max-w-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${pct}%`, background: bc }}
              />
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "h-7 shrink-0 px-2.5 text-[10px] font-semibold",
              badgeClass
            )}
            title={detailLabel}
          >
            {statusLabel}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function DayColumn({
  day,
  schedule,
  weekStore,
  learnerName,
  onOpenSessionNote,
}: {
  day: Day
  schedule: Record<Day, Slot[]>
  weekStore: WeekStore
  learnerName: string
  onOpenSessionNote: (slotId: number) => void
}) {
  const daySessions = (schedule[day] ?? []).filter((s) =>
    learnersMatch(s.learner, learnerName)
  )

  let inner: React.ReactNode
  let title = ""

  if (!daySessions.length) {
    inner = "—"
    title = "No session"
  } else {
    title = daySessions.map((s) => s.time).join(", ")
    const pCount = daySessions.filter(
      (s) => getSlotWeekData(weekStore, s.id).att === "P"
    ).length
    const aCount = daySessions.filter(
      (s) => getSlotWeekData(weekStore, s.id).att === "A"
    ).length
    const rsCount = daySessions.filter(
      (s) => getSlotWeekData(weekStore, s.id).att === "RS"
    ).length
    const ncCount = daySessions.filter(
      (s) => getSlotWeekData(weekStore, s.id).att === "NC"
    ).length
    let cls = dayCellClass
    if (rsCount > 0 && pCount === 0)
      cls += " border-purple-500/45 bg-purple-500/12 text-purple-300"
    else if (aCount > 0 && pCount === 0)
      cls += " border-red-500/40 bg-red-500/12 text-red-400"
    else if (ncCount > 0 && pCount === 0)
      cls += " border-amber-500/40 bg-amber-500/12 text-amber-400"
    else if (pCount > 0)
      cls += " border-emerald-500/45 bg-emerald-500/12 text-emerald-400"
    else cls += " bg-muted/25 text-muted-foreground border-border/60"

    let displayVal = ""
    if (pCount > 0) displayVal = pCount > 1 ? `${pCount}P` : `${pCount}`
    else if (rsCount > 0) displayVal = "RS"
    else if (aCount > 0) displayVal = "A"
    else if (ncCount > 0) displayVal = "NC"

    const firstSlot = daySessions[0]!
    inner = (
      <div className={cls} title={title}>
        <button
          type="button"
          className="absolute inset-0 z-10 rounded-lg opacity-0 focus-visible:opacity-100"
          aria-label={`Edit session note for ${day} (${title})`}
          onClick={() => onOpenSessionNote(firstSlot.id)}
        />
        {displayVal}
      </div>
    )

    return (
      <div className="flex flex-col items-center gap-1">
        <span className="text-muted-foreground text-[9px] font-semibold tracking-wide uppercase">
          {day.slice(0, 3)}
        </span>
        {inner}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-muted-foreground text-[9px] font-semibold tracking-wide uppercase">
        {day.slice(0, 3)}
      </span>
      <div
        className={cn(
          dayCellClass,
          "bg-muted/25 text-muted-foreground border-border/60 font-normal"
        )}
        title={title}
      >
        {inner}
      </div>
    </div>
  )
}
