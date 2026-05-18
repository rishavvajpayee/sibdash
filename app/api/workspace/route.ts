import { NextResponse } from "next/server"

import {
  workspacePayloadSchema,
} from "@/lib/dashboard/constants"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("workspace_dashboard")
    .select("payload, updated_at")
    .eq("id", "default")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    payload: data?.payload ?? null,
    updated_at: data?.updated_at ?? null,
  })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const body = json as { payload?: unknown }
  if (!body.payload || typeof body.payload !== "object") {
    return NextResponse.json({ error: "Missing payload" }, { status: 400 })
  }

  const parsed = workspacePayloadSchema.safeParse(body.payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from("workspace_dashboard")
    .upsert(
      {
        id: "default",
        payload: parsed.data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
