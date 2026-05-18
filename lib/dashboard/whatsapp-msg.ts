import type { Day, MsgSlot } from "@/lib/dashboard/constants"

export function buildWhatsAppMessage(day: Day, slots: MsgSlot[]): string {
  if (!slots.length) {
    return `No slots for ${day}.`
  }
  const lines: string[] = ["*Messages slots to be followed today*", ""]
  slots.forEach((s) => {
    const tArr =
      s.trainers && s.trainers.length
        ? s.trainers
        : s.trainer
          ? [s.trainer]
          : []
    const t = tArr.length ? tArr.join(", ") : "Unassigned"
    lines.push(
      `${s.from} - ${s.to}    *${t}*${s.notes ? `  _${s.notes}_` : ""}`
    )
  })
  return lines.join("\n")
}
