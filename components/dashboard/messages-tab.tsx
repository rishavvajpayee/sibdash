"use client"

import * as React from "react"

import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { DAYS, type Day } from "@/lib/dashboard/constants"
import { trainerHex } from "@/lib/dashboard/trainer-colors"
import { buildWhatsAppMessage } from "@/lib/dashboard/whatsapp-msg"
import { cn } from "@/lib/utils"

export function MessagesTab() {
  const {
    weekStore,
    trainers,
    addMsgSlot,
    updateMsgSlot,
    deleteMsgSlot,
    toggleMsgTrainer,
    toggleMsgDone,
  } = useDashboard()

  const [msgDay, setMsgDay] = React.useState<Day>("Monday")
  const [from, setFrom] = React.useState("")
  const [to, setTo] = React.useState("")
  const [msTrainers, setMsTrainers] = React.useState<string[]>([])
  const [msNotes, setMsNotes] = React.useState("")

  const slots = weekStore.msgSlots[msgDay] ?? []

  const allSlots = React.useMemo(
    () => DAYS.flatMap((d) => weekStore.msgSlots[d] ?? []),
    [weekStore.msgSlots]
  )

  const stats = React.useMemo(() => {
    const tot = allSlots.length
    const assigned = allSlots.filter(
      (s) => (s.trainers?.length ?? 0) > 0 || (s.trainer && s.trainer !== "")
    ).length
    const trainersOnDuty = new Set(
      allSlots.flatMap((s) =>
        s.trainers?.length
          ? s.trainers
          : s.trainer
            ? [s.trainer]
            : []
      )
    ).size
    return { tot, assigned, trainersOnDuty }
  }, [allSlots])

  const waText = React.useMemo(
    () => buildWhatsAppMessage(msgDay, slots),
    [msgDay, slots]
  )

  function onAddSlot(e: React.FormEvent) {
    e.preventDefault()
    addMsgSlot(msgDay, from, to, msTrainers, msNotes)
    setFrom("")
    setTo("")
    setMsNotes("")
    setMsTrainers([])
  }

  async function copyWA() {
    try {
      await navigator.clipboard.writeText(waText)
    } catch {
      window.alert("Copy manually from the preview.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Total slots", stats.tot, "text-brand-cyan"],
          ["Assigned", stats.assigned, "text-brand-orange"],
          ["Unassigned", stats.tot - stats.assigned, "text-red-400"],
          ["Trainers on duty", stats.trainersOnDuty, "text-emerald-400"],
        ].map(([label, val, col]) => (
          <Card key={String(label)}>
            <CardContent className="pt-4">
              <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                {label}
              </div>
              <div className={cn("text-2xl font-bold", col)}>{val}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {DAYS.map((d) => (
            <Button
              key={d}
              type="button"
              size="sm"
              variant={msgDay === d ? "default" : "outline"}
              onClick={() => setMsgDay(d)}
            >
              {d.slice(0, 3)}
            </Button>
          ))}
        </div>
        <Button type="button" variant="secondary" className="ml-auto" onClick={copyWA}>
          Copy WhatsApp message
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="font-heading text-base">
            {msgDay} — message slots
          </CardTitle>
          <span className="text-muted-foreground text-sm">
            {slots.length} slot{slots.length !== 1 ? "s" : ""}
          </span>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-muted-foreground grid max-md:hidden grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 border-b pb-2 text-[10px] font-semibold tracking-wider uppercase">
            <span>Time</span>
            <span>Trainers</span>
            <span>Notes</span>
            <span>Done</span>
            <span />
          </div>
          {!slots.length ? (
            <p className="text-muted-foreground py-6 text-center text-sm italic">
              No message slots for {msgDay}. Add one below.
            </p>
          ) : (
            slots.map((s) => {
              const id = s.id!
              const done = weekStore.msgDoneData[String(id)]?.done
              const doneAt = weekStore.msgDoneData[String(id)]?.doneAt
              const tArr =
                s.trainers?.length
                  ? s.trainers
                  : s.trainer
                    ? s.trainer
                        .split(",")
                        .map((x) => x.trim())
                        .filter(Boolean)
                    : []
              return (
                <div
                  key={String(id)}
                  className={cn(
                    "grid gap-2 border-b pb-3 max-md:grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto_auto] md:items-center",
                    done && "opacity-60"
                  )}
                >
                  <div className="font-medium">
                    {s.from} – {s.to}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {tArr.length ? (
                      tArr.map((t) => (
                        <button
                          key={t}
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs"
                          style={{
                            borderColor: `${trainerHex(trainers, t)}55`,
                            background: `${trainerHex(trainers, t)}18`,
                            color: trainerHex(trainers, t),
                          }}
                          onClick={() => toggleMsgTrainer(id, t)}
                          title="Click to remove"
                        >
                          {t}
                          <span className="opacity-60">✕</span>
                        </button>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-xs">Unassigned</span>
                    )}
                    <TrainerPicker trainers={trainers} onPick={(name) => toggleMsgTrainer(id, name)} />
                  </div>
                  <Input
                    defaultValue={s.notes ?? ""}
                    key={`n-${id}-${s.notes ?? ""}`}
                    placeholder="Notes"
                    onBlur={(e) => updateMsgSlot(id, { notes: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant={done ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => toggleMsgDone(id)}
                  >
                    {done ? `Done${doneAt ? ` ${doneAt}` : ""}` : "Mark done"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => deleteMsgSlot(id)}
                  >
                    ✕
                  </Button>
                </div>
              )
            })
          )}

          <form
            onSubmit={onAddSlot}
            className="flex flex-wrap items-end gap-2 border-t pt-4"
          >
            <Input
              className="w-28"
              placeholder="From"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <Input
              className="w-28"
              placeholder="To"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="min-w-[140px]">
                  {msTrainers.length ? msTrainers.join(", ") : "Trainers"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                {trainers.map((t: string) => (
                  <DropdownMenuCheckboxItem
                    key={t}
                    checked={msTrainers.includes(t)}
                    onCheckedChange={() =>
                      setMsTrainers((prev) =>
                        prev.includes(t)
                          ? prev.filter((x) => x !== t)
                          : [...prev, t]
                      )
                    }
                  >
                    {t}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuItem onClick={() => setMsTrainers(["All"])}>
                  All trainers
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Input
              className="min-w-[120px] flex-1"
              placeholder="Notes"
              value={msNotes}
              onChange={(e) => setMsNotes(e.target.value)}
            />
            <Button type="submit">+ Add</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-base">WhatsApp preview</CardTitle>
          <Button type="button" size="sm" variant="secondary" onClick={copyWA}>
            Copy
          </Button>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted/40 border-border rounded-lg border p-4 font-sans text-sm whitespace-pre-wrap">
            {waText}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}

function TrainerPicker({
  trainers,
  onPick,
}: {
  trainers: string[]
  onPick: (t: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-7 text-[10px]">
          + Add trainer
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48">
        {trainers.map((t: string) => (
          <DropdownMenuItem key={t} onClick={() => onPick(t)}>
            {t}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
