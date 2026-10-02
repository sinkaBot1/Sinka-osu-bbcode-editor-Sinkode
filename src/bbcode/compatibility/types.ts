import type { ScanResult } from '../scanner'

export interface MediaDescriptor {
  readonly kind: 'image' | 'audio' | 'youtube'
  readonly url: string
  readonly allowed: boolean
}

export interface PreviewResult {
  readonly sanitizedHtml: string
  readonly diagnosticsIndependent: true
  readonly media: readonly MediaDescriptor[]
}

export interface StorageDocument {
  readonly source: string
  readonly scan: ScanResult
}
