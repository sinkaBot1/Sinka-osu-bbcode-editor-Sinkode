# Claucode 编辑器语法高亮证据

本目录保存 Claucode 编辑器配色的当前截图、测量脚本和浏览器复核结果。证据只用于复查当前实现，不记录候选方案或修改过程。

## 当前规则

- 编辑器底色为 `#faf9f5`。
- 结构符 `[`、`]`、`/`、`=` 使用 `#8b54d5`，对编辑器底色的对比度为 `4.61:1`。
- 标签名使用 `#00825d`，参数值使用 `#c04e00`，无效标签使用 `#e40033`；三者对编辑器底色的对比度均不低于 `4.58:1`。
- 当前行底色为 `#e9dfc9`，与编辑器底色的分层对比度为 `1.26:1`，正文在其上仍为 `13.92:1`。
- Darkode 和 Hollowcode 的语法令牌保持各自主题定义；本证据只覆盖 Claucode 的编辑器取值。

## 证据文件

- `editor-final-purple.png`：当前 Claucode 编辑器状态截图。
- `palette-measure.mjs`：零依赖的当前取值对比度和 OKLab/OKLCh 测量脚本。
- `capture-editor.mjs`：从本机开发服务器截取浏览器状态的脚本。

## 复核

```bash
node docs/evidence/claucode-syntax-2026-10-10/palette-measure.mjs
npm run dev -- --host 127.0.0.1 --port 4173
node docs/evidence/claucode-syntax-2026-10-10/capture-editor.mjs
```

脚本只访问 `http://127.0.0.1:4173`，截图写入当前工作目录的 `.tmp/`。自动化令牌和对比度断言见 `tests/unit/theme-tokens.test.ts`。
