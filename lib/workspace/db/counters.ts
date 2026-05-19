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
  for (let attempt = 0; attempt < 8; attempt++) {
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

    const { data: updated, error: upErr } = await supabase
      .from("workspace_meta")
      .update({ [field]: next })
      .eq("workspace_id", WORKSPACE_ID)
      .eq(field, current)
      .select(field)
      .maybeSingle()

    if (upErr) throw new Error(upErr.message)
    if (updated) {
      return Number((updated as Record<string, number>)[field] ?? next)
    }
  }

  throw new Error(`Failed to allocate ${field} after repeated concurrent updates`)
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
