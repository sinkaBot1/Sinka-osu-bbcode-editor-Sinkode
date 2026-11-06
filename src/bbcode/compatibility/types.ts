import type { ScanResult } from '../scanner'
import type { LineAnchor } from './lineAnchors'

export interface MediaDescriptor {
  readonly kind: 'image' | 'audio' | 'youtube'
  readonly url: string
  readonly allowed: boolean
}

export interface PreviewResult {
  readonly sanitizedHtml: string
  readonly diagnosticsIndependent: true
  readonly media: readonly MediaDescriptor[]
  /** 编译期产出的行锚点；只描述可见输出，不改变 sanitizedHtml。 */
  readonly lineAnchors: readonly LineAnchor[]
}

export interface StorageDocument {
  readonly source: string
  readonly scan: ScanResult
}
