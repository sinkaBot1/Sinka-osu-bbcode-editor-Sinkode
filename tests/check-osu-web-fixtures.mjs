#!/usr/bin/env node
// osu-web 固定样例完整性检查（零依赖）。
// 用法：node tests/check-osu-web-fixtures.mjs
// 退出码 0 = 通过；1 = 存在问题。

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixturesDir = join(repoRoot, 'tests', 'fixtures', 'osu-web');

const BASIS_SHA = '61b0a41431395f86ff68fa12744f3266448ec885';
const BASIS_DATE = '2026-09-04T07:44:14Z';

// 第一版标签集合（与 src/bbcode/registry/ 保持一致）。registry 实现后应改为直接从 registry 读取，避免两处规则不一致。
const V1_TAGS = [
  'b', 'i', 'u', 's', 'strike', 'color', 'size', 'url', 'img', 'email',
  'youtube', 'audio', 'imagemap', 'centre', 'code', 'c', 'quote', 'list',
  'spoiler', 'spoilerbox', 'heading', 'notice', 'box', 'profile',
];

const CATEGORIES = ['normal', 'size', 'error', 'edge', 'aux'];
const DIFF_IDS = new Set([
  'D-01',
  'D-02',
  'D-03',
  'D-04',
  'D-05',
  'D-06',
  'D-07',
  'D-08',
  'D-09',
  'D-10',
  'D-11',
  'D-12',
  'D-13',
  'D-14',
  'D-15',
  'D-16',
]);

// 需求明确要求必须存在的 case（错误矩阵与 PAR-03 边界）。
const REQUIRED_CASES = [
  'bold-basic', 'italic-basic', 'underline-basic', 'strike-and-alias',
  'color-names-and-hex', 'url-forms', 'img-basic', 'email-basic',
  'email-with-display-text', 'youtube-id-forms', 'audio-basic',
  'imagemap-basic', 'centre-basic', 'code-block', 'inline-code',
  'quote-basic', 'list-basic', 'spoiler-inline', 'spoilerbox-basic',
  'notice-basic', 'box-with-title', 'heading-basic', 'profile-with-id',
  'size-in-range', 'size-clamp-low', 'size-boundary-30',
  'size-boundary-200', 'size-over-range-250',
  'unclosed-bold', 'stray-close-tag', 'crossed-nesting', 'unknown-tag',
  'img-empty', 'invalid-email-url', 'profile-name-only', 'profile-non-numeric',
  'imagemap-invalid-content', 'imagemap-unclosed-nested',
  'code-surrounding-newlines', 'quote-newlines', 'list-title',
  'notice-surrounding-newlines', 'box-nested', 'box-bbcode-title',
  'imagemap-indented', 'profile-tag-in-name', 'plain-text-newlines',
  'block-inline-mix', 'autolink-boundaries',
];

const problems = [];
const foundCases = new Map(); // name -> { covers, category, input }

function problem(msg) {
  problems.push(msg);
}

let caseDirs = [];
try {
  caseDirs = readdirSync(fixturesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
} catch (err) {
  console.error(`无法读取样例目录 ${fixturesDir}: ${err.message}`);
  process.exit(1);
}

for (const name of caseDirs) {
  const dir = join(fixturesDir, name);
  const inputPath = join(dir, 'input.bbcode');
  const metaPath = join(dir, 'metadata.json');
  const expPath = join(dir, 'expected.json');

  for (const [label, p] of [['input.bbcode', inputPath], ['metadata.json', metaPath], ['expected.json', expPath]]) {
    if (!existsSync(p)) problem(`${name}: 缺少 ${label}`);
  }
  if (problems.some((p) => p.startsWith(`${name}:`))) continue;

  const input = readFileSync(inputPath, 'utf8');
  if (input.trim().length === 0) problem(`${name}: input.bbcode 为空`);
  // 固定样例不得依赖实时网络：只允许文档类示例域名；
  // youtube 域名仅作为 [youtube] 标签的解析输入文本出现，运行时断言不请求它。
  const allowedHostPattern = /^https?:\/\/([a-z0-9-]+\.)*(example\.com|example\.org|youtube\.com|youtu\.be)/i;
  const forbiddenHosts = input
    .match(/https?:\/\/[^\s\]]+/g)
    ?.filter((u) => !allowedHostPattern.test(u));
  if (forbiddenHosts && forbiddenHosts.length > 0) {
    problem(`${name}: input.bbcode 含非示例域名（自动化样例不得依赖实时第三方）: ${forbiddenHosts.join(', ')}`);
  }

  let meta;
  try {
    meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  } catch (err) {
    problem(`${name}: metadata.json 不是合法 JSON: ${err.message}`);
    continue;
  }

  if (meta.case !== name) problem(`${name}: metadata.case (${meta.case}) 与目录名不一致`);
  if (!CATEGORIES.includes(meta.category)) problem(`${name}: category "${meta.category}" 不在允许范围`);
  if (meta.basisSha !== BASIS_SHA) problem(`${name}: basisSha 与锁定基准不一致`);
  if (meta.basisDate !== BASIS_DATE) problem(`${name}: basisDate 与锁定基准不一致`);
  if (!Array.isArray(meta.covers)) {
    problem(`${name}: covers 必须是数组（允许为空，如辅助行为或未知标签 case）`);
  } else {
    for (const tag of meta.covers) {
      if (!V1_TAGS.includes(tag)) problem(`${name}: covers 含第一版集合之外的标签 "${tag}"`);
    }
  }
  if (!Array.isArray(meta.upstreamEvidence) || meta.upstreamEvidence.length === 0) {
    problem(`${name}: upstreamEvidence 不能为空`);
  } else {
    for (const ev of meta.upstreamEvidence) {
      if (!ev || typeof ev.path !== 'string' || ev.path.length === 0) {
        problem(`${name}: upstreamEvidence 条目缺少 path`);
      }
      if (!ev || typeof ev.note !== 'string' || ev.note.trim().length === 0) {
        problem(`${name}: upstreamEvidence 条目缺少非空 note`);
      }
    }
  }
  if (!Array.isArray(meta.intentionalDifferences)) {
    problem(`${name}: intentionalDifferences 必须是数组`);
  } else {
    for (const diff of meta.intentionalDifferences) {
      if (typeof diff !== 'string' || !DIFF_IDS.has(diff)) {
        problem(`${name}: intentionalDifferences 含未知差异编号 "${diff}"`);
      }
    }
  }

  let exp;
  try {
    exp = JSON.parse(readFileSync(expPath, 'utf8'));
  } catch (err) {
    problem(`${name}: expected.json 不是合法 JSON: ${err.message}`);
    continue;
  }
  if (exp.case !== name) problem(`${name}: expected.case (${exp.case}) 与目录名不一致`);
  if (exp.status !== 'asserted') problem(`${name}: 样例格式要求 expected.status 为 asserted（现为 ${exp.status}）`);
  if (!exp.expectedAssertions || typeof exp.expectedAssertions !== 'object') {
    problem(`${name}: expectedAssertions 必须是对象`);
  } else {
    const a = exp.expectedAssertions;
    if (a.sourceUnchanged !== true) problem(`${name}: expectedAssertions.sourceUnchanged 必须为 true`);
    if (!Array.isArray(a.tokens)) problem(`${name}: expectedAssertions.tokens 必须是数组`);
    if (!Array.isArray(a.diagnostics)) problem(`${name}: expectedAssertions.diagnostics 必须是数组`);
    if (!a.preview || typeof a.preview.html !== 'string' || !Array.isArray(a.preview.media)) {
      problem(`${name}: expectedAssertions.preview 必须包含 html 和 media`);
    }
  }
  if (!Array.isArray(exp.observations) || exp.observations.length === 0) problem(`${name}: expected.observations 不能为空`);

  foundCases.set(name, { covers: meta.covers ?? [], category: meta.category, input });
}

for (const required of REQUIRED_CASES) {
  if (!foundCases.has(required)) problem(`缺少必需 case: ${required}`);
}

const covered = new Set();
for (const { covers } of foundCases.values()) for (const tag of covers) covered.add(tag);
for (const tag of V1_TAGS) {
  if (!covered.has(tag)) problem(`第一版标签 "${tag}" 没有出现在任何 case 的 covers 中`);
}

const sizeInputs = [...foundCases.entries()]
  .filter(([, c]) => c.category === 'size')
  .map(([, c]) => c.input)
  .join('\n');
for (const required of ['[size=30]', '[size=200]', '[size=250]']) {
  if (!sizeInputs.includes(required)) problem(`size 类样例输入中缺少 ${required}（PAR-03）`);
}

const byCategory = {};
for (const { category } of foundCases.values()) byCategory[category] = (byCategory[category] ?? 0) + 1;

if (problems.length > 0) {
  console.error(`固定样例完整性检查未通过（${problems.length} 个问题）：`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(`固定样例完整性检查通过：${foundCases.size} 个 case`);
console.log(`  类别分布: ${JSON.stringify(byCategory)}`);
console.log(`  第一版标签覆盖: ${covered.size}/${V1_TAGS.length}`);
