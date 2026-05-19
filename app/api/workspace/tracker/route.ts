import { NextResponse } from "next/server"

import { requireWorkspaceUser, jsonError } from "@/lib/workspace/api-auth"
import { removeTrackerEntry, upsertTrackerEntry } from "@/lib/workspace/db/mutations"

export async function POST(request: Request) {
  const auth = await requireWorkspaceUser()
  if (auth.response) return auth.response
  const body = (await request.json()) as {
    weekKey?: string
    entry?: Record<string, unknown>
  }
  if (!body.weekKey || !body.entry?.name) {
    return jsonError("Missing weekKey or entry.name", 400)
  }
  try {
    const id = await upsertTrackerEntry(
      auth.supabase,
      auth.user.email ?? "",
      body.weekKey,
      body.entry as Parameters<typeof upsertTrackerEntry>[3]
    )
    return NextResponse.json({ id })
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500)
  }
}

export async function DELETE(request: Request) {
  const auth = await requireWorkspaceUser()
  if (auth.response) return auth.response
  const body = (await request.json()) as { weekKey?: string; id?: number }
  if (!body.weekKey || body.id == null) return jsonError("Missing weekKey or id", 400)
  try {
    await removeTrackerEntry(auth.supabase, auth.user.email ?? "", body.weekKey, body.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500)
  }
}
