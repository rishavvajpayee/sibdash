import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

export async function requireWorkspaceUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      supabase,
      user: null as null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  return { supabase, user, response: null as null }
}

export function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status })
}
