"use client"

import * as React from "react"

import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { fmtWeekRange } from "@/lib/dashboard/merge-remote"

export function TrashTab() {
  const { persisted, restoreTrashEntry, purgeTrashEntry, emptyTrash } =
    useDashboard()

  const sorted = React.useMemo(
    () => [...persisted.trashBin].reverse(),
    [persisted.trashBin]
  )

  function onEmpty() {
    if (!persisted.trashBin.length) return
    if (
      !window.confirm(
        `Permanently remove all ${persisted.trashBin.length} items from trash?`
      )
    ) {
      return
    }
    emptyTrash()
  }

  function onPurge(id: string, learner: string) {
    if (!window.confirm(`Permanently delete "${learner}"?`)) return
    purgeTrashEntry(id)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold">Trash</h2>
          <p className="text-muted-foreground text-sm">
            Deleted sessions — restore or permanently remove
          </p>
        </div>
        <Button
          type="button"
          variant="destructive"
          className="ml-auto"
          onClick={onEmpty}
          disabled={!persisted.trashBin.length}
        >
          Empty trash
        </Button>
      </div>

      <p className="text-muted-foreground text-sm">
        {!persisted.trashBin.length
          ? "Trash is empty."
          : `${persisted.trashBin.length} item${persisted.trashBin.length !== 1 ? "s" : ""} in trash`}
      </p>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="bg-muted/40 text-muted-foreground border-b text-left text-[10px] font-semibold tracking-wider uppercase">
                  <th className="px-3 py-2">Learner</th>
                  <th className="px-3 py-2">Day / time</th>
                  <th className="px-3 py-2">Trainer</th>
                  <th className="px-3 py-2">Week</th>
                  <th className="px-3 py-2">Deleted by</th>
                  <th className="px-3 py-2">Deleted at</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!sorted.length ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-muted-foreground px-4 py-12 text-center italic"
                    >
                      Deleted sessions will appear here.
                    </td>
                  </tr>
                ) : (
                  sorted.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-border/60 hover:bg-destructive/4 border-b last:border-0"
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium">{entry.slot.learner || "—"}</div>
                        <div className="text-muted-foreground text-xs">
                          {entry.slot.type || "Regular"}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {entry.day} · {entry.slot.time || "—"}
                      </td>
                      <td className="text-muted-foreground px-3 py-2">
                        {entry.slot.trainer || "—"}
                      </td>
                      <td className="text-brand-cyan px-3 py-2 text-xs">
                        Week of {fmtWeekRange(entry.weekKey)}
                      </td>
                      <td className="px-3 py-2">
                        <span className="bg-destructive/15 text-destructive rounded px-1.5 py-0.5 text-xs">
                          {entry.deletedBy ?? "?"}
                        </span>
                      </td>
                      <td className="text-muted-foreground px-3 py-2 text-xs">
                        {entry.deletedAt ?? "—"}
                      </td>
                      <td className="space-x-1 px-3 py-2 text-center whitespace-nowrap">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-emerald-500/40 text-emerald-500"
                          onClick={() => restoreTrashEntry(entry.id)}
                        >
                          Restore
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() =>
                            onPurge(entry.id, entry.slot.learner || "session")
                          }
                        >
                          ✕
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
