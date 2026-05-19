import type { SupabaseClient } from "@supabase/supabase-js"

import { WORKSPACE_ID } from "@/lib/workspace/constants"

type CounterField =
  | "slot_id_counter"
  | "msg_id_counter"
  | "tracker_id_counter"
  | "task_id_counter"
  | "ext_id_counter"

async function bumpCounter(
  supabase: SupabaseClient,
  field: CounterField
): Promise<number> {
  const { data, error } = await supabase
    .from("workspace_meta")
    .select(field)
    .eq("workspace_id", WORKSPACE_ID)
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "workspace_meta missing")
  }

  const current = Number((data as Record<string, number>)[field] ?? 0)
  const next = current + 1

  const { error: upErr } = await supabase
    .from("workspace_meta")
    .update({ [field]: next })
    .eq("workspace_id", WORKSPACE_ID)

  if (upErr) throw new Error(upErr.message)
  return next
}

export const nextSlotId = (s: SupabaseClient) =>
  bumpCounter(s, "slot_id_counter")
export const nextMsgId = (s: SupabaseClient) =>
  bumpCounter(s, "msg_id_counter")
export const nextTrackerId = (s: SupabaseClient) =>
  bumpCounter(s, "tracker_id_counter")
export const nextTaskId = (s: SupabaseClient) =>
  bumpCounter(s, "task_id_counter")
export const nextExtId = (s: SupabaseClient) =>
  bumpCounter(s, "ext_id_counter")
