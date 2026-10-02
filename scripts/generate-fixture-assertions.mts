import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>')
Object.assign(globalThis, { window: dom.window, document: dom.window.document })
const { compileForPreview } = await import('../src/bbcode/compatibility')
const { diagnoseDocument } = await import('../src/bbcode/diagnostics')
const { scanDocument } = await import('../src/bbcode/scanner')

const root = join(process.cwd(), 'tests', 'fixtures', 'osu-web')
for (const name of readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)) {
  const dir = join(root, name)
  const source = readFileSync(join(dir, 'input.bbcode'), 'utf8')
  const preview = compileForPreview(source)
  const diagnostics = diagnoseDocument(source)
  const scan = scanDocument(source)
  const expected = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8'))
  expected.status = 'asserted'
  expected.stage = 2
  expected.expectedAssertions = {
    sourceUnchanged: true,
    tokens: scan.tokens.map((token) => ({
      kind: token.kind,
      from: token.from,
      to: token.to,
      text: token.text,
      ...(token.tagName === undefined ? {} : { tagName: token.tagName }),
      ...(token.canonicalTagName === undefined ? {} : { canonicalTagName: token.canonicalTagName }),
      ...(token.closing === undefined ? {} : { closing: token.closing }),
      ...(token.recognized === undefined ? {} : { recognized: token.recognized }),
      ...(token.special === undefined ? {} : { special: token.special }),
    })),
    diagnostics: diagnostics.map((item) => ({
      code: item.code,
      from: item.from,
      to: item.to,
      line: item.line,
      column: item.column,
    })),
    preview: {
      html: preview.sanitizedHtml,
      media: preview.media,
    },
  }
  delete expected.assertionsNote
  writeFileSync(join(dir, 'expected.json'), `${JSON.stringify(expected, null, 2)}\n`, 'utf8')
}
