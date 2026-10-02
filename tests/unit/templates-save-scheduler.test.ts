import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSaveScheduler, type SaveSchedulerState } from '../../src/templates'

afterEach(() => {
  vi.useRealTimers()
})

async function flushMicrotasks(times = 10) {
  for (let index = 0; index < times; index += 1) await Promise.resolve()
}

describe('自动保存调度器', () => {
  it('500ms 内合并输入，只写入最新内容（FR-SAVE-01、NFR-PERF-02）', async () => {
    vi.useFakeTimers()
    const writes: string[] = []
    const states: string[] = []
    const scheduler = createSaveScheduler({
      onState: (state) => states.push(`${state.status}:${state.version}`),
      persist: ({ content }) => {
        writes.push(content)
      },
    })

    scheduler.schedule('t1', '旧')
    scheduler.schedule('t1', '新')
    await vi.advanceTimersByTimeAsync(499)
    expect(writes).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(writes).toEqual(['新'])
    expect(states).toEqual(['saving:1', 'saving:2', 'saved:2'])
    scheduler.dispose()
  })

  it('flush 立即提交待保存内容并等待写入完成', async () => {
    vi.useFakeTimers()
    const writes: string[] = []
    const scheduler = createSaveScheduler({
      onState: () => undefined,
      persist: ({ content }) => {
        writes.push(content)
      },
    })

    scheduler.schedule('t1', '即时内容')
    expect(scheduler.hasPending()).toBe(true)
    await scheduler.flush()

    expect(writes).toEqual(['即时内容'])
    expect(scheduler.hasPending()).toBe(false)
    scheduler.dispose()
  })

  it('丢弃过期保存的完成状态，由最新版本决定结果', async () => {
    vi.useFakeTimers()
    let resolveOld: (() => void) | undefined
    const states: SaveSchedulerState[] = []
    const scheduler = createSaveScheduler({
      now: () => 1000,
      onState: (state) => states.push(state),
      persist: ({ content }) =>
        content === '旧内容'
          ? new Promise<void>((resolve) => {
              resolveOld = resolve
            })
          : Promise.resolve(),
    })

    scheduler.schedule('t1', '旧内容')
    await vi.advanceTimersByTimeAsync(500)
    scheduler.schedule('t1', '新内容')
    await vi.advanceTimersByTimeAsync(500)
    resolveOld?.()
    await flushMicrotasks()

    const savedStates = states.filter((state) => state.status === 'saved')
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0].version).toBe(2)
    expect(savedStates[0].savedAt).toBe(1000)
    scheduler.dispose()
  })

  it('写入失败进入错误状态，后续成功写入可恢复（FR-SAVE-03）', async () => {
    vi.useFakeTimers()
    const statuses: string[] = []
    let shouldFail = true
    const scheduler = createSaveScheduler({
      onState: (state) => statuses.push(state.status),
      persist: () => {
        if (shouldFail) throw new Error('写入失败')
      },
    })

    scheduler.schedule('t1', '内容')
    await vi.advanceTimersByTimeAsync(500)
    expect(statuses.at(-1)).toBe('error')

    shouldFail = false
    scheduler.schedule('t1', '内容 2')
    await vi.advanceTimersByTimeAsync(500)
    expect(statuses.at(-1)).toBe('saved')
    scheduler.dispose()
  })

  it('dispose 后不再写入待保存内容', async () => {
    vi.useFakeTimers()
    const writes: string[] = []
    const scheduler = createSaveScheduler({
      onState: () => undefined,
      persist: ({ content }) => {
        writes.push(content)
      },
    })

    scheduler.schedule('t1', '内容')
    scheduler.dispose()
    await vi.advanceTimersByTimeAsync(1000)

    expect(writes).toEqual([])
  })
})
