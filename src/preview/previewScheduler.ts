import { compileForPreview } from '../bbcode/compatibility'
import type { PreviewResult } from '../bbcode/compatibility'

export type PreviewRenderStatus = 'idle' | 'rendering' | 'ready'

export interface PreviewSchedulerState {
  readonly status: PreviewRenderStatus
  readonly result: PreviewResult | null
  readonly version: number
}

export interface PreviewSchedulerOptions {
  readonly delayMs?: number
  readonly compile?: (source: string) => PreviewResult | Promise<PreviewResult>
  readonly onState: (state: PreviewSchedulerState) => void
}

export interface PreviewScheduler {
  schedule(source: string): void
  dispose(): void
}

export function createPreviewScheduler(options: PreviewSchedulerOptions): PreviewScheduler {
  const delayMs = options.delayMs ?? 150
  const compile = options.compile ?? compileForPreview
  let timer: ReturnType<typeof setTimeout> | undefined
  let version = 0
  let result: PreviewResult | null = null
  let disposed = false

  function schedule(source: string) {
    if (disposed) return
    version += 1
    const currentVersion = version
    if (timer !== undefined) clearTimeout(timer)
    options.onState({ status: 'rendering', result, version: currentVersion })
    timer = setTimeout(() => {
      timer = undefined
      Promise.resolve(compile(source)).then((nextResult) => {
        if (disposed || currentVersion !== version) return
        result = nextResult
        options.onState({ status: 'ready', result, version: currentVersion })
      })
    }, delayMs)
  }

  function dispose() {
    disposed = true
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }

  return { schedule, dispose }
}
