import type { ReactNode } from "react"

import { AppShell } from "@/components/dashboard/app-shell"
import { DashboardProvider } from "@/components/dashboard/dashboard-provider"
import { getWorkspacePayload } from "@/lib/workspace-data"

export async function DashboardWorkspace({
  userEmail,
  children,
}: {
  userEmail: string
  children: ReactNode
}) {
  const { payload, updatedAt } = await getWorkspacePayload()

  return (
    <DashboardProvider
      initialPayload={payload}
      workspaceUpdatedAt={updatedAt}
      userEmail={userEmail}
    >
      <AppShell>{children}</AppShell>
    </DashboardProvider>
  )
}
