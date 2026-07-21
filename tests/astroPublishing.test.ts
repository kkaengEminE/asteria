import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { preparePublicContent } from '../scripts/prepare-public-content.ts';

const execFileAsync = promisify(execFile);

test('public content preparation includes approved and excludes unapproved articles', async () => {
  const fixture = await createFixture();
  const prepared = await preparePublicContent(fixture.options);

  assert.deepEqual(prepared.map((article) => article.slug), ['approved-guide']);
  assert.equal((await readdir(fixture.options.outputDir)).includes('pending-guide.md'), false);
});

test('public content strips run metadata provider model and editorial diagnostics', async () => {
  const fixture = await createFixture();
  await preparePublicContent(fixture.options);
  const output = await readFile(join(fixture.options.outputDir, 'approved-guide.md'), 'utf8');

  assert.match(output, /공개 본문/);
  assert.match(output, /SEO 설명/);
  assert.doesNotMatch(output, /Run Metadata|Editorial Review|Provider:|Model:|Score:|approvedBy|approvedRevision/);
});

test('changed source invalidates human approval revision', async () => {
  const fixture = await createFixture();
  await writeFile(join(fixture.options.rootDir, 'generated/pets/approved.md'), `${fixture.source}\nchanged`, 'utf8');

  await assert.rejects(() => preparePublicContent(fixture.options), /Human approval must be renewed/);
});

test('Astro production build generates approved pages SEO sitemap robots RSS and 404', async () => {
  await execFileAsync('npm', ['run', 'site:build'], {
    cwd: resolve('.'),
    maxBuffer: 10 * 1024 * 1024
  });

  const dist = resolve('sites/pets/dist');
  const article = await readFile(join(dist, 'articles/adoption-responsibilities/index.html'), 'utf8');
  const list = await readFile(join(dist, 'articles/index.html'), 'utf8');
  const rss = await readFile(join(dist, 'rss.xml'), 'utf8');
  const robots = await readFile(join(dist, 'robots.txt'), 'utf8');
  const sitemap = await readFile(join(dist, 'sitemap-0.xml'), 'utf8');
  const notFound = await readFile(join(dist, '404.html'), 'utf8');

  assert.match(article, /<title>반려동물 입양 전 체크리스트 10가지 \| Asteria Pets<\/title>/);
  assert.match(article, /rel="canonical" href="https:\/\/pets\.asteria\.example\/articles\/adoption-responsibilities\/"/);
  assert.match(list, /adoption-responsibilities/);
  assert.doesNotMatch(list, /cat-or-dog/);
  assert.match(rss, /adoption-responsibilities/);
  assert.doesNotMatch(rss, /cat-or-dog/);
  assert.match(robots, /Sitemap: https:\/\/pets\.asteria\.example\/sitemap-index\.xml/);
  assert.match(sitemap, /articles\/adoption-responsibilities/);
  assert.match(notFound, /404/);

  for (const output of [article, list, rss, robots, sitemap, notFound]) {
    assert.doesNotMatch(output, /Run Metadata|Editorial Review|gemini-3\.1|Provider:|Model:|Workflow status/);
  }
});

async function createFixture() {
  const rootDir = await mkdtemp(join(tmpdir(), 'asteria-public-content-'));
  const contentDir = join(rootDir, 'generated/pets');
  const outputDir = join(rootDir, 'output');
  const manifestPath = join(rootDir, 'approvals.json');
  const source = createGeneratedSource();
  await mkdir(contentDir, { recursive: true });
  await writeFile(join(contentDir, 'approved.md'), source, 'utf8');
  await writeFile(join(contentDir, 'pending.md'), source.replace('승인 글', '대기 글'), 'utf8');
  await writeFile(manifestPath, JSON.stringify({
    version: 1,
    approvals: [
      createApproval('generated/pets/approved.md', 'approved-guide', true, sha256(source)),
      createApproval('generated/pets/pending.md', 'pending-guide', false, '')
    ]
  }), 'utf8');

  return { source, options: { rootDir, manifestPath, outputDir } };
}

function createApproval(source: string, slug: string, approved: boolean, approvedRevision: string) {
  return {
    source,
    slug,
    category: 'care',
    categoryLabel: '돌봄',
    approved,
    approvedBy: approved ? 'Human Editor' : undefined,
    approvedAt: approved ? '2026-07-21T00:00:00.000Z' : undefined,
    approvedRevision: approved ? approvedRevision : undefined
  };
}

function createGeneratedSource(): string {
  return `# 승인 글

## Run Metadata

- Provider: secret-provider
- Model: secret-model
- Workflow status: success

## Article

공개 본문입니다.

## Summary

공개 요약입니다.

## SEO

- SEO title: 승인된 SEO 제목
- SEO description: SEO 설명입니다.
- Keywords: 비공개 키워드

## FAQ

### 질문

답변입니다.

## Editorial Review

- Result: PASS
- Score: 100/100
`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
