import { NextResponse } from "next/server"

import { requireWorkspaceUser, jsonError } from "@/lib/workspace/api-auth"
import {
  addLearnerNote,
  deleteLearnerNoteByIndex,
} from "@/lib/workspace/db/mutations"

export async function POST(request: Request) {
  const auth = await requireWorkspaceUser()
  if (auth.response) return auth.response
  const body = (await request.json()) as {
    slotId?: number | string
    text?: string
    trainers?: string[]
    learnerName?: string
  }
  if (body.slotId == null || !body.text?.trim()) {
    return jsonError("Missing slotId or text", 400)
  }
  try {
    await addLearnerNote(
      auth.supabase,
      auth.user.email ?? "",
      body.slotId,
      body.text.trim(),
      body.trainers ?? [],
      body.learnerName ?? ""
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
    slotId?: number | string
    revIndex?: number
  }
  if (body.slotId == null || body.revIndex == null) {
    return jsonError("Missing slotId or revIndex", 400)
  }
  try {
    await deleteLearnerNoteByIndex(
      auth.supabase,
      body.slotId,
      body.revIndex,
      auth.user.email ?? ""
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500)
  }
}
