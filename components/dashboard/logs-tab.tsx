"use client"

import { motion } from "framer-motion"
import * as React from "react"

import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { EditHistoryEntry } from "@/lib/dashboard/constants"
import { fadeInProps, useMotionAllowed } from "@/lib/motion"

function sortEntries(entries: EditHistoryEntry[]): EditHistoryEntry[] {
  return [...entries].sort((a, b) => b.id.localeCompare(a.id))
}

export function LogsTab() {
  const reduced = useMotionAllowed()
  const { persisted } = useDashboard()
  const sorted = React.useMemo(
    () => sortEntries(persisted.editHistory as EditHistoryEntry[]),
    [persisted.editHistory]
  )

  return (
    <motion.div {...fadeInProps(!reduced)} className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold tracking-tight">Activity logs</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Changes made in this workspace (schedule, tasks, comments, and more).
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {sorted.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No activity recorded yet.
            </p>
          ) : (
            <ScrollArea className="h-[min(70vh,640px)] pr-3">
              <ul className="space-y-3">
                {sorted.map((e) => (
                  <li
                    key={e.id}
                    className="border-border bg-muted/20 rounded-lg border px-3 py-2.5 text-sm"
                  >
                    <div className="text-muted-foreground flex flex-wrap items-baseline justify-between gap-2 text-xs">
                      <span className="font-medium tabular-nums">{e.ts}</span>
                      <span className="text-foreground font-semibold" title={e.actorEmail}>
                        {e.user}
                        {e.actorEmail ? (
                          <span className="text-muted-foreground font-normal">
                            {" "}
                            · {e.actorEmail}
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <div className="mt-1 font-medium">
                      <span className="text-brand-cyan">{e.section}</span>
                      <span className="text-muted-foreground"> · </span>
                      {e.action}
                    </div>
                    <p className="text-muted-foreground mt-1 break-words text-xs leading-relaxed">
                      {e.detail}
                    </p>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
