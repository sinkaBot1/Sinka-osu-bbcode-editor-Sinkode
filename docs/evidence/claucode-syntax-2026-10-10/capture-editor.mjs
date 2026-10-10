// 用真实浏览器渲染 Claucode 编辑器的三个状态并截图：
//   editor-final-purple.png  仓库当前取值（结构符为紫罗兰 #8b54d5）
//   editor-neutral-gray.png  上一轮的结构符中性灰版本
//   editor-initial.png       2026-10-04 的初版 Claucode 取值
// 后两个状态用 addStyleTag 就地覆盖令牌渲染，不改仓库文件。
//
// 只访问本机回环 http://127.0.0.1:4173，不访问任何站外地址。
// 运行前先起本机服务：npm run dev -- --host 127.0.0.1 --port 4173
// 截图写到当前工作目录的 .tmp/ 下。

import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

// 上一轮落地、随后被推翻的中性灰结构符
const NEUTRAL_GRAY = `[data-theme='claucode']{
  --syntax-bracket:#8d857a;--syntax-slash:#8d857a;--syntax-equals:#8d857a;
}`

// 2026-10-04 的初版 Claucode 编辑器取值
const INITIAL = `[data-theme='claucode']{
  --syntax-bracket:#8a4a86;--syntax-slash:#8a6d1f;--syntax-tag:#2f6b5f;
  --syntax-equals:#8a5a00;--syntax-parameter:#a05236;--syntax-invalid:#b93b3b;
  --editor-active-line:#efe9de;
}`

const outDir = resolve('.tmp')
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 2 })
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'load' })

// 切到 Claucode：默认主题是 Darkode
await page
  .getByRole('navigation', { name: '工作台入口' })
  .getByRole('button', { name: '主题', exact: true })
  .click()
await page
  .getByRole('dialog', { name: '选择主题' })
  .locator('.theme-option')
  .filter({ hasText: 'Claucode' })
  .click()
await page.keyboard.press('Escape')
await page.waitForTimeout(1200)

const editor = page.locator('.editor-panel')
const readToken = (name) =>
  page.evaluate(
    (token) => getComputedStyle(document.documentElement).getPropertyValue(token).trim(),
    name,
  )
const tokens = ['--syntax-bracket', '--syntax-tag', '--syntax-parameter', '--editor-active-line']

async function shot(file, label) {
  await page.waitForTimeout(400)
  await editor.screenshot({ path: resolve(outDir, file) })
  const values = []
  for (const name of tokens) values.push(`${name}=${await readToken(name)}`)
  console.log(`${label.padEnd(14)} ${file.padEnd(26)} ${values.join('  ')}`)
}

await shot('editor-final-purple.png', '仓库当前')
await page.addStyleTag({ content: NEUTRAL_GRAY })
await shot('editor-neutral-gray.png', '中性灰版')
await page.addStyleTag({ content: INITIAL })
await shot('editor-initial.png', '初版')

await browser.close()
console.log('截图已写入 .tmp/')
