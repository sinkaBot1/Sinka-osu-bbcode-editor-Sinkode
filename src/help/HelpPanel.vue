<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Check, ChevronRight, CircleAlert, Copy, Search, X } from '@lucide/vue'
import { helpCategories, helpEntries, type HelpCategory } from './helpContent'
import HelpExample from './HelpExample.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const panelElement = ref<HTMLElement | null>(null)
const searchElement = ref<HTMLInputElement | null>(null)
const searchTerm = ref('')
const activeCategory = ref<HelpCategory>('全部')
const activeTag = ref<string | null>(null)
const copyFeedback = ref<'success' | 'failure' | null>(null)
let copyTimer: ReturnType<typeof setTimeout> | undefined

const filteredEntries = computed(() => {
  const query = searchTerm.value.trim().toLocaleLowerCase()
  return helpEntries.filter((entry) => {
    const categoryMatches =
      activeCategory.value === '全部' || entry.category === activeCategory.value
    const searchText = [
      entry.name,
      entry.description,
      entry.category,
      entry.syntax,
      entry.notes,
      entry.commonErrors,
      ...entry.aliases,
      ...entry.keywords,
    ]
      .join(' ')
      .toLocaleLowerCase()
    return categoryMatches && (!query || searchText.includes(query))
  })
})

const activeEntry = computed(() => {
  return filteredEntries.value.find((entry) => entry.name === activeTag.value) ?? null
})

function parameterSummary(entry: (typeof helpEntries)[number]) {
  const name = entry.name
  switch (entry.parameterRequirement) {
    case 'required':
      return `需要参数，请写成 [${name}=参数]；参数的具体格式见下方说明。`
    case 'optional':
      return `参数可选，可以写成 [${name}=参数]；省略时使用该标签的默认行为。`
    default:
      return `不接受参数，请直接使用 [${name}] 内容 [/${name}] 的写法。`
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    searchTerm.value = ''
    activeCategory.value = '全部'
    activeTag.value = null
    resetCopyFeedback()
    void nextTick(() => searchElement.value?.focus())
  },
)

watch(filteredEntries, (entries) => {
  if (activeTag.value !== null && !entries.some((entry) => entry.name === activeTag.value)) {
    activeTag.value = null
  }
})

watch(activeTag, resetCopyFeedback)

function resetCopyFeedback() {
  if (copyTimer !== undefined) clearTimeout(copyTimer)
  copyFeedback.value = null
}

function closePanel() {
  emit('close')
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    closePanel()
  }
}

function setCategory(category: HelpCategory) {
  activeCategory.value = category
}

function selectTag(name: string) {
  activeTag.value = activeTag.value === name ? null : name
}

function showCopyFeedback(kind: 'success' | 'failure') {
  copyFeedback.value = kind
  if (copyTimer !== undefined) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => {
    copyFeedback.value = null
  }, 2000)
}

async function copyExample() {
  const entry = activeEntry.value
  const clipboard = globalThis.navigator?.clipboard
  if (!entry || !clipboard || typeof clipboard.writeText !== 'function') {
    showCopyFeedback('failure')
    return
  }
  try {
    await clipboard.writeText(entry.syntax)
    if (activeEntry.value?.name === entry.name) showCopyFeedback('success')
  } catch {
    if (activeEntry.value?.name === entry.name) showCopyFeedback('failure')
  }
}

onBeforeUnmount(() => {
  if (copyTimer !== undefined) clearTimeout(copyTimer)
})
</script>

<template>
  <Transition name="help-panel">
    <aside
      v-if="open"
      ref="panelElement"
      class="help-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="help-panel-title"
      @keydown="handleKeydown"
    >
      <header class="help-panel-header">
        <div class="help-panel-heading">
          <h2 id="help-panel-title">BBCode 参考</h2>
        </div>
        <button
          class="help-panel-close"
          type="button"
          title="关闭帮助"
          aria-label="关闭帮助"
          @click="closePanel"
        >
          <X :size="16" :stroke-width="2" aria-hidden="true" />
        </button>
      </header>

      <div class="help-panel-toolbar">
        <label class="help-panel-search">
          <Search :size="16" :stroke-width="2" aria-hidden="true" />
          <span class="visually-hidden">搜索帮助内容</span>
          <input
            ref="searchElement"
            v-model="searchTerm"
            type="search"
            placeholder="搜索标签、用途或错误"
            aria-label="搜索帮助内容"
          />
        </label>
        <div class="help-panel-filters" role="tablist" aria-label="帮助分类">
          <button
            v-for="category in helpCategories"
            :key="category"
            class="help-panel-filter"
            :class="{ 'is-active': activeCategory === category }"
            type="button"
            role="tab"
            :aria-selected="activeCategory === category"
            @click="setCategory(category)"
          >
            {{ category }}
          </button>
        </div>
      </div>

      <div class="help-panel-scroll">
        <div class="help-panel-note">
          <strong>参考说明</strong>
          <p>点击标签查看语法、效果和常见错误；当前原文的问题由诊断区指出。</p>
        </div>

        <div class="help-panel-section-heading">
          <h3>标签</h3>
          <span>{{ filteredEntries.length }} / {{ helpEntries.length }}</span>
        </div>

        <ul v-if="filteredEntries.length > 0" class="help-panel-list">
          <li v-for="entry in filteredEntries" :key="entry.name" class="help-panel-item">
            <button
              :id="`help-entry-${entry.name}`"
              class="help-panel-entry"
              :class="{ 'is-active': activeTag === entry.name }"
              type="button"
              :aria-expanded="activeTag === entry.name"
              :aria-controls="`help-detail-${entry.name}`"
              @click="selectTag(entry.name)"
            >
              <code>[{{ entry.name }}]</code>
              <span class="help-panel-entry-copy">
                <strong>{{ entry.description }}</strong>
                <span>{{ entry.notes }}</span>
              </span>
              <ChevronRight :size="15" :stroke-width="2" aria-hidden="true" />
            </button>

            <Transition
              name="help-detail"
              @before-leave="(element) => element.setAttribute('inert', '')"
            >
              <div
                v-if="activeTag === entry.name"
                :id="`help-detail-${entry.name}`"
                class="help-panel-detail-collapse"
                role="region"
                :aria-labelledby="`help-entry-${entry.name}`"
              >
                <div class="help-panel-detail-clip">
                  <article class="help-panel-detail">
                    <div class="help-panel-detail-heading">
                      <div>
                        <code>[{{ entry.name }}]</code>
                        <h3>{{ entry.description }}</h3>
                      </div>
                      <span>{{ entry.category }}</span>
                    </div>
                    <p class="help-panel-description">{{ entry.notes }}</p>

                    <template v-if="entry.aliases.length > 0">
                      <span class="help-panel-label">兼容别名</span>
                      <p class="help-panel-aliases">{{ entry.aliases.join('、') }}</p>
                    </template>

                    <span class="help-panel-label">参数与限制</span>
                    <p class="help-panel-parameters">{{ parameterSummary(entry) }}</p>

                    <span class="help-panel-label">写法</span>
                    <pre class="help-panel-syntax"><code>{{ entry.syntax }}</code></pre>

                    <span class="help-panel-label">效果示意</span>
                    <HelpExample :source="entry.syntax" />

                    <span class="help-panel-label">常见错误</span>
                    <p class="help-panel-error">
                      <CircleAlert :size="15" :stroke-width="2" aria-hidden="true" />
                      <span>{{ entry.commonErrors }}</span>
                    </p>

                    <div class="help-panel-copy">
                      <button type="button" @click="copyExample">
                        <Check
                          v-if="copyFeedback === 'success'"
                          :size="15"
                          :stroke-width="2"
                          aria-hidden="true"
                        />
                        <Copy v-else :size="15" :stroke-width="2" aria-hidden="true" />
                        {{ copyFeedback === 'success' ? '已复制' : '复制示例' }}
                      </button>
                      <span
                        v-if="copyFeedback === 'failure'"
                        class="help-panel-copy-error"
                        role="status"
                      >
                        复制失败，请手动选择文本复制
                      </span>
                    </div>
                  </article>
                </div>
              </div>
            </Transition>
          </li>
        </ul>
        <p v-else class="help-panel-empty">
          没有匹配的标签。<br />
          可以尝试标签名、用途或“越界”等关键词。
        </p>
      </div>
    </aside>
  </Transition>
</template>
