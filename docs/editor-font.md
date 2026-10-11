# 编辑器字体

CodeMirror 编辑区和补全菜单使用以下等宽字体栈：`JetBrains Mono`、`Cascadia Code`、`Consolas`、系统等宽字体。字体未安装时由浏览器选择后续字体；项目不下载远程字体。

编辑区字号为 `14px`，行高为 `1.6`，行号、正文和补全菜单保持同一字体语境，数字使用等宽数字。该规则只作用于编辑器和补全菜单，不改变预览正文使用的 `Inter` 字体、BBCode 原文或预览结果。

## 复核

固定输入：

```text
[b]标签[/b] = 0123
```

在 Chromium `1280 × 800` 视口中，`.cm-content` 和 `.cm-gutters` 的计算字号应为 `14px`；正文的计算字体栈应包含 `JetBrains Mono`，补全菜单使用同一字体栈。自动化检查见[编辑器排版测试](../tests/e2e/editor-typography.spec.ts)。
