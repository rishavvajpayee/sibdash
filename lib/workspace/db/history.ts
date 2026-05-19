import type { SupabaseClient } from "@supabase/supabase-js"

import { WORKSPACE_ID } from "@/lib/workspace/constants"

export async function appendEditHistory(
  supabase: SupabaseClient,
  userEmail: string,
  section: string,
  action: string,
  detail: string
) {
  const user = userEmail.split("@")[0] || "unknown"
  const now = new Date()
  const ts =
    now.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) +
    " " +
    now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })

  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

  await supabase.from("edit_history").insert({
    workspace_id: WORKSPACE_ID,
    id,
    recorded_at: ts,
    user_name: user,
    actor_email: userEmail,
    section,
    action,
    detail,
  })

  const { data: rows } = await supabase
    .from("edit_history")
    .select("id")
    .eq("workspace_id", WORKSPACE_ID)
    .order("id", { ascending: false })

  if (rows && rows.length > 500) {
    const toDelete = rows.slice(500).map((r) => r.id)
    await supabase
      .from("edit_history")
      .delete()
      .eq("workspace_id", WORKSPACE_ID)
      .in("id", toDelete)
  }
}
