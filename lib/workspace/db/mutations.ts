import type { SupabaseClient } from "@supabase/supabase-js"

import {
  DAYS,
  type Day,
  type ExtensionRecord,
  normLearnerKey,
  type Slot,
  type TaskCategory,
  type TaskStatus,
} from "@/lib/dashboard/constants"
import { mergeTrackerFromSchedule } from "@/lib/dashboard/tracker-utils"
import { formatIstTimestamp } from "@/lib/time"
import { fmtWeekRange, getWeekKey, previousWeekKey } from "@/lib/dashboard/merge-remote"
import { WORKSPACE_ID } from "@/lib/workspace/constants"
import { nextExtId, nextMsgId, nextSlotId, nextTaskId, nextTrackerId } from "@/lib/workspace/db/counters"
import { appendEditHistory } from "@/lib/workspace/db/history"
import { addNotificationsForComment } from "@/lib/workspace/db/notifications"

const W = { workspace_id: WORKSPACE_ID }

export async function addTrainer(
  supabase: SupabaseClient,
  userEmail: string,
  name: string
) {
  const { count } = await supabase
    .from("trainers")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", WORKSPACE_ID)

  const { error } = await supabase.from("trainers").insert({
    ...W,
    name,
    sort_order: count ?? 0,
  })
  if (error) throw new Error(error.message)
  await appendEditHistory(supabase, userEmail, "Trainers", "Added trainer", name)
}

export async function removeTrainer(
  supabase: SupabaseClient,
  userEmail: string,
  name: string
) {
  const { error } = await supabase
    .from("trainers")
    .delete()
    .eq("workspace_id", WORKSPACE_ID)
    .eq("name", name)
  if (error) throw new Error(error.message)
  await appendEditHistory(supabase, userEmail, "Trainers", "Removed trainer", name)
}

export async function createScheduleSlot(
  supabase: SupabaseClient,
  userEmail: string,
  weekKey: string,
  day: Day,
  slot: Omit<Slot, "id"> & { id?: number }
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = await nextSlotId(supabase)
    const { error } = await supabase.from("schedule_slots").insert({
      ...W,
      id,
      week_key: weekKey,
      day,
      time: slot.time,
      learner: slot.learner,
      trainer: slot.trainer ?? "",
      co_trainer: slot.coTrainer ?? "",
      type: slot.type ?? "Regular",
      note: slot.note ?? "",
      added_by: slot.addedBy ?? userEmail.split("@")[0],
      added_at: slot.addedAt ?? new Date().toISOString(),
    })

    if (!error) {
      await appendEditHistory(
        supabase,
        userEmail,
        "Schedule",
        "Added slot",
        `${slot.learner} · ${day} ${slot.time}`
      )
      return { ...slot, id } as Slot
    }

    if (error.code === "23505") continue

    if (error.code === "23503") {
      throw new Error("Schedule data is out of sync. Please refresh and try again.")
    }

    throw new Error(error.message)
  }

  throw new Error("Schedule changed while creating the slot. Please refresh and try again.")
}

export async function patchScheduleSlot(
  supabase: SupabaseClient,
  userEmail: string,
  slotId: number,
  patch: Partial<{
    time: string
    learner: string
    trainer: string
    co_trainer: string
    type: string
    note: string
    week_key: string
    day: Day
  }>,
  log?: { section: string; action: string; detail: string }
) {
  const { error } = await supabase
    .from("schedule_slots")
    .update(patch)
    .eq("workspace_id", WORKSPACE_ID)
    .eq("id", slotId)
  if (error) throw new Error(error.message)
  if (log) await appendEditHistory(supabase, userEmail, log.section, log.action, log.detail)
}

export async function deleteScheduleSlot(
  supabase: SupabaseClient,
  userEmail: string,
  slotId: number,
  weekKey: string,
  day: Day,
  slot: Slot
) {
  await supabase.from("schedule_slots").delete().eq("workspace_id", WORKSPACE_ID).eq("id", slotId)
  await supabase.from("deleted_slots").upsert({ ...W, slot_id: slotId })
  const ts = formatIstTimestamp()
  await supabase.from("trash_entries").insert({
    ...W,
    id: `${Date.now()}_t`,
    slot_id: slotId,
    week_key: weekKey,
    day,
    deleted_at: ts,
    deleted_by: userEmail.split("@")[0] || "unknown",
    time: slot.time,
    learner: slot.learner,
    trainer: slot.trainer ?? "",
    co_trainer: slot.coTrainer ?? "",
    type: slot.type ?? "Regular",
    note: slot.note ?? "",
    added_by: slot.addedBy,
    added_at: slot.addedAt,
  })
  await appendEditHistory(
    supabase,
    userEmail,
    "Schedule",
    "Deleted slot",
    `${slot.learner} · ${day} ${slot.time}`
  )
}

export async function upsertAttendance(
  supabase: SupabaseClient,
  userEmail: string,
  weekKey: string,
  slotId: number,
  att: string,
  note?: string
) {
  const row: Record<string, unknown> = { ...W, week_key: weekKey, slot_id: slotId, att }
  if (note !== undefined) row.note = note
  const { error } = await supabase.from("attendance").upsert(row, {
    onConflict: "workspace_id,week_key,slot_id",
  })
  if (error) throw new Error(error.message)
  await appendEditHistory(
    supabase,
    userEmail,
    note !== undefined ? "Session note" : "Attendance",
    note !== undefined ? "Updated session note" : "Updated attendance",
    `slot ${slotId}`
  )
}

export async function addLearnerNote(
  supabase: SupabaseClient,
  userEmail: string,
  slotId: number | string,
  text: string,
  trainers: string[],
  learnerName: string
) {
  const { count } = await supabase
    .from("learner_notes")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", WORKSPACE_ID)
    .eq("slot_id", Number(slotId))

  const ts = formatIstTimestamp()

  const { error } = await supabase.from("learner_notes").insert({
    ...W,
    slot_id: Number(slotId),
    author_email: userEmail,
    trainer: userEmail.split("@")[0],
    text,
    note_ts: ts,
    sort_index: count ?? 0,
  })
  if (error) throw new Error(error.message)
  await appendEditHistory(supabase, userEmail, "Comments", "Added comment", learnerName)
  await addNotificationsForComment(supabase, trainers, userEmail, text, learnerName)
}

export async function deleteLearnerNoteByIndex(
  supabase: SupabaseClient,
  slotId: number | string,
  revIndex: number,
  userEmail: string
) {
  const { data: notes } = await supabase
    .from("learner_notes")
    .select("*")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("slot_id", Number(slotId))
    .order("sort_index")

  if (!notes?.length) throw new Error("Note not found")
  const realIdx = notes.length - 1 - revIndex
  const note = notes[realIdx]
  if (!note) throw new Error("Note not found")
  if (note.author_email !== userEmail && note.email !== userEmail) {
    throw new Error("You can only delete your own comments.")
  }
  const { error } = await supabase.from("learner_notes").delete().eq("id", note.id)
  if (error) throw new Error(error.message)
}

export async function upsertTrackerEntry(
  supabase: SupabaseClient,
  userEmail: string,
  weekKey: string,
  entry: {
    id?: number
    name: string
    trainer?: string
    batch?: string
    week?: string
    target?: number
    notes?: string
  }
) {
  const weekLabel = entry.week ?? fmtWeekRange(weekKey)
  const nameKey = normLearnerKey(entry.name)
  await supabase
    .from("tracker_sync_exclusions")
    .delete()
    .eq("workspace_id", WORKSPACE_ID)
    .eq("week_key", weekKey)
    .eq("learner_name_norm", nameKey)

  const { data: existing } = await supabase
    .from("tracker_entries")
    .select("id")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("week_key", weekKey)
    .ilike("name", entry.name)

  let id = entry.id
  if (existing?.length) {
    id = Number(existing[0]!.id)
    await supabase
      .from("tracker_entries")
      .update({
        name: entry.name,
        trainer: entry.trainer,
        batch: entry.batch,
        week_label: weekLabel,
        target: entry.target ?? 5,
        notes: entry.notes,
      })
      .eq("workspace_id", WORKSPACE_ID)
      .eq("id", id)
  } else {
    id = await nextTrackerId(supabase)
    await supabase.from("tracker_entries").insert({
      ...W,
      id,
      week_key: weekKey,
      name: entry.name,
      trainer: entry.trainer,
      batch: entry.batch,
      week_label: weekLabel,
      target: entry.target ?? 5,
      notes: entry.notes,
    })
  }
  await appendEditHistory(supabase, userEmail, "Lecture Tracker", "Updated learner", entry.name)
  return id
}

export async function removeTrackerEntry(
  supabase: SupabaseClient,
  userEmail: string,
  weekKey: string,
  id: number
) {
  const { data: removed } = await supabase
    .from("tracker_entries")
    .select("name")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("id", id)
    .maybeSingle()

  await supabase
    .from("tracker_entries")
    .delete()
    .eq("workspace_id", WORKSPACE_ID)
    .eq("id", id)

  if (removed?.name) {
    const nk = normLearnerKey(removed.name)
    if (nk) {
      await supabase.from("tracker_sync_exclusions").upsert({
        ...W,
        week_key: weekKey,
        learner_name_norm: nk,
      })
    }
  }
  await appendEditHistory(supabase, userEmail, "Lecture Tracker", "Removed learner", `id ${id}`)
}

export async function syncTrackerFromScheduleDb(
  supabase: SupabaseClient,
  userEmail: string,
  weekKey: string,
  schedule: Record<Day, Slot[]>,
  excludedNames: string[]
) {
  const { data: rows } = await supabase
    .from("tracker_entries")
    .select("*")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("week_key", weekKey)

  const { data: meta } = await supabase
    .from("workspace_meta")
    .select("tracker_id_counter")
    .eq("workspace_id", WORKSPACE_ID)
    .single()

  let trackerId = meta?.tracker_id_counter ?? 100
  const { next, nextId, changed } = mergeTrackerFromSchedule(
    (rows ?? []).map((r) => ({
      id: Number(r.id),
      name: r.name,
      trainer: r.trainer,
      batch: r.batch,
      week: r.week_label,
      target: r.target,
      notes: r.notes,
    })),
    trackerId,
    schedule,
    fmtWeekRange(weekKey),
    excludedNames
  )

  if (!changed) return

  for (const row of next) {
    const { data: ex } = await supabase
      .from("tracker_entries")
      .select("id")
      .eq("workspace_id", WORKSPACE_ID)
      .eq("week_key", weekKey)
      .eq("id", row.id)
      .maybeSingle()
    if (ex) {
      await supabase
        .from("tracker_entries")
        .update({
          name: row.name,
          trainer: row.trainer,
          batch: row.batch,
          week_label: row.week,
          target: row.target,
          notes: row.notes,
        })
        .eq("workspace_id", WORKSPACE_ID)
        .eq("id", row.id)
    } else {
      await supabase.from("tracker_entries").insert({
        ...W,
        id: row.id,
        week_key: weekKey,
        name: row.name,
        trainer: row.trainer,
        batch: row.batch,
        week_label: row.week,
        target: row.target,
        notes: row.notes,
      })
    }
  }

  if (nextId > trackerId) {
    await supabase
      .from("workspace_meta")
      .update({ tracker_id_counter: nextId })
      .eq("workspace_id", WORKSPACE_ID)
  }

  await appendEditHistory(
    supabase,
    userEmail,
    "Lecture Tracker",
    "Synced learners from schedule",
    fmtWeekRange(weekKey)
  )
}

export async function createMsgSlot(
  supabase: SupabaseClient,
  userEmail: string,
  weekKey: string,
  day: Day,
  from: string,
  to: string,
  trainers: string[],
  notes: string
) {
  const n = await nextMsgId(supabase)
  const id = `ms${n}`
  await supabase.from("msg_slots").insert({
    ...W,
    id,
    week_key: weekKey,
    day,
    from_time: from,
    to_time: to,
    trainer: trainers[0] ?? "",
    trainers,
    notes,
  })
  await appendEditHistory(
    supabase,
    userEmail,
    "Message Slots",
    "Added slot",
    `${from}–${to}`
  )
  return id
}

export async function updateMsgSlot(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<{
    from_time: string
    to_time: string
    trainer: string
    trainers: string[]
    notes: string
  }>
) {
  const { error } = await supabase
    .from("msg_slots")
    .update(patch)
    .eq("workspace_id", WORKSPACE_ID)
    .eq("id", id)
  if (error) throw new Error(error.message)
}

export async function deleteMsgSlot(
  supabase: SupabaseClient,
  userEmail: string,
  weekKey: string,
  id: string
) {
  await supabase.from("msg_slots").delete().eq("workspace_id", WORKSPACE_ID).eq("id", id)
  await supabase
    .from("msg_done")
    .delete()
    .eq("workspace_id", WORKSPACE_ID)
    .eq("week_key", weekKey)
    .eq("msg_slot_id", id)
  await appendEditHistory(supabase, userEmail, "Message Slots", "Deleted slot", id)
}

export async function upsertMsgDone(
  supabase: SupabaseClient,
  userEmail: string,
  weekKey: string,
  msgSlotId: string,
  done: boolean,
  doneAt: string | null
) {
  await supabase.from("msg_done").upsert(
    {
      ...W,
      week_key: weekKey,
      msg_slot_id: msgSlotId,
      done,
      done_at: doneAt,
    },
    { onConflict: "workspace_id,week_key,msg_slot_id" }
  )
  await appendEditHistory(
    supabase,
    userEmail,
    "Message Slots",
    done ? "Marked done" : "Unmarked done",
    msgSlotId
  )
}

export async function upsertTask(
  supabase: SupabaseClient,
  userEmail: string,
  weekKey: string,
  category: TaskCategory,
  task: {
    id?: string
    name: string
    assign: string
    date: string
    status: TaskStatus
    delay: string
    createdBy?: string
  }
) {
  let id = task.id
  if (!id) {
    const n = await nextTaskId(supabase)
    id = `t${n}`
  }
  await supabase.from("tasks").upsert(
    {
      ...W,
      id,
      week_key: weekKey,
      category,
      name: task.name,
      assignee: task.assign,
      due_date: task.date,
      status: task.status,
      delay: task.delay,
      created_by: task.createdBy ?? userEmail,
    },
    { onConflict: "workspace_id,id" }
  )
  return id
}

export async function patchTask(
  supabase: SupabaseClient,
  userEmail: string,
  id: string,
  patch: Partial<{
    name: string
    assignee: string
    due_date: string
    status: TaskStatus
    delay: string
  }>,
  logDetail: string
) {
  const { error } = await supabase
    .from("tasks")
    .update(patch)
    .eq("workspace_id", WORKSPACE_ID)
    .eq("id", id)
  if (error) throw new Error(error.message)
  await appendEditHistory(supabase, userEmail, "Tasks", "Updated task", logDetail)
}

export async function deleteTask(
  supabase: SupabaseClient,
  userEmail: string,
  id: string,
  createdBy: string | undefined,
  requesterEmail: string
) {
  if (createdBy && requesterEmail && createdBy !== requesterEmail) {
    throw new Error("You can only delete tasks you created.")
  }
  await supabase.from("tasks").delete().eq("workspace_id", WORKSPACE_ID).eq("id", id)
  await appendEditHistory(supabase, userEmail, "Tasks", "Deleted task", id)
}

export async function upsertExtension(
  supabase: SupabaseClient,
  userEmail: string,
  rec: ExtensionRecord & { id?: string }
) {
  let id = rec.id
  if (!id) {
    await nextExtId(supabase)
    id = `ext${Date.now()}`
  }
  await supabase.from("extension_records").upsert(
    {
      ...W,
      id,
      name: rec.name,
      number: rec.number,
      email: rec.email,
      type: rec.type,
      charges: rec.charges,
      duration: rec.duration,
      approved_by: rec.approvedBy,
      reason: rec.reason,
      status: rec.status,
      mail_sent: rec.mailSent ?? false,
      created_by: rec.createdBy ?? userEmail,
      created_at: rec.createdAt ?? new Date().toISOString(),
    },
    { onConflict: "workspace_id,id" }
  )
  await appendEditHistory(supabase, userEmail, "Extension", rec.id ? "Edited record" : "Added record", rec.name)
  return id
}

export async function deleteExtension(
  supabase: SupabaseClient,
  userEmail: string,
  id: string,
  createdBy: string | undefined,
  requesterEmail: string
) {
  if (createdBy && requesterEmail && createdBy !== requesterEmail) {
    throw new Error("You can only delete records you created.")
  }
  await supabase.from("extension_records").delete().eq("workspace_id", WORKSPACE_ID).eq("id", id)
  await appendEditHistory(supabase, userEmail, "Extension", "Deleted record", id)
}

export async function restoreTrash(
  supabase: SupabaseClient,
  userEmail: string,
  trashId: string
) {
  const { data: entry } = await supabase
    .from("trash_entries")
    .select("*")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("id", trashId)
    .single()
  if (!entry) throw new Error("Trash entry not found")

  await supabase.from("schedule_slots").upsert({
    ...W,
    id: entry.slot_id,
    week_key: entry.week_key,
    day: entry.day,
    time: entry.time,
    learner: entry.learner,
    trainer: entry.trainer,
    co_trainer: entry.co_trainer,
    type: entry.type,
    note: entry.note,
    added_by: entry.added_by,
    added_at: entry.added_at,
  })
  await supabase
    .from("deleted_slots")
    .delete()
    .eq("workspace_id", WORKSPACE_ID)
    .eq("slot_id", entry.slot_id)
  await supabase.from("trash_entries").delete().eq("workspace_id", WORKSPACE_ID).eq("id", trashId)
  await appendEditHistory(
    supabase,
    userEmail,
    "Schedule",
    "Restored slot",
    `${entry.learner} · ${entry.day}`
  )
}

export async function purgeTrash(supabase: SupabaseClient, trashId: string) {
  await supabase.from("trash_entries").delete().eq("workspace_id", WORKSPACE_ID).eq("id", trashId)
}

export async function emptyTrash(supabase: SupabaseClient) {
  await supabase.from("trash_entries").delete().eq("workspace_id", WORKSPACE_ID)
}

export async function copyWeekFromPrevious(
  supabase: SupabaseClient,
  userEmail: string,
  fromWeekKey: string,
  toWeekKey: string
) {
  const { data: slots } = await supabase
    .from("schedule_slots")
    .select("*")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("week_key", fromWeekKey)

  for (const row of slots ?? []) {
    const newId = await nextSlotId(supabase)
    await supabase.from("schedule_slots").insert({
      ...W,
      id: newId,
      week_key: toWeekKey,
      day: row.day,
      time: row.time,
      learner: row.learner,
      trainer: row.trainer,
      co_trainer: row.co_trainer,
      type: row.type,
      note: row.note,
      added_by: userEmail.split("@")[0],
      added_at: new Date().toISOString(),
    })
  }

  await appendEditHistory(
    supabase,
    userEmail,
    "Schedule",
    "Copied from previous week",
    `${fromWeekKey} → ${toWeekKey}`
  )
}
