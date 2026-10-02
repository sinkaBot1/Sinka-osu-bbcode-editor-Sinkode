import { scanDocument } from '../scanner'
import type { StorageDocument } from './types'

export function compileForStorage(source: string): StorageDocument {
  return { source, scan: scanDocument(source) }
}
