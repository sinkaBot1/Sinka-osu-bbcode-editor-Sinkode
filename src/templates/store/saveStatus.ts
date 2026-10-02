const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

export function formatRelativeTime(savedAt: number, now: number): string {
  const delta = Math.max(0, now - savedAt)
  if (delta < MINUTE_MS) return '刚刚'
  if (delta < HOUR_MS) return `${Math.floor(delta / MINUTE_MS)} 分钟前`
  if (delta < DAY_MS) return `${Math.floor(delta / HOUR_MS)} 小时前`
  return `${Math.floor(delta / DAY_MS)} 天前`
}

export function formatSavedLabel(savedAt: number, now: number): string {
  const date = new Date(savedAt)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `已保存 ${hours}:${minutes}（${formatRelativeTime(savedAt, now)}）`
}
