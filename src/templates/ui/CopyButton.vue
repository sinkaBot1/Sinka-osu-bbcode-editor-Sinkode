<script setup lang="ts">
import { Check, Copy } from '@lucide/vue'
import { onBeforeUnmount, ref } from 'vue'

const props = defineProps<{ source: string }>()

/** 反馈时长：docs/workbench.md 要求复制反馈短暂显示约 2 秒。 */
const FEEDBACK_DURATION_MS = 2000

/** 成功：按钮就地换成对勾与「已复制」，不再弹出浮窗。 */
const copied = ref(false)
/** 失败：原因文字放不进按钮，继续由浮窗承载。 */
const failureMessage = ref<string | null>(null)
/** 读屏播报区。节点必须常驻——动态插入的 live region 常常不被播报，所以只换文字。 */
const announcement = ref('')

let timer: ReturnType<typeof setTimeout> | undefined

function clearTimer() {
  if (timer !== undefined) {
    clearTimeout(timer)
    timer = undefined
  }
}

function showSuccess() {
  clearTimer()
  failureMessage.value = null
  copied.value = true
  announcement.value = '已复制'
  timer = setTimeout(() => {
    copied.value = false
    announcement.value = ''
    timer = undefined
  }, FEEDBACK_DURATION_MS)
}

function showFailure(message: string) {
  clearTimer()
  copied.value = false
  failureMessage.value = message
  announcement.value = message
  timer = setTimeout(() => {
    failureMessage.value = null
    announcement.value = ''
    timer = undefined
  }, FEEDBACK_DURATION_MS)
}

async function copySource() {
  const clipboard = globalThis.navigator?.clipboard
  if (!clipboard || typeof clipboard.writeText !== 'function') {
    showFailure('复制失败：当前浏览器不支持剪贴板')
    return
  }
  try {
    await clipboard.writeText(props.source)
    showSuccess()
  } catch {
    showFailure('复制失败，请手动选择文本复制')
  }
}

onBeforeUnmount(clearTimer)
</script>

<template>
  <div class="copy-control">
    <button
      type="button"
      class="copy-button"
      :class="{ 'is-copied': copied }"
      aria-label="复制 BBCode"
      title="复制 BBCode 原文"
      @click="copySource"
    >
      <!-- 两条图标常驻 DOM、叠在同一格：v-if 换 DOM 会让非活动那条不在渲染树里，
           没有可动画对象（docs/ui-icon-system.md §10）。显隐由 .is-copied 驱动。 -->
      <span class="copy-icon" aria-hidden="true">
        <Copy :size="16" :stroke-width="2" />
        <Check :size="16" :stroke-width="2" />
      </span>
      <span class="copy-button-label" aria-hidden="true">
        <span class="label-idle">复制 BBCode</span>
        <span class="label-copied">已复制</span>
      </span>
    </button>
    <Transition name="copy-toast">
      <p v-if="failureMessage" class="copy-toast" aria-hidden="true">{{ failureMessage }}</p>
    </Transition>
    <p class="visually-hidden" role="status">{{ announcement }}</p>
  </div>
</template>
