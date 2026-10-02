#!/usr/bin/env node
// 文档结构、本地链接与锚点检查（零依赖）。
// 用法：
//   node scripts/check-docs-links.mjs                     # 检查仓库内全部 Markdown
//   node scripts/check-docs-links.mjs README.md docs/a.md # 只检查指定文件
// 退出码 0 = 通过；1 = 存在问题。
//
// 检查内容：
//   1. 代码围栏成对（``` 与 ~~~ 必须闭合，避免文档结构断裂）；
//   2. 每个引用到的仓库内文件确实存在；
//   3. 带 #锚点 的链接能在目标文档中找到对应标题（GitHub 标题 slug 规则）；
//   4. 同目录重复标题导致锚点歧义时给出提示。
//
// 外部链接（http/https/mailto）只登记数量，不发起网络请求，保持检查离线可复现。

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SKIP_DIRS = new Set([
  '.git',
  '.github', // 工作流 YAML 不是 Markdown，保留占位避免误入
  'node_modules',
  'dist',
  'coverage',
  'playwright-report',
  'test-results',
  'logo',
])

const problems = []
const notices = []
let linkCount = 0
let externalCount = 0
let anchorCount = 0

function report(file, message) {
  problems.push(`${relative(repoRoot, file).split(sep).join('/')}: ${message}`)
}

function notice(file, message) {
  notices.push(`${relative(repoRoot, file).split(sep).join('/')}: ${message}`)
}

function collectMarkdown(dir, into) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
      collectMarkdown(join(dir, entry.name), into)
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      into.push(join(dir, entry.name))
    }
  }
  return into
}

// 去掉代码围栏与行内代码，避免把示例里的方括号、括号当成真实链接。
function stripCode(text) {
  const withoutFences = text.replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[^\n]*$/gm, '')
  return withoutFences.replace(/`[^`\n]*`/g, '')
}

function checkFences(file, text) {
  const lines = text.split(/\r?\n/)
  let fence = null
  for (let i = 0; i < lines.length; i += 1) {
    const match = /^ {0,3}(`{3,}|~{3,})/.exec(lines[i])
    if (!match) continue
    if (fence === null) {
      fence = { char: match[1][0], length: match[1].length, line: i + 1 }
    } else if (match[1][0] === fence.char && match[1].length >= fence.length) {
      fence = null
    }
  }
  if (fence !== null) {
    report(file, `第 ${fence.line} 行开始的代码围栏没有闭合（${fence.char.repeat(fence.length)}）`)
  }
}

// 与 GitHub 标题锚点保持一致：小写，保留「拉丁字母/数字/下划线/连字符/空格」以及
// 中日韩等表意文字（`\w` 只覆盖 ASCII，会把中文标题整段删掉，必须显式放行），
// 其余标点（全角括号、全角冒号、逗号等）一律去掉，空格转连字符；重复标题追加 -1、-2……
const WORD_CLASS =
  'A-Za-z0-9_' +
  '\\u00c0-\\u024f' + // 拉丁扩展
  '\\u0370-\\u03ff' + // 希腊字母
  '\\u0400-\\u04ff' + // 西里尔字母
  '\\u3040-\\u30ff' + // 日文假名
  '\\u3400-\\u4dbf' + // 中日韩扩展 A
  '\\u4e00-\\u9fff' + // 中日韩统一表意文字
  '\\uf900-\\ufaff' + // 兼容表意文字
  '\\uac00-\\ud7af' + // 谚文音节
  '\\uff10-\\uff19\\uff21-\\uff3a\\uff41-\\uff5a' // 全角数字与字母
const SLUG_KEEP = new RegExp(`[^${WORD_CLASS}\\- ]`, 'gu')

function slugify(headingText) {
  return headingText.trim().toLowerCase().replace(SLUG_KEEP, '').replace(/ /g, '-')
}

function collectAnchors(text) {
  const anchors = new Set()
  const duplicates = new Set()
  const seen = new Map()
  const lines = text.split(/\r?\n/)
  let fence = null
  for (const line of lines) {
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (fenceMatch) {
      if (fence === null) fence = { char: fenceMatch[1][0], length: fenceMatch[1].length }
      else if (fenceMatch[1][0] === fence.char && fenceMatch[1].length >= fence.length) fence = null
      continue
    }
    if (fence !== null) continue
    const heading = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
    if (!heading) continue
    const base = slugify(heading[2])
    if (base.length === 0) continue
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    if (count > 0) duplicates.add(base)
    anchors.add(count === 0 ? base : `${base}-${count}`)
  }
  return { anchors, duplicates }
}

function decodeTarget(target) {
  try {
    return decodeURIComponent(target)
  } catch {
    return target
  }
}

function checkFile(file) {
  const text = readFileSync(file, 'utf8')
  checkFences(file, text)
  const content = stripCode(text)
  const { anchors, duplicates } = collectAnchors(text)
  for (const name of duplicates) {
    notice(file, `存在同名标题，重复标题的锚点为 #${name}-1、#${name}-2……（不改链接即视为提示）`)
  }

  const linkPattern = /(!?)\[([^\]]*)\]\(([^()\s]*(?:\([^()]*\)[^()\s]*)*)\)/g
  let match
  while ((match = linkPattern.exec(content)) !== null) {
    if (match[1] === '!') continue // 图片不检查
    const rawTarget = match[3].trim()
    if (rawTarget.length === 0) continue
    if (/^(https?:|mailto:|tel:)/i.test(rawTarget)) {
      externalCount += 1
      continue
    }
    if (rawTarget.startsWith('#')) {
      linkCount += 1
      anchorCount += 1
      const anchor = decodeTarget(rawTarget.slice(1)).toLowerCase()
      if (!anchors.has(anchor)) {
        report(file, `锚点 ${rawTarget} 在本文档中不存在`)
      }
      continue
    }
    linkCount += 1
    const [pathPart, anchorPart] = rawTarget.split('#')
    const decodedPath = decodeTarget(pathPart)
    const targetPath = decodedPath.startsWith('/')
      ? join(repoRoot, decodedPath.slice(1))
      : resolve(dirname(file), decodedPath)
    if (!existsSync(targetPath)) {
      report(file, `链接目标不存在：${rawTarget}`)
      continue
    }
    if (anchorPart === undefined || anchorPart.length === 0) continue
    anchorCount += 1
    const stat = statSync(targetPath)
    if (!stat.isFile()) {
      report(file, `链接 ${rawTarget} 指向目录，锚点无法校验`)
      continue
    }
    if (!targetPath.toLowerCase().endsWith('.md')) continue
    const targetAnchors = collectAnchors(readFileSync(targetPath, 'utf8')).anchors
    const anchor = decodeTarget(anchorPart).toLowerCase()
    if (!targetAnchors.has(anchor)) {
      report(file, `链接 ${rawTarget} 的锚点 #${anchorPart} 在目标文档中不存在`)
    }
  }
}

const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('-'))
const files =
  requested.length > 0
    ? requested.map((arg) => resolve(process.cwd(), arg))
    : collectMarkdown(repoRoot, [])

if (files.length === 0) {
  console.error('没有找到需要检查的 Markdown 文件')
  process.exit(1)
}

for (const file of files) {
  if (!existsSync(file)) {
    console.error(`文件不存在：${file}`)
    process.exit(1)
  }
  checkFile(file)
}

if (problems.length > 0) {
  console.error(`文档检查未通过（${problems.length} 个问题）：`)
  for (const item of problems) console.error(`  - ${item}`)
  if (notices.length > 0) {
    console.error(`另有 ${notices.length} 条提示（不计为失败）：`)
    for (const item of notices) console.error(`  · ${item}`)
  }
  process.exit(1)
}

if (notices.length > 0) {
  console.warn(`文档检查通过，但有 ${notices.length} 条提示：`)
  for (const item of notices) console.warn(`  · ${item}`)
}

console.log(`文档检查通过：${files.length} 个 Markdown 文件`)
console.log(
  `  本地链接 ${linkCount} 个（其中含锚点 ${anchorCount} 个），外部链接 ${externalCount} 个（未联网校验）`,
)
