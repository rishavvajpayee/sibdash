import { cache } from "react"

import { createClient } from "@/lib/supabase/server"
import { loadWorkspaceBootstrap } from "@/lib/workspace/db/assemble"

export type WorkspaceServerState = {
  payload: unknown
  updatedAt: string | null
}

export const getWorkspacePayload = cache(async (): Promise<WorkspaceServerState> => {
  const supabase = await createClient()
  const { payload, updatedAt } = await loadWorkspaceBootstrap(supabase)
  return { payload, updatedAt }
})
