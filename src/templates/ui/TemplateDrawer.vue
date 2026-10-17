<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { X } from '@lucide/vue'
import type { TemplateRecord } from '../storage/types'
import TemplateSidebar from './TemplateSidebar.vue'

const props = withDefaults(
  defineProps<{
    templates: readonly TemplateRecord[]
    activeTemplateId: string | null
    open?: boolean
  }>(),
  { open: false },
)

const emit = defineEmits<{
  close: []
  select: [id: string]
  create: []
  rename: [payload: { id: string; name: string }]
  duplicate: [id: string]
  delete: [id: string]
  restore: []
}>()

const drawerElement = ref<HTMLElement | null>(null)
let restoreFocusElement: HTMLElement | null = null
let previousBodyOverflow = ''

function isFocusable(element: HTMLElement) {
  return (
    !element.hasAttribute('disabled') &&
    element.getAttribute('aria-hidden') !== 'true' &&
    element.getClientRects().length > 0
  )
}

function focusableElements() {
  const drawerElements = Array.from(
    drawerElement.value?.querySelectorAll<HTMLElement>(
      'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
    ) ?? [],
  ).filter(isFocusable)
  const actionMenuElements = Array.from(
    document.querySelectorAll<HTMLElement>(
      '#template-action-menu button, #template-action-menu input, #template-action-menu [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(isFocusable)
  return [...drawerElements, ...actionMenuElements]
}

async function focusDrawer() {
  await nextTick()
  focusableElements()[0]?.focus()
}

function closeDrawer() {
  if (!props.open) return
  emit('close')
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.open) return
  if (event.key === 'Escape') {
    event.preventDefault()
    closeDrawer()
    return
  }
  if (event.key !== 'Tab') return
  const elements = focusableElements()
  if (elements.length === 0) return
  const active = document.activeElement as HTMLElement | null
  const currentIndex = active ? elements.indexOf(active) : -1
  const nextIndex = event.shiftKey
    ? currentIndex <= 0
      ? elements.length - 1
      : currentIndex - 1
    : currentIndex === elements.length - 1
      ? 0
      : currentIndex + 1
  event.preventDefault()
  elements[nextIndex].focus()
}

function handleBackdropPointerDown(event: PointerEvent) {
  if (event.target === event.currentTarget) closeDrawer()
}

function syncOpenState(open: boolean) {
  if (open) {
    restoreFocusElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    void focusDrawer()
    return
  }
  document.body.style.overflow = previousBodyOverflow
  const target = restoreFocusElement
  restoreFocusElement = null
  requestAnimationFrame(() => target?.isConnected && target.focus())
}

watch(() => props.open, syncOpenState, { immediate: true })

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = previousBodyOverflow
})
</script>

<template>
  <Teleport to="body">
    <Transition name="template-drawer">
      <div
        v-if="props.open"
        class="template-drawer-backdrop"
        role="presentation"
        @pointerdown="handleBackdropPointerDown"
      >
        <aside
          ref="drawerElement"
          class="template-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="template-drawer-title"
        >
          <div class="template-drawer-header">
            <h2 id="template-drawer-title">模板</h2>
            <button
              type="button"
              class="template-drawer-close"
              aria-label="关闭模板抽屉"
              title="关闭模板抽屉"
              @click="closeDrawer"
            >
              <X :size="16" :stroke-width="2" aria-hidden="true" />
            </button>
          </div>
          <aside class="template-sidebar template-drawer-sidebar" aria-label="模板列表">
            <TemplateSidebar
              :templates="props.templates"
              :active-template-id="props.activeTemplateId"
              :open="true"
              @toggle="closeDrawer"
              @select="emit('select', $event)"
              @create="emit('create')"
              @rename="emit('rename', $event)"
              @duplicate="emit('duplicate', $event)"
              @delete="emit('delete', $event)"
              @restore="emit('restore')"
            />
          </aside>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>
