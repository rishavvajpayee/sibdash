import { TCOLORS } from "@/lib/dashboard/constants"

export function trainerHex(trainers: string[], name: string): string {
  const i = trainers.indexOf(name)
  const idx = i >= 0 ? i : 0
  return TCOLORS[idx % TCOLORS.length]!
}

export function initials(name: string): string {
  const p = name.trim().split(/\s+/)
  return (
    (p[0]?.[0] ?? "?").toUpperCase() + (p[1]?.[0] ?? "").toUpperCase()
  )
}
