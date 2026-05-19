import { NextResponse } from "next/server"

import { requireWorkspaceUser, jsonError } from "@/lib/workspace/api-auth"
import {
  emptyTrash,
  purgeTrash,
  restoreTrash,
} from "@/lib/workspace/db/mutations"

export async function POST(request: Request) {
  const auth = await requireWorkspaceUser()
  if (auth.response) return auth.response
  const body = (await request.json()) as {
    action?: "restore" | "purge" | "empty"
    trashId?: string
  }
  try {
    if (body.action === "restore" && body.trashId) {
      await restoreTrash(auth.supabase, auth.user.email ?? "", body.trashId)
    } else if (body.action === "purge" && body.trashId) {
      await purgeTrash(auth.supabase, body.trashId)
    } else if (body.action === "empty") {
      await emptyTrash(auth.supabase)
    } else {
      return jsonError("Invalid action", 400)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500)
  }
}
