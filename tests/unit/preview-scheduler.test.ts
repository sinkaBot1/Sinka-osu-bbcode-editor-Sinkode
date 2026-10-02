import { describe, expect, it, vi } from 'vitest'
import type { PreviewResult } from '../../src/bbcode/compatibility'
import { createPreviewScheduler } from '../../src/preview'

function result(value: string): PreviewResult {
  return { sanitizedHtml: value, diagnosticsIndependent: true, media: [] }
}

describe('预览渲染调度', () => {
  it('等待 150ms 后提交最新结果', async () => {
    vi.useFakeTimers()
    const states: string[] = []
    const scheduler = createPreviewScheduler({
      onState: (state) => states.push(`${state.status}:${state.version}`),
      compile: (source) => result(source),
    })

    scheduler.schedule('旧文本')
    scheduler.schedule('新文本')
    await vi.advanceTimersByTimeAsync(149)
    expect(states).toEqual(['rendering:1', 'rendering:2'])
    await vi.advanceTimersByTimeAsync(1)
    expect(states).toEqual(['rendering:1', 'rendering:2', 'ready:2'])
    scheduler.dispose()
    vi.useRealTimers()
  })

  it('丢弃已经过期的异步结果', async () => {
    vi.useFakeTimers()
    let resolveOld: ((value: PreviewResult) => void) | undefined
    const states: string[] = []
    const scheduler = createPreviewScheduler({
      onState: (state) => states.push(`${state.status}:${state.result?.sanitizedHtml ?? ''}`),
      compile: (source) =>
        source === '旧文本'
          ? new Promise<PreviewResult>((resolve) => {
              resolveOld = resolve
            })
          : result(source),
    })

    scheduler.schedule('旧文本')
    await vi.advanceTimersByTimeAsync(150)
    scheduler.schedule('新文本')
    await vi.advanceTimersByTimeAsync(150)
    resolveOld?.(result('旧结果'))
    await Promise.resolve()
    expect(states).toEqual(['rendering:', 'rendering:', 'ready:新文本'])
    scheduler.dispose()
    vi.useRealTimers()
  })
})
