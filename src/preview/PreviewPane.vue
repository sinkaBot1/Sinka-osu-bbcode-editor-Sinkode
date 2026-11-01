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

const audioPlayingClass = 'bbcode-audio--playing'
const audioDraggingClass = 'is-dragging'
const audioFrames = new Map<HTMLElement, number>()
let audioSeek: AudioSeekState | null = null

interface AudioSeekState {
  readonly player: HTMLElement
  readonly audio: HTMLAudioElement
  readonly progress: HTMLElement
  readonly pointerId: number
  ratio: number
}

type AudioTimeFormat = 'minute' | 'minute-padded' | 'hour' | 'hour-padded'

// 时间格式与锁定基准的可观察输出一致：不足 10 分钟不补零分钟；
// 1 小时以上才出现小时段，10 小时以上小时段补零。
function audioTimeFormat(duration: number): AudioTimeFormat {
  if (duration < 600) return 'minute'
  if (duration < 3600) return 'minute-padded'
  if (duration < 36000) return 'hour'
  return 'hour-padded'
}

function padAudioUnit(value: number): string {
  return String(value).padStart(2, '0')
}

function formatAudioTime(seconds: number, format: AudioTimeFormat): string {
  const total = Math.max(0, Math.floor(seconds))
  const second = total % 60
  const minuteTotal = Math.floor(total / 60)
  if (format === 'minute') return `${minuteTotal}:${padAudioUnit(second)}`
  if (format === 'minute-padded') return `${padAudioUnit(minuteTotal)}:${padAudioUnit(second)}`
  const hourTotal = Math.floor(minuteTotal / 60)
  const minute = minuteTotal % 60
  if (format === 'hour') return `${hourTotal}:${padAudioUnit(minute)}:${padAudioUnit(second)}`
  return `${padAudioUnit(hourTotal)}:${padAudioUnit(minute)}:${padAudioUnit(second)}`
}

function audioPlayerAt(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  const player = target.closest<HTMLElement>('.bbcode-audio')
  return player && previewRoot.value?.contains(player) ? player : null
}

function audioElementOf(player: HTMLElement): HTMLAudioElement | null {
  const audio = player.querySelector('audio')
  return audio instanceof HTMLAudioElement ? audio : null
}

function audioPart<T extends HTMLElement>(player: HTMLElement, selector: string): T | null {
  const node = player.querySelector<T>(selector)
  return node
}

function setAudioPlaying(player: HTMLElement, playing: boolean) {
  player.classList.toggle(audioPlayingClass, playing)
  const button = player.querySelector<HTMLButtonElement>('.bbcode-audio__play')
  button?.setAttribute('aria-label', playing ? '暂停音频' : '播放音频')
}

// 进度条宽度与当前时间集中在一处更新：播放中的动画帧、拖动预览和暂停同步都走这里。
function showAudioProgress(player: HTMLElement, ratio: number, duration: number) {
  const fill = audioPart(player, '.bbcode-audio__progress-fill')
  if (fill) fill.style.width = `${Math.min(1, Math.max(0, ratio)) * 100}%`
  if (!Number.isFinite(duration) || duration <= 0) return
  const current = audioPart(player, '.bbcode-audio__time--current')
  if (current) current.textContent = formatAudioTime(ratio * duration, audioTimeFormat(duration))
}

function syncAudioProgress(player: HTMLElement, audio: HTMLAudioElement) {
  const duration = audio.duration
  const hasDuration = Number.isFinite(duration) && duration > 0
  const current = audioPart(player, '.bbcode-audio__time--current')
  const separator = audioPart(player, '.bbcode-audio__time-separator')
  const total = audioPart(player, '.bbcode-audio__time--total')
  if (current) current.hidden = !hasDuration
  if (separator) separator.hidden = !hasDuration
  if (total) {
    total.textContent = hasDuration ? formatAudioTime(duration, audioTimeFormat(duration)) : '--:--'
  }
  showAudioProgress(player, hasDuration ? audio.currentTime / duration : 0, duration)
}

function stopAudioFrame(player: HTMLElement) {
  const frame = audioFrames.get(player)
  if (frame === undefined) return
  window.cancelAnimationFrame(frame)
  audioFrames.delete(player)
}

function stopAllAudioFrames() {
  for (const frame of audioFrames.values()) window.cancelAnimationFrame(frame)
  audioFrames.clear()
}

// 移除 DOM 不会自动停止媒体：重新渲染或卸载前必须显式暂停，否则旧音频会在后台继续播。
function stopAllAudioPlayback() {
  stopAllAudioFrames()
  for (const audio of previewRoot.value?.querySelectorAll('audio') ?? []) {
    if (!(audio instanceof HTMLAudioElement) || audio.paused) continue
    audio.pause()
    audio.currentTime = 0
  }
  if (audioSeek) {
    audioSeek.progress.classList.remove(audioDraggingClass)
    audioSeek = null
  }
}

// 播放中的进度用 requestAnimationFrame 平滑推进；音频暂停、结束或离开文档时停止。
function startAudioFrame(player: HTMLElement, audio: HTMLAudioElement) {
  stopAudioFrame(player)
  const tick = () => {
    audioFrames.delete(player)
    if (!previewRoot.value?.contains(player) || audio.paused) return
    if (audioSeek?.player !== player) syncAudioProgress(player, audio)
    audioFrames.set(player, window.requestAnimationFrame(tick))
  }
  audioFrames.set(player, window.requestAnimationFrame(tick))
}

function pauseAudio(player: HTMLElement, audio: HTMLAudioElement, reset: boolean) {
  audio.pause()
  if (reset) audio.currentTime = 0
  stopAudioFrame(player)
  setAudioPlaying(player, false)
  syncAudioProgress(player, audio)
}

function toggleAudioPlayback(player: HTMLElement) {
  const audio = audioElementOf(player)
  if (!audio || !audio.getAttribute('src')) return

  if (!audio.paused) {
    pauseAudio(player, audio, false)
    return
  }

  // 锁定基准全站共用一个音频对象：开始播放一段时，其它播放条要回到停止状态。
  for (const other of previewRoot.value?.querySelectorAll<HTMLElement>('.bbcode-audio') ?? []) {
    if (other === player) continue
    const otherAudio = audioElementOf(other)
    if (otherAudio && !otherAudio.paused) pauseAudio(other, otherAudio, true)
  }

  if (Number.isFinite(audio.duration) && audio.currentTime >= audio.duration) audio.currentTime = 0
  player.classList.remove('preview-media-failed')
  if (player.nextElementSibling?.classList.contains('preview-media-failure')) {
    player.nextElementSibling.remove()
  }
  setAudioPlaying(player, true)
  try {
    const promise = audio.play()
    void promise?.catch(() => {
      if (!previewRoot.value?.contains(player)) return
      setAudioPlaying(player, false)
      stopAudioFrame(player)
    })
  } catch {
    setAudioPlaying(player, false)
  }
}

function audioSeekRatio(progress: HTMLElement, clientX: number): number {
  const rect = progress.getBoundingClientRect()
  if (rect.width <= 0) return 0
  return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
}

function onAudioSeekStart(event: PointerEvent) {
  if (event.button !== 0) return
  const target = event.target
  if (!(target instanceof Element)) return
  const progress = target.closest<HTMLElement>('.bbcode-audio__progress')
  const player = progress ? audioPlayerAt(progress) : null
  if (!progress || !player) return
  const audio = audioElementOf(player)
  // 与锁定基准一致：时长未知或为零时不接受定位。
  if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return

  event.preventDefault()
  audioSeek?.progress.classList.remove(audioDraggingClass)
  audioSeek = {
    player,
    audio,
    progress,
    pointerId: event.pointerId,
    ratio: audioSeekRatio(progress, event.clientX),
  }
  progress.classList.add(audioDraggingClass)
  progress.setPointerCapture?.(event.pointerId)
  stopAudioFrame(player)
  showAudioProgress(player, audioSeek.ratio, audio.duration)
}

function onAudioSeekMove(event: PointerEvent) {
  const seek = audioSeek
  if (!seek || seek.pointerId !== event.pointerId) return
  seek.ratio = audioSeekRatio(seek.progress, event.clientX)
  showAudioProgress(seek.player, seek.ratio, seek.audio.duration)
}

function applyAudioSeek(seek: AudioSeekState, commit: boolean) {
  const duration = seek.audio.duration
  if (commit && Number.isFinite(duration) && duration > 0) {
    // 与锁定基准一致：拖到最末端时停在结尾前 0.01 秒，避免直接触发结束。
    seek.audio.currentTime = seek.ratio >= 1 ? duration - 0.01 : seek.ratio * duration
  }
  syncAudioProgress(seek.player, seek.audio)
  if (!seek.audio.paused) startAudioFrame(seek.player, seek.audio)
}

function finishAudioSeek(event: PointerEvent, commit: boolean) {
  const seek = audioSeek
  if (!seek || seek.pointerId !== event.pointerId) return
  audioSeek = null
  seek.progress.classList.remove(audioDraggingClass)
  if (seek.progress.hasPointerCapture?.(event.pointerId)) {
    seek.progress.releasePointerCapture(event.pointerId)
  }
  applyAudioSeek(seek, commit)
}

function cancelAudioSeekOnBlur() {
  const seek = audioSeek
  if (!seek) return
  audioSeek = null
  seek.progress.classList.remove(audioDraggingClass)
  applyAudioSeek(seek, true)
}

function onAudioSeekEnd(event: PointerEvent) {
  finishAudioSeek(event, true)
}

function onAudioSeekCancel(event: PointerEvent) {
  finishAudioSeek(event, false)
}

function onAudioClick(event: Event) {
  const target = event.target
  if (!(target instanceof Element)) return
  const button = target.closest<HTMLElement>('.bbcode-audio__play')
  if (!button) return
  const player = audioPlayerAt(button)
  if (player) toggleAudioPlayback(player)
}

// 媒体事件不冒泡，用捕获阶段统一接收，避免每次重新渲染都给新元素挂监听。
function onAudioMediaEvent(event: Event) {
  const audio = event.target
  if (!(audio instanceof HTMLAudioElement)) return
  const player = audio.closest<HTMLElement>('.bbcode-audio')
  if (!player || !previewRoot.value?.contains(player)) return

  if (event.type === 'playing') {
    player.classList.remove('preview-media-failed')
    setAudioPlaying(player, true)
    syncAudioProgress(player, audio)
    startAudioFrame(player, audio)
    return
  }
  if (event.type === 'pause') {
    setAudioPlaying(player, false)
    stopAudioFrame(player)
    syncAudioProgress(player, audio)
    return
  }
  if (event.type === 'ended') {
    audio.currentTime = 0
    setAudioPlaying(player, false)
    stopAudioFrame(player)
    syncAudioProgress(player, audio)
    return
  }
  if (event.type === 'loadedmetadata' || event.type === 'durationchange') {
    syncAudioProgress(player, audio)
    return
  }
  // 播放中的时间由动画帧更新，这里只补上暂停状态下的定位同步。
  if (audio.paused) syncAudioProgress(player, audio)
}

function markMediaFailure(event: Event) {
  const element = mediaElement(event.target)
  if (!element || !previewRoot.value?.contains(element)) return
  const player =
    element instanceof HTMLAudioElement ? element.closest<HTMLElement>('.bbcode-audio') : null
  const marked = player ?? element
  if (player) {
    stopAudioFrame(player)
    setAudioPlaying(player, false)
  }
  marked.classList.add('preview-media-failed')
  if (marked.nextElementSibling?.classList.contains('preview-media-failure')) return

  const status = document.createElement('span')
  status.className = 'preview-media-failure'
  status.setAttribute('role', 'status')
  status.textContent = '媒体加载失败'
  marked.insertAdjacentElement('afterend', status)
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
  previewRoot.value?.addEventListener('click', onAudioClick)
  previewRoot.value?.addEventListener('pointerdown', onAudioSeekStart)
  previewRoot.value?.addEventListener('pointermove', onAudioSeekMove)
  previewRoot.value?.addEventListener('pointerup', onAudioSeekEnd)
  previewRoot.value?.addEventListener('pointercancel', onAudioSeekCancel)
  previewRoot.value?.addEventListener('error', markMediaFailure, true)
  for (const type of [
    'loadedmetadata',
    'durationchange',
    'playing',
    'pause',
    'ended',
    'timeupdate',
  ]) {
    previewRoot.value?.addEventListener(type, onAudioMediaEvent, true)
  }
  previewRoot.value?.addEventListener('mouseover', onRegionPointerOver)
  previewRoot.value?.addEventListener('mouseout', onRegionPointerOut)
  previewRoot.value?.addEventListener('focusin', onRegionFocusIn)
  previewRoot.value?.addEventListener('focusout', onRegionFocusOut)
  window.addEventListener('blur', cancelAudioSeekOnBlur)
  window.addEventListener('resize', hideTooltip)
  // 捕获阶段：滚动事件不冒泡，这里用于覆盖预览自身与任意祖先滚动容器的滚动。
  document.addEventListener('scroll', onDocumentScroll, true)
})

// 预览内容重渲染后原来的热区和播放器已经脱离文档，气泡与播放必须同步收尾。
watch(
  () => props.result?.sanitizedHtml,
  () => {
    hideTooltip()
    stopAllAudioPlayback()
  },
)

onBeforeUnmount(() => {
  previewRoot.value?.removeEventListener('click', toggleSpoilerbox)
  previewRoot.value?.removeEventListener('click', onAudioClick)
  previewRoot.value?.removeEventListener('pointerdown', onAudioSeekStart)
  previewRoot.value?.removeEventListener('pointermove', onAudioSeekMove)
  previewRoot.value?.removeEventListener('pointerup', onAudioSeekEnd)
  previewRoot.value?.removeEventListener('pointercancel', onAudioSeekCancel)
  previewRoot.value?.removeEventListener('error', markMediaFailure, true)
  for (const type of [
    'loadedmetadata',
    'durationchange',
    'playing',
    'pause',
    'ended',
    'timeupdate',
  ]) {
    previewRoot.value?.removeEventListener(type, onAudioMediaEvent, true)
  }
  previewRoot.value?.removeEventListener('mouseover', onRegionPointerOver)
  previewRoot.value?.removeEventListener('mouseout', onRegionPointerOut)
  previewRoot.value?.removeEventListener('focusin', onRegionFocusIn)
  previewRoot.value?.removeEventListener('focusout', onRegionFocusOut)
  window.removeEventListener('blur', cancelAudioSeekOnBlur)
  window.removeEventListener('resize', hideTooltip)
  document.removeEventListener('scroll', onDocumentScroll, true)
  cancelTooltipTimers()
  stopWatchingTooltipAnchor()
  stopAllAudioPlayback()
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
