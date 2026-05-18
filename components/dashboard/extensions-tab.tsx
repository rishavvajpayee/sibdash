"use client"

import * as React from "react"

import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import type { ExtensionRecord } from "@/lib/dashboard/constants"

const EXT_TYPES = ["Exam", "Portfolio", "Both", "Course Extension"] as const
const EXT_STATUSES = ["Pending", "Approved", "Rejected", "Mail Sent"] as const

export function ExtensionsTab() {
  const {
    persisted,
    trainers,
    userEmail,
    upsertExtension,
    deleteExtension,
    updateExtensionField,
    toggleExtMail,
  } = useDashboard()

  const [search, setSearch] = React.useState("")
  const [typeF, setTypeF] = React.useState("")
  const [statusF, setStatusF] = React.useState("")

  const [open, setOpen] = React.useState(false)
  const [editId, setEditId] = React.useState<string | undefined>()
  const [form, setForm] = React.useState<Partial<ExtensionRecord>>({})

  const rows = React.useMemo(() => {
    return persisted.extRecords.filter((r) => {
      if (search && !r.name.toLowerCase().includes(search.toLowerCase()))
        return false
      if (typeF && r.type !== typeF) return false
      if (statusF && r.status !== statusF) return false
      return true
    })
  }, [persisted.extRecords, search, typeF, statusF])

  const stats = React.useMemo(() => {
    const all = persisted.extRecords
    return {
      total: all.length,
      pending: all.filter((r) => r.status === "Pending").length,
      approved: all.filter((r) => r.status === "Approved").length,
      mailSent: all.filter((r) => r.mailSent).length,
    }
  }, [persisted.extRecords])

  function openModal(id?: string) {
    setEditId(id)
    if (id) {
      const r = persisted.extRecords.find((x) => x.id === id)
      setForm(r ? { ...r } : {})
    } else {
      setForm({
        status: "Pending",
        type: "",
        name: "",
        number: "",
        email: "",
        charges: "",
        duration: "",
        approvedBy: "",
        reason: "",
      })
    }
    setOpen(true)
  }

  function saveForm() {
    upsertExtension({
      ...form,
      id: editId,
      name: form.name ?? "",
    } as Omit<ExtensionRecord, "id"> & { id?: string })
    setOpen(false)
  }

  function onDelete(r: ExtensionRecord) {
    if (!window.confirm(`Delete extension record for "${r.name}"?`)) return
    deleteExtension(r.id)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["Total", stats.total, "#29ABE2"],
            ["Pending", stats.pending, "#F7C325"],
            ["Approved", stats.approved, "#22c55e"],
            ["Mail sent", stats.mailSent, "#a78bfa"],
          ] as const
        ).map(([l, v, c]) => (
          <Card key={l} className="overflow-hidden">
            <div className="h-0.5 w-full" style={{ background: c }} />
            <CardContent className="pt-4">
              <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                {l}
              </div>
              <div className="text-2xl font-bold" style={{ color: c }}>
                {v}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => openModal()}>
          + Add extension
        </Button>
        <Input
          className="max-w-[200px]"
          placeholder="Search student…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={typeF || "__all__"}
          onValueChange={(v) => setTypeF(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All types</SelectItem>
            {EXT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusF || "__all__"}
          onValueChange={(v) => setStatusF(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            {EXT_STATUSES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground ml-auto text-sm">
          {rows.length} record{rows.length !== 1 ? "s" : ""}
        </span>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="bg-muted/40 text-muted-foreground border-b text-left text-[10px] font-semibold tracking-wider uppercase">
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2">Number</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Charges</th>
                <th className="px-3 py-2">Duration</th>
                <th className="px-3 py-2">Approved</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Mail</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr>
                  <td
                    colSpan={10}
                    className="text-muted-foreground px-4 py-10 text-center italic"
                  >
                    No extension records.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const canDel =
                    !r.createdBy || !userEmail || r.createdBy === userEmail
                  return (
                    <tr key={r.id} className="border-border/60 border-b last:border-0">
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.name}</div>
                      </td>
                      <td className="text-muted-foreground px-3 py-2">
                        {r.number ?? "—"}
                      </td>
                      <td className="text-muted-foreground max-w-[140px] truncate px-3 py-2">
                        {r.email ?? "—"}
                      </td>
                      <td className="px-3 py-2">{r.type ?? "—"}</td>
                      <td className="px-3 py-2">{r.charges ?? "—"}</td>
                      <td className="px-3 py-2">{r.duration ?? "—"}</td>
                      <td className="px-3 py-2">{r.approvedBy ?? "—"}</td>
                      <td className="px-3 py-2">
                        <Select
                          value={r.status ?? "Pending"}
                          onValueChange={(v) =>
                            updateExtensionField(r.id, "status", v)
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EXT_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => toggleExtMail(r.id)}
                        >
                          {r.mailSent ? "Sent" : "Send"}
                        </Button>
                      </td>
                      <td className="space-x-1 px-3 py-2 text-center whitespace-nowrap">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openModal(r.id)}
                        >
                          Edit
                        </Button>
                        {canDel ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => onDelete(r)}
                          >
                            ✕
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit extension" : "Add extension"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Student name</Label>
              <Input
                value={form.name ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Number</Label>
              <Input
                value={form.number ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, number: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Mail ID</Label>
              <Input
                value={form.email ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select
                value={form.type ?? ""}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {EXT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Charges</Label>
              <Input
                value={form.charges ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, charges: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Duration</Label>
              <Input
                value={form.duration ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, duration: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Approved by</Label>
              <Select
                value={form.approvedBy ?? ""}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, approvedBy: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Trainer" />
                </SelectTrigger>
                <SelectContent>
                  {trainers.map((t: string) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                value={form.status ?? "Pending"}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXT_STATUSES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Reason</Label>
              <Textarea
                value={form.reason ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, reason: e.target.value }))
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveForm}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
