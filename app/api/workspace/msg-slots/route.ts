import { NextResponse } from "next/server"

import type { Day } from "@/lib/dashboard/constants"
import { requireWorkspaceUser, jsonError } from "@/lib/workspace/api-auth"
import {
  createMsgSlot,
  deleteMsgSlot,
  updateMsgSlot,
} from "@/lib/workspace/db/mutations"

export async function POST(request: Request) {
  const auth = await requireWorkspaceUser()
  if (auth.response) return auth.response
  const body = (await request.json()) as {
    weekKey?: string
    day?: Day
    from?: string
    to?: string
    trainers?: string[]
    notes?: string
  }
  if (!body.weekKey || !body.day || !body.from || !body.to) {
    return jsonError("Missing required fields", 400)
  }
  try {
    const id = await createMsgSlot(
      auth.supabase,
      auth.user.email ?? "",
      body.weekKey,
      body.day,
      body.from,
      body.to,
      body.trainers ?? [],
      body.notes ?? ""
    )
    return NextResponse.json({ id })
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500)
  }
}

export async function PATCH(request: Request) {
  const auth = await requireWorkspaceUser()
  if (auth.response) return auth.response
  const body = (await request.json()) as {
    id?: string
    patch?: Record<string, unknown>
  }
  if (!body.id || !body.patch) return jsonError("Missing id or patch", 400)
  try {
    await updateMsgSlot(auth.supabase, body.id, body.patch as Parameters<typeof updateMsgSlot>[2])
    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500)
  }
}

export async function DELETE(request: Request) {
  const auth = await requireWorkspaceUser()
  if (auth.response) return auth.response
  const body = (await request.json()) as { weekKey?: string; id?: string }
  if (!body.weekKey || !body.id) return jsonError("Missing weekKey or id", 400)
  try {
    await deleteMsgSlot(auth.supabase, auth.user.email ?? "", body.weekKey, body.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500)
  }
}
