import { NextResponse } from "next/server"

import { requireWorkspaceUser, jsonError } from "@/lib/workspace/api-auth"
import { upsertAttendance } from "@/lib/workspace/db/mutations"

export async function PATCH(request: Request) {
  const auth = await requireWorkspaceUser()
  if (auth.response) return auth.response
  const body = (await request.json()) as {
    weekKey?: string
    slotId?: number
    att?: string
    note?: string
  }
  if (!body.weekKey || body.slotId == null) {
    return jsonError("Missing weekKey or slotId", 400)
  }
  try {
    await upsertAttendance(
      auth.supabase,
      auth.user.email ?? "",
      body.weekKey,
      body.slotId,
      body.att ?? "",
      body.note
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500)
  }
}
