<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  ALargeSmall,
  AlignCenter,
  Bold,
  Check,
  CheckCircle2,
  Code2,
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
import sinkodeSymbol from './assets/sinkode-symbol.png'
import sinkodeWordmark from './assets/sinkode-wordmark.png'
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
import { DEFAULT_THEME_ID } from '../templates/storage/types'

// GitHub 仓库标志的遮罩地址写进样式表，而不是用行内样式对象：
// Vue 解析含冒号的行内样式值时会把整个绑定丢掉，`url(data:…)` 正好会命中这一点。
const githubMarkStyleElement = document.createElement('style')
githubMarkStyleElement.textContent = `.header-action-icon[data-icon='github-mark']::before{mask-image:url("${githubMark}");-webkit-mask-image:url("${githubMark}");}`
document.head.append(githubMarkStyleElement)

const workspace = useWorkspaceStore()

const editorHost = ref<HTMLElement | null>(null)
const workspaceElement = ref<HTMLElement | null>(null)
const headerElement = ref<HTMLElement | null>(null)
const expandedHeaderHeight = ref(72)
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
    themePopoverElement.value?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus()
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

function handleThemePointerDown(event: PointerEvent) {
  if (!themeDialogOpen.value) return
  const target = event.target as Node
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
}

function toggleHeader() {
  headerOpen.value = !headerOpen.value
  if (!headerOpen.value && themeDialogOpen.value) closeThemePicker(false)
}

async function selectTheme(id: string) {
  await workspace.selectTheme(id)
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
  const activeTemplate = await workspace.initialize()
  if (!editorHost.value) return

  editorView = new EditorView({
    state: createEditorStateFor(activeTemplate?.content ?? ''),
    parent: editorHost.value,
  })
  snapshot.value = snapshotForView(editorView)
  previewScheduler.schedule(editorView.state.doc.toString())
  document.addEventListener('visibilitychange', handleVisibilityChange)
  document.addEventListener('pointerdown', handleThemePointerDown)
  window.addEventListener('keydown', handleThemeKeydown)
  window.addEventListener('resize', updateThemePopoverPlacement)
  window.addEventListener('pagehide', flushPendingSave)
})

onUnmounted(() => {
  headerResizeObserver?.disconnect()
  workspaceResizeObserver?.disconnect()
  document.documentElement.removeAttribute('data-theme')
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  document.removeEventListener('pointerdown', handleThemePointerDown)
  window.removeEventListener('keydown', handleThemeKeydown)
  window.removeEventListener('resize', updateThemePopoverPlacement)
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
              aria-label="在 osu! 打开 Sinkode 的主页（新标签页）"
              title="在 osu! 打开 Sinkode 的主页"
            >
              <img
                class="brand-symbol"
                :src="sinkodeSymbol"
                alt=""
                width="403"
                height="423"
                aria-hidden="true"
              />
              <img
                class="brand-wordmark"
                :src="sinkodeWordmark"
                alt=""
                width="813"
                height="156"
                aria-hidden="true"
              />
            </a>
          </div>
          <nav class="app-header-actions" aria-label="工作台入口">
            <span class="app-header-actions-divider" aria-hidden="true"></span>
            <a
              class="header-action header-action-icon"
              data-icon="github-mark"
              href="https://github.com/sinkaBot1/Sinka-osu-bbcode-editor"
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
              <CircleHelp :size="18" :stroke-width="2" aria-hidden="true" />
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
              <Moon :size="18" :stroke-width="2" aria-hidden="true" />
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
        <ChevronUp :size="18" :stroke-width="2" aria-hidden="true" />
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
              <PanelLeft :size="18" :stroke-width="2" aria-hidden="true" />
            </button>
            <CopyButton :source="snapshot.source" />
          </div>
        </div>
        <div class="editor-toolbar" aria-label="编辑工具栏">
          <div class="editor-toolbar-group" role="group" aria-label="历史操作">
            <button
              class="editor-toolbar-button"
              type="button"
              title="撤销"
              aria-label="撤销"
              @click="editorView && undoCommand(editorView)"
            >
              <Undo2 :size="18" :stroke-width="2" aria-hidden="true" />
            </button>
            <button
              class="editor-toolbar-button"
              type="button"
              title="重做"
              aria-label="重做"
              @click="editorView && redoCommand(editorView)"
            >
              <Redo2 :size="18" :stroke-width="2" aria-hidden="true" />
            </button>
          </div>
          <span class="editor-toolbar-divider" aria-hidden="true"></span>
          <div class="editor-toolbar-group" role="group" aria-label="文字格式">
            <button
              class="editor-toolbar-button"
              type="button"
              title="粗体"
              aria-label="粗体"
              @click="editorView && wrapTag(editorView, 'b')"
            >
              <Bold :size="18" :stroke-width="2" aria-hidden="true" />
            </button>
            <button
              class="editor-toolbar-button"
              type="button"
              title="斜体"
              aria-label="斜体"
              @click="editorView && wrapTag(editorView, 'i')"
            >
              <Italic :size="18" :stroke-width="2" aria-hidden="true" />
            </button>
            <button
              class="editor-toolbar-button"
              type="button"
              title="下划线"
              aria-label="下划线"
              @click="editorView && wrapTag(editorView, 'u')"
            >
              <Underline :size="18" :stroke-width="2" aria-hidden="true" />
            </button>
            <button
              class="editor-toolbar-button"
              type="button"
              title="删除线"
              aria-label="删除线"
              @click="editorView && wrapTag(editorView, 's')"
            >
              <Strikethrough :size="18" :stroke-width="2" aria-hidden="true" />
            </button>
          </div>
          <span class="editor-toolbar-divider" aria-hidden="true"></span>
          <div class="editor-toolbar-group" role="group" aria-label="文字样式">
            <button
              class="editor-toolbar-button"
              type="button"
              title="文字颜色"
              aria-label="文字颜色"
              @click="editorView && wrapTag(editorView, 'color', tagAllowsValue('color'))"
            >
              <Palette :size="18" :stroke-width="2" aria-hidden="true" />
            </button>
            <button
              class="editor-toolbar-button"
              type="button"
              title="字号"
              aria-label="字号"
              @click="editorView && wrapTag(editorView, 'size', tagAllowsValue('size'))"
            >
              <ALargeSmall :size="18" :stroke-width="2" aria-hidden="true" />
            </button>
          </div>
          <span class="editor-toolbar-divider" aria-hidden="true"></span>
          <div class="editor-toolbar-group" role="group" aria-label="插入与布局">
            <button
              class="editor-toolbar-button"
              type="button"
              title="链接"
              aria-label="链接"
              @click="editorView && wrapTag(editorView, 'url', tagAllowsValue('url'))"
            >
              <Link2 :size="18" :stroke-width="2" aria-hidden="true" />
            </button>
            <button
              class="editor-toolbar-button"
              type="button"
              title="居中"
              aria-label="居中"
              @click="editorView && wrapTag(editorView, 'centre')"
            >
              <AlignCenter :size="18" :stroke-width="2" aria-hidden="true" />
            </button>
          </div>
          <span class="editor-toolbar-divider" aria-hidden="true"></span>
          <div class="editor-toolbar-group" role="group" aria-label="媒体">
            <button
              class="editor-toolbar-button"
              type="button"
              title="图片"
              aria-label="图片"
              @click="editorView && wrapTag(editorView, 'img')"
            >
              <Image :size="18" :stroke-width="2" aria-hidden="true" />
            </button>
            <button
              class="editor-toolbar-button"
              type="button"
              title="YouTube 视频"
              aria-label="YouTube 视频"
              @click="editorView && wrapTag(editorView, 'youtube')"
            >
              <SquarePlay :size="18" :stroke-width="2" aria-hidden="true" />
            </button>
            <button
              class="editor-toolbar-button"
              type="button"
              title="音频"
              aria-label="音频"
              @click="editorView && wrapTag(editorView, 'audio')"
            >
              <Music2 :size="18" :stroke-width="2" aria-hidden="true" />
            </button>
          </div>
          <span class="editor-toolbar-divider" aria-hidden="true"></span>
          <div class="editor-toolbar-group" role="group" aria-label="结构">
            <button
              class="editor-toolbar-button"
              type="button"
              title="代码块"
              aria-label="代码块"
              @click="editorView && wrapTag(editorView, 'code')"
            >
              <Code2 :size="18" :stroke-width="2" aria-hidden="true" />
            </button>
            <button
              class="editor-toolbar-button"
              type="button"
              title="引用"
              aria-label="引用"
              @click="editorView && wrapTag(editorView, 'quote', tagAllowsValue('quote'))"
            >
              <Quote :size="18" :stroke-width="2" aria-hidden="true" />
            </button>
            <button
              class="editor-toolbar-button"
              type="button"
              title="列表"
              aria-label="列表"
              @click="editorView && wrapTag(editorView, 'list', tagAllowsValue('list'))"
            >
              <List :size="18" :stroke-width="2" aria-hidden="true" />
            </button>
            <button
              class="editor-toolbar-button"
              type="button"
              title="剧透框"
              aria-label="剧透框"
              @click="editorView && wrapTag(editorView, 'spoilerbox')"
            >
              <EyeOff :size="18" :stroke-width="2" aria-hidden="true" />
            </button>
          </div>
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
            class="theme-option"
            :class="{ 'is-selected': workspace.selectedThemeId === DEFAULT_THEME_ID }"
          >
            <input
              class="visually-hidden"
              type="radio"
              name="workspace-theme"
              :value="DEFAULT_THEME_ID"
              :checked="workspace.selectedThemeId === DEFAULT_THEME_ID"
              @change="selectTheme(DEFAULT_THEME_ID)"
            />
            <span class="theme-option-copy">
              <span class="theme-option-title">Darkode</span>
              <span class="theme-option-description">深色主题：编辑器、预览与工作台统一配色</span>
            </span>
            <span class="theme-preview" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </span>
            <Check class="theme-option-check" :size="17" :stroke-width="2.4" aria-hidden="true" />
          </label>
        </div>
        <p class="theme-note">更多主题将在后续版本提供。</p>
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
  </div>
</template>
