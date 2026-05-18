"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import * as React from "react"

import { SkillinaboxLogo } from "@/brand/logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { TCOLORS } from "@/lib/dashboard/constants"
import { cn } from "@/lib/utils"
import { staggerContainer, staggerItem, useMotionAllowed } from "@/lib/motion"

const plannerNav = [
  { href: "/dashboard/schedule", label: "Schedule" },
  { href: "/dashboard/trainer-log", label: "Trainer log" },
  { href: "/dashboard/tracker", label: "Tracker" },
  { href: "/dashboard/messages", label: "Messages" },
  { href: "/dashboard/tasks", label: "Tasks" },
  { href: "/dashboard/extensions", label: "Extensions" },
  { href: "/dashboard/trash", label: "Trash" },
] as const

const logsNav = {
  href: "/dashboard/logs",
  label: "Logs",
} as const

const profileNav = {
  href: "/dashboard/profile",
  label: "Profile",
} as const

function isNavActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export type DashboardSidebarProps = {
  pathname: string
  trainers: string[]
  trainerInput: string
  onTrainerInput: (v: string) => void
  onAddTrainer: (e: React.FormEvent) => void
  onRemoveTrainer: (i: number) => void
  syncStatus: "idle" | "syncing" | "saved" | "error"
  syncMessage: string
  onNavigate?: () => void
}

export function DashboardSidebar({
  pathname,
  trainers,
  trainerInput,
  onTrainerInput,
  onAddTrainer,
  onRemoveTrainer,
  syncStatus,
  syncMessage,
  onNavigate,
}: DashboardSidebarProps) {
  const reduced = useMotionAllowed()

  return (
    <>
      <div className="mb-6 flex items-center gap-2 px-1">
        <SkillinaboxLogo variant="mark" className="h-8 text-foreground" />
        <div className="leading-tight">
          <div className="font-heading text-sm font-bold tracking-wide uppercase">
            Sessions
          </div>
          <div className="text-muted-foreground text-[0.62rem] tracking-wider uppercase">
            Planner
          </div>
        </div>
      </div>

      <nav className="space-y-1">
        {plannerNav.map(({ href, label }) => {
          const active = isNavActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-orange/15 text-brand-orange border-brand-orange/40 border"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {label}
            </Link>
          )
        })}
        <Link
          href={logsNav.href}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isNavActive(pathname, logsNav.href)
              ? "bg-brand-orange/15 text-brand-orange border-brand-orange/40 border"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {logsNav.label}
        </Link>
        <Link
          href={profileNav.href}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isNavActive(pathname, profileNav.href)
              ? "bg-brand-orange/15 text-brand-orange border-brand-orange/40 border"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {profileNav.label}
        </Link>
      </nav>

      <Separator className="my-6" />

      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[0.62rem] font-semibold tracking-wider uppercase">
          Trainers ({trainers.length})
        </span>
      </div>
      <ScrollArea className="h-[min(36vh,320px)] pr-2">
        <motion.ul {...staggerContainer(!reduced)} className="space-y-1">
          {trainers.map((t, i) => (
            <motion.li key={t} {...staggerItem(!reduced)}>
              <div className="bg-muted/40 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{
                    background: TCOLORS[i % TCOLORS.length],
                  }}
                />
                <span className="flex-1 truncate">{t}</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive px-1"
                  aria-label={`Remove ${t}`}
                  onClick={() => onRemoveTrainer(i)}
                >
                  ×
                </button>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      </ScrollArea>
      <form className="mt-3 flex gap-1" onSubmit={onAddTrainer}>
        <Input
          value={trainerInput}
          onChange={(e) => onTrainerInput(e.target.value)}
          placeholder="Add trainer"
          className="h-8 text-xs"
        />
        <Button type="submit" size="sm" className="h-8 shrink-0 px-2 text-xs">
          +
        </Button>
      </form>

      <div className="border-border bg-muted/30 mt-auto rounded-lg border p-3 text-[0.7rem]">
        <div className="text-muted-foreground mb-1 font-semibold uppercase">
          Sync
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              syncStatus === "saved" && "bg-emerald-500",
              syncStatus === "syncing" && "animate-pulse bg-amber-400",
              syncStatus === "error" && "bg-red-500"
            )}
          />
          <span className="text-muted-foreground">{syncMessage}</span>
        </div>
      </div>
    </>
  )
}
