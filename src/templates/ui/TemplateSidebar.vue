<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Copy, Ellipsis, PanelLeft, Pencil, Plus, RotateCcw, Trash2 } from '@lucide/vue'
import type { TemplateRecord } from '../storage/types'

const props = withDefaults(
  defineProps<{
    templates: readonly TemplateRecord[]
    activeTemplateId: string | null
    open?: boolean
  }>(),
  {
    open: true,
  },
)

const emit = defineEmits<{
  toggle: []
  select: [id: string]
  create: []
  rename: [payload: { id: string; name: string }]
  duplicate: [id: string]
  delete: [id: string]
  restore: []
}>()

const renamingId = ref<string | null>(null)
const renameDraft = ref('')
const pendingDeleteId = ref<string | null>(null)
const actionMenuId = ref<string | null>(null)
const sidebarContentElement = ref<HTMLElement | null>(null)
const actionMenuElement = ref<HTMLElement | null>(null)
const actionMenuTrigger = ref<HTMLButtonElement | null>(null)
const actionMenuStyle = ref<Record<string, string>>({})
const actionMenuTemplate = computed(() =>
  props.templates.find((template) => template.id === actionMenuId.value),
)

function updateActionMenuPlacement() {
  const trigger = actionMenuTrigger.value
  if (!trigger || !actionMenuId.value) return
  const triggerRect = trigger.getBoundingClientRect()
  const sidebarWidth = trigger.closest('.template-sidebar')?.getBoundingClientRect().width ?? 196
  const width = Math.min(176, Math.max(132, sidebarWidth - 20))
  const left = Math.max(8, Math.min(triggerRect.right - width, window.innerWidth - width - 8))
  const menuHeight = actionMenuElement.value?.getBoundingClientRect().height ?? 150
  const belowTop = triggerRect.bottom - 2
  const top =
    belowTop + menuHeight <= window.innerHeight - 8
      ? belowTop
      : Math.max(8, triggerRect.top - menuHeight + 2)
  actionMenuStyle.value = { left: `${left}px`, top: `${top}px`, width: `${width}px` }
}

function closeActionMenu(restoreFocus = false) {
  if (!actionMenuId.value) return
  const trigger = actionMenuTrigger.value
  actionMenuId.value = null
  if (restoreFocus) void nextTick(() => trigger?.isConnected && trigger.focus())
}

function toggleActionMenu(template: TemplateRecord, event: MouseEvent) {
  if (actionMenuId.value === template.id) {
    closeActionMenu(true)
    return
  }
  actionMenuTrigger.value = event.currentTarget as HTMLButtonElement
  actionMenuId.value = template.id
  if (pendingDeleteId.value !== template.id) pendingDeleteId.value = null
  updateActionMenuPlacement()
  void nextTick(() => {
    updateActionMenuPlacement()
    actionMenuElement.value?.querySelector<HTMLButtonElement>('button')?.focus()
  })
}

function handleActionMenuPointerDown(event: PointerEvent) {
  if (!actionMenuId.value) return
  const target = event.target as Node
  if (actionMenuTrigger.value?.contains(target) || actionMenuElement.value?.contains(target)) return
  closeActionMenu()
}

function handleActionMenuKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !actionMenuId.value) return
  event.preventDefault()
  closeActionMenu(true)
}

function handleActionMenuScroll() {
  closeActionMenu()
}

function findTemplateItem(id: string) {
  return Array.from(
    sidebarContentElement.value?.querySelectorAll<HTMLElement>('.template-item') ?? [],
  ).find((item) => item.dataset.templateId === id)
}

function focusTemplateMoreButton(id: string) {
  void nextTick(() =>
    findTemplateItem(id)?.querySelector<HTMLButtonElement>('.template-more')?.focus(),
  )
}

function beginRename(template: TemplateRecord) {
  closeActionMenu()
  pendingDeleteId.value = null
  renamingId.value = template.id
  renameDraft.value = template.name
  void nextTick(() =>
    findTemplateItem(template.id)?.querySelector<HTMLInputElement>('input')?.focus(),
  )
}

function confirmRename(id: string) {
  const name = renameDraft.value.trim()
  if (name) emit('rename', { id, name })
  renamingId.value = null
  focusTemplateMoreButton(id)
}

function cancelRename() {
  const id = renamingId.value
  renamingId.value = null
  if (id) focusTemplateMoreButton(id)
}

function requestDelete(id: string) {
  closeActionMenu()
  renamingId.value = null
  pendingDeleteId.value = pendingDeleteId.value === id ? null : id
  if (pendingDeleteId.value) {
    void nextTick(() =>
      findTemplateItem(id)
        ?.querySelector<HTMLButtonElement>('.template-delete-confirm button')
        ?.focus(),
    )
  } else focusTemplateMoreButton(id)
}

function cancelDelete() {
  const id = pendingDeleteId.value
  pendingDeleteId.value = null
  if (id) focusTemplateMoreButton(id)
}

function confirmDelete(id: string) {
  pendingDeleteId.value = null
  emit('delete', id)
}

function duplicateTemplate(id: string) {
  closeActionMenu()
  emit('duplicate', id)
}

function selectTemplate(id: string) {
  closeActionMenu()
  emit('select', id)
}

function toggleSidebar() {
  closeActionMenu()
  emit('toggle')
}

onMounted(() => {
  document.addEventListener('pointerdown', handleActionMenuPointerDown)
  document.addEventListener('keydown', handleActionMenuKeydown)
  document.addEventListener('scroll', handleActionMenuScroll, true)
  window.addEventListener('resize', updateActionMenuPlacement)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', handleActionMenuPointerDown)
  document.removeEventListener('keydown', handleActionMenuKeydown)
  document.removeEventListener('scroll', handleActionMenuScroll, true)
  window.removeEventListener('resize', updateActionMenuPlacement)
})

watch(
  () => props.templates.map((template) => template.id).join(','),
  () => {
    if (
      pendingDeleteId.value &&
      !props.templates.some((template) => template.id === pendingDeleteId.value)
    ) {
      pendingDeleteId.value = null
    }
    if (renamingId.value && !props.templates.some((template) => template.id === renamingId.value)) {
      renamingId.value = null
    }
    if (
      actionMenuId.value &&
      !props.templates.some((template) => template.id === actionMenuId.value)
    ) {
      closeActionMenu()
    }
  },
)

watch(
  () => props.open,
  (open) => {
    if (!open) closeActionMenu()
  },
)
</script>

<template>
  <div ref="sidebarContentElement" class="template-sidebar-content">
    <div class="template-sidebar-layout">
      <Transition name="template-sidebar-panel">
        <div v-if="props.open" class="template-sidebar-panel">
          <div class="section-heading">
            <h2>模板</h2>
            <button type="button" aria-label="新建模板" title="新建模板" @click="emit('create')">
              <Plus :size="18" :stroke-width="2" aria-hidden="true" />
            </button>
          </div>

          <div class="template-sidebar-main">
            <TransitionGroup name="template-list" tag="ul" class="template-list">
              <li
                v-for="template in templates"
                :key="template.id"
                class="template-item"
                :class="{ 'is-active': template.id === activeTemplateId }"
                :data-template-id="template.id"
              >
                <div
                  class="template-row"
                  :class="{ 'is-active': template.id === activeTemplateId }"
                >
                  <button
                    type="button"
                    class="template-select"
                    :class="{ 'is-active': template.id === activeTemplateId }"
                    :title="template.name"
                    @click="selectTemplate(template.id)"
                  >
                    {{ template.name }}
                  </button>
                  <button
                    type="button"
                    class="template-more"
                    :aria-label="`更多操作：${template.name}`"
                    :title="`更多操作：${template.name}`"
                    :aria-expanded="actionMenuId === template.id"
                    :aria-controls="
                      actionMenuId === template.id ? 'template-action-menu' : undefined
                    "
                    @click="toggleActionMenu(template, $event)"
                  >
                    <Ellipsis :size="18" :stroke-width="2" aria-hidden="true" />
                  </button>
                </div>
                <form
                  v-if="renamingId === template.id"
                  class="template-rename"
                  @submit.prevent="confirmRename(template.id)"
                >
                  <input
                    v-model="renameDraft"
                    type="text"
                    aria-label="模板名称"
                    maxlength="80"
                    @keydown.esc="cancelRename"
                  />
                  <div class="template-rename-actions">
                    <button type="button" @click="cancelRename">取消</button>
                    <button type="submit">保存</button>
                  </div>
                </form>
                <Transition name="template-delete-confirm">
                  <div
                    v-if="pendingDeleteId === template.id"
                    class="template-delete-confirm"
                    role="alertdialog"
                    :aria-label="`确认删除模板：${template.name}`"
                  >
                    <div class="template-delete-confirm-inner">
                      <div class="template-delete-confirm-surface">
                        <p>确定删除“{{ template.name }}”吗？此操作不可撤销。</p>
                        <div class="template-delete-actions">
                          <button type="button" @click="cancelDelete">取消</button>
                          <button
                            type="button"
                            class="danger"
                            aria-label="确认删除"
                            @click="confirmDelete(template.id)"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Transition>
              </li>
            </TransitionGroup>

            <div class="template-footer">
              <button
                type="button"
                aria-label="恢复默认示例"
                title="恢复默认示例"
                @click="emit('restore')"
              >
                <RotateCcw :size="16" :stroke-width="2" aria-hidden="true" />
                恢复默认示例
              </button>
            </div>
          </div>
        </div>
      </Transition>
      <button
        class="template-sidebar-toggle"
        type="button"
        :aria-label="props.open ? '关闭模板栏' : '打开模板栏'"
        :aria-expanded="props.open"
        :title="props.open ? '关闭模板栏' : '打开模板栏'"
        @click="toggleSidebar"
      >
        <PanelLeft :size="18" :stroke-width="2" aria-hidden="true" />
      </button>
    </div>
  </div>
  <Teleport to="body">
    <Transition name="template-action-menu">
      <div
        v-if="actionMenuTemplate"
        id="template-action-menu"
        ref="actionMenuElement"
        class="template-action-menu"
        role="group"
        :aria-label="`${actionMenuTemplate.name}的操作`"
        :style="actionMenuStyle"
      >
        <button
          type="button"
          :aria-label="`重命名模板：${actionMenuTemplate.name}`"
          :title="`重命名模板：${actionMenuTemplate.name}`"
          @click="beginRename(actionMenuTemplate)"
        >
          <Pencil :size="16" :stroke-width="2" aria-hidden="true" />
          重命名
        </button>
        <button
          type="button"
          :aria-label="`复制模板：${actionMenuTemplate.name}`"
          :title="`复制模板：${actionMenuTemplate.name}`"
          @click="duplicateTemplate(actionMenuTemplate.id)"
        >
          <Copy :size="16" :stroke-width="2" aria-hidden="true" />
          复制模板
        </button>
        <span class="template-action-menu-separator" aria-hidden="true"></span>
        <button
          type="button"
          class="danger"
          :aria-label="`删除模板：${actionMenuTemplate.name}`"
          :title="`删除模板：${actionMenuTemplate.name}`"
          @click="requestDelete(actionMenuTemplate.id)"
        >
          <Trash2 :size="16" :stroke-width="2" aria-hidden="true" />
          删除模板
        </button>
      </div>
    </Transition>
  </Teleport>
</template>
