export function parseTime(t?: string) {
  if (!t) return Number.MAX_SAFE_INTEGER
  const d = new Date(`1970-01-01T${t}`)
  return isNaN(d.getTime()) ? Number.MAX_SAFE_INTEGER : d.getTime()
}

export function isToday(date: string) {
  return date === new Date().toISOString().slice(0, 10)
}