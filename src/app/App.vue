<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Component } from 'vue'
import {
  ALargeSmall,
  AlignCenter,
  Bold,
  Check,
  CheckCircle2,
  Code2,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleHelp,
  EyeOff,
  Image,
  Italic,
  Link2,
  List,
  Music2,
  Moon,
  Palette,
  PanelLeft,
  Quote,
  Redo2,
  SquarePlay,
  Strikethrough,
  Underline,
  Undo2,
  X,
} from '@lucide/vue'
import githubMark from './assets/github-mark.svg'
import { EditorView, type ViewUpdate } from '@codemirror/view'
import type { PreviewResult } from '../bbcode/compatibility'
import { diagnoseDocument, type DiagnosticCode } from '../bbcode/diagnostics'
import {
  createEditorState,
  replaceEditorDocument,
  snapshotForView,
  tagAllowsValue,
} from '../editor'
import { wrapTag, undoCommand, redoCommand } from '../editor'
import { PreviewPane, createPreviewScheduler } from '../preview'
import {
  CopyButton,
  SaveStatus,
  TemplateDrawer,
  TemplateSidebar,
  useWorkspaceStore,
} from '../templates'
import { HelpPanel } from '../help'
import { THEMES } from '../templates/storage/types'
import SplashScreen from './SplashScreen.vue'

// GitHub 仓库标志的遮罩地址写进样式表，而不是用行内样式对象：
// Vue 解析含冒号的行内样式值时会把整个绑定丢掉，`url(data:…)` 正好会命中这一点。
const githubMarkStyleElement = document.createElement('style')
githubMarkStyleElement.textContent = `.header-action-icon[data-icon='github-mark']::before{mask-image:url("${githubMark}");-webkit-mask-image:url("${githubMark}");}`
document.head.append(githubMarkStyleElement)

const workspace = useWorkspaceStore()

const showSplash = ref(true)

const editorHost = ref<HTMLElement | null>(null)
const workspaceElement = ref<HTMLElement | null>(null)
const headerElement = ref<HTMLElement | null>(null)
const expandedHeaderHeight = ref(56)
const headerOpen = ref(true)
const themeDialogOpen = ref(false)
const themeButtonElement = ref<HTMLButtonElement | null>(null)
const themePopoverElement = ref<HTMLElement | null>(null)
const themePopoverStyle = ref<Record<string, string>>({})
const helpOpen = ref(false)
const helpButtonElement = ref<HTMLButtonElement | null>(null)
let editorView: EditorView | undefined
let headerResizeObserver: ResizeObserver | undefined
let workspaceResizeObserver: ResizeObserver | undefined
const workspaceWidth = ref(0)
const snapshot = ref({
  source: '',
  line: 1,
  column: 1,
  characterCount: 0,
  lineCount: 1,
  diagnostics: diagnoseDocument(''),
})
const showDiagnostics = ref(false)
const activeDiagnosticKey = ref<string | null>(null)
const diagnostics = computed(() => snapshot.value.diagnostics)
const diagnosticTypeLabels: Record<DiagnosticCode, string> = {
  INVALID_SYNTAX: '语法错误',
  UNKNOWN_TAG: '标签错误',
  UNOPENED_TAG: '标签错误',
  UNCLOSED_TAG: '标签错误',
  CROSSED_NESTING: '嵌套错误',
  INVALID_PARAMETER: '参数错误',
  PARAMETER_OUT_OF_RANGE: '参数错误',
  FORBIDDEN_NEWLINE: '内容错误',
  INVALID_CONTENT: '内容错误',
  INVALID_URL: '链接错误',
}
const previewResult = ref<PreviewResult | null>(null)
const previewStatus = ref<'idle' | 'rendering' | 'ready'>('idle')
const previewStatusText = computed(() => {
  if (previewStatus.value === 'rendering') return '渲染中...'
  if (previewStatus.value === 'ready') return '已更新'
  return '等待内容'
})
const activeTemplateName = computed(() => workspace.activeTemplate?.name ?? '未命名模板')
const templateWidth = ref(210)
const templateSidebarOpen = ref(true)
const mobileTemplateDrawerOpen = ref(false)
const templateColumnWidth = computed(() =>
  templateSidebarOpen.value ? Math.min(templateWidth.value, templateMaxWidth.value) : 48,
)
const layoutResizing = ref(false)
const editorWidth = ref(50)
const diagnosticsHeight = ref(140)
let resizing: { type: 'template' | 'editor' | 'diagnostics'; start: number; value: number } | null =
  null

const resizeHandleGap = 16
const desktopEditorMinPx = 240
const desktopPreviewMinPx = 280

function measuredWorkspaceWidth() {
  return workspaceWidth.value || workspaceElement.value?.clientWidth || window.innerWidth
}

function splitMetrics(templateColumn = templateColumnWidth.value) {
  const splitWidth = Math.max(0, measuredWorkspaceWidth() - templateColumn - resizeHandleGap)
  const editorMinPx =
    splitWidth >= desktopEditorMinPx + desktopPreviewMinPx
      ? desktopEditorMinPx
      : Math.max(180, Math.floor(splitWidth * 0.42))
  const previewMinPx =
    splitWidth >= desktopEditorMinPx + desktopPreviewMinPx
      ? desktopPreviewMinPx
      : Math.max(220, Math.floor(splitWidth * 0.42))
  const minEditorPercent = Math.max(30, (editorMinPx / Math.max(splitWidth, 1)) * 100)
  const maxEditorPercent = Math.min(
    70,
    ((splitWidth - previewMinPx) / Math.max(splitWidth, 1)) * 100,
  )
  return {
    splitWidth,
    editorMinPx,
    previewMinPx,
    minEditorPercent: Math.min(minEditorPercent, maxEditorPercent),
    maxEditorPercent: Math.max(minEditorPercent, maxEditorPercent),
  }
}

const editorTrackWidth = computed(() => {
  const metrics = splitMetrics()
  const percent = Math.min(
    metrics.maxEditorPercent,
    Math.max(metrics.minEditorPercent, editorWidth.value),
  )
  return Math.max(
    0,
    Math.min(metrics.splitWidth - metrics.previewMinPx, (metrics.splitWidth * percent) / 100),
  )
})

const templateMinWidth = 160
const templateMaxWidth = computed(() => {
  const metrics = splitMetrics(templateMinWidth)
  return Math.max(
    templateMinWidth,
    Math.min(
      360,
      measuredWorkspaceWidth() - resizeHandleGap - metrics.editorMinPx - metrics.previewMinPx,
    ),
  )
})

const editorMinPercent = computed(() => splitMetrics().minEditorPercent)
const editorMaxPercent = computed(() => splitMetrics().maxEditorPercent)

function updateWorkspaceMeasurement() {
  if (workspaceElement.value) workspaceWidth.value = workspaceElement.value.clientWidth
}
const previewScheduler = createPreviewScheduler({
  onState: (state) => {
    previewStatus.value = state.status
    previewResult.value = state.result
  },
})

watch(
  () => diagnostics.value.length,
  (count) => {
    if (count === 0) {
      showDiagnostics.value = false
      activeDiagnosticKey.value = null
    }
  },
)

// 主题只通过文档根上的 data-theme 生效：theme.css 里每个主题是一个
// [data-theme='…'] 块，切换主题不需要改任何组件。
watch(
  () => workspace.selectedThemeId,
  (id) => {
    if (id) document.documentElement.setAttribute('data-theme', id)
    else document.documentElement.removeAttribute('data-theme')
  },
  { immediate: true },
)

function handleEditorUpdate(update: ViewUpdate) {
  if (update.docChanged || update.selectionSet) {
    snapshot.value = snapshotForView(update.view)
  }
  if (update.docChanged) {
    const source = update.state.doc.toString()
    previewScheduler.schedule(source)
    workspace.updateActiveContent(source)
  }
}

function createEditorStateFor(doc: string) {
  return createEditorState(doc, handleEditorUpdate)
}

function replaceDocument(source: string) {
  if (!editorView) return
  replaceEditorDocument(editorView, source, handleEditorUpdate)
  snapshot.value = snapshotForView(editorView)
  previewScheduler.schedule(source)
  editorView.focus()
}

async function handleSelectTemplate(id: string) {
  if (id === workspace.activeTemplateId) {
    mobileTemplateDrawerOpen.value = false
    return
  }
  await workspace.selectTemplate(id)
  replaceDocument(workspace.activeTemplate?.content ?? '')
  mobileTemplateDrawerOpen.value = false
}

async function handleCreateTemplate() {
  await workspace.createTemplate()
  replaceDocument(workspace.activeTemplate?.content ?? '')
}

async function handleRenameTemplate(payload: { id: string; name: string }) {
  await workspace.renameTemplate(payload.id, payload.name)
}

async function handleDuplicateTemplate(id: string) {
  await workspace.duplicateTemplate(id)
  replaceDocument(workspace.activeTemplate?.content ?? '')
}

async function handleDeleteTemplate(id: string) {
  const wasActive = workspace.activeTemplateId === id
  await workspace.deleteTemplate(id)
  if (wasActive) replaceDocument(workspace.activeTemplate?.content ?? '')
}

async function handleRestoreExample() {
  await workspace.restoreDefaultExample()
  replaceDocument(workspace.activeTemplate?.content ?? '')
}

function flushPendingSave() {
  void workspace.flushPendingSave()
}

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') flushPendingSave()
}

function beginResize(type: 'template' | 'editor' | 'diagnostics', event: PointerEvent) {
  layoutResizing.value = true
  resizing = {
    type,
    start: type === 'diagnostics' ? event.clientY : event.clientX,
    value:
      type === 'template'
        ? templateColumnWidth.value
        : type === 'editor'
          ? editorWidth.value
          : diagnosticsHeight.value,
  }
  window.addEventListener('pointermove', resize)
  window.addEventListener('pointerup', endResize, { once: true })
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
}

function resize(event: PointerEvent) {
  if (!resizing) return
  const delta =
    resizing.type === 'diagnostics'
      ? resizing.start - event.clientY
      : event.clientX - resizing.start
  if (resizing.type === 'template') {
    templateWidth.value = Math.min(
      templateMaxWidth.value,
      Math.max(templateMinWidth, resizing.value + delta),
    )
  } else if (resizing.type === 'editor') {
    const metrics = splitMetrics()
    const next = resizing.value + (delta / Math.max(metrics.splitWidth, 1)) * 100
    editorWidth.value = Math.min(metrics.maxEditorPercent, Math.max(metrics.minEditorPercent, next))
  } else {
    const maxHeight = Math.max(240, Math.floor(window.innerHeight * 0.75))
    diagnosticsHeight.value = Math.min(maxHeight, Math.max(72, resizing.value + delta))
  }
}

function resizeByKeyboard(type: 'template' | 'editor' | 'diagnostics', event: KeyboardEvent) {
  const horizontalDirection = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
  const verticalDirection = event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0
  const direction = type === 'diagnostics' ? verticalDirection : horizontalDirection
  if (event.key !== 'Home' && event.key !== 'End' && direction === 0) return
  event.preventDefault()

  if (type === 'template') {
    const next =
      event.key === 'Home'
        ? templateMinWidth
        : event.key === 'End'
          ? templateMaxWidth.value
          : templateWidth.value + direction * 10
    templateWidth.value = Math.min(templateMaxWidth.value, Math.max(templateMinWidth, next))
    return
  }

  if (type === 'editor') {
    const metrics = splitMetrics()
    const next =
      event.key === 'Home'
        ? metrics.minEditorPercent
        : event.key === 'End'
          ? metrics.maxEditorPercent
          : editorWidth.value + direction
    editorWidth.value = Math.min(metrics.maxEditorPercent, Math.max(metrics.minEditorPercent, next))
    return
  }

  const maxHeight = Math.max(240, Math.floor(window.innerHeight * 0.75))
  const next =
    event.key === 'Home'
      ? 72
      : event.key === 'End'
        ? maxHeight
        : diagnosticsHeight.value + direction * 10
  diagnosticsHeight.value = Math.min(maxHeight, Math.max(72, next))
}

function endResize() {
  window.removeEventListener('pointermove', resize)
  resizing = null
  layoutResizing.value = false
}

// ---- 编辑器工具栏 ----
// 17 个动作只在这里定义一次，工具栏与「被裁按钮」浮层共用同一份来源，
// 避免两处各写一遍后出现漏项、顺序漂移或标签不一致（提案 §5.6）。
type ToolbarAction = {
  key: string
  label: string
  icon: Component
  run: (view: EditorView) => boolean
}

type ToolbarGroup = {
  key: string
  label: string
  actions: ToolbarAction[]
}

const toolbarGroups: ToolbarGroup[] = [
  {
    key: 'history',
    label: '历史操作',
    actions: [
      { key: 'undo', label: '撤销', icon: Undo2, run: (view) => undoCommand(view) },
      { key: 'redo', label: '重做', icon: Redo2, run: (view) => redoCommand(view) },
    ],
  },
  {
    key: 'format',
    label: '文字格式',
    actions: [
      { key: 'bold', label: '粗体', icon: Bold, run: (view) => wrapTag(view, 'b') },
      { key: 'italic', label: '斜体', icon: Italic, run: (view) => wrapTag(view, 'i') },
      { key: 'underline', label: '下划线', icon: Underline, run: (view) => wrapTag(view, 'u') },
      { key: 'strike', label: '删除线', icon: Strikethrough, run: (view) => wrapTag(view, 's') },
    ],
  },
  {
    key: 'style',
    label: '文字样式',
    actions: [
      {
        key: 'color',
        label: '文字颜色',
        icon: Palette,
        run: (view) => wrapTag(view, 'color', tagAllowsValue('color')),
      },
      {
        key: 'size',
        label: '字号',
        icon: ALargeSmall,
        run: (view) => wrapTag(view, 'size', tagAllowsValue('size')),
      },
    ],
  },
  {
    key: 'insert',
    label: '插入与布局',
    actions: [
      {
        key: 'link',
        label: '链接',
        icon: Link2,
        run: (view) => wrapTag(view, 'url', tagAllowsValue('url')),
      },
      { key: 'centre', label: '居中', icon: AlignCenter, run: (view) => wrapTag(view, 'centre') },
    ],
  },
  {
    key: 'media',
    label: '媒体',
    actions: [
      { key: 'image', label: '图片', icon: Image, run: (view) => wrapTag(view, 'img') },
      {
        key: 'youtube',
        label: 'YouTube 视频',
        icon: SquarePlay,
        run: (view) => wrapTag(view, 'youtube'),
      },
      { key: 'audio', label: '音频', icon: Music2, run: (view) => wrapTag(view, 'audio') },
    ],
  },
  {
    key: 'structure',
    label: '结构',
    actions: [
      { key: 'code', label: '代码块', icon: Code2, run: (view) => wrapTag(view, 'code') },
      {
        key: 'quote',
        label: '引用',
        icon: Quote,
        run: (view) => wrapTag(view, 'quote', tagAllowsValue('quote')),
      },
      {
        key: 'list',
        label: '列表',
        icon: List,
        run: (view) => wrapTag(view, 'list', tagAllowsValue('list')),
      },
      {
        key: 'spoilerbox',
        label: '剧透框',
        icon: EyeOff,
        run: (view) => wrapTag(view, 'spoilerbox'),
      },
    ],
  },
]

const toolbarElement = ref<HTMLElement | null>(null)
const toolbarMoreButtonElement = ref<HTMLButtonElement | null>(null)
const toolbarMoreElement = ref<HTMLElement | null>(null)
const toolbarMoreStyle = ref<Record<string, string>>({})
const toolbarOverflowing = ref(false)
const toolbarAtEnd = ref(false)
const toolbarClippedKeys = ref<string[]>([])
// 浮层内容在打开时冻结：横滚会让「被裁集合」逐帧变化，若直接跟随，
// 用户正在读的条目会中途消失。
const toolbarMoreKeys = ref<string[]>([])
const toolbarMoreOpen = ref(false)
let toolbarResizeObserver: ResizeObserver | undefined

// 遮罩宽 24px，落在它下面的按钮既读不到也点不到，按被裁处理。
const toolbarFadeWidth = 24
const toolbarMoreGap = 4

function clippedGroupsOf(keys: string[]): ToolbarGroup[] {
  if (!keys.length) return []
  return toolbarGroups
    .map((group) => ({
      ...group,
      actions: group.actions.filter((action) => keys.includes(action.key)),
    }))
    .filter((group) => group.actions.length > 0)
}

const toolbarMoreGroups = computed(() => clippedGroupsOf(toolbarMoreKeys.value))

function measureToolbarOverflow() {
  const element = toolbarElement.value
  if (!element) return
  const overflowing = element.scrollWidth > element.clientWidth + 1
  toolbarOverflowing.value = overflowing
  toolbarAtEnd.value = element.scrollLeft + element.clientWidth >= element.scrollWidth - 1
  if (!overflowing) {
    toolbarClippedKeys.value = []
    if (toolbarMoreOpen.value) closeToolbarMore(false)
    return
  }
  const bounds = element.getBoundingClientRect()
  const visibleRight = bounds.right - toolbarFadeWidth
  const clipped: string[] = []
  const buttons = element.querySelectorAll<HTMLElement>('.editor-toolbar-button[data-action]')
  buttons.forEach((button) => {
    const rect = button.getBoundingClientRect()
    // 左侧被卷出去的和右侧压在遮罩下的都算不可见。
    if (rect.left < bounds.left - 0.5 || rect.right > visibleRight + 0.5) {
      const key = button.dataset.action
      if (key) clipped.push(key)
    }
  })
  const previous = toolbarClippedKeys.value
  if (clipped.length === previous.length && clipped.every((key, index) => key === previous[index]))
    return
  toolbarClippedKeys.value = clipped
}

function updateToolbarMorePlacement() {
  const button = toolbarMoreButtonElement.value
  if (!button) return
  const rect = button.getBoundingClientRect()
  // 浮层对齐工具栏底边而不是按钮底边：按钮 24px 居中在 44px 的条里，
  // 按按钮底边定位会让浮层压住工具栏最后几像素。
  const shellBottom = button.parentElement?.getBoundingClientRect().bottom ?? rect.bottom
  toolbarMoreStyle.value = {
    '--toolbar-more-top': `${Math.max(rect.bottom, shellBottom) + toolbarMoreGap}px`,
    '--toolbar-more-right': `${Math.max(12, window.innerWidth - rect.right)}px`,
  }
}

function toolbarMoreItems() {
  return [...(toolbarMoreElement.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
}

function openToolbarMore() {
  if (!toolbarClippedKeys.value.length) return
  toolbarMoreKeys.value = [...toolbarClippedKeys.value]
  toolbarMoreOpen.value = true
  void nextTick(() => {
    updateToolbarMorePlacement()
    toolbarMoreItems()[0]?.focus()
  })
}

function closeToolbarMore(restoreFocus = true) {
  toolbarMoreOpen.value = false
  toolbarMoreKeys.value = []
  if (restoreFocus) requestAnimationFrame(() => toolbarMoreButtonElement.value?.focus())
}

function toggleToolbarMore() {
  if (toolbarMoreOpen.value) closeToolbarMore()
  else openToolbarMore()
}

function runToolbarAction(action: ToolbarAction) {
  if (editorView) action.run(editorView)
}

function runClippedToolbarAction(action: ToolbarAction) {
  // 不回焦溢出按钮：包裹类命令会主动把焦点交给编辑器，回焦会把它抢回来。
  // 撤销/重做这类不改焦点的命令会让焦点落到 body，这条兜底把焦点放回可见的触发点。
  closeToolbarMore(false)
  runToolbarAction(action)
  const active = document.activeElement
  if (!active || active === document.body) {
    requestAnimationFrame(() => toolbarMoreButtonElement.value?.focus())
  }
}

function moveToolbarMoreFocus(step: 1 | -1) {
  const items = toolbarMoreItems()
  if (!items.length) return
  const current = items.indexOf(document.activeElement as HTMLElement)
  const index = current < 0 ? 0 : (current + step + items.length) % items.length
  items[index].focus()
}

function handleToolbarMoreKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeToolbarMore()
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    moveToolbarMoreFocus(1)
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    moveToolbarMoreFocus(-1)
    return
  }
  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    const items = toolbarMoreItems()
    const target = event.key === 'Home' ? items[0] : items[items.length - 1]
    target?.focus()
  }
}

function toggleDiagnostics() {
  if (diagnostics.value.length === 0) return
  showDiagnostics.value = !showDiagnostics.value
}

function toggleTemplateSidebar() {
  templateSidebarOpen.value = !templateSidebarOpen.value
}

function openMobileTemplateDrawer() {
  mobileTemplateDrawerOpen.value = true
}

function closeMobileTemplateDrawer() {
  mobileTemplateDrawerOpen.value = false
}

function updateThemePopoverPlacement() {
  const button = themeButtonElement.value
  if (!button) return
  const right = Math.max(12, window.innerWidth - button.getBoundingClientRect().right)
  themePopoverStyle.value = {
    '--theme-popover-right': `${right}px`,
    '--theme-popover-top': `${expandedHeaderHeight.value + 8}px`,
  }
}

function openThemePicker() {
  themeDialogOpen.value = true
  void nextTick(() => {
    updateThemePopoverPlacement()
    // 焦点落在当前选中的主题上，而不是清单里的第一个：焦点环是强调色描边，
    // 落在未选中的选项上会让人误以为选中的就是它。只有一个主题时这个问题不会显现。
    // 取不到选中项时退回第一个，保证键盘仍能进入菜单。
    const inputs =
      themePopoverElement.value?.querySelectorAll<HTMLInputElement>('input[type="radio"]')
    if (!inputs?.length) return
    const selected = [...inputs].find((input) => input.checked) ?? inputs[0]
    selected.focus()
  })
}

function closeThemePicker(restoreFocus = true) {
  themeDialogOpen.value = false
  if (restoreFocus) requestAnimationFrame(() => themeButtonElement.value?.focus())
}

function toggleThemePicker() {
  if (themeDialogOpen.value) closeThemePicker()
  else openThemePicker()
}

function openHelp() {
  if (themeDialogOpen.value) closeThemePicker(false)
  helpOpen.value = true
}

function closeHelp(restoreFocus = true) {
  helpOpen.value = false
  if (restoreFocus) requestAnimationFrame(() => helpButtonElement.value?.focus())
}

function toggleHelp() {
  if (helpOpen.value) closeHelp()
  else openHelp()
}

// 文档级 pointerdown 同时服务于主题弹层与工具栏溢出浮层：两者都是点击外部关闭的浮层。
function handleDocumentPointerDown(event: PointerEvent) {
  const target = event.target as Node
  if (toolbarMoreOpen.value) {
    if (
      toolbarMoreButtonElement.value?.contains(target) ||
      toolbarMoreElement.value?.contains(target)
    )
      return
    closeToolbarMore(false)
  }
  if (!themeDialogOpen.value) return
  if (themeButtonElement.value?.contains(target) || themePopoverElement.value?.contains(target))
    return
  closeThemePicker(false)
}

function handleThemeKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && themeDialogOpen.value) {
    event.preventDefault()
    closeThemePicker()
    return
  }
  if (event.key === 'Escape' && helpOpen.value) {
    event.preventDefault()
    closeHelp()
  }
  if (event.key === 'Escape' && toolbarMoreOpen.value) {
    event.preventDefault()
    closeToolbarMore()
  }
}

function handleWindowResize() {
  updateThemePopoverPlacement()
  if (toolbarMoreOpen.value) updateToolbarMorePlacement()
}

function toggleHeader() {
  headerOpen.value = !headerOpen.value
  if (!headerOpen.value && themeDialogOpen.value) closeThemePicker(false)
}

// ---- 主题切换的圆揭示动画 ----
// 新配色以顶栏「主题」按钮为圆心向四周扩散，圆形覆盖到哪里、哪里才换色。
// 规则、时序约束与降级条件见 docs/theme.md §4。
// 过渡抑制类用计数管理：连续切换时最后一个结束才摘掉。
let themeRevealCount = 0

async function selectTheme(id: string) {
  if (id === workspace.selectedThemeId) return

  const rect = themeButtonElement.value?.getBoundingClientRect()
  const reduceMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const duration = workspace.themeRevealDuration

  // 降级：浏览器不支持该 API、低动态效果、时长为 0、拿不到触发按钮的位置。
  // 降级只影响动画，主题切换本身在任何情况下都必须正确生效。
  if (
    typeof document.startViewTransition !== 'function' ||
    !rect ||
    reduceMotion ||
    duration <= 0
  ) {
    await workspace.selectTheme(id)
    return
  }

  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height / 2
  // 半径取圆心到视口最远角的距离，保证圆最终完全覆盖视口
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  const root = document.documentElement
  root.style.setProperty('--theme-reveal-x', `${x}px`)
  root.style.setProperty('--theme-reveal-y', `${y}px`)
  root.style.setProperty('--theme-reveal-r', `${radius}px`)
  root.style.setProperty('--theme-reveal-duration', `${duration}ms`)

  // 抑制类必须早于写入 data-theme 生效，否则新快照会拍到"颜色过渡到一半"的状态。
  themeRevealCount += 1
  root.classList.add('is-theme-revealing')
  let released = false
  const release = () => {
    if (released) return
    released = true
    themeRevealCount -= 1
    if (themeRevealCount <= 0) {
      themeRevealCount = 0
      root.classList.remove('is-theme-revealing')
    }
  }
  // 兜底：该类用 !important 全局禁用过渡，一旦因异常路径没被摘掉，
  // 全站的悬停与面板动画都会永久失效。
  const fallbackTimer = window.setTimeout(release, duration + 500)

  const transition = document.startViewTransition(async () => {
    await workspace.selectTheme(id)
    await nextTick()
  })
  try {
    await transition.finished
  } catch {
    // 动画被跳过（例如期间又切了一次）时 finished 会 reject，忽略即可
  } finally {
    window.clearTimeout(fallbackTimer)
    release()
  }
}

onMounted(async () => {
  if (headerElement.value) {
    const measureHeader = () => {
      if (headerElement.value)
        expandedHeaderHeight.value = headerElement.value.getBoundingClientRect().height
      if (themeDialogOpen.value) updateThemePopoverPlacement()
    }
    measureHeader()
    if (typeof ResizeObserver !== 'undefined') {
      headerResizeObserver = new ResizeObserver(measureHeader)
      headerResizeObserver.observe(headerElement.value)
    }
  }
  if (workspaceElement.value) {
    updateWorkspaceMeasurement()
    if (typeof ResizeObserver !== 'undefined') {
      workspaceResizeObserver = new ResizeObserver(updateWorkspaceMeasurement)
      workspaceResizeObserver.observe(workspaceElement.value)
    }
  }
  if (toolbarElement.value) {
    measureToolbarOverflow()
    if (typeof ResizeObserver !== 'undefined') {
      toolbarResizeObserver = new ResizeObserver(measureToolbarOverflow)
      toolbarResizeObserver.observe(toolbarElement.value)
    }
  }
  const activeTemplate = await workspace.initialize()
  if (!editorHost.value) return

  editorView = new EditorView({
    state: createEditorStateFor(activeTemplate?.content ?? ''),
    parent: editorHost.value,
  })
  snapshot.value = snapshotForView(editorView)
  previewScheduler.schedule(editorView.state.doc.toString())
  document.addEventListener('visibilitychange', handleVisibilityChange)
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  window.addEventListener('keydown', handleThemeKeydown)
  window.addEventListener('resize', handleWindowResize)
  window.addEventListener('pagehide', flushPendingSave)
})

onUnmounted(() => {
  headerResizeObserver?.disconnect()
  workspaceResizeObserver?.disconnect()
  toolbarResizeObserver?.disconnect()
  document.documentElement.removeAttribute('data-theme')
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  window.removeEventListener('keydown', handleThemeKeydown)
  window.removeEventListener('resize', handleWindowResize)
  window.removeEventListener('pagehide', flushPendingSave)
  previewScheduler.dispose()
  workspace.dispose()
  editorView?.destroy()
})

function focusDiagnosticLine(item: (typeof diagnostics.value)[number]) {
  if (!editorView) return
  activeDiagnosticKey.value = `${item.from}-${item.code}`
  const line = editorView.state.doc.lineAt(item.from)
  editorView.dispatch({ selection: { anchor: line.to }, scrollIntoView: true })
  editorView.focus()
}

function diagnosticLocation(item: (typeof diagnostics.value)[number]) {
  return `第 ${item.line} 行，第 ${item.column} 列`
}
</script>

<template>
  <div
    class="app-shell"
    :style="{
      '--header-expanded-height': `${expandedHeaderHeight}px`,
      '--help-top': headerOpen ? `${expandedHeaderHeight}px` : '0px',
    }"
  >
    <div
      class="header-dock"
      :class="{ 'is-collapsed': !headerOpen }"
      :style="{ '--header-expanded-height': `${expandedHeaderHeight}px` }"
      :aria-hidden="mobileTemplateDrawerOpen"
      :inert="mobileTemplateDrawerOpen"
    >
      <div
        id="app-header-content"
        class="header-clip"
        :aria-hidden="!headerOpen"
        :inert="!headerOpen"
      >
        <header ref="headerElement" class="app-header">
          <div class="app-header-brand">
            <h1 class="visually-hidden">osu! BBCode Editor | Sinkode</h1>
            <a
              class="brand-link"
              href="https://osu.ppy.sh/users/21614712"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="在 osu! 打开 SINKA0 的主页（新标签页）"
              title="在 osu! 打开 SINKA0 的主页"
            >
              <span class="brand-symbol" aria-hidden="true"></span>
              <span class="brand-wordmark" aria-hidden="true"></span>
            </a>
          </div>
          <nav class="app-header-actions" aria-label="工作台入口">
            <span class="app-header-actions-divider" aria-hidden="true"></span>
            <!-- 项目仓库。 -->
            <a
              class="header-action header-action-icon"
              data-icon="github-mark"
              href="https://github.com/sinkaBot1/Sinka-osu-bbcode-editor-Sinkode"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="在 GitHub 打开项目仓库（新标签页）"
              title="在 GitHub 打开项目仓库"
            ></a>
            <button
              ref="helpButtonElement"
              class="header-action"
              type="button"
              :aria-label="helpOpen ? '关闭帮助' : '打开帮助'"
              title="BBCode 参考说明"
              aria-controls="help-panel"
              :aria-expanded="helpOpen"
              @click="toggleHelp"
            >
              <CircleHelp :size="16" :stroke-width="2" aria-hidden="true" />
              <span>帮助</span>
            </button>
            <button
              ref="themeButtonElement"
              class="header-action"
              type="button"
              aria-label="主题"
              title="选择主题"
              aria-haspopup="dialog"
              aria-controls="theme-popover"
              :aria-expanded="themeDialogOpen"
              @click="toggleThemePicker"
            >
              <Moon :size="16" :stroke-width="2" aria-hidden="true" />
              <span>主题</span>
            </button>
          </nav>
        </header>
      </div>
      <button
        class="header-toggle"
        type="button"
        :aria-label="headerOpen ? '收起头栏' : '展开头栏'"
        :title="headerOpen ? '收起头栏' : '展开头栏'"
        aria-controls="app-header-content"
        :aria-expanded="headerOpen"
        @click="toggleHeader"
      >
        <span class="header-toggle-tab" aria-hidden="true"></span>
        <ChevronUp :size="12" :stroke-width="2" aria-hidden="true" />
      </button>
    </div>

    <main
      ref="workspaceElement"
      class="workspace"
      :class="{ 'is-resizing': layoutResizing }"
      aria-label="BBCode 编辑工作区"
      :aria-hidden="mobileTemplateDrawerOpen"
      :inert="mobileTemplateDrawerOpen"
      :style="{
        '--template-width': `${templateColumnWidth}px`,
        '--editor-width': `${editorWidth}%`,
        '--editor-track': `${editorTrackWidth}px`,
      }"
    >
      <aside
        class="template-sidebar"
        :class="{ 'is-collapsed': !templateSidebarOpen }"
        aria-label="模板列表"
      >
        <TemplateSidebar
          :templates="workspace.templates"
          :active-template-id="workspace.activeTemplateId"
          :open="templateSidebarOpen"
          @toggle="toggleTemplateSidebar"
          @select="handleSelectTemplate"
          @create="handleCreateTemplate"
          @rename="handleRenameTemplate"
          @duplicate="handleDuplicateTemplate"
          @delete="handleDeleteTemplate"
          @restore="handleRestoreExample"
        />
      </aside>
      <div
        class="resize-handle resize-handle-vertical"
        role="separator"
        aria-label="调整模板栏宽度"
        aria-orientation="vertical"
        :aria-valuemin="templateMinWidth"
        :aria-valuemax="templateMaxWidth"
        :aria-valuenow="templateColumnWidth"
        tabindex="0"
        @pointerdown="beginResize('template', $event)"
        @keydown="resizeByKeyboard('template', $event)"
      ></div>

      <section class="editor-panel" aria-label="编辑器">
        <div class="panel-header">
          <span class="panel-title">{{ activeTemplateName }}</span>
          <div class="panel-header-actions">
            <button
              class="mobile-template-trigger"
              type="button"
              aria-label="打开模板抽屉"
              title="打开模板抽屉"
              :aria-expanded="mobileTemplateDrawerOpen"
              aria-controls="template-drawer-title"
              @click="openMobileTemplateDrawer"
            >
              <PanelLeft :size="16" :stroke-width="2" aria-hidden="true" />
            </button>
            <CopyButton :source="snapshot.source" />
          </div>
        </div>
        <div class="editor-toolbar-shell">
          <div
            ref="toolbarElement"
            class="editor-toolbar"
            aria-label="编辑工具栏"
            @scroll="measureToolbarOverflow"
          >
            <template v-for="(group, index) in toolbarGroups" :key="group.key">
              <span v-if="index > 0" class="editor-toolbar-divider" aria-hidden="true"></span>
              <div class="editor-toolbar-group" role="group" :aria-label="group.label">
                <button
                  v-for="action in group.actions"
                  :key="action.key"
                  :data-action="action.key"
                  class="editor-toolbar-button"
                  type="button"
                  :title="action.label"
                  :aria-label="action.label"
                  @click="runToolbarAction(action)"
                >
                  <component :is="action.icon" :size="17" :stroke-width="2" aria-hidden="true" />
                </button>
              </div>
            </template>
          </div>
          <!-- 裁切处给一层渐隐，滚到最右端时撤掉，避免右侧没内容还压着暗角。 -->
          <div
            v-if="toolbarOverflowing && !toolbarAtEnd"
            class="editor-toolbar-fade"
            aria-hidden="true"
          ></div>
          <button
            v-if="toolbarOverflowing"
            ref="toolbarMoreButtonElement"
            class="editor-toolbar-more"
            type="button"
            title="更多编辑操作"
            aria-label="更多编辑操作"
            aria-haspopup="menu"
            :aria-expanded="toolbarMoreOpen"
            @click="toggleToolbarMore"
          >
            <ChevronRight :size="14" :stroke-width="2" aria-hidden="true" />
          </button>
          <Transition name="editor-toolbar-more">
            <div
              v-if="toolbarMoreOpen"
              ref="toolbarMoreElement"
              class="editor-toolbar-more-menu"
              role="menu"
              aria-label="被裁掉的编辑操作"
              :style="toolbarMoreStyle"
              @keydown="handleToolbarMoreKeydown"
            >
              <div
                v-for="group in toolbarMoreGroups"
                :key="group.key"
                class="editor-toolbar-more-group"
              >
                <p class="editor-toolbar-more-title">{{ group.label }}</p>
                <button
                  v-for="action in group.actions"
                  :key="action.key"
                  class="editor-toolbar-more-item"
                  type="button"
                  role="menuitem"
                  :title="action.label"
                  @click="runClippedToolbarAction(action)"
                >
                  <component :is="action.icon" :size="17" :stroke-width="2" aria-hidden="true" />
                  <span>{{ action.label }}</span>
                </button>
              </div>
            </div>
          </Transition>
        </div>
        <div ref="editorHost" class="editor-host"></div>
        <Transition name="diagnostic-panel">
          <div
            v-if="showDiagnostics && diagnostics.length > 0"
            id="diagnostic-panel"
            class="diagnostic-panel"
          >
            <div class="diagnostic-panel-inner">
              <div
                class="resize-handle resize-handle-horizontal diagnostic-resizer"
                role="separator"
                aria-label="调整错误诊断高度"
                aria-orientation="horizontal"
                aria-valuemin="72"
                :aria-valuemax="
                  Math.max(
                    240,
                    Math.floor((typeof window === 'undefined' ? 800 : window.innerHeight) * 0.75),
                  )
                "
                :aria-valuenow="diagnosticsHeight"
                tabindex="0"
                @pointerdown="beginResize('diagnostics', $event)"
                @keydown="resizeByKeyboard('diagnostics', $event)"
              ></div>
              <div
                class="diagnostic-list"
                role="region"
                aria-label="错误详情"
                :style="{ height: `${diagnosticsHeight}px` }"
              >
                <button
                  v-for="item in diagnostics"
                  :key="`${item.from}-${item.code}`"
                  :class="[
                    'diagnostic-row',
                    { 'is-active': activeDiagnosticKey === `${item.from}-${item.code}` },
                  ]"
                  type="button"
                  :aria-label="`第 ${item.line} 行，第 ${item.column} 列：${item.message}`"
                  :aria-current="
                    activeDiagnosticKey === `${item.from}-${item.code}` ? 'location' : undefined
                  "
                  @click="focusDiagnosticLine(item)"
                >
                  <CircleAlert :size="16" :stroke-width="2" aria-hidden="true" />
                  <span class="diagnostic-location">{{ diagnosticLocation(item) }}</span>
                  <span class="diagnostic-message">
                    {{ item.message }}
                    <span class="diagnostic-type">{{ diagnosticTypeLabels[item.code] }}</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </Transition>
        <footer class="status-bar">
          <button
            :class="['diagnostic-count', { 'has-errors': diagnostics.length > 0 }]"
            type="button"
            :disabled="diagnostics.length === 0"
            :aria-expanded="showDiagnostics"
            aria-controls="diagnostic-panel"
            aria-live="polite"
            @click="toggleDiagnostics"
          >
            <CircleAlert
              v-if="diagnostics.length > 0"
              :size="15"
              :stroke-width="2"
              aria-hidden="true"
            />
            <CheckCircle2 v-else :size="15" :stroke-width="2" aria-hidden="true" />
            <span>{{ diagnostics.length ? `${diagnostics.length} 个问题` : '未发现问题' }}</span>
          </button>
          <SaveStatus :status="workspace.saveState" :text="workspace.saveStatusText" />
          <span class="render-status">{{ previewStatusText }}</span>
          <span>行 {{ snapshot.line }}，列 {{ snapshot.column }}</span>
          <span>{{ snapshot.characterCount }} 字符 · {{ snapshot.lineCount }} 行</span>
        </footer>
      </section>

      <div
        class="resize-handle resize-handle-vertical"
        role="separator"
        aria-label="调整编辑器和预览宽度"
        aria-orientation="vertical"
        :aria-valuemin="editorMinPercent"
        :aria-valuemax="editorMaxPercent"
        :aria-valuenow="Math.min(editorMaxPercent, Math.max(editorMinPercent, editorWidth))"
        tabindex="0"
        @pointerdown="beginResize('editor', $event)"
        @keydown="resizeByKeyboard('editor', $event)"
      ></div>

      <section class="preview-panel" aria-label="预览">
        <div class="panel-header">
          <span>预览</span>
          <span class="panel-status">{{ previewStatusText }}</span>
        </div>
        <div class="preview-canvas">
          <PreviewPane :result="previewResult" />
        </div>
      </section>
    </main>

    <HelpPanel id="help-panel" :open="helpOpen" @close="closeHelp" />

    <Transition name="theme-popover">
      <section
        v-if="themeDialogOpen"
        id="theme-popover"
        ref="themePopoverElement"
        class="theme-popover"
        role="dialog"
        aria-labelledby="theme-title"
        :style="themePopoverStyle"
      >
        <div class="section-heading">
          <h2 id="theme-title">选择主题</h2>
          <button
            class="theme-close"
            type="button"
            title="关闭"
            aria-label="关闭"
            @click="closeThemePicker()"
          >
            <X :size="16" :stroke-width="2" aria-hidden="true" />
          </button>
        </div>
        <div class="theme-options" role="radiogroup" aria-label="主题选项">
          <label
            v-for="theme in THEMES"
            :key="theme.id"
            class="theme-option"
            :class="{ 'is-selected': workspace.selectedThemeId === theme.id }"
          >
            <input
              class="visually-hidden"
              type="radio"
              name="workspace-theme"
              :value="theme.id"
              :checked="workspace.selectedThemeId === theme.id"
              @change="selectTheme(theme.id)"
            />
            <span class="theme-option-copy">
              <span class="theme-option-title">{{ theme.name }}</span>
              <span class="theme-option-description">{{ theme.description }}</span>
            </span>
            <!-- 色板带 data-theme-sample，从同名主题块取色，因此显示的是
                 该选项自己的配色，与当前生效主题无关（见 docs/theme.md §3）。 -->
            <span class="theme-preview" :data-theme-sample="theme.id" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </span>
            <Check class="theme-option-check" :size="16" :stroke-width="2.4" aria-hidden="true" />
          </label>
        </div>
        <p class="theme-note">主题会记住你的选择，下次打开自动恢复。</p>
      </section>
    </Transition>

    <TemplateDrawer
      :templates="workspace.templates"
      :active-template-id="workspace.activeTemplateId"
      :open="mobileTemplateDrawerOpen"
      @close="closeMobileTemplateDrawer"
      @select="handleSelectTemplate"
      @create="handleCreateTemplate"
      @rename="handleRenameTemplate"
      @duplicate="handleDuplicateTemplate"
      @delete="handleDeleteTemplate"
      @restore="handleRestoreExample"
    />

    <!-- 开场动画：done 事件触发后 v-if 摘掉组件，归还焦点与交互 -->
    <SplashScreen v-if="showSplash" @done="showSplash = false" />
  </div>
</template>
