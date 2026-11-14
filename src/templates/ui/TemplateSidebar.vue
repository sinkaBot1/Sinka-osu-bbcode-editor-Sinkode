<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  Check,
  Copy,
  Ellipsis,
  ListChecks,
  PanelLeft,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from '@lucide/vue'
import type { TemplateRecord } from '../storage/types'

const props = withDefaults(
  defineProps<{
    templates: readonly TemplateRecord[]
    activeTemplateId: string | null
    open?: boolean
    /** 批量删除必须回传成功与否：确认步骤据此决定退出还是留在原处重试。 */
    deleteTemplates: (ids: readonly string[]) => Promise<boolean>
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

/** 模板栏的三态：普通、批量选择、确认删除。 */
type SidebarMode = 'browse' | 'select' | 'confirm'

const mode = ref<SidebarMode>('browse')
const selectedIds = ref<string[]>([])
const deleting = ref(false)
const deleteFailed = ref(false)
const announcement = ref('')

const renamingId = ref<string | null>(null)
const renameDraft = ref('')
const pendingDeleteId = ref<string | null>(null)
const actionMenuId = ref<string | null>(null)
const sidebarContentElement = ref<HTMLElement | null>(null)
const actionMenuElement = ref<HTMLElement | null>(null)
const actionMenuTrigger = ref<HTMLButtonElement | null>(null)
const actionMenuStyle = ref<Record<string, string>>({})
const batchButton = ref<HTMLButtonElement | null>(null)
const cancelButton = ref<HTMLButtonElement | null>(null)
const selectDeleteButton = ref<HTMLButtonElement | null>(null)
const confirmDeleteButton = ref<HTMLButtonElement | null>(null)
const actionMenuTemplate = computed(() =>
  props.templates.find((template) => template.id === actionMenuId.value),
)

const selectedCount = computed(() => selectedIds.value.length)
const isBatching = computed(() => mode.value !== 'browse')
const selectedTemplates = computed(() =>
  props.templates.filter((template) => selectedIds.value.includes(template.id)),
)
/** 确认态只列所选、按原顺序；其余两态列全部模板。 */
const visibleTemplates = computed(() =>
  mode.value === 'confirm' ? selectedTemplates.value : props.templates,
)
const allSelected = computed(
  () => props.templates.length > 0 && selectedCount.value === props.templates.length,
)
const cancelLabel = computed(() => (mode.value === 'confirm' ? '返回选择列表' : '取消批量选择'))
const selectAllLabel = computed(() => (allSelected.value ? '取消全选' : '全选'))

function isSelected(id: string) {
  return selectedIds.value.includes(id)
}

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

function focusInSidebar(selector: string) {
  void nextTick(() =>
    sidebarContentElement.value?.querySelector<HTMLButtonElement>(selector)?.focus(),
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

/** 侧栏收起或抽屉关闭时回到普通态：选择不跨会话保留。 */
function resetBatchState() {
  mode.value = 'browse'
  selectedIds.value = []
  deleting.value = false
  deleteFailed.value = false
  announcement.value = ''
}

function enterSelectMode() {
  closeActionMenu()
  renamingId.value = null
  pendingDeleteId.value = null
  selectedIds.value = []
  deleteFailed.value = false
  mode.value = 'select'
  announcement.value = '批量选择模式，已选择 0 个模板'
  focusInSidebar('.template-check-row')
}

function toggleTemplateSelection(id: string) {
  if (deleting.value) return
  selectedIds.value = isSelected(id)
    ? selectedIds.value.filter((item) => item !== id)
    : [...selectedIds.value, id]
}

function toggleSelectAll() {
  if (deleting.value) return
  selectedIds.value = allSelected.value ? [] : props.templates.map((template) => template.id)
  deleteFailed.value = false
}

/** 确认态列表要滚回顶部：所选可能在原列表里散得很开。 */
function scrollListToTop() {
  let node: HTMLElement | null =
    sidebarContentElement.value?.querySelector<HTMLElement>('.template-list') ?? null
  while (node) {
    const overflowY = getComputedStyle(node).overflowY
    if (overflowY === 'auto' || overflowY === 'scroll') {
      node.scrollTop = 0
      return
    }
    node = node.parentElement
  }
}

function requestConfirmDelete() {
  if (selectedCount.value === 0 || deleting.value) return
  deleteFailed.value = false
  mode.value = 'confirm'
  announcement.value = `确认删除 ${selectedCount.value} 个模板`
  void nextTick(() => {
    scrollListToTop()
    cancelButton.value?.focus()
  })
}

function cancelConfirm() {
  if (deleting.value) return
  deleteFailed.value = false
  mode.value = 'select'
  void nextTick(() => selectDeleteButton.value?.focus())
}

function exitSelectMode() {
  if (deleting.value) return
  mode.value = 'browse'
  selectedIds.value = []
  deleteFailed.value = false
  void nextTick(() => batchButton.value?.focus())
}

function handleCancel() {
  if (mode.value === 'confirm') cancelConfirm()
  else exitSelectMode()
}

async function confirmBatchDelete() {
  if (deleting.value || selectedCount.value === 0) return
  const ids = [...selectedIds.value]
  const count = ids.length
  deleting.value = true
  deleteFailed.value = false
  let deleted = false
  try {
    deleted = await props.deleteTemplates(ids)
  } catch {
    deleted = false
  }
  deleting.value = false
  if (!deleted) {
    // 失败留在确认态：勾选与列表不动，按钮重新可用后原地重试。
    deleteFailed.value = true
    void nextTick(() => confirmDeleteButton.value?.focus())
    return
  }
  mode.value = 'browse'
  selectedIds.value = []
  announcement.value = `已删除 ${count} 个模板`
  void nextTick(() => batchButton.value?.focus())
}

/**
 * Esc 分层：确认 → 选择 → 普通。返回 true 表示这次 Esc 被批量流程消费，
 * 由调用方拦住冒泡，窄屏抽屉因此不会同时关闭。
 */
function handleEscape(): boolean {
  if (mode.value === 'browse') return false
  if (deleting.value) return true
  if (mode.value === 'confirm') cancelConfirm()
  else exitSelectMode()
  return true
}

function handleEscapeKeydown(event: KeyboardEvent) {
  if (!handleEscape()) return
  event.stopPropagation()
  event.preventDefault()
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
    // 模板被删除后，勾选里不能留下已不存在的 id（例如从其它入口单删）。
    const liveIds = props.templates.map((template) => template.id)
    if (selectedIds.value.some((id) => !liveIds.includes(id))) {
      selectedIds.value = selectedIds.value.filter((id) => liveIds.includes(id))
    }
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
    if (!open) {
      closeActionMenu()
      resetBatchState()
    }
  },
)
</script>

<template>
  <div
    ref="sidebarContentElement"
    class="template-sidebar-content"
    @keydown.esc="handleEscapeKeydown"
  >
    <div class="template-sidebar-layout">
      <Transition name="template-sidebar-panel">
        <div v-if="props.open" class="template-sidebar-panel" :class="{ 'is-batch': isBatching }">
          <div class="section-heading">
            <h2 v-if="mode === 'browse'">
              模板<span class="template-sidebar-count">{{ templates.length }}</span>
            </h2>
            <h2 v-else-if="mode === 'select'">
              已选 <span class="template-sidebar-count">{{ selectedCount }}</span> 项
            </h2>
            <h2 v-else>确认删除</h2>
            <div class="section-heading-actions">
              <template v-if="mode === 'browse'">
                <button
                  ref="batchButton"
                  type="button"
                  class="template-batch"
                  aria-label="批量选择模板"
                  title="批量选择模板"
                  @click="enterSelectMode"
                >
                  <ListChecks :size="15" :stroke-width="2" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="新建模板"
                  title="新建模板"
                  @click="emit('create')"
                >
                  <Plus :size="15" :stroke-width="2" aria-hidden="true" />
                </button>
              </template>
              <button
                v-else
                ref="cancelButton"
                type="button"
                class="template-cancel"
                :aria-label="cancelLabel"
                :title="cancelLabel"
                @click="handleCancel"
              >
                取消
              </button>
            </div>
          </div>

          <p class="visually-hidden" role="status">{{ announcement }}</p>

          <!-- 按状态换 key：切换三态时整块重挂载，由 CSS 播放一次 120ms 淡入。
               不做整块淡出，焦点与“滚到顶部”都在同一帧落到新节点上。 -->
          <div :key="mode" class="template-sidebar-main">
            <TransitionGroup name="template-list" tag="ul" class="template-list">
              <li
                v-for="template in visibleTemplates"
                :key="template.id"
                class="template-item"
                :class="{
                  'is-active': template.id === activeTemplateId,
                  'is-selected': mode === 'select' && isSelected(template.id),
                }"
                :data-template-id="template.id"
              >
                <template v-if="mode === 'browse'">
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
                      <Ellipsis :size="15" :stroke-width="2" aria-hidden="true" />
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
                </template>
                <div
                  v-else-if="mode === 'select'"
                  class="template-row template-row--batch"
                  :class="{
                    'is-active': template.id === activeTemplateId,
                    'is-selected': isSelected(template.id),
                  }"
                >
                  <button
                    type="button"
                    class="template-check-row"
                    role="checkbox"
                    :aria-checked="isSelected(template.id)"
                    :aria-label="`模板：${template.name}，${isSelected(template.id) ? '已选' : '未选'}`"
                    :title="template.name"
                    @click="toggleTemplateSelection(template.id)"
                  >
                    <span
                      class="template-check"
                      :class="{ 'is-checked': isSelected(template.id) }"
                      aria-hidden="true"
                    >
                      <Check v-if="isSelected(template.id)" :size="11" :stroke-width="3" />
                    </span>
                    <span class="template-check-name">{{ template.name }}</span>
                  </button>
                </div>
                <div
                  v-else
                  class="template-row template-row--batch template-row--static"
                  :class="{ 'is-active': template.id === activeTemplateId }"
                >
                  <span class="template-check is-checked" aria-hidden="true">
                    <Check :size="11" :stroke-width="3" />
                  </span>
                  <span class="template-check-name">{{ template.name }}</span>
                </div>
              </li>
            </TransitionGroup>

            <div
              class="template-footer"
              :class="{
                'template-footer--select': mode === 'select',
                'template-footer--confirm': mode === 'confirm',
              }"
            >
              <button
                v-if="mode === 'browse'"
                type="button"
                aria-label="恢复默认示例"
                title="恢复默认示例"
                @click="emit('restore')"
              >
                <RotateCcw :size="15" :stroke-width="2" aria-hidden="true" />
                恢复默认示例
              </button>
              <template v-else-if="mode === 'select'">
                <button type="button" class="template-batch-all" @click="toggleSelectAll">
                  {{ selectAllLabel }}
                </button>
                <button
                  ref="selectDeleteButton"
                  type="button"
                  class="template-batch-delete"
                  :disabled="selectedCount === 0 || deleting"
                  :aria-label="`删除 ${selectedCount} 个模板`"
                  @click="requestConfirmDelete"
                >
                  删除 {{ selectedCount }} 项
                </button>
              </template>
              <template v-else>
                <p v-if="deleteFailed" class="template-confirm-error" role="alert">
                  删除失败，请重试
                </p>
                <p v-else class="template-confirm-warning">此操作不可撤销。</p>
                <button
                  ref="confirmDeleteButton"
                  type="button"
                  class="template-batch-delete template-batch-delete--wide"
                  :disabled="deleting"
                  :aria-label="`删除 ${selectedCount} 个模板`"
                  @click="confirmBatchDelete"
                >
                  <Trash2 :size="15" :stroke-width="2" aria-hidden="true" />
                  删除 {{ selectedCount }} 项
                </button>
              </template>
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
        <PanelLeft :size="15" :stroke-width="2" aria-hidden="true" />
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
          <Pencil :size="15" :stroke-width="2" aria-hidden="true" />
          重命名
        </button>
        <button
          type="button"
          :aria-label="`复制模板：${actionMenuTemplate.name}`"
          :title="`复制模板：${actionMenuTemplate.name}`"
          @click="duplicateTemplate(actionMenuTemplate.id)"
        >
          <Copy :size="15" :stroke-width="2" aria-hidden="true" />
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
          <Trash2 :size="15" :stroke-width="2" aria-hidden="true" />
          删除模板
        </button>
      </div>
    </Transition>
  </Teleport>
</template>
