"use client"

import { motion } from "framer-motion"
import * as React from "react"

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
import { Textarea } from "@/components/ui/textarea"
import { useDashboard } from "@/components/dashboard/dashboard-provider"
import {
  DAYS,
  FIXED_TIMES,
  STYPES,
  type Day,
  type NoteEntry,
  type Slot,
} from "@/lib/dashboard/constants"
import {
  findDuplicateSlots,
  getMsgSlotConflict,
  getSlotWeekData,
  mergeScheduleTimesForDay,
  tmin,
} from "@/lib/dashboard/schedule-utils"
import { cn } from "@/lib/utils"
import { fadeInProps, useMotionAllowed } from "@/lib/motion"

function esc(s: string) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function ScheduleTab() {
  const reduced = useMotionAllowed()
  const {
    schedule,
    currentDay,
    currentWeekKey,
    fmtWeekRange,
    pickDay,
    setDate,
    shiftWeek,
    copyFromLastWeek,
    weekStore,
    persisted,
    userEmail,
    updateSlotField,
    updateSlotTime,
    updateAttendance,
    deleteSlotById,
    submitNewSlot,
    dupState,
    resolveDuplicate,
    saveComment,
    deleteComment,
    rsSlotId,
    closeRSModal,
    bookReschedule,
    markRSTBD,
  } = useDashboard()

  const daySlots = React.useMemo(
    () => schedule[currentDay] ?? [],
    [schedule, currentDay]
  )
  const [nfDay, setNfDay] = React.useState<Day>(currentDay)
  const [nfTime, setNfTime] = React.useState("")
  const [nfLearner, setNfLearner] = React.useState("")
  const [nfNote, setNfNote] = React.useState("")
  const [nfTrainer, setNfTrainer] = React.useState("")
  const [nfCo, setNfCo] = React.useState("")
  const [nfType, setNfType] = React.useState("Regular")

  const [openComments, setOpenComments] = React.useState<number | null>(null)
  const [commentDraft, setCommentDraft] = React.useState<Record<number, string>>(
    {}
  )
  const [addSessionOpen, setAddSessionOpen] = React.useState(false)

  const sorted = [...daySlots].sort((a, b) => tmin(a.time) - tmin(b.time))
  const byTime: Record<string, Slot[]> = {}
  sorted.forEach((s) => {
    if (!byTime[s.time]) byTime[s.time] = []
    byTime[s.time].push(s)
  })
  const times = mergeScheduleTimesForDay(daySlots)

  const stats = React.useMemo(() => {
    const s = daySlots
    const total = s.filter((x) => x.learner).length
    const p = s.filter((x) => getSlotWeekData(weekStore, x.id).att === "P").length
    const a = s.filter((x) => getSlotWeekData(weekStore, x.id).att === "A").length
    const rs = s.filter((x) => getSlotWeekData(weekStore, x.id).att === "RS").length
    const nc = s.filter((x) => getSlotWeekData(weekStore, x.id).att === "NC").length
    return [
      { label: "Total Sessions", value: total, color: "text-brand-cyan" },
      { label: "Present", value: p, color: "text-emerald-500" },
      { label: "Absent", value: a, color: "text-red-500" },
      { label: "Rescheduled", value: rs, color: "text-purple-400" },
      { label: "NC / No-Show", value: nc, color: "text-amber-400" },
    ]
  }, [daySlots, weekStore])

  function onAddSlot(e: React.FormEvent) {
    e.preventDefault()
    submitNewSlot({
      day: nfDay,
      time: nfTime,
      learner: nfLearner,
      note: nfNote,
      trainer: nfTrainer,
      coTrainer: nfCo,
      type: nfType,
    })
    setNfLearner("")
    setNfNote("")
    setNfCo("")
    setNfTime("")
    setAddSessionOpen(false)
  }

  const dupExisting =
    dupState.open && dupState.learnerName
      ? findDuplicateSlots(schedule, dupState.learnerName)
      : []
  return (
    <motion.div {...fadeInProps(!reduced)} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => shiftWeek(-1)}>
            ← Prev week
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => shiftWeek(1)}>
            Next week →
          </Button>
          <span className="text-muted-foreground text-sm font-medium">
            Week of {fmtWeekRange(currentWeekKey)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            className="w-auto bg-muted/30"
            value={currentWeekKey}
            onChange={(e) => {
              setDate(e.target.value)
            }}
          />
          <Button type="button" variant="secondary" size="sm" onClick={copyFromLastWeek}>
            Copy last week
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {DAYS.map((d) => (
          <Button
            key={d}
            type="button"
            variant={d === currentDay ? "default" : "outline"}
            size="sm"
            className={cn(
              "rounded-lg",
              d === currentDay &&
                "bg-brand-orange hover:bg-brand-orange/90 border-brand-orange"
            )}
            onClick={() => pickDay(d)}
          >
            {d.slice(0, 3)}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((st) => (
          <Card key={st.label} className="overflow-hidden border-t-2 pt-0">
            <CardHeader className="pb-1 pt-3">
              <CardTitle className="text-muted-foreground text-[0.62rem] font-semibold tracking-wider uppercase">
                {st.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={cn("font-heading text-2xl font-bold", st.color)}>
                {st.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-center sm:justify-start">
        <Button
          type="button"
          size="lg"
          className="w-full gap-2 rounded-lg bg-brand-cyan hover:bg-brand-cyan/90 sm:w-auto"
          onClick={() => {
            setNfDay(currentDay)
            setAddSessionOpen(true)
          }}
        >
          <span className="font-heading tracking-wide uppercase">Add session</span>
          <span className="text-primary-foreground/80 font-normal normal-case">
            · {currentDay}
          </span>
        </Button>
      </div>

      <Dialog
        open={addSessionOpen}
        onOpenChange={(open) => {
          setAddSessionOpen(open)
          if (open) setNfDay(currentDay)
        }}
      >
        <DialogContent
          className="flex max-h-[min(90dvh,calc(100%-2rem))] min-h-0 max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden sm:max-w-md"
          overlayClassName="bg-black/30 supports-backdrop-filter:backdrop-blur-md"
        >
          <DialogHeader className="shrink-0 pb-4">
            <DialogTitle className="font-heading text-base tracking-wide uppercase">
              Add session · {nfDay}
            </DialogTitle>
          </DialogHeader>
          <form
            className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
            onSubmit={onAddSlot}
          >
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-0.5 pb-2">
              <div className="grid w-full min-w-0 gap-1">
                <Label className="text-xs">Weekday</Label>
                <select
                  className="border-input bg-muted/30 h-9 w-full rounded-md border pl-2.5 pr-9 text-sm"
                  value={nfDay}
                  onChange={(e) => setNfDay(e.target.value as Day)}
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid w-full min-w-0 gap-1">
                <Label className="text-xs">Time</Label>
                <select
                  className="border-input bg-muted/30 h-9 w-full rounded-md border pl-2.5 pr-9 text-sm"
                  value={nfTime}
                  onChange={(e) => setNfTime(e.target.value)}
                  required
                >
                  <option value="">Select…</option>
                  {FIXED_TIMES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid w-full min-w-0 gap-1">
                <Label className="text-xs">Learner</Label>
                <Input
                  value={nfLearner}
                  onChange={(e) => setNfLearner(e.target.value)}
                  placeholder="Learner name"
                  className="bg-muted/30 w-full"
                />
              </div>
              <div className="grid w-full min-w-0 gap-1">
                <Label className="text-xs">Trainer</Label>
                <select
                  className="border-input bg-muted/30 h-9 w-full rounded-md border pl-2.5 pr-9 text-sm"
                  value={nfTrainer}
                  onChange={(e) => setNfTrainer(e.target.value)}
                >
                  <option value="">Trainer</option>
                  <option value="Changed">Changed</option>
                  {persisted.trainers.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                  <option value="All">All (group)</option>
                </select>
              </div>
              <div className="grid w-full min-w-0 gap-1">
                <Label className="text-xs">Co-trainer</Label>
                <select
                  className="border-input bg-muted/30 h-9 w-full rounded-md border pl-2.5 pr-9 text-sm"
                  value={nfCo}
                  onChange={(e) => setNfCo(e.target.value)}
                >
                  <option value="">+ Co-trainer</option>
                  {persisted.trainers.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid w-full min-w-0 gap-1">
                <Label className="text-xs">Type</Label>
                <select
                  className="border-input bg-muted/30 h-9 w-full rounded-md border pl-2.5 pr-9 text-sm"
                  value={nfType}
                  onChange={(e) => setNfType(e.target.value)}
                >
                  {STYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid w-full min-w-0 gap-1">
                <Label className="text-xs">Note</Label>
                <Input
                  value={nfNote}
                  onChange={(e) => setNfNote(e.target.value)}
                  placeholder="Optional"
                  className="bg-muted/30 w-full"
                />
              </div>
            </div>
            <div className="border-border bg-popover shrink-0 border-t pt-4">
              <Button
                type="submit"
                size="lg"
                className="bg-brand-cyan hover:bg-brand-cyan/90 w-full"
              >
                Add
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="font-heading text-base tracking-wide uppercase">
            Schedule · {currentDay}
          </CardTitle>
          <span className="text-muted-foreground text-xs">{sorted.length} sessions</span>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="divide-border w-full min-w-0 divide-y">
            {times.map((time) => {
              const sessions = byTime[time] ?? []
              if (!sessions.length) {
                return (
                  <div
                    key={time}
                    className="text-muted-foreground grid grid-cols-[minmax(4.5rem,auto)_1fr] items-center gap-x-3 gap-y-1 px-4 py-2.5 text-xs sm:grid-cols-[5.5rem_1fr] sm:py-2"
                  >
                    <span className="text-foreground/70 font-mono tabular-nums not-italic">
                      {time}
                    </span>
                    <span className="italic">No session</span>
                  </div>
                )
              }
              return sessions.map((slot, si) => (
                <SlotRow
                  key={slot.id}
                  slot={slot}
                  showTimeSelect={si === 0}
                  fixedTimes={[...FIXED_TIMES]}
                  currentDay={currentDay}
                  weekStore={weekStore}
                  trainers={persisted.trainers}
                  learnerNotes={persisted.learnerNotes[slot.id] ?? []}
                  userEmail={userEmail}
                  openComments={openComments === slot.id}
                  commentText={commentDraft[slot.id] ?? ""}
                  onToggleComments={() =>
                    setOpenComments((o) => (o === slot.id ? null : slot.id))
                  }
                  onCommentChange={(v) =>
                    setCommentDraft((d) => ({ ...d, [slot.id]: v }))
                  }
                  onSaveComment={() => {
                    saveComment(slot.id, commentDraft[slot.id] ?? "")
                    setCommentDraft((d) => ({ ...d, [slot.id]: "" }))
                  }}
                  onDeleteComment={(revIdx) => deleteComment(slot.id, revIdx)}
                  onUpdateField={(f, v) =>
                    updateSlotField(slot.id, f as keyof Slot, v)
                  }
                  onTimeChange={(t) => updateSlotTime(slot.id, t)}
                  onAttendance={(att) => updateAttendance(slot.id, att)}
                  onDelete={() => deleteSlotById(slot.id)}
                />
              ))
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dupState.open} onOpenChange={(o) => !o && resolveDuplicate(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Session already this week</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            This learner (<strong>{dupState.open ? dupState.learnerName : ""}</strong>) already
            has a session booked this week. Do you want to continue and add another?
          </p>
          {dupState.open && dupExisting.length > 0 ? (
            <ul className="text-muted-foreground max-h-40 space-y-1 overflow-y-auto text-xs">
              {dupExisting.map((s) => (
                <li key={`${s.day}-${s.id}`}>
                  <span className="text-brand-cyan font-semibold">{s.day.slice(0, 3)}</span>{" "}
                  {s.time} · {esc(s.trainer || "—")} · att{" "}
                  {getSlotWeekData(weekStore, s.id).att || "—"}
                </li>
              ))}
            </ul>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => resolveDuplicate(false)}>
              Cancel
            </Button>
            <Button onClick={() => resolveDuplicate(true)}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rsSlotId !== null} onOpenChange={(o) => !o && closeRSModal()}>
        <DialogContent>
          {rsSlotId !== null ? (
            <RescheduleForm
              key={rsSlotId}
              rsSlotId={rsSlotId}
              schedule={schedule}
              currentDay={currentDay}
              bookReschedule={bookReschedule}
              markRSTBD={markRSTBD}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

function RescheduleForm({
  rsSlotId,
  schedule,
  currentDay,
  bookReschedule,
  markRSTBD,
}: {
  rsSlotId: number
  schedule: Record<Day, Slot[]>
  currentDay: Day
  bookReschedule: (dateVal: string, timeVal: string) => void
  markRSTBD: () => void
}) {
  const slot = schedule[currentDay]?.find((s) => s.id === rsSlotId)
  const [rsDate, setRsDate] = React.useState(() => {
    const t = new Date()
    t.setDate(t.getDate() + 7)
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`
  })
  const [rsTime, setRsTime] = React.useState(() => slot?.time ?? "")

  return (
    <>
      <DialogHeader>
        <DialogTitle>Reschedule session</DialogTitle>
      </DialogHeader>
      <p className="text-muted-foreground text-sm">
        Book a new slot or mark as TBD (adds a comment on this session).
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label>Date</Label>
          <Input
            type="date"
            value={rsDate}
            onChange={(e) => setRsDate(e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label>Time</Label>
          <select
            className="border-input bg-muted/30 h-9 rounded-md border pl-2.5 pr-9 text-sm"
            value={rsTime}
            onChange={(e) => setRsTime(e.target.value)}
          >
            <option value="">— Pick time —</option>
            {FIXED_TIMES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>
      <DialogFooter className="flex-col gap-2 sm:flex-row">
        <Button variant="outline" onClick={markRSTBD}>
          Mark TBD
        </Button>
        <Button
          onClick={() => bookReschedule(rsDate, rsTime)}
          disabled={!rsDate || !rsTime}
        >
          Book new slot
        </Button>
      </DialogFooter>
    </>
  )
}

function SlotRow({
  slot,
  showTimeSelect,
  fixedTimes,
  currentDay,
  weekStore,
  trainers,
  learnerNotes,
  userEmail,
  openComments,
  commentText,
  onToggleComments,
  onCommentChange,
  onSaveComment,
  onDeleteComment,
  onUpdateField,
  onTimeChange,
  onAttendance,
  onDelete,
}: {
  slot: Slot
  showTimeSelect: boolean
  fixedTimes: string[]
  currentDay: Day
  weekStore: import("@/lib/dashboard/constants").WeekStore
  trainers: string[]
  learnerNotes: NoteEntry[]
  userEmail: string
  openComments: boolean
  commentText: string
  onToggleComments: () => void
  onCommentChange: (v: string) => void
  onSaveComment: () => void
  onDeleteComment: (revIdx: number) => void
  onUpdateField: (f: keyof Slot, v: string) => void
  onTimeChange: (t: string) => void
  onAttendance: (att: string) => void
  onDelete: () => void
}) {
  const wd = getSlotWeekData(weekStore, slot.id)
  const notesCount = learnerNotes.length
  const conflict =
    slot.trainer &&
    getMsgSlotConflict(weekStore, slot.trainer, currentDay, slot.time)

  const timeTitle = showTimeSelect ? slot.time : `Same time · ${slot.time}`
  const trainerTitle = slot.trainer || "Trainer"
  const coTitle = slot.coTrainer || "Co-trainer (optional)"
  const typeLabel = slot.type || "Session type"
  const attLabel =
    wd.att === "P"
      ? "Present"
      : wd.att === "A"
        ? "Absent"
        : wd.att === "NC"
          ? "No-show"
          : wd.att === "RS"
            ? "Rescheduled"
            : "Attendance"

  const rowCls = cn(
    "hover:bg-muted/40 flex flex-col gap-3 px-4 py-3 transition-colors sm:gap-4",
    wd.att === "RS" && "border-l-purple-400 bg-purple-500/5 border-l-4",
    slot.trainer === "Changed" && "border-l-pink-500 bg-pink-500/10 border-l-4",
    slot.learner && wd.att !== "RS" && slot.trainer !== "Changed" && "bg-brand-cyan/5"
  )

  const selectBase =
    "border-input bg-muted/40 h-9 w-full min-w-0 max-w-full rounded-md border pl-2.5 pr-9 text-sm"

  return (
    <div className={rowCls}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">
        <div className="flex w-full shrink-0 flex-row items-start gap-2 lg:w-[7.25rem] lg:flex-col lg:gap-1.5">
          {showTimeSelect ? (
            <select
              title={timeTitle}
              className={cn(
                selectBase,
                "font-mono font-semibold tabular-nums lg:min-h-[2.25rem]"
              )}
              value={slot.time}
              onChange={(e) => onTimeChange(e.target.value)}
            >
              {fixedTimes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              {!fixedTimes.includes(slot.time) ? (
                <option value={slot.time}>{slot.time}</option>
              ) : null}
            </select>
          ) : (
            <span
              className="text-muted-foreground bg-muted/30 inline-flex min-h-9 items-center rounded-md border border-dashed px-2 text-xs leading-tight"
              title={`Another session at ${slot.time}`}
            >
              Same slot
            </span>
          )}
          {wd.att === "RS" ? (
            <span className="bg-purple-500/15 text-purple-600 dark:text-purple-300 w-fit rounded px-1.5 py-0.5 text-[0.62rem] font-semibold">
              RS
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
            <div className="min-w-0 flex-1">
              <Input
                value={slot.learner}
                onChange={(e) => onUpdateField("learner", e.target.value)}
                className="bg-muted/40 font-medium"
                placeholder="Learner"
                title={slot.learner || undefined}
              />
            </div>
            <div className="flex shrink-0 gap-2 sm:pt-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn("shrink-0", notesCount > 0 && "border-amber-400/50")}
                onClick={onToggleComments}
              >
                💬{notesCount ? ` ${notesCount}` : ""}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="shrink-0"
                onClick={onDelete}
              >
                ✕
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 min-[520px]:grid-cols-2 xl:grid-cols-4">
            <div className="min-w-0 space-y-1">
              <span className="text-muted-foreground mb-0.5 block text-[0.65rem] font-medium tracking-wide uppercase">
                Trainer
              </span>
              <select
                title={trainerTitle}
                className={cn(selectBase, conflict && "border-amber-400/80 bg-amber-500/10")}
                value={slot.trainer}
                onChange={(e) => onUpdateField("trainer", e.target.value)}
              >
                <option value="">Trainer</option>
                <option value="Changed">Changed</option>
                {trainers.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                <option value="All">All (group)</option>
              </select>
              {conflict ? (
                <span className="text-amber-500 text-[0.62rem] leading-snug">
                  ⚠ Msg slot {conflict.from}–{conflict.to}
                </span>
              ) : null}
            </div>

            <div className="min-w-0 space-y-1">
              <span className="text-muted-foreground mb-0.5 block text-[0.65rem] font-medium tracking-wide uppercase">
                Co-trainer
              </span>
              <select
                title={coTitle}
                className={cn(selectBase, "text-muted-foreground")}
                value={slot.coTrainer ?? ""}
                onChange={(e) => onUpdateField("coTrainer", e.target.value)}
              >
                <option value="">+ Co-trainer</option>
                {trainers.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0 space-y-1">
              <span className="text-muted-foreground mb-0.5 block text-[0.65rem] font-medium tracking-wide uppercase">
                Attendance
              </span>
              <select
                title={attLabel}
                className={cn(
                  selectBase,
                  "font-semibold",
                  wd.att === "P" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
                  wd.att === "A" && "border-red-500/40 bg-red-500/10 text-red-600",
                  wd.att === "NC" && "border-amber-400/40 bg-amber-400/10 text-amber-600",
                  wd.att === "RS" && "border-purple-400/40 bg-purple-500/10 text-purple-600",
                  !wd.att && "border-input bg-muted/40"
                )}
                value={wd.att}
                onChange={(e) => onAttendance(e.target.value)}
              >
                <option value="">— Attendance —</option>
                <option value="P">Present</option>
                <option value="A">Absent</option>
                <option value="NC">No-show</option>
                <option value="RS">Rescheduled</option>
              </select>
            </div>

            <div className="min-w-0 space-y-1 min-[520px]:col-span-2 xl:col-span-1">
              <span className="text-muted-foreground mb-0.5 block text-[0.65rem] font-medium tracking-wide uppercase">
                Type
              </span>
              <select
                title={typeLabel}
                className={selectBase}
                value={slot.type}
                onChange={(e) => onUpdateField("type", e.target.value)}
              >
                {STYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {openComments ? (
        <div className="border-border bg-muted/20 w-full min-w-0 rounded-lg border p-3">
          <div className="mb-2 max-h-36 space-y-2 overflow-y-auto">
            {[...learnerNotes].reverse().map((n, ri) => {
              const realIdx = learnerNotes.length - 1 - ri
              const name =
                n.authorEmail?.split("@")[0] ||
                n.email?.split("@")[0] ||
                n.trainer ||
                "?"
              const mine =
                n.authorEmail === userEmail || n.email === userEmail
              return (
                <div
                  key={`${n.ts}-${realIdx}`}
                  className="bg-card flex justify-between gap-2 rounded-md border p-2 text-xs"
                >
                  <div>
                    <div className="mb-0.5 flex flex-wrap gap-2">
                      <span className="text-brand-cyan font-semibold">{esc(name)}</span>
                      <span className="text-muted-foreground">{esc(n.ts ?? "")}</span>
                    </div>
                    <p className="leading-snug">{esc(n.text)}</p>
                  </div>
                  {mine ? (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => onDeleteComment(ri)}
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
              )
            })}
            {!learnerNotes.length ? (
              <p className="text-muted-foreground text-xs italic">No comments yet</p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Textarea
              value={commentText}
              onChange={(e) => onCommentChange(e.target.value)}
              placeholder="Comment… @mention trainers"
              className="bg-background min-h-[72px] flex-1 text-sm"
            />
            <Button type="button" className="self-end bg-brand-cyan hover:bg-brand-cyan/90" size="sm" onClick={onSaveComment}>
              Save
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
