export type UrlKind = 'link' | 'media' | 'email'

export interface SafeUrl {
  readonly allowed: boolean
  readonly value: string
}

const emailAddressPattern =
  /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,63}$/i

function isValidMailto(url: URL): boolean {
  if (url.protocol !== 'mailto:' || url.hash !== '') return false
  try {
    return emailAddressPattern.test(decodeURIComponent(url.pathname))
  } catch {
    return false
  }
}

export function validateUrl(value: string, kind: UrlKind): SafeUrl {
  const trimmed = value.trim()
  try {
    if (kind === 'email') {
      if (!emailAddressPattern.test(trimmed)) return { allowed: false, value: trimmed }
      const url = new URL(`mailto:${trimmed}`)
      return { allowed: isValidMailto(url), value: url.href }
    }

    const url = new URL(trimmed)
    const allowed =
      kind === 'link' ? url.protocol === 'https:' || isValidMailto(url) : url.protocol === 'https:'
    return { allowed, value: url.href }
  } catch {
    return { allowed: false, value: trimmed }
  }
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
