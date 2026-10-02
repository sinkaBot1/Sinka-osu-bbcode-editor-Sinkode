<script setup lang="ts">
import 'inter-ui/inter-latin.css'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { PreviewResult } from '../bbcode/compatibility'

withDefaults(
  defineProps<{
    result: PreviewResult | null
    showPrivacyNote?: boolean
  }>(),
  { showPrivacyNote: true },
)

const previewRoot = ref<HTMLElement | null>(null)

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

onMounted(() => {
  previewRoot.value?.addEventListener('click', toggleSpoilerbox)
  previewRoot.value?.addEventListener('error', markMediaFailure, true)
})

onBeforeUnmount(() => {
  previewRoot.value?.removeEventListener('click', toggleSpoilerbox)
  previewRoot.value?.removeEventListener('error', markMediaFailure, true)
})
</script>

<template>
  <div ref="previewRoot" class="preview-content">
    <p v-if="!result?.sanitizedHtml" class="preview-placeholder">
      输入 BBCode 后，预览将在这里显示。
    </p>
    <!-- eslint-disable-next-line vue/no-v-html -- 这里仅显示兼容管线已经清理的 HTML。 -->
    <div v-else v-html="result.sanitizedHtml"></div>
    <p v-if="showPrivacyNote" class="preview-privacy-note">
      媒体预览会由浏览器直接请求 BBCode 中指定的 HTTPS 地址，不会上传模板内容。
    </p>
  </div>
</template>
