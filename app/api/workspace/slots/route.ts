import { NextResponse } from "next/server"

import type { Day, Slot } from "@/lib/dashboard/constants"
import { requireWorkspaceUser, jsonError } from "@/lib/workspace/api-auth"
import {
  createScheduleSlot,
  deleteScheduleSlot,
  patchScheduleSlot,
} from "@/lib/workspace/db/mutations"

export async function POST(request: Request) {
  const auth = await requireWorkspaceUser()
  if (auth.response) return auth.response
  const body = (await request.json()) as {
    weekKey?: string
    day?: Day
    slot?: Record<string, unknown>
  }
  if (!body.weekKey || !body.day || !body.slot) {
    return jsonError("Missing weekKey, day, or slot", 400)
  }
  try {
    const slot = await createScheduleSlot(
      auth.supabase,
      auth.user.email ?? "",
      body.weekKey,
      body.day,
      body.slot as Omit<Slot, "id"> & { id?: number }
    )
    return NextResponse.json({ slot })
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500)
  }
}

export async function PATCH(request: Request) {
  const auth = await requireWorkspaceUser()
  if (auth.response) return auth.response
  const body = (await request.json()) as {
    slotId?: number
    patch?: Record<string, unknown>
    log?: { section: string; action: string; detail: string }
  }
  if (!body.slotId || !body.patch) return jsonError("Missing slotId or patch", 400)
  try {
    await patchScheduleSlot(
      auth.supabase,
      auth.user.email ?? "",
      body.slotId,
      body.patch as Parameters<typeof patchScheduleSlot>[3],
      body.log
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500)
  }
}

export async function DELETE(request: Request) {
  const auth = await requireWorkspaceUser()
  if (auth.response) return auth.response
  const body = (await request.json()) as {
    slotId?: number
    weekKey?: string
    day?: Day
    slot?: Record<string, unknown>
  }
  if (!body.slotId || !body.weekKey || !body.day || !body.slot) {
    return jsonError("Missing fields", 400)
  }
  try {
    await deleteScheduleSlot(
      auth.supabase,
      auth.user.email ?? "",
      body.slotId,
      body.weekKey,
      body.day,
      body.slot as Slot
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500)
  }
}
