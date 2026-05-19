const IST_TIME_ZONE = "Asia/Kolkata"
const IST_LOCALE = "en-IN"

function formatWithTimeZone(
  date: Date,
  options: Intl.DateTimeFormatOptions,
  locale = IST_LOCALE
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: IST_TIME_ZONE,
    ...options,
  }).format(date)
}

export function formatIstDate(
  date: Date = new Date(),
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }
): string {
  return formatWithTimeZone(date, options)
}

export function formatIstTime(
  date: Date = new Date(),
  options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" }
): string {
  return formatWithTimeZone(date, options)
}

export function formatIstTimestamp(date: Date = new Date()): string {
  return `${formatIstDate(date, { day: "numeric", month: "short" })} ${formatIstTime(date, {
    hour: "2-digit",
    minute: "2-digit",
  })}`
}

export function getIstYmd(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const year = parts.find((part) => part.type === "year")?.value ?? "0000"
  const month = parts.find((part) => part.type === "month")?.value ?? "01"
  const day = parts.find((part) => part.type === "day")?.value ?? "01"
  return `${year}-${month}-${day}`
}

export function formatYmd(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
