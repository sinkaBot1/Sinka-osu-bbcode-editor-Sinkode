export const DEFAULT_EXAMPLE_NAME = '默认示例'

// 编辑器首次打开时载入的示例稿，同时也是各标签实际渲染效果的展示入口。
export const DEFAULT_EXAMPLE_CONTENT = `[centre]
[img]https://www.helloimg.com/i/2026/10/11/6acb4c9e986c5.png[/img]
[/centre]

[centre]
[size=200][color=#ff66aa][b]SINKA0[/b][/color][/size]
[/centre]

[centre]
[size=200][color=#ff66aa][b]S[/b][/color][/size][size=170][color=#ff99cc][b]I[/b][/color][/size][size=140][color=LavenderBlush][b]N[/b][/color][/size][size=115][color=Aquamarine][b]K[/b][/color][/size][size=95][color=#7fd4c1][b]A[/b][/color][/size][size=80][color=Gold][b]0[/b][/color][/size]
[/centre]

[centre]
[size=120][color=LavenderBlush][b]Sinkode[/b][/color][/size] [size=120][color=Aquamarine][i]BBCode Editor[/i][/color][/size]
[/centre]

[notice]
[color=#ff66aa][b]欢迎来到 SInkode 的个人主页。[/b][/color]

这里是 [b]SINKA0[/b]，[i]Sinkode[/i] BBCode 编辑器的开发者。如果你看到 [spoiler]这一小段被黑条盖住了[/spoiler]，用鼠标划过去就能读出来——这叫行内剧透。
[centre]↑[/centre]
文字样式一览：[b]粗体[/b]、[i]斜体[/i]、[u]下划线[/u]、[s]删除线[/s]、[color=Gold]金色[/color]、[color=Aquamarine]水绿色[/color]。
[/notice]

[heading][color=#ff66aa][b]技能清单[/b][/color][/heading]
[list=1]
[*][b]标签解析[/b]：严格嵌套配对，未知标签原样保留为文本
[*][b]模板保存[/b]：打开侧边栏即可看到模板界面
[*][b]候选词[/b]：输入 [ 后,自动弹出候选词列表
[list]
[*]按方向键↑↓切换候选词，按tab和enter键入选中的候选测
[*]按esc关闭候选词面板
[/list]
[*][b]官网对齐[/b]：可以在osu官网个人简介编辑处进行的基础操作
[*][b]切换主题[/b]：见展开头栏后的右上角
[*][b]帮助面板[/b]：其中可以查看更多的bbcode语法细节以及预览效果
[*][b]基础错误诊断[/b]：可以识别基本的bbcode语法错误，点击编辑器下方的 [b]n 个问题[/b] 来打开面板
[/list]


[quote="SINKA0"]
排版稿和代码一样：先把结构立住，再谈好不好看。
[/quote]

如果你克隆了本项目的仓库，对应目录的命令行里敲 [c]npm run dev[/c] 就能启动本地服务器
[code]
> sinka-osu-bbcode-editor@0.1.0 dev
> vite
[/code]

[heading][color=#ff66aa][b]媒体区[/b][/color][/heading]

[youtube]https://www.youtube.com/watch?v=7wMz8mDyHgM&list=RD7wMz8mDyHgM&start_radio=1[/youtube]
[audio]https://files.catbox.moe/h1qhu9.mp3[/audio]

[heading][color=#ff66aa][b]collab · 图片热区[/b][/color][/heading]

[imagemap]
https://free.picui.cn/free/2025/11/15/6918293be5cf0.png
5 50 20 10 https://osu.ppy.sh/users/14613519 -Normal XiGua-
40 53 19 5 https://osu.ppy.sh/users/21614712 SINKA0
75.4 52.2 17 5 https://osu.ppy.sh/users/32406156 BenZn
2.5 93 26 5 https://osu.ppy.sh/users/32396623 daring tact
39.5 93.5 22 5 https://osu.ppy.sh/users/13054016 AmeHuyu
73.5 93.5 20 5 https://osu.ppy.sh/users/19140894 Saykai_
[/imagemap]

[box=[size=90][color=LavenderBlush]SINKA0 | MyAngelRuri[/color][/size]]
[size=90][color=Aquamarine][b]2026.2.16[/b][/color][/size]
[imagemap]
https://i.ibb.co/twQgwS7d/1212.png
7.582 7.0239 40.6762 49.6017 https://osu.ppy.sh/users/37684093 MyAngelRuri
48.5656 4.4171 42.8279 50.8327 https://osu.ppy.sh/users/21614712 SINKA0
[/imagemap]
[/box]

[box=box]这里是被折叠起来的内容，点标题才会展开。[/box]
[spoilerbox]
don't read this
[quote="ppy"]
我们承诺，未来各届 osu! World Cup 都将采用 lazer（注意，这不包括其他游戏模式），除非遇到阻碍这一计划实施的重大障碍。若出现这种情况，我们会通过常规渠道（osu! 论坛、Discord、新闻公告等）向大家更新进展。
[/quote]
[/spoilerbox]

[heading][color=#ff66aa][b]找到我[/b][/color][/heading]
[list]
[*]osu! 主页：[url]https://osu.ppy.sh/users/21614712[/url]
[*]玩家名片：[profile=21614712]SINKA0[/profile] ←这个没被渲染，以后做（（
[/list]`
