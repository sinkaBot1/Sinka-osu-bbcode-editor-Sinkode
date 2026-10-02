export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface SaveSchedulerState {
  readonly status: SaveState
  readonly savedAt: number | null
  readonly version: number
}

export interface SavePayload {
  readonly templateId: string
  readonly content: string
}

export interface SaveSchedulerOptions {
  readonly delayMs?: number
  readonly now?: () => number
  readonly persist: (payload: SavePayload) => Promise<void> | void
  readonly onState: (state: SaveSchedulerState) => void
}

export interface SaveScheduler {
  schedule(templateId: string, content: string): void
  flush(): Promise<void>
  hasPending(): boolean
  dispose(): void
}

export function createSaveScheduler(options: SaveSchedulerOptions): SaveScheduler {
  const delayMs = options.delayMs ?? 500
  const now = options.now ?? (() => Date.now())
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: SavePayload | null = null
  let version = 0
  let lastSavedAt: number | null = null
  let inflight: Promise<void> = Promise.resolve()
  let disposed = false

  function emit(status: SaveState, commitVersion: number) {
    options.onState({ status, savedAt: lastSavedAt, version: commitVersion })
  }

  function clearTimer() {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  function schedule(templateId: string, content: string) {
    if (disposed) return
    version += 1
    pending = { templateId, content }
    clearTimer()
    emit('saving', version)
    timer = setTimeout(() => {
      void commit()
    }, delayMs)
  }

  function commit(): Promise<void> {
    clearTimer()
    const payload = pending
    if (!payload) return inflight
    pending = null
    const commitVersion = version
    inflight = inflight.then(async () => {
      try {
        await options.persist(payload)
        if (disposed || commitVersion !== version) return
        lastSavedAt = now()
        emit('saved', commitVersion)
      } catch {
        if (disposed || commitVersion !== version) return
        emit('error', commitVersion)
      }
    })
    return inflight
  }

  function flush(): Promise<void> {
    if (disposed) return inflight
    return commit()
  }

  function hasPending(): boolean {
    return pending !== null || timer !== undefined
  }

  function dispose() {
    disposed = true
    clearTimer()
    pending = null
  }

  return { schedule, flush, hasPending, dispose }
}
