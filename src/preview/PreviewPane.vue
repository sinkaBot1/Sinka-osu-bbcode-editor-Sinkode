<script setup lang="ts">
import 'inter-ui/inter-latin.css'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PreviewResult } from '../bbcode/compatibility'

const props = defineProps<{
  result: PreviewResult | null
}>()

const previewRoot = ref<HTMLElement | null>(null)
const tooltip = ref<HTMLElement | null>(null)
const tooltipAnchor = ref<HTMLElement | null>(null)

// 悬停气泡（imagemap 热区）：与锁定基准的浮层提示同一种可观察行为——
// 说明文字取自热区自身的可访问名称，黑底白字小气泡在停顿后淡入、移出后淡出。
const tooltipDelayMs = 200
const tooltipFadeMs = 150
const tooltipEdgeGapPx = 8
const tooltipTimers = new WeakMap<HTMLElement, number>()
let reducedMotionQuery: MediaQueryList | undefined
let tooltipHideTimer: number | undefined
let tooltipHideFrame: number | undefined
let tooltipObserver: IntersectionObserver | undefined

// 低动态效果模式下去掉"停顿后出现"的延迟，悬停即时反馈（与 theme.css 同一媒体查询）。
function tooltipDelay() {
  reducedMotionQuery ??= window.matchMedia('(prefers-reduced-motion: reduce)')
  return reducedMotionQuery.matches ? 0 : tooltipDelayMs
}

// 热区离开视口（页面滚动、面板内部滚动、窗口缩放）时收起气泡：
// IntersectionObserver 能覆盖任意祖先容器的滚动，不依赖在 window 上挂滚动监听。
function watchTooltipAnchor(anchor: HTMLElement) {
  if (typeof IntersectionObserver !== 'function') return
  tooltipObserver ??= new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => !entry.isIntersecting)) hideTooltip()
    },
    { threshold: 0 },
  )
  tooltipObserver.disconnect()
  tooltipObserver.observe(anchor)
}

function stopWatchingTooltipAnchor() {
  tooltipObserver?.disconnect()
}

const spoilerboxDurationMs = 400
const spoilerboxBodyGapPx = 10
const spoilerboxAnimations = new WeakMap<HTMLElement, Animation>()

function animateSpoilerboxBody(body: HTMLElement, expand: boolean) {
  spoilerboxAnimations.get(body)?.cancel()
  spoilerboxAnimations.delete(body)

  if (typeof body.animate !== 'function') {
    body.hidden = !expand
    return
  }

  body.style.overflow = ''
  if (expand) body.hidden = false
  const naturalHeight = body.getBoundingClientRect().height
  const from = expand ? 0 : naturalHeight
  const to = expand ? naturalHeight : 0

  body.style.overflow = 'hidden'
  const animation = body.animate(
    [
      { height: `${from}px`, marginTop: expand ? '0px' : `${spoilerboxBodyGapPx}px` },
      { height: `${to}px`, marginTop: expand ? `${spoilerboxBodyGapPx}px` : '0px' },
    ],
    { duration: spoilerboxDurationMs, easing: 'ease-in-out' },
  )
  spoilerboxAnimations.set(body, animation)
  animation.onfinish = () => {
    spoilerboxAnimations.delete(body)
    body.style.height = ''
    body.style.marginTop = ''
    body.style.overflow = ''
    body.hidden = !expand
  }
}

function mediaElement(
  target: EventTarget | null,
): HTMLImageElement | HTMLAudioElement | HTMLIFrameElement | null {
  if (
    target instanceof HTMLImageElement ||
    target instanceof HTMLAudioElement ||
    target instanceof HTMLIFrameElement
  ) {
    return target
  }
  return null
}

function markMediaFailure(event: Event) {
  const element = mediaElement(event.target)
  if (!element || !previewRoot.value?.contains(element)) return
  element.classList.add('preview-media-failed')
  if (element.nextElementSibling?.classList.contains('preview-media-failure')) return

  const status = document.createElement('span')
  status.className = 'preview-media-failure'
  status.setAttribute('role', 'status')
  status.textContent = '媒体加载失败'
  element.insertAdjacentElement('afterend', status)
}

function toggleSpoilerbox(event: Event) {
  const target = event.target
  if (!(target instanceof Element)) return
  const button = target.closest<HTMLButtonElement>('.bbcode-spoilerbox__link')
  const root = previewRoot.value
  if (!button || !root?.contains(button)) return
  const box = button.closest<HTMLElement>('.bbcode-spoilerbox')
  const body = box?.querySelector<HTMLElement>(':scope > .bbcode-spoilerbox__body')
  if (!body) return
  const expanded = button.getAttribute('aria-expanded') === 'true'
  button.setAttribute('aria-expanded', String(!expanded))
  animateSpoilerboxBody(body, !expanded)
}

function cancelTooltipTimers() {
  if (tooltipHideTimer !== undefined) {
    window.clearTimeout(tooltipHideTimer)
    tooltipHideTimer = undefined
  }
  if (tooltipHideFrame !== undefined) {
    window.cancelAnimationFrame(tooltipHideFrame)
    tooltipHideFrame = undefined
  }
}

function regionLabel(element: HTMLElement): string {
  return element.getAttribute('aria-label')?.trim() ?? ''
}

// 气泡里除了文字还有箭头元素，所以文字必须写进专门的文字节点，
// 不能用 textContent（那会连箭头一起清掉）。
function setTooltipText(bubble: HTMLElement, text: string) {
  const label = bubble.querySelector<HTMLElement>('.preview-tooltip__text')
  if (label) label.textContent = text
}

function isInRegion(node: Node | null, region: HTMLElement) {
  return node instanceof Node && region.contains(node)
}

function positionTooltip(element: HTMLElement, anchor: HTMLElement) {
  const anchorRect = anchor.getBoundingClientRect()
  const bubbleRect = element.getBoundingClientRect()
  // 元素高度 = 文字盒子 + 箭头 8px（两种朝向都一样）。气泡在热区上方时元素底边 = 箭头尖端，
  // 整体贴在热区上边缘，文字盒子下边缘因此停在热区之外；翻到下方时元素顶边 = 箭头尖端。
  const totalHeight = bubbleRect.height
  const aboveTop = anchorRect.top - totalHeight
  const above = aboveTop >= tooltipEdgeGapPx
  const top = above
    ? aboveTop
    : Math.min(anchorRect.bottom, window.innerHeight - totalHeight - tooltipEdgeGapPx)
  const anchorCenter = anchorRect.left + anchorRect.width / 2
  const centered = anchorCenter - bubbleRect.width / 2
  const left = Math.min(
    Math.max(centered, tooltipEdgeGapPx),
    Math.max(window.innerWidth - bubbleRect.width - tooltipEdgeGapPx, tooltipEdgeGapPx),
  )
  element.style.top = `${Math.round(top)}px`
  element.style.left = `${Math.round(left)}px`
  const arrow = element.querySelector<HTMLElement>('.preview-tooltip__arrow')
  const arrowHalfWidth = (arrow?.getBoundingClientRect().width ?? 0) / 2
  element.style.setProperty(
    '--preview-tooltip-arrow-left',
    `${Math.min(Math.max(anchorCenter - Math.round(left), arrowHalfWidth), bubbleRect.width - arrowHalfWidth)}px`,
  )
  element.dataset.placement = above ? 'top' : 'bottom'
  element.classList.toggle('is-below', !above)
}

// 先让气泡处于透明状态并完成布局，再在下一帧打开可见类，
// 透明度过渡才会从 0 开始播放，而不是直接跳到 1。
function revealTooltip(element: HTMLElement, anchor: HTMLElement) {
  element.classList.remove('is-visible')
  element.setAttribute('aria-hidden', 'true')
  positionTooltip(element, anchor)
  tooltipHideFrame = window.requestAnimationFrame(() => {
    tooltipHideFrame = undefined
    // 延迟期间指针可能已经移开或内容已经重渲染，这里再确认一次锚点仍在容器内。
    if (tooltipAnchor.value !== anchor || !previewRoot.value?.contains(anchor)) return
    element.classList.add('is-visible')
    element.setAttribute('aria-hidden', 'false')
  })
}

function showTooltip(element: HTMLElement) {
  cancelTooltipTimers()
  const label = regionLabel(element)
  const bubble = tooltip.value
  if (!label || !bubble) return
  tooltipAnchor.value = element
  watchTooltipAnchor(element)
  // 只改文字，不能写 bubble.textContent：那会清空气泡的子节点（包括箭头元素），
  // 结果就是箭头只在悬停前存在、一悬停就消失。
  setTooltipText(bubble, label)
  // 可见状态下换到另一个热区时只更新内容与位置，避免整块气泡闪烁。
  if (!bubble.classList.contains('is-visible')) {
    revealTooltip(bubble, element)
    return
  }
  positionTooltip(bubble, element)
}

function hideTooltip() {
  cancelTooltipTimers()
  stopWatchingTooltipAnchor()
  const bubble = tooltip.value
  tooltipAnchor.value = null
  if (!bubble) return
  const wasVisible = bubble.classList.contains('is-visible')
  bubble.classList.remove('is-visible')
  bubble.setAttribute('aria-hidden', 'true')
  delete bubble.dataset.placement
  if (!wasVisible) return
  // 等淡出结束后再清空文字，避免过渡期间内容突然消失。
  tooltipHideTimer = window.setTimeout(() => {
    tooltipHideTimer = undefined
    if (tooltipAnchor.value === null) setTooltipText(bubble, '')
  }, tooltipFadeMs)
}

function regionAt(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null
  const region = node.closest<HTMLElement>('.preview-imagemap-region')
  return region && previewRoot.value?.contains(region) ? region : null
}

function cancelPendingShow(region: HTMLElement) {
  const pending = tooltipTimers.get(region)
  if (pending === undefined) return
  window.clearTimeout(pending)
  tooltipTimers.delete(region)
}

function onRegionPointerOver(event: Event) {
  const region = regionAt(event.target)
  if (!region || tooltipAnchor.value === region) return
  const anchor = region
  cancelTooltipTimers()
  cancelPendingShow(anchor)
  tooltipTimers.set(
    anchor,
    window.setTimeout(() => {
      tooltipTimers.delete(anchor)
      showTooltip(anchor)
    }, tooltipDelay()),
  )
}

function onRegionPointerOut(event: MouseEvent) {
  const region = regionAt(event.target)
  if (!region) return
  cancelPendingShow(region)
  if (isInRegion(event.relatedTarget as Node | null, region)) return
  hideTooltip()
}

function onRegionFocusIn(event: Event) {
  const region = regionAt(event.target)
  if (region) showTooltip(region)
}

function onRegionFocusOut(event: FocusEvent) {
  const region = regionAt(event.target)
  if (!region) return
  if (isInRegion(event.relatedTarget as Node | null, region)) return
  hideTooltip()
}

// 气泡用视口坐标定位，任何会带动它的滚动都必须收起气泡，否则气泡会停在错位的位置上。
// 预览容器的滚动事件在捕获阶段就能看到；预览之外（帮助面板的滚动容器、页面滚动）
// 用 document 的捕获阶段兜底，并逐个判断该滚动是否发生在预览的祖先链上。
function onDocumentScroll(event: Event) {
  const target = event.target
  const preview = previewRoot.value
  if (!preview) return
  if (target instanceof Node && (target === preview || preview.contains(target))) return
  let node: Node | null = preview.parentNode
  while (node) {
    if (node === target) {
      hideTooltip()
      return
    }
    node = node.parentNode
  }
}

onMounted(() => {
  previewRoot.value?.addEventListener('click', toggleSpoilerbox)
  previewRoot.value?.addEventListener('error', markMediaFailure, true)
  previewRoot.value?.addEventListener('mouseover', onRegionPointerOver)
  previewRoot.value?.addEventListener('mouseout', onRegionPointerOut)
  previewRoot.value?.addEventListener('focusin', onRegionFocusIn)
  previewRoot.value?.addEventListener('focusout', onRegionFocusOut)
  window.addEventListener('resize', hideTooltip)
  // 捕获阶段：滚动事件不冒泡，这里用于覆盖预览自身与任意祖先滚动容器的滚动。
  document.addEventListener('scroll', onDocumentScroll, true)
})

// 预览内容重渲染后原来的热区元素已经脱离文档，气泡必须收起，不能留在屏幕上。
watch(
  () => props.result?.sanitizedHtml,
  () => hideTooltip(),
)

onBeforeUnmount(() => {
  previewRoot.value?.removeEventListener('click', toggleSpoilerbox)
  previewRoot.value?.removeEventListener('error', markMediaFailure, true)
  previewRoot.value?.removeEventListener('mouseover', onRegionPointerOver)
  previewRoot.value?.removeEventListener('mouseout', onRegionPointerOut)
  previewRoot.value?.removeEventListener('focusin', onRegionFocusIn)
  previewRoot.value?.removeEventListener('focusout', onRegionFocusOut)
  window.removeEventListener('resize', hideTooltip)
  document.removeEventListener('scroll', onDocumentScroll, true)
  cancelTooltipTimers()
  stopWatchingTooltipAnchor()
})
</script>

<template>
  <!-- 外层容器只为承载热区气泡：`.preview-content` 的语义是正文内容区，
       其它地方用 `.preview-content > div`（正文容器）和 `span[style]`（帮助示意里的示例元素）
       定位元素，气泡必须在这两个选择器的语义之外。 -->
  <div ref="previewRoot" class="preview-surface">
    <div class="preview-content">
      <p v-if="!result?.sanitizedHtml" class="preview-placeholder">
        输入 BBCode 后，预览将在这里显示。
      </p>
      <!-- eslint-disable-next-line vue/no-v-html -- 这里仅显示兼容管线已经清理的 HTML。 -->
      <div v-else v-html="result.sanitizedHtml"></div>
    </div>
    <div ref="tooltip" class="preview-tooltip" role="tooltip" aria-hidden="true">
      <span class="preview-tooltip__arrow"></span>
      <span class="preview-tooltip__text"></span>
    </div>
  </div>
</template>
