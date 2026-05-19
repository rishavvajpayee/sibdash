import { formatIstTimestamp } from "@/lib/time"

export function parseTaggedUsers(text: string, trainers: string[]): string[] {
  const matches: string[] = []
  const re = /@([A-Za-z][A-Za-z0-9 ._]*)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const found = trainers.find(
      (t) => t.toLowerCase() === m![1].trim().toLowerCase()
    )
    if (found && !matches.includes(found)) matches.push(found)
  }
  return matches
}

export function addNotificationDraft(
  notifications: Record<string, unknown[]>,
  toTrainerName: string,
  fromEmail: string,
  noteText: string,
  learnerName: string
): Record<string, unknown[]> {
  const next = { ...notifications }
  const key = toTrainerName.toLowerCase().replace(/\s+/g, "_")
  const arr = [...(next[key] ?? [])]
  const ts = formatIstTimestamp()
  arr.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    from: fromEmail || "someone",
    msg: `@${toTrainerName} — "${noteText.substring(0, 80)}${noteText.length > 80 ? "…" : ""}" (re: ${learnerName || "session"})`,
    ts,
    read: false,
    learnerName,
    toTrainerName,
  })
  next[key] = arr
  return next
}
