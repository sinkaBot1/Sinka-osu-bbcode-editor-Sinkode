<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { LineAnchor } from '../bbcode/compatibility'
import {
  contentYForRatio,
  lookupAnchor,
  measureAnchors,
  ratioForContentY,
  type MeasuredAnchor,
} from './indicatorLine'

const props = defineProps<{
  anchors: readonly LineAnchor[]
  lineCount: number
  ratio: number
}>()

const emit = defineEmits<{
  (event: 'update:ratio', value: number): void
  (event: 'commit:ratio', value: number): void
  (event: 'line-change', payload: { line: number | null; follow: boolean; animate: boolean }): void
  (event: 'announce', text: string): void
  (event: 'escape'): void
}>()

const root = ref<HTMLElement | null>(null)
const hit = ref<HTMLElement | null>(null)
const localRatio = ref(clampRatio(props.ratio))
const currentLine = ref<number | null>(null)
const dragging = ref(false)

let canvas: HTMLElement | null = null
let content: HTMLElement | null = null
let renderRoot: HTMLElement | null = null
let measured: MeasuredAnchor[] = []
let measureTimer: number | undefined
let measureFrame = 0
let lineFrame = 0
let commitTimer: number | undefined
let resizeObserver: ResizeObserver | undefined
let contentObserver: ResizeObserver | undefined
let dragOffset = 0
let pointerId: number | null = null
let measuredAnchors: readonly LineAnchor[] | null = null
let disposed = false

const hasLine = computed(() => currentLine.value !== null)
const lineLabel = computed(() =>
  currentLine.value === null ? '第 — 行' : `第 ${currentLine.value} 行`,
)

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0.5
  return Math.min(1, Math.max(0, value))
}

function resolveElements() {
  const stage = root.value?.parentElement
  canvas = stage?.querySelector<HTMLElement>('.preview-canvas') ?? null
  content = stage?.querySelector<HTMLElement>('.preview-content') ?? null
  // 空预览时 .preview-content 里是占位段落，没有渲染根节点。
  renderRoot = content?.querySelector<HTMLElement>(':scope > div') ?? null
}

function scheduleMeasure(delay: number) {
  if (disposed) return
  if (measureTimer !== undefined) window.clearTimeout(measureTimer)
  measureTimer = window.setTimeout(() => {
    measureTimer = undefined
    if (disposed || measureFrame !== 0) return
    measureFrame = requestAnimationFrame(() => {
      measureFrame = 0
      if (!disposed) measureNow()
    })
  }, delay)
}

function measureNow() {
  if (disposed) return
  resolveElements()
  // .preview-content 有 260px 最小高度：折叠盒展开时内容根节点变高，
  // 但 .preview-content 的边框盒可能不变，因此两个节点都要观察。
  if (contentObserver && renderRoot) contentObserver.observe(renderRoot)
  // 锚点数组身份变化意味着预览重新渲染；即使行号相同也要重发一次，
  // 补回 setState 清空的编辑器指示行。按数组身份判断，避免异步测量抢走 force 标记。
  const force = props.anchors !== measuredAnchors
  measuredAnchors = props.anchors
  if (!content || !renderRoot) {
    measured = []
    updateLine(false, force)
    return
  }
  measured = measureAnchors(content, renderRoot, props.anchors)
  updateLine(false, force)
}

function currentRatioFromPointer(clientY: number): number {
  if (!canvas) return localRatio.value
  const rect = canvas.getBoundingClientRect()
  if (rect.height <= 0) return localRatio.value
  return clampRatio((clientY - rect.top) / rect.height)
}

function updateLine(follow: boolean, force = false) {
  if (!canvas || !content || measured.length === 0) {
    if (currentLine.value !== null) {
      currentLine.value = null
      emit('line-change', { line: null, follow: false, animate: false })
    }
    return
  }
  const canvasRect = canvas.getBoundingClientRect()
  const contentRect = content.getBoundingClientRect()
  const contentY = contentYForRatio(localRatio.value, canvasRect, contentRect)
  const anchor = lookupAnchor(measured, contentY)
  const line = anchor?.line ?? null
  if (line === currentLine.value && !force) return
  currentLine.value = line
  emit('line-change', { line, follow, animate: follow })
}

function scheduleCommit() {
  if (commitTimer !== undefined) window.clearTimeout(commitTimer)
  commitTimer = window.setTimeout(() => {
    commitTimer = undefined
    emit('commit:ratio', localRatio.value)
    announce()
  }, 240)
}

function applyRatio(value: number, follow: boolean) {
  const next = clampRatio(value)
  if (next === localRatio.value && !follow) return
  localRatio.value = next
  emit('update:ratio', next)
  updateLine(follow)
}

function announce() {
  if (currentLine.value === null) return
  emit('announce', `第 ${currentLine.value} 行`)
}

function beginDrag(event: PointerEvent) {
  if (event.button !== 0 || !canvas || measured.length === 0) return
  event.preventDefault()
  dragging.value = true
  pointerId = event.pointerId
  const rect = canvas.getBoundingClientRect()
  const lineY = rect.top + rect.height * localRatio.value
  dragOffset = lineY - event.clientY
  hit.value?.focus({ preventScroll: true })
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', endDrag)
  window.addEventListener('pointercancel', cancelDrag)
  window.addEventListener('blur', cancelDragOnBlur)
  announce()
}

function onPointerMove(event: PointerEvent) {
  if (!dragging.value || event.pointerId !== pointerId) return
  applyRatio(currentRatioFromPointer(event.clientY + dragOffset), true)
}

function finishDrag() {
  if (!dragging.value) return
  dragging.value = false
  pointerId = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointercancel', cancelDrag)
  window.removeEventListener('blur', cancelDragOnBlur)
}

function endDrag(event: PointerEvent) {
  if (event.pointerId !== pointerId) return
  finishDrag()
  emit('commit:ratio', localRatio.value)
  announce()
}

function cancelDrag(event: PointerEvent) {
  if (event.pointerId !== pointerId) return
  finishDrag()
  emit('commit:ratio', localRatio.value)
  announce()
}

function cancelDragOnBlur() {
  if (!dragging.value) return
  finishDrag()
  emit('commit:ratio', localRatio.value)
}

function onWheel(event: WheelEvent) {
  if (!canvas) return
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1
  canvas.scrollTop += event.deltaY * unit
  event.preventDefault()
  updateLine(true)
}

function moveLineByPixels(delta: number) {
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  if (rect.height <= 0) return
  const lineY = rect.top + rect.height * localRatio.value
  applyRatio((lineY + delta - rect.top) / rect.height, true)
  scheduleCommit()
}

function scrollToAnchor(first: boolean) {
  if (!canvas || !content || measured.length === 0) return
  canvas.scrollTop = first ? 0 : canvas.scrollHeight
  requestAnimationFrame(() => {
    if (!canvas || !content) return
    const anchor = first ? measured[0] : measured[measured.length - 1]
    const canvasRect = canvas.getBoundingClientRect()
    const contentRect = content.getBoundingClientRect()
    applyRatio(ratioForContentY(anchor.y, canvasRect, contentRect), true)
    announce()
    scheduleCommit()
  })
}

function onKeydown(event: KeyboardEvent) {
  if (measured.length === 0) return
  switch (event.key) {
    case 'ArrowUp':
      event.preventDefault()
      moveLineByPixels(event.shiftKey ? -10 : -1)
      announce()
      return
    case 'ArrowDown':
      event.preventDefault()
      moveLineByPixels(event.shiftKey ? 10 : 1)
      announce()
      return
    case 'PageUp':
      event.preventDefault()
      moveLineByPixels(-(canvas?.clientHeight ?? 0) / 4)
      announce()
      return
    case 'PageDown':
      event.preventDefault()
      moveLineByPixels((canvas?.clientHeight ?? 0) / 4)
      announce()
      return
    case 'Home':
      event.preventDefault()
      scrollToAnchor(true)
      return
    case 'End':
      event.preventDefault()
      scrollToAnchor(false)
      return
    case 'Escape':
      event.preventDefault()
      emit('escape')
      return
    default:
      return
  }
}

function onCanvasScroll() {
  if (lineFrame !== 0) return
  lineFrame = requestAnimationFrame(() => {
    lineFrame = 0
    updateLine(true)
  })
}

function onResourceLoad() {
  scheduleMeasure(0)
}

function onWindowResize() {
  scheduleMeasure(40)
}

watch(
  () => props.ratio,
  (value) => {
    if (dragging.value) return
    localRatio.value = clampRatio(value)
    updateLine(false)
  },
)

watch(
  () => props.anchors,
  () => {
    // 预览重新渲染后不自动滚动编辑器；用户再次拖动/滚动时才恢复跟随。
    // flush: 'post' 保证 v-html 已经替换完，测量拿到的是新 DOM。
    scheduleMeasure(0)
  },
  { flush: 'post' },
)

onMounted(() => {
  resolveElements()
  canvas?.addEventListener('scroll', onCanvasScroll, { passive: true })
  canvas?.addEventListener('load', onResourceLoad, true)
  window.addEventListener('resize', onWindowResize)
  if (content && typeof ResizeObserver !== 'undefined') {
    contentObserver = new ResizeObserver(() => scheduleMeasure(16))
    contentObserver.observe(content)
    if (renderRoot) contentObserver.observe(renderRoot)
  }
  if (canvas && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => updateLine(false))
    resizeObserver.observe(canvas)
  }
  if (typeof document !== 'undefined' && 'fonts' in document) {
    void document.fonts.ready.then(() => scheduleMeasure(0))
  }
  scheduleMeasure(0)
})

onBeforeUnmount(() => {
  disposed = true
  canvas?.removeEventListener('scroll', onCanvasScroll)
  canvas?.removeEventListener('load', onResourceLoad, true)
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointercancel', cancelDrag)
  window.removeEventListener('blur', cancelDragOnBlur)
  if (measureTimer !== undefined) window.clearTimeout(measureTimer)
  if (commitTimer !== undefined) window.clearTimeout(commitTimer)
  if (measureFrame !== 0) cancelAnimationFrame(measureFrame)
  if (lineFrame !== 0) cancelAnimationFrame(lineFrame)
  resizeObserver?.disconnect()
  contentObserver?.disconnect()
})
</script>

<template>
  <div ref="root" class="preview-indicator">
    <div
      v-if="hasLine"
      ref="hit"
      class="preview-indicator__hit"
      :class="{ 'is-dragging': dragging }"
      :style="{ top: `${localRatio * 100}%` }"
      role="slider"
      aria-orientation="vertical"
      :aria-valuemin="1"
      :aria-valuemax="Math.max(1, lineCount)"
      :aria-valuenow="currentLine ?? 1"
      :aria-valuetext="lineLabel"
      aria-label="源码行指示线"
      tabindex="0"
      @pointerdown="beginDrag"
      @keydown="onKeydown"
      @wheel="onWheel"
    >
      <span class="preview-indicator__line" aria-hidden="true"></span>
      <span class="preview-indicator__handle preview-indicator__handle--start" aria-hidden="true">
        <span class="preview-indicator__grip"><i></i><i></i><i></i></span>
      </span>
      <span class="preview-indicator__handle preview-indicator__handle--end" aria-hidden="true">
        <span class="preview-indicator__grip"><i></i><i></i><i></i></span>
      </span>
      <span class="preview-indicator__label" aria-hidden="true">{{ lineLabel }}</span>
    </div>
  </div>
</template>
