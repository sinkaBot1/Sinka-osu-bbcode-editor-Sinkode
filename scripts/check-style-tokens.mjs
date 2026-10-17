#!/usr/bin/env node
// 样式令牌检查（零依赖）：theme.css 里不允许再出现尺寸类字面量。
// 用法：
//   node scripts/check-style-tokens.mjs                          # 检查 src/app/theme.css
//   node scripts/check-style-tokens.mjs src/app/theme.css ...    # 只检查指定文件
// 退出码 0 = 通过；1 = 存在问题。
//
// 背景：theme.css 的圆角、字号、时长、缓动与 z-index 已全部换成令牌（规则见
// docs/theme.md 第 2 节）。令牌定义在 src/app/scale.css，组件规则只引用、不写数值。
// 本脚本守住这条线，避免数值又被写回字面量。
//
// 检查内容：
//   1. 注释之外的 border-radius / font-size 里不得出现 px 数字，z-index 不得写数字，
//      不得写 ms/s 时长（0ms、0s 除外），不得写 cubic-bezier()；
//   2. 引用到的 var(--x) 必须在 theme.css 或 scale.css 中声明，或由脚本/组件在运行时写入
//      （运行时令牌从 src 下的 .ts/.vue 里采集），防止令牌名手误；
//   3. --legacy-* 是批次 0 的迁移期占位：已无引用的占位给出提示，下一步就该删掉那一行。
//
// 只做静态文本检查，不联网、不启动浏览器。

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const STYLE_FILES = [join(repoRoot, 'src', 'app', 'theme.css')]
const TOKEN_FILES = [
  join(repoRoot, 'src', 'app', 'scale.css'),
  join(repoRoot, 'src', 'app', 'theme.css'),
]
const RUNTIME_DIR = join(repoRoot, 'src')
const RUNTIME_EXTENSIONS = ['.ts', '.vue']

// 允许的例外：没有时长含义的 0，以及不是尺寸的写法
const ALLOWED_TIME = new Set(['0ms', '0s'])

const problems = []
const notices = []

const display = (file) => relative(repoRoot, file).split(sep).join('/')

function report(file, message) {
  problems.push(`${display(file)}: ${message}`)
}

function notice(file, message) {
  notices.push(`${display(file)}: ${message}`)
}

// 注释里的数值是说明文字，不参与检查；保留换行数以便报告行号。
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length
}

function collectFiles(dir, extensions, into = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      collectFiles(join(dir, entry.name), extensions, into)
    } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
      into.push(join(dir, entry.name))
    }
  }
  return into
}

function checkLiterals(file, css) {
  const checks = [
    {
      label: '圆角',
      pattern: /(border-radius\s*:\s*)([^;{}]+)/g,
      offending: (value) => /\d+(?:\.\d+)?px/.test(value),
      hint: '圆角一律取 --radius / --radius-pill / --r-*，迁移期未归一的取值用 --legacy-radius-*',
    },
    {
      label: '字号',
      pattern: /(font-size\s*:\s*)([^;{}]+)/g,
      offending: (value) => /\d+(?:\.\d+)?px/.test(value),
      hint: '字号一律取 --text-*（em/%/inherit 这类相对写法不受限）',
    },
    {
      label: '层级',
      pattern: /(z-index\s*:\s*)([^;{}]+)/g,
      offending: (value) => /^-?\d+$/.test(value.trim()),
      hint: '层叠顺序一律取 --z-*（迁移期未归一的临时层级用 --legacy-z-*）',
    },
  ]

  for (const { label, pattern, offending, hint } of checks) {
    for (const match of css.matchAll(pattern)) {
      if (!offending(match[2])) continue
      report(
        file,
        `第 ${lineOf(css, match.index)} 行还有${label}字面量「${match[2].trim()}」：${hint}`,
      )
    }
  }

  for (const match of css.matchAll(/(?<![\d.])(\d+(?:\.\d+)?)(ms|s)\b/g)) {
    if (ALLOWED_TIME.has(match[0])) continue
    report(
      file,
      `第 ${lineOf(css, match.index)} 行还有时长字面量「${match[0]}」：动效时长一律取 --dur-1/--dur-2/--dur-3/--dur-exit（迁移期用 --legacy-dur-*）`,
    )
  }

  for (const match of css.matchAll(/cubic-bezier\(/g)) {
    report(file, `第 ${lineOf(css, match.index)} 行还有缓动函数字面量：缓动一律取 --ease`)
  }
}

function declaredTokens(files) {
  const tokens = new Set()
  for (const file of files) {
    const css = stripComments(readFileSync(file, 'utf8'))
    for (const match of css.matchAll(/(--[a-z0-9-]+)\s*:/g)) tokens.add(match[1])
  }
  return tokens
}

// 运行时令牌（--theme-reveal-* 等）由组件写入，静态样式表里没有声明，需要放行。
function runtimeTokens() {
  const tokens = new Set()
  if (!existsSync(RUNTIME_DIR)) return tokens
  for (const file of collectFiles(RUNTIME_DIR, RUNTIME_EXTENSIONS)) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(/(--[a-z0-9-]+)/g)) tokens.add(match[1])
  }
  return tokens
}

function checkReferences(file, css, declared, runtime) {
  const referenced = new Map()
  for (const match of css.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) {
    if (!referenced.has(match[1])) referenced.set(match[1], lineOf(css, match.index))
  }
  for (const [name, line] of referenced) {
    if (declared.has(name) || runtime.has(name)) continue
    report(
      file,
      `第 ${line} 行引用了未声明的令牌 ${name}（既不在 theme.css / scale.css，也不是运行时写入）`,
    )
  }
  return referenced
}

function checkLegacyUsage(referenced) {
  const scaleFile = TOKEN_FILES[0]
  const css = stripComments(readFileSync(scaleFile, 'utf8'))
  for (const match of css.matchAll(/(--legacy-[a-z0-9-]+)\s*:/g)) {
    if (referenced.has(match[1])) continue
    notice(scaleFile, `${match[1]} 已无引用：后续批次把用量换成阶梯令牌后应连行删除`)
  }
}

const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('-'))
const files =
  requested.length > 0 ? requested.map((arg) => resolve(process.cwd(), arg)) : STYLE_FILES

if (files.length === 0) {
  console.error('没有找到需要检查的样式文件')
  process.exit(1)
}

const declared = declaredTokens(TOKEN_FILES)
const runtime = runtimeTokens()

for (const file of files) {
  if (!existsSync(file)) {
    console.error(`文件不存在：${file}`)
    process.exit(1)
  }
  const raw = readFileSync(file, 'utf8')
  const css = stripComments(raw)
  checkLiterals(file, css)
  const referenced = checkReferences(file, css, declared, runtime)
  if (file === STYLE_FILES[0]) checkLegacyUsage(referenced)
}

if (problems.length > 0) {
  console.error(`样式令牌检查未通过（${problems.length} 个问题）：`)
  for (const item of problems) console.error(`  - ${item}`)
  if (notices.length > 0) {
    console.error(`另有 ${notices.length} 条提示（不计为失败）：`)
    for (const item of notices) console.error(`  · ${item}`)
  }
  process.exit(1)
}

if (notices.length > 0) {
  console.warn(`样式令牌检查通过，但有 ${notices.length} 条提示：`)
  for (const item of notices) console.warn(`  · ${item}`)
}

console.log(`样式令牌检查通过：${files.length} 个样式文件`)
console.log(`  令牌声明 ${declared.size} 个，运行时令牌 ${runtime.size} 个`)
