import type { ReactNode } from "react"
import { Suspense } from "react"

import { redirect } from "next/navigation"

import { DashboardRootSkeleton } from "@/components/dashboard/dashboard-root-skeleton"
import { createClient } from "@/lib/supabase/server"

import { DashboardWorkspace } from "./dashboard-workspace"

export default async function DashboardGroupLayout({
  children,
}: {
  children: ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    redirect("/login")
  }

  return (
    <Suspense fallback={<DashboardRootSkeleton />}>
      <DashboardWorkspace userEmail={user.email}>{children}</DashboardWorkspace>
    </Suspense>
  )
}
