import { NextResponse } from "next/server"

import type { Day, Slot } from "@/lib/dashboard/constants"
import { requireWorkspaceUser, jsonError } from "@/lib/workspace/api-auth"
import { syncTrackerFromScheduleDb } from "@/lib/workspace/db/mutations"

export async function POST(request: Request) {
  const auth = await requireWorkspaceUser()
  if (auth.response) return auth.response
  const body = (await request.json()) as {
    weekKey?: string
    schedule?: Record<Day, Slot[]>
    excludedNames?: string[]
  }
  if (!body.weekKey || !body.schedule) {
    return jsonError("Missing weekKey or schedule", 400)
  }
  try {
    await syncTrackerFromScheduleDb(
      auth.supabase,
      auth.user.email ?? "",
      body.weekKey,
      body.schedule,
      body.excludedNames ?? []
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500)
  }
}
