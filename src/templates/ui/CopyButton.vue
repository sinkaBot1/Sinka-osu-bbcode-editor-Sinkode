<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

const props = defineProps<{ source: string }>()

type CopyFeedback = { kind: 'success' | 'failure'; message: string }

const FEEDBACK_DURATION_MS = 2000

const feedback = ref<CopyFeedback | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined

function showFeedback(kind: CopyFeedback['kind'], message: string) {
  feedback.value = { kind, message }
  if (timer !== undefined) clearTimeout(timer)
  timer = setTimeout(() => {
    feedback.value = null
  }, FEEDBACK_DURATION_MS)
}

async function copySource() {
  const clipboard = globalThis.navigator?.clipboard
  if (!clipboard || typeof clipboard.writeText !== 'function') {
    showFeedback('failure', '复制失败：当前浏览器不支持剪贴板')
    return
  }
  try {
    await clipboard.writeText(props.source)
    showFeedback('success', '已复制')
  } catch {
    showFeedback('failure', '复制失败，请手动选择文本复制')
  }
}

onBeforeUnmount(() => {
  if (timer !== undefined) clearTimeout(timer)
})
</script>

<template>
  <div class="copy-control">
    <button type="button" class="copy-button" title="复制 BBCode 原文" @click="copySource">
      复制 BBCode
    </button>
    <Transition name="copy-toast">
      <p v-if="feedback" class="copy-toast" :class="`copy-toast--${feedback.kind}`" role="status">
        {{ feedback.message }}
      </p>
    </Transition>
  </div>
</template>
