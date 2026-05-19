import { NextResponse } from "next/server"

import { requireWorkspaceUser, jsonError } from "@/lib/workspace/api-auth"
import { addTrainer, removeTrainer } from "@/lib/workspace/db/mutations"

export async function POST(request: Request) {
  const auth = await requireWorkspaceUser()
  if (auth.response) return auth.response
  const body = (await request.json()) as { name?: string }
  if (!body.name?.trim()) return jsonError("Missing name", 400)
  try {
    await addTrainer(auth.supabase, auth.user.email ?? "", body.name.trim())
    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500)
  }
}

export async function DELETE(request: Request) {
  const auth = await requireWorkspaceUser()
  if (auth.response) return auth.response
  const body = (await request.json()) as { name?: string }
  if (!body.name) return jsonError("Missing name", 400)
  try {
    await removeTrainer(auth.supabase, auth.user.email ?? "", body.name)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500)
  }
}
