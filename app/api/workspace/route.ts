import { NextResponse } from "next/server"

import { loadWorkspaceBootstrap } from "@/lib/workspace/db/assemble"
import { requireWorkspaceUser, jsonError } from "@/lib/workspace/api-auth"

export async function GET() {
  const auth = await requireWorkspaceUser()
  if (auth.response) return auth.response

  try {
    const { payload, updatedAt } = await loadWorkspaceBootstrap(auth.supabase)
    return NextResponse.json({
      payload,
      updated_at: updatedAt,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load workspace"
    return jsonError(msg, 500)
  }
}
