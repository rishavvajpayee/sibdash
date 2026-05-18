import { cache } from "react"

import { createClient } from "@/lib/supabase/server"

export type WorkspaceServerState = {
  payload: unknown
  updatedAt: string | null
}

export const getWorkspacePayload = cache(async (): Promise<WorkspaceServerState> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from("workspace_dashboard")
    .select("payload, updated_at")
    .eq("id", "default")
    .maybeSingle()

  return {
    payload: data?.payload ?? null,
    updatedAt: data?.updated_at ?? null,
  }
})
