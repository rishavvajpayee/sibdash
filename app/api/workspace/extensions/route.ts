import { NextResponse } from "next/server"

import type { ExtensionRecord } from "@/lib/dashboard/constants"
import { requireWorkspaceUser, jsonError } from "@/lib/workspace/api-auth"
import { deleteExtension, upsertExtension } from "@/lib/workspace/db/mutations"

export async function POST(request: Request) {
  const auth = await requireWorkspaceUser()
  if (auth.response) return auth.response
  const body = (await request.json()) as { record?: ExtensionRecord }
  if (!body.record?.name?.trim()) return jsonError("Missing record.name", 400)
  try {
    const id = await upsertExtension(
      auth.supabase,
      auth.user.email ?? "",
      body.record
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
    field?: keyof ExtensionRecord
    value?: string | boolean
    record?: ExtensionRecord
  }
  try {
    if (body.record) {
      const id = await upsertExtension(
        auth.supabase,
        auth.user.email ?? "",
        body.record
      )
      return NextResponse.json({ id })
    }
    if (!body.id || !body.field) return jsonError("Missing id/field or record", 400)
    const { data: existing } = await auth.supabase
      .from("extension_records")
      .select("*")
      .eq("id", body.id)
      .single()
    if (!existing) return jsonError("Not found", 404)
    const rec: ExtensionRecord = {
      id: body.id,
      name: existing.name,
      number: existing.number,
      email: existing.email,
      type: existing.type,
      charges: existing.charges,
      duration: existing.duration,
      approvedBy: existing.approved_by,
      reason: existing.reason,
      status: existing.status,
      mailSent: existing.mail_sent,
      createdBy: existing.created_by,
      createdAt: existing.created_at,
    }
    const keyMap: Record<string, keyof ExtensionRecord> = {
      approvedBy: "approvedBy",
      mailSent: "mailSent",
      createdBy: "createdBy",
      createdAt: "createdAt",
    }
    const field = (keyMap[body.field as string] ?? body.field) as keyof ExtensionRecord
    ;(rec as Record<string, unknown>)[field as string] = body.value
    if (field === "mailSent" && body.value === true) rec.status = "Mail Sent"
    await upsertExtension(auth.supabase, auth.user.email ?? "", rec)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500)
  }
}

export async function DELETE(request: Request) {
  const auth = await requireWorkspaceUser()
  if (auth.response) return auth.response
  const body = (await request.json()) as { id?: string; createdBy?: string }
  if (!body.id) return jsonError("Missing id", 400)
  try {
    await deleteExtension(
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
