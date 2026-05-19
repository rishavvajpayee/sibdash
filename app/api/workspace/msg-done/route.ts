import { NextResponse } from "next/server"

import { requireWorkspaceUser, jsonError } from "@/lib/workspace/api-auth"
import { upsertMsgDone } from "@/lib/workspace/db/mutations"

export async function PATCH(request: Request) {
  const auth = await requireWorkspaceUser()
  if (auth.response) return auth.response
  const body = (await request.json()) as {
    weekKey?: string
    msgSlotId?: string
    done?: boolean
    doneAt?: string | null
  }
  if (!body.weekKey || !body.msgSlotId || body.done == null) {
    return jsonError("Missing fields", 400)
  }
  try {
    await upsertMsgDone(
      auth.supabase,
      auth.user.email ?? "",
      body.weekKey,
      body.msgSlotId,
      body.done,
      body.doneAt ?? null
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500)
  }
}
