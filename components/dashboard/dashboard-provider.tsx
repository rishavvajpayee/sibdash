"use client"

import { usePathname } from "next/navigation"
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { toast } from "sonner"

import {
  DAYS,
  ensureWeekStore,
  normLearnerKey,
  type DashboardTask,
  type Day,
  type MsgSlot,
  type TaskCategory,
  type TaskStatus,
  emptyWeekSchedule,
  type ExtensionRecord,
  type Slot,
  type TrackerEntry,
  type WeekStore,
} from "@/lib/dashboard/constants"
import { parseTaggedUsers } from "@/lib/dashboard/notifications"
import {
  type DashboardPersisted,
  mergeRemoteIntoLocal,
  persistedFromRemote,
  fmtWeekRange,
  getWeekKey,
  previousWeekKey,
} from "@/lib/dashboard/merge-remote"
import { workspaceClient } from "@/lib/workspace/client"
import { mergeTrackerFromSchedule } from "@/lib/dashboard/tracker-utils"
import {
  dayNameFromDateStr,
  findDuplicateSlots,
  findSlotInWeek,
  getMsgSlotConflict,
  weekKeyForCalendarDate,
} from "@/lib/dashboard/schedule-utils"
import { createClient } from "@/lib/supabase/client"
import { formatIstTime, formatIstTimestamp, getIstYmd } from "@/lib/time"

type SyncStatus = "idle" | "syncing" | "saved" | "error"

export type SlotDraft = {
  day: Day
  time: string
  learner: string
  note: string
  trainer: string
  coTrainer: string
  type: string
}

type DupState =
  | { open: false }
  | { open: true; learnerName: string; pending: SlotDraft }

function findMsgSlotLocation(
  ws: WeekStore,
  slotId: string | number
): { day: Day; index: number } | null {
  for (const d of DAYS) {
    const arr = ws.msgSlots[d] ?? []
    const i = arr.findIndex((s) => String(s.id) === String(slotId))
    if (i >= 0) return { day: d, index: i }
  }
  return null
}

type DashboardContextValue = {
  userEmail: string
  syncStatus: SyncStatus
  syncMessage: string
  persisted: DashboardPersisted
  currentWeekKey: string
  currentDay: Day
  schedule: Record<Day, Slot[]>
  weekStore: WeekStore
  trainers: string[]
  fmtWeekRange: typeof fmtWeekRange
  pickDay: (day: Day) => void
  setDate: (isoDate: string) => void
  shiftWeek: (delta: number) => void
  copyFromLastWeek: () => void
  addTrainer: (name: string) => void
  removeTrainer: (index: number) => void
  updateSlotField: (slotId: number, field: keyof Slot, value: string) => void
  updateSlotTime: (slotId: number, newTime: string) => void
  updateAttendance: (slotId: number, att: string) => void
  deleteSlotById: (slotId: number) => void
  submitNewSlot: (draft: Omit<SlotDraft, "day"> & { day?: Day }) => void
  dupState: DupState
  resolveDuplicate: (continueAdd: boolean) => void
  saveComment: (slotId: number | string, text: string) => void
  deleteComment: (slotId: number | string, revIndex: number) => void
  updateSlotSessionNote: (slotId: number, note: string) => void
  syncTrackerFromSchedule: () => void
  addOrUpdateTrackerLearner: (entry: Omit<TrackerEntry, "id"> & { name: string }) => void
  removeTrackerLearner: (id: number) => void
  addMsgSlot: (
    day: Day,
    from: string,
    to: string,
    trainers: string[],
    notes: string
  ) => void
  updateMsgSlot: (slotId: string | number, patch: Partial<MsgSlot>) => void
  deleteMsgSlot: (slotId: string | number) => void
  toggleMsgTrainer: (slotId: string | number, trainerName: string) => void
  toggleMsgDone: (slotId: string | number) => void
  updateTaskField: (
    cat: TaskCategory,
    id: string,
    field: keyof Pick<DashboardTask, "assign" | "date" | "delay" | "name">,
    value: string
  ) => void
  updateTaskStatus: (cat: TaskCategory, id: string, status: TaskStatus) => void
  deleteTask: (cat: TaskCategory, id: string) => void
  addInlineTask: (cat: TaskCategory) => void
  addTask: (task: Omit<DashboardTask, "id"> & { category: TaskCategory }) => void
  cycleTaskStatus: (cat: TaskCategory, id: string) => void
  upsertExtension: (rec: Omit<ExtensionRecord, "id"> & { id?: string }) => void
  deleteExtension: (id: string) => void
  updateExtensionField: (
    id: string,
    field: keyof ExtensionRecord,
    value: string | boolean
  ) => void
  toggleExtMail: (id: string) => void
  restoreTrashEntry: (trashId: string) => void
  purgeTrashEntry: (trashId: string) => void
  emptyTrash: () => void
  rsSlotId: number | null
  openRSModal: (slotId: number) => void
  closeRSModal: () => void
  bookReschedule: (dateVal: string, timeVal: string) => void
  markRSTBD: () => void
  saveNow: (op: () => Promise<unknown>) => Promise<void>
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

export function DashboardProvider({
  children,
  initialPayload,
  workspaceUpdatedAt = null,
  userEmail,
}: {
  children: React.ReactNode
  initialPayload: unknown
  workspaceUpdatedAt?: string | null
  userEmail: string
}) {
  const [persisted, setPersisted] = useState<DashboardPersisted>(() =>
    persistedFromRemote(initialPayload)
  )

  const initialWeek = getWeekKey()
  const today = new Date()
  const todayNames: Day[] = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ]
  const dn = todayNames[today.getDay()] as Day
  const [currentWeekKey, setCurrentWeekKey] = useState(initialWeek)
  const [currentDay, setCurrentDay] = useState<Day>(
    DAYS.includes(dn) ? dn : "Monday"
  )

  const [syncStatus, setSyncStatus] = useState<SyncStatus>("saved")
  const [syncMessage, setSyncMessage] = useState("Live sync on")

  const [dupState, setDupState] = useState<DupState>({ open: false })
  const [rsSlotId, setRsSlotId] = useState<number | null>(null)

  const persistedRef = useRef(persisted)
  useEffect(() => {
    persistedRef.current = persisted
  }, [persisted])

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingWritesRef = useRef(0)
  const pendingRemotePayloadRef = useRef<unknown>(null)
  const pathname = usePathname()

  const touchWeek = useCallback((draft: DashboardPersisted, weekKey: string) => {
    if (!draft.userWeeks[weekKey]) {
      draft.userWeeks[weekKey] = emptyWeekSchedule()
    }
    if (!draft.allWeekData[weekKey]) {
      draft.allWeekData[weekKey] = ensureWeekStore(undefined)
    }
  }, [])

  const finishPersist = useCallback(() => {
    pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1)
    if (pendingWritesRef.current === 0) {
      const queued = pendingRemotePayloadRef.current
      if (queued) {
        pendingRemotePayloadRef.current = null
        setPersisted((prev) => mergeRemoteIntoLocal(prev, queued))
      }
    }
  }, [])

  const runPersist = useCallback(
    async (op: () => Promise<unknown>) => {
      pendingWritesRef.current++
      setSyncStatus("syncing")
      setSyncMessage("Saving…")
      try {
        await op()
        setSyncStatus("saved")
        setSyncMessage("All changes saved ✓")
        window.setTimeout(() => setSyncMessage("Live sync on"), 1500)
      } catch (err) {
        setSyncStatus("error")
        setSyncMessage("Save failed")
        const msg =
          err instanceof Error ? err.message : "Could not save workspace."
        toast.error(msg, {
          description:
            msg.includes("relation") || msg.includes("does not exist")
              ? "Run Supabase migrations (supabase/migrations) and confirm RLS policies."
              : msg.includes("Unauthorized") || msg.includes("401")
                ? "Session expired — sign in again."
                : undefined,
        })
      } finally {
        finishPersist()
      }
    },
    [finishPersist]
  )

  const pendingOpRef = useRef<(() => Promise<unknown>) | null>(null)

  const scheduleDebouncedSave = useCallback(
    (op: () => Promise<unknown>) => {
      pendingOpRef.current = op
      setSyncStatus("syncing")
      setSyncMessage("Saving…")
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null
        const fn = pendingOpRef.current
        pendingOpRef.current = null
        if (fn) void runPersist(fn)
      }, 600)
    },
    [runPersist]
  )

  const saveNow = useCallback(
    async (op: () => Promise<unknown>) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      pendingOpRef.current = null
      await runPersist(op)
    },
    [runPersist]
  )

  const mergeFromRemote = useCallback((remote: unknown) => {
    if (!remote || typeof remote !== "object") return
    if (pendingWritesRef.current > 0) {
      pendingRemotePayloadRef.current = remote
      return
    }
    pendingRemotePayloadRef.current = null
    setPersisted((prev) => mergeRemoteIntoLocal(prev, remote))
  }, [])

  useEffect(() => {
    if (workspaceUpdatedAt == null) return
    const remote = initialPayload
    if (remote == null || typeof remote !== "object") return
    if (pendingWritesRef.current > 0) {
      pendingRemotePayloadRef.current = remote
      return
    }
    setPersisted((prev) => mergeRemoteIntoLocal(prev, remote))
    // Intentionally when the DB row’s updated_at changes — payload is read from the same render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialPayload tracks workspaceUpdatedAt from the server
  }, [workspaceUpdatedAt])

  useEffect(() => {
    if (!pathname?.startsWith("/dashboard")) return
    const t = window.setTimeout(() => {
      void fetch("/api/workspace")
        .then((r) => r.json())
        .then((body: { payload?: unknown }) => {
          if (body?.payload && typeof body.payload === "object") {
            mergeFromRemote(body.payload)
          }
        })
        .catch(() => {})
    }, 120)
    return () => window.clearTimeout(t)
  }, [pathname, mergeFromRemote])

  const refetchRemoteRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refetchWorkspace = useCallback(() => {
    void workspaceClient
      .fetchBootstrap()
      .then((body) => {
        if (body?.payload && typeof body.payload === "object") {
          mergeFromRemote(body.payload)
        }
      })
      .catch(() => {})
  }, [mergeFromRemote])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("workspace_meta_row")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "workspace_meta",
          filter: "workspace_id=eq.default",
        },
        () => {
          if (pendingWritesRef.current > 0) return
          if (refetchRemoteRef.current) clearTimeout(refetchRemoteRef.current)
          refetchRemoteRef.current = setTimeout(() => {
            refetchRemoteRef.current = null
            refetchWorkspace()
          }, 300)
        }
      )
      .subscribe()

    return () => {
      if (refetchRemoteRef.current) clearTimeout(refetchRemoteRef.current)
      void supabase.removeChannel(channel)
    }
  }, [refetchWorkspace])

  const schedule = useMemo(() => {
    const w = persisted.userWeeks[currentWeekKey]
    if (w) return w
    return emptyWeekSchedule()
  }, [persisted.userWeeks, currentWeekKey])

  const weekStore = useMemo(() => {
    return ensureWeekStore(persisted.allWeekData[currentWeekKey])
  }, [persisted.allWeekData, currentWeekKey])

  const pickDay = useCallback((day: Day) => {
    setCurrentDay(day)
  }, [])

  const setDate = useCallback(
    (val: string) => {
      if (!val) return
      const dnLocal = dayNameFromDateStr(val)
      const newWeekKey = getWeekKey(val)
      setPersisted((prev) => {
        const next = structuredClone(prev)
        touchWeek(next, newWeekKey)
        return next
      })
      setCurrentWeekKey(newWeekKey)
      setCurrentDay(DAYS.includes(dnLocal) ? dnLocal : currentDay)
    },
    [currentDay, touchWeek, setCurrentWeekKey]
  )

  const shiftWeek = useCallback(
    (delta: number) => {
      const cur = new Date(`${currentWeekKey}T00:00:00`)
      cur.setDate(cur.getDate() + delta * 7)
      const yyyy = cur.getFullYear()
      const mm = String(cur.getMonth() + 1).padStart(2, "0")
      const dd = String(cur.getDate()).padStart(2, "0")
      setDate(`${yyyy}-${mm}-${dd}`)
    },
    [currentWeekKey, setDate]
  )

  const copyFromLastWeek = useCallback(() => {
    const prevKey = previousWeekKey(currentWeekKey)
    const prevWeek = persistedRef.current.userWeeks[prevKey]
    if (
      !prevWeek ||
      DAYS.reduce((n, d) => n + (prevWeek[d] ?? []).length, 0) === 0
    ) {
      toast.message("No data for previous week", {
        description: "Open a week that has sessions first.",
      })
      return
    }
    const currentSlots = DAYS.reduce(
      (n, d) => n + (persistedRef.current.userWeeks[currentWeekKey]?.[d] ?? []).length,
      0
    )
    if (currentSlots > 0) {
      if (
        !window.confirm(
          `This week already has ${currentSlots} slots. Copy will ADD them. Continue?`
        )
      ) {
        return
      }
    } else if (
      !window.confirm(
        `Copy all slots from week of ${fmtWeekRange(prevKey)} into ${fmtWeekRange(currentWeekKey)}? Attendance and comments will NOT be copied.`
      )
    ) {
      return
    }
    void saveNow(() =>
      workspaceClient.copyWeek(prevKey, currentWeekKey).then(() => refetchWorkspace())
    )
  }, [currentWeekKey, refetchWorkspace, saveNow])

  const addTrainer = useCallback(
    (name: string) => {
      const n = name.trim()
      if (!n) return
      setPersisted((prev) => {
        if (prev.trainers.includes(n)) {
          toast.message("Trainer already exists")
          return prev
        }
        const draft = structuredClone(prev)
        draft.trainers.push(n)
        scheduleDebouncedSave(() => workspaceClient.addTrainer(n))
        return draft
      })
    },
    [scheduleDebouncedSave]
  )

  const removeTrainer = useCallback(
    (index: number) => {
      setPersisted((prev) => {
        if (prev.trainers.length <= 1) {
          toast.message("Need at least one trainer")
          return prev
        }
        if (!window.confirm(`Remove ${prev.trainers[index]}?`)) return prev
        const name = prev.trainers[index]!
        const draft = structuredClone(prev)
        draft.trainers.splice(index, 1)
        scheduleDebouncedSave(() => workspaceClient.removeTrainer(name))
        return draft
      })
    },
    [scheduleDebouncedSave]
  )

  const updateSlotField = useCallback(
    (slotId: number, field: keyof Slot, value: string) => {
      setPersisted((prev) => {
        const draft = structuredClone(prev)
        touchWeek(draft, currentWeekKey)
        const slot = findSlotInWeek(draft.userWeeks, currentWeekKey, slotId)
        if (!slot) return prev

        if (field === "trainer" && value) {
          const ws = ensureWeekStore(draft.allWeekData[currentWeekKey])
          const conflict = getMsgSlotConflict(
            ws,
            value,
            currentDay,
            slot.time
          )
          if (
            conflict &&
            !window.confirm(
              `${value} has a message slot (${conflict.from}–${conflict.to}) overlapping ${slot.time}. Assign anyway?`
            )
          ) {
            return prev
          }
        }

        const oldVal = slot[field]
        ;(slot as Record<string, unknown>)[field] = value
        const fieldLabel =
          field === "learner"
            ? "Learner"
            : field === "trainer"
              ? "Trainer"
              : field === "coTrainer"
                ? "Co-Trainer"
                : field === "type"
                  ? "Session Type"
                  : String(field)
        const patchKey =
          field === "coTrainer"
            ? "co_trainer"
            : field === "learner"
              ? "learner"
              : field === "trainer"
                ? "trainer"
                : field === "type"
                  ? "type"
                  : field === "note"
                    ? "note"
                    : field
        scheduleDebouncedSave(() =>
          workspaceClient.patchSlot({
            slotId,
            patch: { [patchKey]: value },
            log: {
              section: "Schedule",
              action: `Changed ${fieldLabel}`,
              detail: `${slot.learner || "slot"} · ${currentDay} ${slot.time} · "${String(oldVal ?? "—")}" → "${value || "—"}"`,
            },
          })
        )
        return draft
      })
    },
    [currentDay, currentWeekKey, scheduleDebouncedSave, touchWeek]
  )

  const updateSlotTime = useCallback(
    (slotId: number, newTime: string) => {
      setPersisted((prev) => {
        const draft = structuredClone(prev)
        touchWeek(draft, currentWeekKey)
        let found: Slot | null = null
        for (const d of DAYS) {
          const s = (draft.userWeeks[currentWeekKey][d] ?? []).find(
            (x) => x.id === slotId
          )
          if (s) {
            found = s
            break
          }
        }
        if (!found || found.time === newTime) return prev
        const oldTime = found.time
        const learnerLabel = found.learner || "slot"
        found.time = newTime
        scheduleDebouncedSave(() =>
          workspaceClient.patchSlot({
            slotId,
            patch: { time: newTime },
            log: {
              section: "Schedule",
              action: "Changed time",
              detail: `${learnerLabel} · ${currentDay} · "${oldTime}" → "${newTime}"`,
            },
          })
        )
        return draft
      })
    },
    [currentDay, currentWeekKey, scheduleDebouncedSave, touchWeek]
  )

  const updateAttendance = useCallback(
    (slotId: number, att: string) => {
      setPersisted((prev) => {
        const draft = structuredClone(prev)
        touchWeek(draft, currentWeekKey)
        const ws = ensureWeekStore(draft.allWeekData[currentWeekKey])
        if (!ws.attData[slotId]) ws.attData[slotId] = { att: "", note: "" }
        ws.attData[slotId]!.att = att
        draft.allWeekData[currentWeekKey] = ws

        scheduleDebouncedSave(() =>
          workspaceClient.patchAttendance({
            weekKey: currentWeekKey,
            slotId,
            att,
          })
        )
        if (att === "RS") setRsSlotId(slotId)
        return draft
      })
    },
    [currentWeekKey, scheduleDebouncedSave, touchWeek]
  )

  const deleteSlotById = useCallback(
    (slotId: number) => {
      if (!window.confirm("Remove this session?")) return
      setPersisted((prev) => {
        const draft = structuredClone(prev)
        touchWeek(draft, currentWeekKey)
        let slot: Slot | undefined
        const wk = draft.userWeeks[currentWeekKey]
        for (const d of DAYS) {
          const idx = (wk[d] ?? []).findIndex((s) => s.id === slotId)
          if (idx >= 0) {
            slot = wk[d]![idx]
            wk[d]!.splice(idx, 1)
            break
          }
        }
        if (slot) {
          const trashId = `${Date.now()}_t`
          draft.trashBin.push({
            id: trashId,
            slot: { ...slot },
            day: currentDay,
            weekKey: currentWeekKey,
            deletedAt: formatIstTimestamp(),
            deletedBy: userEmail.split("@")[0] || "unknown",
          })
          draft.deletedSlotIds.push(Number(slotId))
          void saveNow(() =>
            workspaceClient.deleteSlot({
              slotId,
              weekKey: currentWeekKey,
              day: currentDay,
              slot,
            })
          )
        }
        return draft
      })
    },
    [currentDay, currentWeekKey, saveNow, touchWeek, userEmail]
  )

  const commitSlotDraft = useCallback(
    (data: SlotDraft) => {
      setPersisted((prev) => {
        const draft = structuredClone(prev)
        touchWeek(draft, currentWeekKey)
        const dayArr = draft.userWeeks[currentWeekKey]![data.day]
        const optimisticId = draft.slotId + 1
        draft.slotId = optimisticId
        const newSlot: Slot = {
          id: optimisticId,
          time: data.time,
          learner: data.learner,
          note: data.note,
          trainer: data.trainer,
          coTrainer: data.coTrainer,
          type: data.type,
          addedBy: userEmail || "unknown",
          addedAt: new Date().toISOString(),
        }
        dayArr.push(newSlot)
        scheduleDebouncedSave(async () => {
          const { slot } = await workspaceClient.createSlot({
            weekKey: currentWeekKey,
            day: data.day,
            slot: newSlot,
          })
          if (slot && Number(slot.id) !== optimisticId) {
            setPersisted((p) => {
              const d = structuredClone(p)
              const arr = d.userWeeks[currentWeekKey]?.[data.day] ?? []
              const idx = arr.findIndex((s) => s.id === optimisticId)
              if (idx >= 0) {
                arr[idx] = { ...arr[idx]!, id: Number(slot.id) }
              }
              d.slotId = Math.max(d.slotId, Number(slot.id))
              return d
            })
          }
        })
        return draft
      })
    },
    [currentWeekKey, scheduleDebouncedSave, touchWeek, userEmail]
  )

  const submitNewSlot = useCallback(
    (form: Omit<SlotDraft, "day"> & { day?: Day }) => {
      const { day: dayOverride, ...rest } = form
      const targetDay = dayOverride ?? currentDay
      if (!rest.time) {
        toast.message("Pick a time slot")
        return
      }
      const slotsAtTime = (schedule[targetDay] ?? []).filter(
        (s) => s.time === rest.time
      )
      if (slotsAtTime.length >= 4) {
        toast.error("This time already has 4 sessions.")
        return
      }
      if (rest.trainer) {
        const conflict = getMsgSlotConflict(
          weekStore,
          rest.trainer,
          targetDay,
          rest.time
        )
        if (
          conflict &&
          !window.confirm(
            `${rest.trainer} has a message slot (${conflict.from}–${conflict.to}) covering ${rest.time}. Continue?`
          )
        ) {
          return
        }
      }

      const draft: SlotDraft = {
        day: targetDay,
        ...rest,
      }

      if (rest.learner.trim()) {
        const dups = findDuplicateSlots(schedule, rest.learner)
        if (dups.length > 0) {
          setDupState({
            open: true,
            learnerName: rest.learner,
            pending: draft,
          })
          return
        }
      }
      commitSlotDraft(draft)
    },
    [commitSlotDraft, currentDay, schedule, weekStore]
  )

  const resolveDuplicate = useCallback(
    (continueAdd: boolean) => {
      if (!dupState.open) return
      const pending = dupState.pending
      setDupState({ open: false })
      if (continueAdd && pending) commitSlotDraft(pending)
    },
    [commitSlotDraft, dupState]
  )

  const saveComment = useCallback(
    (slotId: number | string, text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      setPersisted((prev) => {
        const draft = structuredClone(prev)
        const notes = { ...draft.learnerNotes }
        const key = String(slotId)
        const arr = [...(notes[key] ?? [])]
        const ts = formatIstTimestamp()
        arr.push({
          authorEmail: userEmail,
          trainer: userEmail.split("@")[0],
          text: trimmed,
          ts,
        })
        notes[key] = arr
        draft.learnerNotes = notes

        const slot =
          typeof slotId === "number"
            ? findSlotInWeek(draft.userWeeks, currentWeekKey, slotId)
            : null
        const learnerLabel = slot?.learner ?? ""
        parseTaggedUsers(trimmed, draft.trainers).forEach((name) => {
          const trainerKey = name.toLowerCase().replace(/\s+/g, "_")
          const tkey = trainerKey
          const nlist = [...(draft.notifications[tkey] ?? [])]
          const ts = formatIstTimestamp()
          nlist.push({
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            from: userEmail,
            msg: `@${name} — "${trimmed.substring(0, 80)}${trimmed.length > 80 ? "…" : ""}" (re: ${learnerLabel || "session"})`,
            ts,
            read: false,
            learnerName: learnerLabel,
            toTrainerName: name,
          })
          draft.notifications = { ...draft.notifications, [tkey]: nlist }
        })

        scheduleDebouncedSave(() =>
          workspaceClient.addLearnerNote({
            slotId,
            text: trimmed,
            trainers: draft.trainers,
            learnerName: learnerLabel,
          })
        )
        return draft
      })
    },
    [currentWeekKey, scheduleDebouncedSave, userEmail]
  )

  const deleteComment = useCallback(
    (slotId: number | string, revIndex: number) => {
      setPersisted((prev) => {
        const draft = structuredClone(prev)
        const key = String(slotId)
        const arr = [...(draft.learnerNotes[key] ?? [])]
        const realIdx = arr.length - 1 - revIndex
        const n = arr[realIdx]
        if (!n || (n.authorEmail !== userEmail && n.email !== userEmail)) {
          toast.message("You can only delete your own comments.")
          return prev
        }
        arr.splice(realIdx, 1)
        draft.learnerNotes = { ...draft.learnerNotes, [key]: arr }
        scheduleDebouncedSave(() =>
          workspaceClient.deleteLearnerNote({ slotId, revIndex })
        )
        return draft
      })
    },
    [scheduleDebouncedSave, userEmail]
  )

  const updateSlotSessionNote = useCallback(
    (slotId: number, note: string) => {
      setPersisted((prev) => {
        const draft = structuredClone(prev)
        touchWeek(draft, currentWeekKey)
        const ws = ensureWeekStore(draft.allWeekData[currentWeekKey])
        if (!ws.attData[slotId]) ws.attData[slotId] = { att: "", note: "" }
        ws.attData[slotId]!.note = note
        draft.allWeekData[currentWeekKey] = ws
        scheduleDebouncedSave(() =>
          workspaceClient.patchAttendance({
            weekKey: currentWeekKey,
            slotId,
            att: ws.attData[slotId]?.att ?? "",
            note,
          })
        )
        return draft
      })
    },
    [currentWeekKey, scheduleDebouncedSave, touchWeek]
  )

  const syncTrackerFromSchedule = useCallback(() => {
    setPersisted((prev) => {
      const draft = structuredClone(prev)
      touchWeek(draft, currentWeekKey)
      const ws = ensureWeekStore(draft.allWeekData[currentWeekKey])
      const wkSched = draft.userWeeks[currentWeekKey] ?? emptyWeekSchedule()
      const { next, nextId, changed } = mergeTrackerFromSchedule(
        ws.tracker,
        draft.trackerId,
        wkSched,
        fmtWeekRange(currentWeekKey),
        ws.trackerSyncExcludedNames
      )
      if (!changed) return prev
      ws.tracker = next
      draft.trackerId = Math.max(draft.trackerId, nextId)
      draft.allWeekData[currentWeekKey] = ws
      scheduleDebouncedSave(() =>
        workspaceClient.syncTracker({
          weekKey: currentWeekKey,
          schedule: wkSched,
          excludedNames: ws.trackerSyncExcludedNames,
        })
      )
      return draft
    })
  }, [currentWeekKey, scheduleDebouncedSave, touchWeek])

  const addOrUpdateTrackerLearner = useCallback(
    (entry: Omit<TrackerEntry, "id"> & { name: string }) => {
      const name = entry.name.trim()
      if (!name) return
      setPersisted((prev) => {
        const draft = structuredClone(prev)
        touchWeek(draft, currentWeekKey)
        const ws = ensureWeekStore(draft.allWeekData[currentWeekKey])
        const weekKey = entry.week ?? fmtWeekRange(currentWeekKey)
        const nameKey = normLearnerKey(name)
        ws.trackerSyncExcludedNames = ws.trackerSyncExcludedNames.filter(
          (x) => normLearnerKey(x) !== nameKey
        )
        const ei = ws.tracker.findIndex(
          (l) =>
            l.name.toLowerCase() === name.toLowerCase() && (l.week ?? "") === weekKey
        )
        if (ei >= 0) {
          const prevRow = ws.tracker[ei]!
          ws.tracker[ei] = {
            ...prevRow,
            ...entry,
            week: weekKey,
            id: prevRow.id,
            target: entry.target ?? prevRow.target ?? 5,
          }
        } else {
          draft.trackerId += 1
          ws.tracker.push({
            id: draft.trackerId,
            name,
            trainer: entry.trainer,
            batch: entry.batch,
            week: weekKey,
            target: entry.target ?? 5,
            notes: entry.notes,
          })
        }
        draft.allWeekData[currentWeekKey] = ws
        scheduleDebouncedSave(() =>
          workspaceClient.upsertTracker({
            weekKey: currentWeekKey,
            entry: {
              id: ei >= 0 ? ws.tracker[ei]!.id : undefined,
              name,
              trainer: entry.trainer,
              batch: entry.batch,
              week: weekKey,
              target: entry.target,
              notes: entry.notes,
            },
          })
        )
        return draft
      })
    },
    [currentWeekKey, scheduleDebouncedSave, touchWeek]
  )

  const removeTrackerLearner = useCallback(
    (id: number) => {
      setPersisted((prev) => {
        const draft = structuredClone(prev)
        touchWeek(draft, currentWeekKey)
        const ws = ensureWeekStore(draft.allWeekData[currentWeekKey])
        const removed = ws.tracker.find((l) => l.id === id)
        ws.tracker = ws.tracker.filter((l) => l.id !== id)
        if (removed) {
          const nk = normLearnerKey(removed.name)
          if (nk) {
            const ex = new Set(ws.trackerSyncExcludedNames.map((x) => normLearnerKey(x)))
            ex.add(nk)
            ws.trackerSyncExcludedNames = [...ex]
          }
        }
        draft.allWeekData[currentWeekKey] = ws
        scheduleDebouncedSave(() =>
          workspaceClient.removeTracker({ weekKey: currentWeekKey, id })
        )
        return draft
      })
    },
    [currentWeekKey, scheduleDebouncedSave, touchWeek]
  )

  const addMsgSlot = useCallback(
    (day: Day, from: string, to: string, trainers: string[], notes: string) => {
      if (!from.trim() || !to.trim()) {
        toast.message("Enter both from and to times")
        return
      }
      setPersisted((prev) => {
        const draft = structuredClone(prev)
        touchWeek(draft, currentWeekKey)
        const ws = ensureWeekStore(draft.allWeekData[currentWeekKey])
        draft.msgId += 1
        const slot: MsgSlot = {
          id: `ms${draft.msgId}`,
          from: from.trim(),
          to: to.trim(),
          trainers: [...trainers],
          trainer: trainers[0] || "",
          notes: notes.trim(),
        }
        ws.msgSlots[day] = [...(ws.msgSlots[day] ?? []), slot]
        draft.allWeekData[currentWeekKey] = ws
        scheduleDebouncedSave(async () => {
          const { id: serverId } = await workspaceClient.createMsgSlot({
            weekKey: currentWeekKey,
            day,
            from: from.trim(),
            to: to.trim(),
            trainers,
            notes: notes.trim(),
          })
          setPersisted((p) => {
            const d = structuredClone(p)
            const w = ensureWeekStore(d.allWeekData[currentWeekKey])
            const arr = w.msgSlots[day] ?? []
            const idx = arr.findIndex((s) => String(s.id) === String(slot.id))
            if (idx >= 0) arr[idx] = { ...arr[idx]!, id: serverId }
            d.allWeekData[currentWeekKey] = w
            return d
          })
        })
        return draft
      })
    },
    [currentWeekKey, scheduleDebouncedSave, touchWeek]
  )

  const updateMsgSlot = useCallback(
    (slotId: string | number, patch: Partial<MsgSlot>) => {
      setPersisted((prev) => {
        const draft = structuredClone(prev)
        const ws = ensureWeekStore(draft.allWeekData[currentWeekKey])
        const loc = findMsgSlotLocation(ws, slotId)
        if (!loc) return prev
        const row = { ...ws.msgSlots[loc.day]![loc.index]!, ...patch }
        ws.msgSlots[loc.day]![loc.index] = row
        draft.allWeekData[currentWeekKey] = ws
        const dbPatch: Record<string, unknown> = {}
        if (patch.from != null) dbPatch.from_time = patch.from
        if (patch.to != null) dbPatch.to_time = patch.to
        if (patch.notes != null) dbPatch.notes = patch.notes
        if (patch.trainer != null) dbPatch.trainer = patch.trainer
        if (patch.trainers != null) dbPatch.trainers = patch.trainers
        scheduleDebouncedSave(() =>
          workspaceClient.patchMsgSlot({ id: String(slotId), patch: dbPatch })
        )
        return draft
      })
    },
    [currentWeekKey, scheduleDebouncedSave]
  )

  const deleteMsgSlot = useCallback(
    (slotId: string | number) => {
      setPersisted((prev) => {
        const draft = structuredClone(prev)
        const ws = ensureWeekStore(draft.allWeekData[currentWeekKey])
        for (const d of DAYS) {
          ws.msgSlots[d] = (ws.msgSlots[d] ?? []).filter(
            (x) => String(x.id) !== String(slotId)
          )
        }
        const mdd = { ...ws.msgDoneData }
        delete mdd[slotId as string]
        delete mdd[String(slotId)]
        ws.msgDoneData = mdd
        draft.allWeekData[currentWeekKey] = ws
        scheduleDebouncedSave(() =>
          workspaceClient.deleteMsgSlot({
            weekKey: currentWeekKey,
            id: String(slotId),
          })
        )
        return draft
      })
    },
    [currentWeekKey, scheduleDebouncedSave]
  )

  const toggleMsgTrainer = useCallback(
    (slotId: string | number, trainerName: string) => {
      setPersisted((prev) => {
        const draft = structuredClone(prev)
        const ws = ensureWeekStore(draft.allWeekData[currentWeekKey])
        const loc = findMsgSlotLocation(ws, slotId)
        if (!loc) return prev
        const cur = ws.msgSlots[loc.day]![loc.index]!
        const t = [
          ...(cur.trainers ??
            (cur.trainer
              ? cur.trainer
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [])),
        ]
        const idx = t.indexOf(trainerName)
        if (idx >= 0) t.splice(idx, 1)
        else t.push(trainerName)
        ws.msgSlots[loc.day]![loc.index] = {
          ...cur,
          trainers: t,
          trainer: t[0] || "",
        }
        draft.allWeekData[currentWeekKey] = ws
        scheduleDebouncedSave(() =>
          workspaceClient.patchMsgSlot({
            id: String(slotId),
            patch: { trainers: t, trainer: t[0] || "" },
          })
        )
        return draft
      })
    },
    [currentWeekKey, scheduleDebouncedSave]
  )

  const toggleMsgDone = useCallback(
    (slotId: string | number) => {
      setPersisted((prev) => {
        const draft = structuredClone(prev)
        touchWeek(draft, currentWeekKey)
        const ws = ensureWeekStore(draft.allWeekData[currentWeekKey])
        const key = String(slotId)
        const cur = ws.msgDoneData[key] ?? { done: false, doneAt: null }
        if (cur.done) {
          ws.msgDoneData = { ...ws.msgDoneData, [key]: { done: false, doneAt: null } }
        } else {
          const ts = formatIstTime(new Date(), { hour: "2-digit", minute: "2-digit" })
          ws.msgDoneData = { ...ws.msgDoneData, [key]: { done: true, doneAt: ts } }
        }
        draft.allWeekData[currentWeekKey] = ws
        const nextDone = !cur.done
        const nextAt = nextDone
          ? formatIstTime(new Date(), {
              hour: "2-digit",
              minute: "2-digit",
            })
          : null
        scheduleDebouncedSave(() =>
          workspaceClient.patchMsgDone({
            weekKey: currentWeekKey,
            msgSlotId: key,
            done: nextDone,
            doneAt: nextAt,
          })
        )
        return draft
      })
    },
    [currentWeekKey, scheduleDebouncedSave, touchWeek]
  )

  const updateTaskField = useCallback(
    (
      cat: TaskCategory,
      id: string,
      field: keyof Pick<DashboardTask, "assign" | "date" | "delay" | "name">,
      value: string
    ) => {
      setPersisted((prev) => {
        const draft = structuredClone(prev)
        touchWeek(draft, currentWeekKey)
        const ws = ensureWeekStore(draft.allWeekData[currentWeekKey])
        const t = ws.tasks[cat].find((x) => x.id === id)
        if (!t) return prev
        ;(t as Record<string, string>)[field] = value
        draft.allWeekData[currentWeekKey] = ws
        const patchKey =
          field === "assign" ? "assignee" : field === "date" ? "due_date" : field
        scheduleDebouncedSave(() =>
          workspaceClient.patchTask({
            id,
            patch: { [patchKey]: value },
            logDetail: `"${t.name}" · ${cat}`,
          })
        )
        return draft
      })
    },
    [currentWeekKey, scheduleDebouncedSave, touchWeek]
  )

  const updateTaskStatus = useCallback(
    (cat: TaskCategory, id: string, status: TaskStatus) => {
      setPersisted((prev) => {
        const draft = structuredClone(prev)
        touchWeek(draft, currentWeekKey)
        const ws = ensureWeekStore(draft.allWeekData[currentWeekKey])
        const t = ws.tasks[cat].find((x) => x.id === id)
        if (!t) return prev
        t.status = status
        draft.allWeekData[currentWeekKey] = ws
        scheduleDebouncedSave(() =>
          workspaceClient.patchTask({
            id,
            patch: { status },
            logDetail: `"${t.name}" · ${cat}`,
          })
        )
        return draft
      })
    },
    [currentWeekKey, scheduleDebouncedSave, touchWeek]
  )

  const deleteTask = useCallback(
    (cat: TaskCategory, id: string) => {
      setPersisted((prev) => {
        const draft = structuredClone(prev)
        touchWeek(draft, currentWeekKey)
        const ws = ensureWeekStore(draft.allWeekData[currentWeekKey])
        const task = ws.tasks[cat].find((t) => t.id === id)
        if (!task) return prev
        if (
          task.createdBy &&
          userEmail &&
          task.createdBy !== userEmail
        ) {
          toast.message("You can only delete tasks you created.")
          return prev
        }
        ws.tasks[cat] = ws.tasks[cat].filter((t) => t.id !== id)
        draft.allWeekData[currentWeekKey] = ws
        scheduleDebouncedSave(() =>
          workspaceClient.deleteTask({ id, createdBy: task.createdBy })
        )
        return draft
      })
    },
    [currentWeekKey, scheduleDebouncedSave, touchWeek, userEmail]
  )

  const addInlineTask = useCallback(
    (cat: TaskCategory) => {
      setPersisted((prev) => {
        const draft = structuredClone(prev)
        touchWeek(draft, currentWeekKey)
        const ws = ensureWeekStore(draft.allWeekData[currentWeekKey])
        const today = getIstYmd()
        draft.taskId += 1
        ws.tasks[cat].push({
          id: `t${draft.taskId}`,
          name: "New Task",
          assign: "",
          date: today,
          status: "pending",
          delay: "",
          createdBy: userEmail,
        })
        draft.allWeekData[currentWeekKey] = ws
        const taskPayload = ws.tasks[cat][ws.tasks[cat].length - 1]!
        scheduleDebouncedSave(async () => {
          const { id: serverId } = await workspaceClient.upsertTask({
            weekKey: currentWeekKey,
            category: cat,
            task: taskPayload,
          })
          if (serverId !== taskPayload.id) {
            setPersisted((p) => {
              const d = structuredClone(p)
              const w = ensureWeekStore(d.allWeekData[currentWeekKey])
              const t = w.tasks[cat].find((x) => x.id === taskPayload.id)
              if (t) t.id = serverId
              return d
            })
          }
        })
        return draft
      })
    },
    [currentWeekKey, scheduleDebouncedSave, touchWeek, userEmail]
  )

  const addTask = useCallback(
    (task: Omit<DashboardTask, "id"> & { category: TaskCategory }) => {
      setPersisted((prev) => {
        const draft = structuredClone(prev)
        touchWeek(draft, currentWeekKey)
        const ws = ensureWeekStore(draft.allWeekData[currentWeekKey])
        draft.taskId += 1
        const { category, ...rest } = task
        ws.tasks[category].push({
          ...rest,
          id: `t${draft.taskId}`,
        })
        draft.allWeekData[currentWeekKey] = ws
        const newTask = ws.tasks[category][ws.tasks[category].length - 1]!
        scheduleDebouncedSave(() =>
          workspaceClient.upsertTask({
            weekKey: currentWeekKey,
            category,
            task: newTask,
          })
        )
        return draft
      })
    },
    [currentWeekKey, scheduleDebouncedSave, touchWeek]
  )

  const cycleTaskStatus = useCallback(
    (cat: TaskCategory, id: string) => {
      const order: TaskStatus[] = ["pending", "inprogress", "done"]
      setPersisted((prev) => {
        const draft = structuredClone(prev)
        touchWeek(draft, currentWeekKey)
        const ws = ensureWeekStore(draft.allWeekData[currentWeekKey])
        const t = ws.tasks[cat].find((x) => x.id === id)
        if (!t) return prev
        const next = order[(order.indexOf(t.status) + 1) % order.length]!
        t.status = next
        draft.allWeekData[currentWeekKey] = ws
        scheduleDebouncedSave(() =>
          workspaceClient.patchTask({ id, patch: { status: next }, logDetail: id })
        )
        return draft
      })
    },
    [currentWeekKey, scheduleDebouncedSave, touchWeek]
  )

  const upsertExtension = useCallback(
    (rec: Omit<ExtensionRecord, "id"> & { id?: string }) => {
      const name = rec.name.trim()
      if (!name) {
        toast.message("Student name is required.")
        return
      }
      setPersisted((prev) => {
        const draft = structuredClone(prev)
        let id = rec.id
        if (!id) {
          draft.extId = (draft.extId || 0) + 1
          id = `ext${draft.extId}_${Date.now()}`
        }
        const existing = draft.extRecords.find((r) => r.id === id)
        const full: ExtensionRecord = {
          id: id!,
          name,
          number: rec.number?.trim(),
          email: rec.email?.trim(),
          type: rec.type,
          charges: rec.charges?.trim(),
          duration: rec.duration?.trim(),
          approvedBy: rec.approvedBy,
          reason: rec.reason?.trim(),
          status: rec.status || "Pending",
          mailSent:
            typeof rec.mailSent === "boolean"
              ? rec.mailSent
              : (existing?.mailSent ?? false),
          createdBy: existing?.createdBy || userEmail,
          createdAt: existing?.createdAt || new Date().toISOString(),
        }
        const idx = draft.extRecords.findIndex((r) => r.id === id)
        if (idx >= 0) draft.extRecords[idx] = full
        else draft.extRecords.push(full)
        scheduleDebouncedSave(() =>
          workspaceClient.upsertExtension({ record: full })
        )
        return draft
      })
    },
    [scheduleDebouncedSave, userEmail]
  )

  const deleteExtension = useCallback(
    (id: string) => {
      setPersisted((prev) => {
        const draft = structuredClone(prev)
        const r = draft.extRecords.find((x) => x.id === id)
        if (!r) return prev
        if (r.createdBy && userEmail && r.createdBy !== userEmail) {
          toast.message("You can only delete records you created.")
          return prev
        }
        draft.extRecords = draft.extRecords.filter((x) => x.id !== id)
        scheduleDebouncedSave(() =>
          workspaceClient.deleteExtension({ id, createdBy: r.createdBy })
        )
        return draft
      })
    },
    [scheduleDebouncedSave, userEmail]
  )

  const updateExtensionField = useCallback(
    (id: string, field: keyof ExtensionRecord, value: string | boolean) => {
      setPersisted((prev) => {
        const draft = structuredClone(prev)
        const r = draft.extRecords.find((x) => x.id === id)
        if (!r) return prev
        ;(r as Record<string, unknown>)[field as string] = value
        scheduleDebouncedSave(() =>
          workspaceClient.patchExtension({ id, field, value })
        )
        return draft
      })
    },
    [scheduleDebouncedSave]
  )

  const toggleExtMail = useCallback(
    (id: string) => {
      setPersisted((prev) => {
        const draft = structuredClone(prev)
        const r = draft.extRecords.find((x) => x.id === id)
        if (!r) return prev
        r.mailSent = !r.mailSent
        if (r.mailSent && r.status !== "Mail Sent") r.status = "Mail Sent"
        scheduleDebouncedSave(() =>
          workspaceClient.patchExtension({
            record: { ...r },
          })
        )
        return draft
      })
    },
    [scheduleDebouncedSave]
  )

  const restoreTrashEntry = useCallback(
    (trashId: string) => {
      setPersisted((prev) => {
        const draft = structuredClone(prev)
        const entry = draft.trashBin.find((e) => e.id === trashId)
        if (!entry) return prev
        touchWeek(draft, entry.weekKey)
        const dayArr = draft.userWeeks[entry.weekKey]![entry.day]
        const exists = dayArr.some((s) => s.id === entry.slot.id)
        if (!exists) {
          dayArr.push({ ...entry.slot })
        }
        draft.deletedSlotIds = draft.deletedSlotIds.filter(
          (x) => Number(x) !== Number(entry.slot.id)
        )
        draft.trashBin = draft.trashBin.filter((e) => e.id !== trashId)
        void saveNow(() => workspaceClient.restoreTrash(trashId))
        return draft
      })
    },
    [saveNow, touchWeek]
  )

  const purgeTrashEntry = useCallback(
    (trashId: string) => {
      setPersisted((prev) => {
        const draft = structuredClone(prev)
        draft.trashBin = draft.trashBin.filter((e) => e.id !== trashId)
        void saveNow(() => workspaceClient.purgeTrash(trashId))
        return draft
      })
    },
    [saveNow]
  )

  const emptyTrash = useCallback(() => {
    setPersisted((prev) => {
      const draft = structuredClone(prev)
      draft.trashBin = []
      void saveNow(() => workspaceClient.emptyTrash())
      return draft
    })
  }, [saveNow])

  const bookReschedule = useCallback(
    (dateVal: string, timeVal: string) => {
      if (!dateVal || !timeVal || rsSlotId === null) return
      setPersisted((prev) => {
        const draft = structuredClone(prev)
        const orig = findSlotInWeek(draft.userWeeks, currentWeekKey, rsSlotId)
        const targetDay = dayNameFromDateStr(dateVal)
        const targetWeekKey = weekKeyForCalendarDate(dateVal)
        touchWeek(draft, targetWeekKey)
        draft.slotId++
        const newSlot: Slot = {
          id: draft.slotId,
          time: timeVal,
          learner: orig?.learner ?? "",
          trainer: orig?.trainer ?? "",
          coTrainer: orig?.coTrainer ?? "",
          type: orig?.type ?? "Regular",
          note: `Rescheduled from ${currentDay} ${orig?.time ?? ""}`,
          addedBy: userEmail,
          addedAt: new Date().toISOString(),
        }
        draft.userWeeks[targetWeekKey]![targetDay].push(newSlot)

        const notes = { ...draft.learnerNotes }
        const arr = [...(notes[rsSlotId] ?? [])]
        const ts = formatIstTimestamp()
        arr.push({
          authorEmail: userEmail,
          trainer: userEmail.split("@")[0],
          text: `🔄 Rescheduled → booked for ${targetDay} ${timeVal} (${dateVal})`,
          ts,
        })
        notes[rsSlotId] = arr
        draft.learnerNotes = notes

        scheduleDebouncedSave(async () => {
          await workspaceClient.createSlot({
            weekKey: targetWeekKey,
            day: targetDay,
            slot: newSlot,
          })
          await workspaceClient.addLearnerNote({
            slotId: rsSlotId,
            text: `🔄 Rescheduled → booked for ${targetDay} ${timeVal} (${dateVal})`,
            trainers: draft.trainers,
            learnerName: orig?.learner ?? "",
          })
        })
        return draft
      })
      setRsSlotId(null)
      toast.success("Session booked on new date")
    },
    [
      currentDay,
      currentWeekKey,
      rsSlotId,
      scheduleDebouncedSave,
      touchWeek,
      userEmail,
    ]
  )

  const markRSTBD = useCallback(() => {
    if (rsSlotId === null) return
    const id = rsSlotId
    setPersisted((prev) => {
      const draft = structuredClone(prev)
      const notes = { ...draft.learnerNotes }
      const arr = [...(notes[id] ?? [])]
        const ts = formatIstTimestamp()
      arr.push({
        authorEmail: userEmail,
        trainer: userEmail.split("@")[0],
        text: "🔄 Rescheduled — next slot to be discussed with learner",
        ts,
      })
      notes[id] = arr
      draft.learnerNotes = notes
      scheduleDebouncedSave(() =>
        workspaceClient.addLearnerNote({
          slotId: id,
          text: "🔄 Rescheduled — next slot to be discussed with learner",
          trainers: draft.trainers,
          learnerName: "",
        })
      )
      return draft
    })
    setRsSlotId(null)
  }, [rsSlotId, scheduleDebouncedSave, userEmail])

  const value = useMemo<DashboardContextValue>(
    () => ({
      userEmail,
      syncStatus,
      syncMessage,
      persisted,
      currentWeekKey,
      currentDay,
      schedule,
      weekStore,
      trainers: persisted.trainers,
      fmtWeekRange,
      pickDay,
      setDate,
      shiftWeek,
      copyFromLastWeek,
      addTrainer,
      removeTrainer,
      updateSlotField,
      updateSlotTime,
      updateAttendance,
      deleteSlotById,
      submitNewSlot,
      dupState,
      resolveDuplicate,
      saveComment,
      deleteComment,
      updateSlotSessionNote,
      syncTrackerFromSchedule,
      addOrUpdateTrackerLearner,
      removeTrackerLearner,
      addMsgSlot,
      updateMsgSlot,
      deleteMsgSlot,
      toggleMsgTrainer,
      toggleMsgDone,
      updateTaskField,
      updateTaskStatus,
      deleteTask,
      addInlineTask,
      addTask,
      cycleTaskStatus,
      upsertExtension,
      deleteExtension,
      updateExtensionField,
      toggleExtMail,
      restoreTrashEntry,
      purgeTrashEntry,
      emptyTrash,
      rsSlotId,
      openRSModal: setRsSlotId,
      closeRSModal: () => setRsSlotId(null),
      bookReschedule,
      markRSTBD,
      saveNow,
    }),
    [
      userEmail,
      syncStatus,
      syncMessage,
      persisted,
      currentWeekKey,
      currentDay,
      schedule,
      weekStore,
      pickDay,
      setDate,
      shiftWeek,
      copyFromLastWeek,
      addTrainer,
      removeTrainer,
      updateSlotField,
      updateSlotTime,
      updateAttendance,
      deleteSlotById,
      submitNewSlot,
      dupState,
      resolveDuplicate,
      saveComment,
      deleteComment,
      updateSlotSessionNote,
      syncTrackerFromSchedule,
      addOrUpdateTrackerLearner,
      removeTrackerLearner,
      addMsgSlot,
      updateMsgSlot,
      deleteMsgSlot,
      toggleMsgTrainer,
      toggleMsgDone,
      updateTaskField,
      updateTaskStatus,
      deleteTask,
      addInlineTask,
      addTask,
      cycleTaskStatus,
      upsertExtension,
      deleteExtension,
      updateExtensionField,
      toggleExtMail,
      restoreTrashEntry,
      purgeTrashEntry,
      emptyTrash,
      rsSlotId,
      bookReschedule,
      markRSTBD,
      saveNow,
    ]
  )

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error("useDashboard must be used inside DashboardProvider")
  return ctx
}
