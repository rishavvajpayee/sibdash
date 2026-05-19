import { NextResponse } from "next/server"

import type { TaskCategory, TaskStatus } from "@/lib/dashboard/constants"
import { requireWorkspaceUser, jsonError } from "@/lib/workspace/api-auth"
import { deleteTask, patchTask, upsertTask } from "@/lib/workspace/db/mutations"

export async function POST(request: Request) {
  const auth = await requireWorkspaceUser()
  if (auth.response) return auth.response
  const body = (await request.json()) as {
    weekKey?: string
    category?: TaskCategory
    task?: Record<string, unknown>
  }
  if (!body.weekKey || !body.category || !body.task) {
    return jsonError("Missing fields", 400)
  }
  try {
    const id = await upsertTask(
      auth.supabase,
      auth.user.email ?? "",
      body.weekKey,
      body.category,
      body.task as Parameters<typeof upsertTask>[4]
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
    logDetail?: string
  }
  if (!body.id || !body.patch) return jsonError("Missing id or patch", 400)
  try {
    await patchTask(
      auth.supabase,
      auth.user.email ?? "",
      body.id,
      body.patch as Parameters<typeof patchTask>[3],
      body.logDetail ?? body.id
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
    id?: string
    createdBy?: string
  }
  if (!body.id) return jsonError("Missing id", 400)
  try {
    await deleteTask(
      auth.supabase,
      auth.user.email ?? "",
      body.id,
      body.createdBy,
      auth.user.email ?? ""
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500)
  }
}
