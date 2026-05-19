import type { SupabaseClient } from "@supabase/supabase-js"

import {
  DAYS,
  type Day,
  emptyWeekSchedule,
  ensureWeekStore,
  type EditHistoryEntry,
  type ExtensionRecord,
  type MsgSlot,
  type NoteEntry,
  type Slot,
  TASK_CATEGORY_KEYS,
  type TaskCategory,
  type TrashEntry,
  type TrackerEntry,
  type WeekStore,
  type WorkspacePayload,
} from "@/lib/dashboard/constants"
import { persistedFromRemote } from "@/lib/dashboard/merge-remote"
import { WORKSPACE_ID } from "@/lib/workspace/constants"

export type WorkspaceBootstrap = {
  payload: WorkspacePayload
  updatedAt: string | null
}

export async function loadWorkspaceBootstrap(
  supabase: SupabaseClient
): Promise<WorkspaceBootstrap> {
  const [
    metaRes,
    trainersRes,
    slotsRes,
    deletedRes,
    notesRes,
    notifRes,
    historyRes,
    extRes,
    trashRes,
    trackerRes,
    exclusionsRes,
    msgRes,
    msgDoneRes,
    tasksRes,
    attRes,
  ] = await Promise.all([
    supabase
      .from("workspace_meta")
      .select("*")
      .eq("workspace_id", WORKSPACE_ID)
      .maybeSingle(),
    supabase
      .from("trainers")
      .select("name, sort_order")
      .eq("workspace_id", WORKSPACE_ID)
      .order("sort_order"),
    supabase.from("schedule_slots").select("*").eq("workspace_id", WORKSPACE_ID),
    supabase.from("deleted_slots").select("slot_id").eq("workspace_id", WORKSPACE_ID),
    supabase
      .from("learner_notes")
      .select("*")
      .eq("workspace_id", WORKSPACE_ID)
      .order("sort_index"),
    supabase.from("notifications").select("*").eq("workspace_id", WORKSPACE_ID),
    supabase
      .from("edit_history")
      .select("*")
      .eq("workspace_id", WORKSPACE_ID)
      .order("id", { ascending: false })
      .limit(500),
    supabase.from("extension_records").select("*").eq("workspace_id", WORKSPACE_ID),
    supabase.from("trash_entries").select("*").eq("workspace_id", WORKSPACE_ID),
    supabase.from("tracker_entries").select("*").eq("workspace_id", WORKSPACE_ID),
    supabase
      .from("tracker_sync_exclusions")
      .select("*")
      .eq("workspace_id", WORKSPACE_ID),
    supabase.from("msg_slots").select("*").eq("workspace_id", WORKSPACE_ID),
    supabase.from("msg_done").select("*").eq("workspace_id", WORKSPACE_ID),
    supabase.from("tasks").select("*").eq("workspace_id", WORKSPACE_ID),
    supabase.from("attendance").select("*").eq("workspace_id", WORKSPACE_ID),
  ])

  const meta = metaRes.data
  const userWeeks: Record<string, Record<Day, Slot[]>> = {}
  const deletedSet = new Set(
    (deletedRes.data ?? []).map((r) => Number(r.slot_id))
  )

  for (const row of slotsRes.data ?? []) {
    if (deletedSet.has(Number(row.id))) continue
    const wk = row.week_key as string
    if (!userWeeks[wk]) userWeeks[wk] = emptyWeekSchedule()
    const day = row.day as Day
    if (!DAYS.includes(day)) continue
    userWeeks[wk][day].push({
      id: Number(row.id),
      time: row.time ?? "",
      learner: row.learner ?? "",
      trainer: row.trainer ?? "",
      coTrainer: row.co_trainer ?? undefined,
      type: row.type ?? "Regular",
      note: row.note ?? undefined,
      addedBy: row.added_by ?? undefined,
      addedAt: row.added_at ?? undefined,
    })
  }

  const allWeekData: Record<string, Partial<WeekStore>> = {}
  const weekKeys = new Set<string>([
    ...Object.keys(userWeeks),
    ...(trackerRes.data ?? []).map((r) => r.week_key as string),
    ...(msgRes.data ?? []).map((r) => r.week_key as string),
    ...(tasksRes.data ?? []).map((r) => r.week_key as string),
    ...(attRes.data ?? []).map((r) => r.week_key as string),
    ...(exclusionsRes.data ?? []).map((r) => r.week_key as string),
  ])

  for (const wk of weekKeys) {
    const store = ensureWeekStore(undefined)

    for (const row of trackerRes.data ?? []) {
      if (row.week_key !== wk) continue
      store.tracker.push({
        id: Number(row.id),
        name: row.name ?? "",
        trainer: row.trainer ?? undefined,
        batch: row.batch ?? undefined,
        week: row.week_label ?? undefined,
        target: row.target ?? 5,
        notes: row.notes ?? undefined,
      } as TrackerEntry)
    }

    store.trackerSyncExcludedNames = (exclusionsRes.data ?? [])
      .filter((r) => r.week_key === wk)
      .map((r) => r.learner_name_norm as string)

    for (const row of msgRes.data ?? []) {
      if (row.week_key !== wk) continue
      const day = row.day as Day
      if (!DAYS.includes(day)) continue
      const trainers = (row.trainers as string[] | null) ?? []
      store.msgSlots[day].push({
        id: row.id,
        from: row.from_time ?? "",
        to: row.to_time ?? "",
        trainer: row.trainer ?? trainers[0] ?? "",
        trainers: trainers.length ? trainers : undefined,
        notes: row.notes ?? undefined,
        day,
      } as MsgSlot)
    }

    for (const row of msgDoneRes.data ?? []) {
      if (row.week_key !== wk) continue
      store.msgDoneData[row.msg_slot_id as string] = {
        done: Boolean(row.done),
        doneAt: row.done_at ?? null,
      }
    }

    for (const row of tasksRes.data ?? []) {
      if (row.week_key !== wk) continue
      const cat = row.category as TaskCategory
      if (!TASK_CATEGORY_KEYS.includes(cat)) continue
      store.tasks[cat].push({
        id: row.id as string,
        name: row.name ?? "",
        assign: row.assignee ?? "",
        date: row.due_date ?? "",
        status: (row.status ?? "pending") as "pending" | "inprogress" | "done",
        delay: row.delay ?? "",
        createdBy: row.created_by ?? undefined,
      })
    }

    for (const row of attRes.data ?? []) {
      if (row.week_key !== wk) continue
      store.attData[Number(row.slot_id)] = {
        att: row.att ?? "",
        note: row.note ?? "",
      }
    }

    allWeekData[wk] = store
  }

  const learnerNotes: Record<string, NoteEntry[]> = {}
  for (const row of notesRes.data ?? []) {
    const key = String(row.slot_id)
    if (!learnerNotes[key]) learnerNotes[key] = []
    learnerNotes[key].push({
      authorEmail: row.author_email ?? undefined,
      email: row.email ?? undefined,
      trainer: row.trainer ?? undefined,
      text: row.text ?? "",
      ts: row.note_ts ?? undefined,
    })
  }

  const notifications: Record<string, unknown[]> = {}
  for (const row of notifRes.data ?? []) {
    const key = row.trainer_key as string
    if (!notifications[key]) notifications[key] = []
    notifications[key].push({
      id: row.id,
      from: row.from_email,
      msg: row.message,
      ts: row.ts,
      read: row.read,
      learnerName: row.learner_name,
      toTrainerName: row.to_trainer_name,
    })
  }

  const editHistory: EditHistoryEntry[] = (historyRes.data ?? []).map((row) => ({
    id: row.id as string,
    ts: row.recorded_at as string,
    user: row.user_name as string,
    actorEmail: row.actor_email ?? undefined,
    section: row.section as string,
    action: row.action as string,
    detail: row.detail as string,
  }))

  const extRecords: ExtensionRecord[] = (extRes.data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    number: row.number ?? undefined,
    email: row.email ?? undefined,
    type: row.type ?? undefined,
    charges: row.charges ?? undefined,
    duration: row.duration ?? undefined,
    approvedBy: row.approved_by ?? undefined,
    reason: row.reason ?? undefined,
    status: row.status ?? undefined,
    mailSent: Boolean(row.mail_sent),
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at ?? undefined,
  }))

  const trashBin: TrashEntry[] = (trashRes.data ?? []).map((row) => ({
    id: row.id as string,
    slot: {
      id: Number(row.slot_id),
      time: row.time ?? "",
      learner: row.learner ?? "",
      trainer: row.trainer ?? "",
      coTrainer: row.co_trainer ?? undefined,
      type: row.type ?? "Regular",
      note: row.note ?? undefined,
      addedBy: row.added_by ?? undefined,
      addedAt: row.added_at ?? undefined,
    },
    day: row.day as Day,
    weekKey: row.week_key as string,
    deletedAt: row.deleted_at ?? undefined,
    deletedBy: row.deleted_by ?? undefined,
  }))

  const raw: WorkspacePayload = {
    trainers: (trainersRes.data ?? []).map((r) => r.name as string),
    userWeeks,
    allWeekData,
    learnerNotes,
    notifications,
    editHistory,
    extRecords,
    extId: meta?.ext_id_counter ?? 0,
    trashBin,
    slotId: meta?.slot_id_counter ?? 1101,
    msgId: meta?.msg_id_counter ?? 200,
    trackerId: meta?.tracker_id_counter ?? 100,
    taskId: meta?.task_id_counter ?? 1,
    deletedSlotIds: [...deletedSet],
    _savedAt: Date.now(),
  }

  return {
    payload: persistedFromRemote(raw) as WorkspacePayload,
    updatedAt: meta?.updated_at ?? null,
  }
}
