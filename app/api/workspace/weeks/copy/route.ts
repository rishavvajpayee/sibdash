import { NextResponse } from "next/server"

import { requireWorkspaceUser, jsonError } from "@/lib/workspace/api-auth"
import { copyWeekFromPrevious } from "@/lib/workspace/db/mutations"

export async function POST(request: Request) {
  const auth = await requireWorkspaceUser()
  if (auth.response) return auth.response
  const body = (await request.json()) as {
    fromWeekKey?: string
    toWeekKey?: string
  }
  if (!body.fromWeekKey || !body.toWeekKey) {
    return jsonError("Missing fromWeekKey or toWeekKey", 400)
  }
  try {
    await copyWeekFromPrevious(
      auth.supabase,
      auth.user.email ?? "",
      body.fromWeekKey,
      body.toWeekKey
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500)
  }
}
