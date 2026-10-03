import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

// jsdom 不实现 matchMedia；预览容器的低动态效果判断依赖它，这里提供默认值（不匹配 reduce）。
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

// jsdom 也不实现 IntersectionObserver；热区气泡用它监听锚点离开视口。
if (typeof globalThis.IntersectionObserver !== 'function') {
  class NoopIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null = null
    readonly rootMargin: string = '0px'
    readonly thresholds: ReadonlyArray<number> = [0]
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  }
  globalThis.IntersectionObserver =
    NoopIntersectionObserver as unknown as typeof IntersectionObserver
}
