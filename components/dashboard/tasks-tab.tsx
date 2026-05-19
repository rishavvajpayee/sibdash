"use client"

import * as React from "react"

import { useDashboard } from "@/components/dashboard/dashboard-provider"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  TASK_CATEGORY_KEYS,
  type DashboardTask,
  type TaskCategory,
  type TaskStatus,
} from "@/lib/dashboard/constants"
import { formatYmd, getIstYmd } from "@/lib/time"
import { cn } from "@/lib/utils"

const CAT_META: Record<
  TaskCategory,
  { label: string; color: string }
> = {
  training: { label: "Training", color: "#29ABE2" },
  operations: { label: "Operations", color: "#F26522" },
  marketing: { label: "Marketing", color: "#a78bfa" },
  admin: { label: "Admin", color: "#22c55e" },
  other: { label: "Other", color: "#9EA3A8" },
}

type TaskFilter = "all" | TaskStatus

export function TasksTab() {
  const {
    weekStore,
    currentWeekKey,
    fmtWeekRange,
    userEmail,
    updateTaskField,
    updateTaskStatus,
    deleteTask,
    addInlineTask,
    addTask,
    cycleTaskStatus,
  } = useDashboard()

  const [filter, setFilter] = React.useState<TaskFilter>("all")
  const [view, setView] = React.useState<"list" | "calendar">("list")

  const [modalOpen, setModalOpen] = React.useState(false)
  const [modalCat, setModalCat] = React.useState<TaskCategory>("training")
  const [atName, setAtName] = React.useState("")
  const [atAssign, setAtAssign] = React.useState("")
  const [atDate, setAtDate] = React.useState(() => getIstYmd())
  const [atStatus, setAtStatus] = React.useState<TaskStatus>("pending")
  const [atDelay, setAtDelay] = React.useState("")

  const allFlat = React.useMemo(
    () => TASK_CATEGORY_KEYS.flatMap((k) => weekStore.tasks[k] ?? []),
    [weekStore.tasks]
  )

  const stats = React.useMemo(() => {
    return {
      pending: allFlat.filter((t) => t.status === "pending").length,
      inprogress: allFlat.filter((t) => t.status === "inprogress").length,
      done: allFlat.filter((t) => t.status === "done").length,
    }
  }, [allFlat])

  function filteredRows(cat: TaskCategory): DashboardTask[] {
    let rows = [...(weekStore.tasks[cat] ?? [])]
    if (filter === "pending") rows = rows.filter((t) => t.status === "pending")
    else if (filter === "inprogress")
      rows = rows.filter((t) => t.status === "inprogress")
    else if (filter === "done") rows = rows.filter((t) => t.status === "done")
    return rows
  }

  function openAddModal(cat?: TaskCategory, dateStr?: string) {
    setModalCat(cat ?? "training")
    setAtName("")
    setAtAssign("")
    setAtDate(dateStr ?? getIstYmd())
    setAtStatus("pending")
    setAtDelay("")
    setModalOpen(true)
  }

  function submitModal() {
    if (!atName.trim()) return
    addTask({
      category: modalCat,
      name: atName.trim(),
      assign: atAssign.trim(),
      date: atDate,
      status: atStatus,
      delay: atDelay.trim(),
      createdBy: userEmail,
    })
    setModalOpen(false)
  }

  const weekStart = new Date(`${currentWeekKey}T00:00:00`)
  const weekDays: Date[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    weekDays.push(d)
  }
  const todayStr = getIstYmd()

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["Pending", stats.pending, "text-muted-foreground"],
            ["In progress", stats.inprogress, "text-brand-orange"],
            ["Done", stats.done, "text-emerald-400"],
          ] as const
        ).map(([l, v, c]) => (
          <Card key={l}>
            <CardContent className="pt-4">
              <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                {l}
              </div>
              <div className={cn("text-3xl font-bold", c)}>{v}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-sm">Week</span>
        <span className="bg-muted/50 border-border rounded-lg border px-3 py-1 text-sm font-medium">
          {fmtWeekRange(currentWeekKey)}
        </span>
        {(["all", "pending", "inprogress", "done"] as const).map((f) => (
          <Button
            key={f}
            type="button"
            size="sm"
            variant={filter === f ? "default" : "outline"}
            className="rounded-full capitalize"
            onClick={() => setFilter(f)}
          >
            {f === "inprogress" ? "In progress" : f}
          </Button>
        ))}
        <div className="bg-muted/40 ml-auto flex rounded-lg border p-0.5">
          <Button
            type="button"
            size="sm"
            variant={view === "list" ? "default" : "ghost"}
            onClick={() => setView("list")}
          >
            List
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "calendar" ? "default" : "ghost"}
            onClick={() => setView("calendar")}
          >
            Calendar
          </Button>
        </div>
        <Button type="button" onClick={() => openAddModal()}>
          + Add task
        </Button>
      </div>

      {view === "list" ? (
        <div className="space-y-4">
          {TASK_CATEGORY_KEYS.map((cat) => {
            const meta = CAT_META[cat]
            const rows = filteredRows(cat)
            const allCount = (weekStore.tasks[cat] ?? []).length
            return (
              <Card key={cat} className="overflow-hidden">
                <CardHeader className="bg-muted/30 flex flex-row items-center justify-between py-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase">
                    <span
                      className="inline-block w-1 self-stretch rounded-sm"
                      style={{ background: meta.color }}
                    />
                    {meta.label}
                    <span className="text-muted-foreground text-xs font-normal normal-case">
                      ({allCount})
                    </span>
                  </CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addInlineTask(cat)}
                  >
                    + Add row
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="text-muted-foreground bg-muted/20 grid grid-cols-[1fr_140px_110px_120px_1fr_40px] gap-2 border-b px-4 py-2 text-[10px] font-semibold tracking-wider uppercase max-lg:hidden">
                    <span>Task</span>
                    <span>Assign</span>
                    <span>Date</span>
                    <span>Status</span>
                    <span>Delay</span>
                    <span />
                  </div>
                  {!rows.length ? (
                    <p className="text-muted-foreground px-4 py-6 text-center text-sm italic">
                      No {filter !== "all" ? filter + " " : ""}tasks — add one.
                    </p>
                  ) : (
                    rows.map((t) => {
                      const canDel =
                        !t.createdBy || !userEmail || t.createdBy === userEmail
                      return (
                        <div
                          key={t.id}
                          className={cn(
                            "grid max-lg:grid-cols-1 max-lg:gap-2 max-lg:border-b max-lg:py-3 lg:grid-cols-[1fr_140px_110px_120px_1fr_40px] lg:items-center lg:gap-2 lg:border-b lg:px-4 lg:py-2",
                            t.status === "done" && "opacity-50"
                          )}
                        >
                          <div className="font-medium">
                            {t.name}
                            {t.createdBy ? (
                              <span className="text-muted-foreground ml-2 text-[10px]">
                                {t.createdBy.split("@")[0]}
                              </span>
                            ) : null}
                          </div>
                          <Input
                            className="h-8"
                            defaultValue={t.assign}
                            key={`a-${t.id}`}
                            onBlur={(e) =>
                              updateTaskField(cat, t.id, "assign", e.target.value)
                            }
                          />
                          <Input
                            type="date"
                            className="h-8"
                            defaultValue={t.date}
                            key={`d-${t.id}`}
                            onBlur={(e) =>
                              updateTaskField(cat, t.id, "date", e.target.value)
                            }
                          />
                          <Select
                            value={t.status}
                            onValueChange={(v) =>
                              updateTaskStatus(cat, t.id, v as TaskStatus)
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="inprogress">In progress</SelectItem>
                              <SelectItem value="done">Done</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            className="h-8"
                            defaultValue={t.delay}
                            key={`dl-${t.id}`}
                            placeholder="Reason for delay"
                            onBlur={(e) =>
                              updateTaskField(cat, t.id, "delay", e.target.value)
                            }
                          />
                          {canDel ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-destructive h-8 w-8"
                              onClick={() => deleteTask(cat, t.id)}
                            >
                              ✕
                            </Button>
                          ) : (
                            <span />
                          )}
                        </div>
                      )
                    })
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="bg-muted/30 grid grid-cols-[140px_repeat(6,1fr)] border-b text-center text-[10px] font-bold tracking-wider uppercase">
            <div className="border-r p-3 text-left">Category</div>
            {weekDays.map((d, i) => {
              const dStr = formatYmd(d)
              const isToday = dStr === todayStr
              return (
                <div key={dStr} className="border-r p-2 last:border-r-0">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i]}
                  <div
                    className={cn(
                      "text-base",
                      isToday ? "text-brand-orange font-bold" : ""
                    )}
                  >
                    {d.getDate()}
                  </div>
                </div>
              )
            })}
          </div>
          {TASK_CATEGORY_KEYS.map((cat) => {
            const meta = CAT_META[cat]
            const allTasks = weekStore.tasks[cat] ?? []
            const filtered =
              filter === "all"
                ? allTasks
                : allTasks.filter((t) => t.status === filter)
            return (
              <div
                key={cat}
                className="grid grid-cols-[140px_repeat(6,1fr)] border-b last:border-0"
              >
                <div className="flex items-stretch gap-2 border-r p-2">
                  <span
                    className="w-1 shrink-0 rounded-sm"
                    style={{ background: meta.color }}
                  />
                  <span className="text-muted-foreground self-center text-xs font-semibold">
                    {meta.label}
                  </span>
                </div>
                {weekDays.map((d) => {
                  const dStr = formatYmd(d)
                  const dayTasks = filtered.filter((t) => t.date === dStr)
                  return (
                    <div
                      key={dStr}
                      className="border-r p-1.5 last:border-r-0 flex flex-wrap content-start gap-1 min-h-[72px]"
                    >
                      {dayTasks.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          title={t.assign ? `${t.name} · ${t.assign}` : t.name}
                          onClick={() => cycleTaskStatus(cat, t.id)}
                          className={cn(
                            "max-w-full truncate rounded border px-1.5 py-0.5 text-left text-[11px]",
                            t.status === "pending" && "border-border bg-muted/40",
                            t.status === "inprogress" &&
                              "border-brand-orange/50 bg-brand-orange/10",
                            t.status === "done" &&
                              "border-emerald-500/40 bg-emerald-500/10 line-through"
                          )}
                        >
                          <span className="font-medium">{t.name}</span>
                          {t.assign ? (
                            <span className="text-muted-foreground block truncate text-[10px]">
                              {t.assign}
                            </span>
                          ) : null}
                        </button>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 shrink-0 p-0 text-xs"
                        onClick={() => openAddModal(cat, dStr)}
                      >
                        +
                      </Button>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </Card>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs">Category</label>
              <Select
                value={modalCat}
                onValueChange={(v) => setModalCat(v as TaskCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_CATEGORY_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {CAT_META[k].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs">Name</label>
              <Input value={atName} onChange={(e) => setAtName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs">Assign</label>
              <Input
                value={atAssign}
                onChange={(e) => setAtAssign(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs">Date</label>
              <Input
                type="date"
                value={atDate}
                onChange={(e) => setAtDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs">Status</label>
              <Select
                value={atStatus}
                onValueChange={(v) => setAtStatus(v as TaskStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="inprogress">In progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs">Delay reason</label>
              <Input value={atDelay} onChange={(e) => setAtDelay(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitModal}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
