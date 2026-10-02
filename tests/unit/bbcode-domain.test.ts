import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileForPreview } from '../../src/bbcode/compatibility'
import { compileForStorage } from '../../src/bbcode/compatibility'
import { getTagDefinition } from '../../src/bbcode/registry'
import { scanDocument } from '../../src/bbcode/scanner'
import { diagnoseDocument } from '../../src/bbcode/diagnostics'
import { countGraphemes } from '../../src/shared/text/graphemes'

const fixtureRoot = join(process.cwd(), 'tests', 'fixtures', 'osu-web')

describe('BBCode 领域核心', () => {
  it('所有固定样例都能扫描、诊断和生成安全预览', () => {
    const cases = readdirSync(fixtureRoot, { withFileTypes: true }).filter((entry) =>
      entry.isDirectory(),
    )
    expect(cases).toHaveLength(49)
    for (const entry of cases) {
      const source = readFileSync(join(fixtureRoot, entry.name, 'input.bbcode'), 'utf8')
      const preview = compileForPreview(source)
      const diagnostics = diagnoseDocument(source)
      expect(preview.diagnosticsIndependent).toBe(true)
      expect(preview.sanitizedHtml).not.toContain('<script')
      expect(diagnostics.every((item) => item.severity === 'error')).toBe(true)
    }
  })

  it('逐项执行固定样例的固化断言', () => {
    const cases = readdirSync(fixtureRoot, { withFileTypes: true }).filter((entry) =>
      entry.isDirectory(),
    )
    for (const entry of cases) {
      const dir = join(fixtureRoot, entry.name)
      const source = readFileSync(join(dir, 'input.bbcode'), 'utf8')
      const expected = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8'))
      const assertions = expected.expectedAssertions
      const scan = scanDocument(source)
      const diagnostics = diagnoseDocument(scan)
      const preview = compileForPreview(source)
      const tokens = scan.tokens.map((token) => ({
        kind: token.kind,
        from: token.from,
        to: token.to,
        text: token.text,
        ...(token.tagName === undefined ? {} : { tagName: token.tagName }),
        ...(token.canonicalTagName === undefined
          ? {}
          : { canonicalTagName: token.canonicalTagName }),
        ...(token.closing === undefined ? {} : { closing: token.closing }),
        ...(token.recognized === undefined ? {} : { recognized: token.recognized }),
        ...(token.special === undefined ? {} : { special: token.special }),
      }))
      const actualDiagnostics = diagnostics.map((item) => ({
        code: item.code,
        from: item.from,
        to: item.to,
        line: item.line,
        column: item.column,
      }))
      expect(assertions.sourceUnchanged, entry.name).toBe(true)
      expect(tokens, `${entry.name} tokens`).toEqual(assertions.tokens)
      expect(actualDiagnostics, `${entry.name} diagnostics`).toEqual(assertions.diagnostics)
      expect(preview.sanitizedHtml, `${entry.name} preview`).toBe(assertions.preview.html)
      expect(preview.media, `${entry.name} media`).toEqual(assertions.preview.media)
    }
  })

  it('正常固定样例中的标签都来自唯一注册表', () => {
    const cases = readdirSync(fixtureRoot, { withFileTypes: true }).filter((entry) =>
      entry.isDirectory(),
    )
    const normalCases = cases.filter(
      (entry) =>
        JSON.parse(readFileSync(join(fixtureRoot, entry.name, 'metadata.json'), 'utf8'))
          .category === 'normal',
    )

    for (const entry of normalCases) {
      const source = readFileSync(join(fixtureRoot, entry.name, 'input.bbcode'), 'utf8')
      const tagNames = scanDocument(source)
        .tokens.filter((item) => item.kind === 'tag-name' && item.special !== 'list-item')
        .map((item) => item.canonicalTagName)
      expect(tagNames.every((name) => getTagDefinition(name ?? '') !== undefined)).toBe(true)
    }
  })

  it('storage 阶段保留原文和扫描结果，预览阶段不回写原文', () => {
    const source = '[b]原文[/b]'
    const storage = compileForStorage(source)
    const preview = compileForPreview(storage)

    expect(storage.source).toBe(source)
    expect(storage.scan.source).toBe(source)
    expect(preview.sanitizedHtml).toContain('<strong>原文</strong>')
  })

  it('保留错误输入原文，并将 size 越界只限制在预览结果', () => {
    const source = '[size=250]超出上限[/size] [unknown]<script>alert(1)</script>[/unknown]'
    const diagnostics = diagnoseDocument(source)
    const preview = compileForPreview(source)

    expect(source).toContain('250')
    expect(diagnostics.map((item) => item.code)).toContain('PARAMETER_OUT_OF_RANGE')
    expect(diagnostics.map((item) => item.code)).toContain('UNKNOWN_TAG')
    expect(preview.sanitizedHtml).toContain('font-size:200%')
    expect(preview.sanitizedHtml).toContain('&lt;script&gt;')
    expect(preview.sanitizedHtml).not.toContain('<script>')
  })

  it('支持列表项、代码块和数字 profile 的领域语义', () => {
    const list = compileForPreview('[list]\n[*]第一项\n[*]第二项\n[/list]')
    const code = compileForPreview('[code][b]不解析[/b][/code]')
    const profile = compileForPreview('[profile=102]玩家[/profile]')

    expect(list.sanitizedHtml).toContain('<li>第一项</li>')
    expect(list.sanitizedHtml).toContain('<li>第二项</li>')
    expect(code.sanitizedHtml).toContain('[b]不解析[/b]')
    expect(code.sanitizedHtml).not.toContain('<strong>')
    expect(profile.sanitizedHtml).toContain('https://osu.ppy.sh/users/102')
  })

  it('生成 imagemap 百分比热区并安全处理 box 标题中的 BBCode', () => {
    const imagemap = compileForPreview(
      '[imagemap]\nhttps://example.com/map.png\n10 20 30 40 https://example.com/area 热区\n5 5 10 10 #\n1.5 2.5 3.5 4.5 https://example.com/decimal 小数\n[/imagemap]',
    )
    const dangerous = compileForPreview(
      '[imagemap]\nhttps://example.com/map.png\n10 10 10 10 javascript:alert(1) 危险\n[/imagemap]',
    )
    const box = compileForPreview('[box=[color=red]标题[/color]]内容[/box]')

    expect(imagemap.sanitizedHtml).toContain('<div class="preview-imagemap">')
    expect(imagemap.sanitizedHtml).toContain('style="left:10%;top:20%;width:30%;height:40%"')
    expect(imagemap.sanitizedHtml).toContain('style="left:1.5%;top:2.5%;width:3.5%;height:4.5%"')
    expect(imagemap.sanitizedHtml).toContain('href="https://example.com/area"')
    expect(imagemap.sanitizedHtml).not.toContain('<area')
    expect(imagemap.sanitizedHtml).not.toContain('<map')
    expect(imagemap.sanitizedHtml).toContain(
      '<span class="preview-imagemap-region" title="" style="left:5%;top:5%;width:10%;height:10%"></span>',
    )
    expect(dangerous.sanitizedHtml).not.toContain('<a ')
    expect(dangerous.sanitizedHtml).toContain(
      '<span class="preview-imagemap-region" title="危险" style="left:10%;top:10%;width:10%;height:10%"></span>',
    )
    expect(box.sanitizedHtml).toContain('style="color:red"')
    expect(box.sanitizedHtml).toContain('标题')
  })

  it('按项目折叠盒结构渲染标题、边界换行和嵌套', () => {
    const source =
      '盒外前文\n[box=[color=red]标题[/color]]\n第一行\n\n第二行\n[box=内层]\n内层内容\n[/box]\n[/box]\n盒外后文'
    const preview = compileForPreview(source)

    expect(preview.sanitizedHtml).toContain(
      '<button type="button" class="bbcode-spoilerbox__link" aria-expanded="false">',
    )
    expect(preview.sanitizedHtml).toContain(
      '<span class="bbcode-spoilerbox__link-text"><span style="color:red">标题</span></span>',
    )
    expect(preview.sanitizedHtml).toContain('第一行<br><br>第二行')
    expect(preview.sanitizedHtml).toContain('class="bbcode-spoilerbox__body" hidden')
    expect(preview.sanitizedHtml).not.toContain('body" hidden><br>')
    expect(preview.sanitizedHtml).toContain('盒外前文<br><div class="bbcode-spoilerbox">')
    // 盒体结束标签后的首个换行被吸收（对齐上游 box 贴边换行规则）。
    expect(preview.sanitizedHtml).toContain('</div></div>盒外后文')
  })

  it('引用署名按上游输出“作者 wrote:”并拒绝其他参数形态', () => {
    expect(compileForPreview('[quote="某位玩家"]内容[/quote]').sanitizedHtml).toBe(
      '<blockquote><h4>某位玩家 wrote:</h4>内容</blockquote>',
    )
    expect(compileForPreview('[quote]内容[/quote]').sanitizedHtml).toBe(
      '<blockquote>内容</blockquote>',
    )
    expect(compileForPreview('[quote=某位玩家]内容[/quote]').sanitizedHtml).toContain(
      '[quote=某位玩家]内容[/quote]',
    )
  })

  it('列表项内的嵌套子列表渲染为嵌套结构', () => {
    const source =
      '[list]\n[*]第一项\n[*]第二项\n  [list]\n  [*]嵌套项一\n  [*]嵌套项二\n  [/list]\n[*]第三项\n[/list]'
    const preview = compileForPreview(source)

    expect(preview.sanitizedHtml).toContain(
      '<li>第二项<br>  <ul><li>嵌套项一</li><li>嵌套项二</li></ul></li>',
    )
    expect(preview.sanitizedHtml).toContain('<li>第三项</li>')
    expect(preview.sanitizedHtml).not.toContain('[/list]')
  })

  it('异常标签只影响自身，不让后续标签一起失效', () => {
    const inline = compileForPreview('[list]\n[*]颜色：点 [c][color=#...][/c] 中的颜色值\n[/list]')
    expect(inline.sanitizedHtml).toContain('<code>[color=#...]</code>')
    expect(inline.sanitizedHtml).toContain('<ul><li>颜色：点 ')

    const following = compileForPreview('[c][color=red][/c]\n[notice]公告[/notice]')
    expect(following.sanitizedHtml).toContain('<code>[color=red]</code>')
    expect(following.sanitizedHtml).toContain('<div class="bbcode-notice">')

    const crossed = compileForPreview('[b]加粗 [i]未闭合[/b] 结尾[/i]')
    expect(crossed.sanitizedHtml).toBe('<strong>加粗 [i]未闭合</strong> 结尾[/i]')

    const lifted = compileForPreview('[box=盒][b][i]斜体[/i][/box] 盒外')
    expect(lifted.sanitizedHtml).toContain('[b]<em>斜体</em>')
  })

  it('空标题和 spoilerbox 使用 SPOILER', () => {
    expect(compileForPreview('[box=][/box]').sanitizedHtml).toContain('>SPOILER</span>')
    expect(compileForPreview('[spoilerbox]内容[/spoilerbox]').sanitizedHtml).toContain(
      '>SPOILER</span>',
    )
  })

  it('拒绝危险协议并统计用户可见字素簇', () => {
    const preview = compileForPreview(
      '[url=javascript:alert(1)]危险链接[/url][img]javascript:bad[/img]',
    )

    expect(preview.sanitizedHtml).not.toContain('href="javascript:')
    expect(preview.sanitizedHtml).not.toContain('src="javascript:')
    expect(preview.media).toEqual([{ kind: 'image', url: 'javascript:bad', allowed: false }])
    expect(diagnoseDocument('[url=javascript:alert(1)]危险链接[/url]')).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'INVALID_URL' })]),
    )
    expect(countGraphemes('👨‍👩‍👧‍👦é')).toBe(2)
  })

  it('支持 mailto 链接和普通文本自动链接边界', () => {
    const mailto = compileForPreview('[url=mailto:user@example.com]发邮件[/url]')
    const plain = compileForPreview(
      'https://example.com/path:1/hello: (https://example.com/paren) https://example.com/dot. www.example.com someone@example.com',
    )
    expect(mailto.sanitizedHtml).toContain('href="mailto:user@example.com"')
    expect(plain.sanitizedHtml).toContain('>https://example.com/path:1/hello</a>:')
    expect(plain.sanitizedHtml).toContain('>https://example.com/paren</a>)')
    expect(plain.sanitizedHtml).toContain('>https://example.com/dot</a>.')
    expect(plain.sanitizedHtml).toContain('href="mailto:someone@example.com"')
    expect(compileForPreview('[code]https://example.com[/code]').sanitizedHtml).not.toContain(
      '<a href=',
    )
  })
})
