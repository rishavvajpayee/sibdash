import type { SupabaseClient } from "@supabase/supabase-js"

import { parseTaggedUsers } from "@/lib/dashboard/notifications"
import { WORKSPACE_ID } from "@/lib/workspace/constants"

export async function addNotificationsForComment(
  supabase: SupabaseClient,
  trainers: string[],
  userEmail: string,
  noteText: string,
  learnerName: string
) {
  const tagged = parseTaggedUsers(noteText, trainers)
  for (const name of tagged) {
    const trainerKey = name.toLowerCase().replace(/\s+/g, "_")
    const ts =
      new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      }) +
      " " +
      new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    await supabase.from("notifications").insert({
      workspace_id: WORKSPACE_ID,
      id,
      trainer_key: trainerKey,
      from_email: userEmail || "someone",
      message: `@${name} — "${noteText.substring(0, 80)}${noteText.length > 80 ? "…" : ""}" (re: ${learnerName || "session"})`,
      ts,
      read: false,
      learner_name: learnerName,
      to_trainer_name: name,
    })
  }
}
