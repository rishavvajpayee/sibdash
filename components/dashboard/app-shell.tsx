"use client"

import { CalendarDays, ChevronRight, Menu } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import * as React from "react"

import { ThemeToggle } from "@/components/theme-toggle"
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { createClient } from "@/lib/supabase/client"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const {
    persisted,
    addTrainer,
    removeTrainer,
    syncStatus,
    syncMessage,
    userEmail,
  } = useDashboard()

  const [trainerInput, setTrainerInput] = React.useState("")
  const [mobileOpen, setMobileOpen] = React.useState(false)

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace("/login")
    router.refresh()
  }

  const initials =
    userEmail
      .split("@")[0]
      ?.split(/[._]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "?"

  function onAddTrainer(e: React.FormEvent) {
    e.preventDefault()
    addTrainer(trainerInput)
    setTrainerInput("")
  }

  const sidebarProps = {
    pathname,
    trainers: persisted.trainers,
    trainerInput,
    onTrainerInput: setTrainerInput,
    onAddTrainer,
    onRemoveTrainer: removeTrainer,
    syncStatus,
    syncMessage,
  }

  return (
    <div className="bg-background flex min-h-svh">
      <aside className="border-border bg-card hidden w-64 shrink-0 flex-col border-r p-4 lg:flex">
        <DashboardSidebar {...sidebarProps} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-background/80 sticky top-0 z-40 flex items-center gap-3 border-b px-4 py-3 backdrop-blur-md">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon-sm" className="lg:hidden">
                <Menu className="size-4" />
                <span className="sr-only">Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4">
              <SheetHeader>
                <SheetTitle className="sr-only">Navigation</SheetTitle>
              </SheetHeader>
              <DashboardSidebar
                {...sidebarProps}
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <CalendarDays className="text-brand-cyan size-5 shrink-0" />
            <div className="min-w-0">
              <h1 className="font-heading truncate text-lg font-bold tracking-tight">
                Sessions Planner
              </h1>
            </div>
          </div>

          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 rounded-full pr-3"
              >
                <span className="bg-muted flex size-7 items-center justify-center rounded-full text-xs font-bold">
                  {initials}
                </span>
                <ChevronRight className="size-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="text-muted-foreground px-2 py-1.5 text-xs">
                {userEmail}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/logs">Activity logs</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/profile">Profile & password</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void logout()}>
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
