import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface ArticleApproval {
  source: string;
  slug: string;
  category: string;
  categoryLabel: string;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: string;
  approvedRevision?: string;
}

export interface ApprovalManifest {
  version: number;
  approvals: ArticleApproval[];
}

export interface PreparedPublicArticle {
  slug: string;
  source: string;
  output: string;
  title: string;
}

export async function preparePublicContent(options: {
  rootDir: string;
  manifestPath: string;
  outputDir: string;
}): Promise<PreparedPublicArticle[]> {
  const rootDir = resolve(options.rootDir);
  const manifest = parseManifest(await readFile(options.manifestPath, 'utf8'));
  const outputDir = resolve(options.outputDir);
  const prepared: PreparedPublicArticle[] = [];

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  for (const approval of manifest.approvals) {
    if (approval.approved !== true) continue;
    validateApproval(approval);

    const sourcePath = resolve(rootDir, approval.source);
    assertWithinRoot(rootDir, sourcePath);
    const source = await readFile(sourcePath, 'utf8');
    const actualRevision = sha256(source);

    if (actualRevision !== approval.approvedRevision) {
      throw new Error(
        `Approved revision mismatch for ${approval.source}. Human approval must be renewed for the changed source.`
      );
    }

    const article = parseGeneratedArticle(source);
    const publicMarkdown = createPublicMarkdown(article, approval);
    assertPublicBoundary(publicMarkdown, approval.source);
    const output = resolve(outputDir, `${approval.slug}.md`);
    assertWithinRoot(outputDir, output);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, publicMarkdown, 'utf8');
    prepared.push({ slug: approval.slug, source: approval.source, output, title: article.title });
  }

  return prepared;
}

export function parseGeneratedArticle(source: string): {
  title: string;
  article: string;
  summary: string;
  seoTitle: string;
  seoDescription: string;
  faq: string;
} {
  const normalized = source.replace(/\r\n/g, '\n');
  const title = normalized.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const article = readSection(normalized, 'Article');
  const summary = readSection(normalized, 'Summary');
  const seo = readSection(normalized, 'SEO');
  const faq = readSection(normalized, 'FAQ');
  const seoTitle = seo.match(/^- SEO title:\s*(.+)$/m)?.[1]?.trim();
  const seoDescription = seo.match(/^- SEO description:\s*(.+)$/m)?.[1]?.trim();

  if (!title || !article || !summary || !seoTitle || !seoDescription || !faq) {
    throw new Error('Generated article is missing a required public section.');
  }

  return { title, article, summary, seoTitle, seoDescription, faq };
}

export function assertPublicBoundary(value: string, sourceName = 'public article'): void {
  const forbidden = [
    /^## Run Metadata$/m,
    /^## Editorial Review$/m,
    /^- Provider:/m,
    /^- Model:/m,
    /^- Workflow status:/m,
    /^- Editorial review time:/m,
    /^- Score:/m,
    /^- Issues:/m,
    /approvedRevision/,
    /approvedBy/
  ];

  if (forbidden.some((pattern) => pattern.test(value))) {
    throw new Error(`Internal metadata crossed the public boundary for ${sourceName}.`);
  }
}

function parseManifest(value: string): ApprovalManifest {
  const parsed: unknown = JSON.parse(value);
  if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.approvals)) {
    throw new Error('Public approval manifest must use version 1 and contain an approvals array.');
  }
  return parsed as unknown as ApprovalManifest;
}

function validateApproval(approval: ArticleApproval): void {
  const required = [approval.source, approval.slug, approval.category, approval.categoryLabel, approval.approvedBy, approval.approvedAt, approval.approvedRevision];
  if (required.some((value) => typeof value !== 'string' || value.trim().length === 0)) {
    throw new Error('Every approved article requires source, slug, category, approver, date, and revision.');
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(approval.slug) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(approval.category)) {
    throw new Error(`Approval slugs must be URL-safe: ${approval.source}.`);
  }
  if (/bot|system|automation|codex|pipeline/i.test(approval.approvedBy!)) {
    throw new Error(`Approval must name a human editorial owner: ${approval.source}.`);
  }
  if (Number.isNaN(Date.parse(approval.approvedAt!)) || !/^[a-f0-9]{64}$/.test(approval.approvedRevision!)) {
    throw new Error(`Approval date or revision is invalid: ${approval.source}.`);
  }
}

function createPublicMarkdown(
  article: ReturnType<typeof parseGeneratedArticle>,
  approval: ArticleApproval
): string {
  const frontmatter = [
    '---',
    `title: ${JSON.stringify(article.seoTitle)}`,
    `description: ${JSON.stringify(article.seoDescription)}`,
    `category: ${JSON.stringify(approval.category)}`,
    `categoryLabel: ${JSON.stringify(approval.categoryLabel)}`,
    `publishedAt: ${JSON.stringify(approval.approvedAt)}`,
    '---'
  ].join('\n');

  return `${frontmatter}\n\n# ${article.title}\n\n${article.article}\n\n## 요약\n\n${article.summary}\n\n## 자주 묻는 질문\n\n${article.faq}\n`;
}

function readSection(source: string, name: string): string {
  const heading = `## ${name}`;
  const start = source.indexOf(heading);
  if (start < 0) return '';
  const contentStart = start + heading.length;
  const remaining = source.slice(contentStart).replace(/^\s*\n/, '');
  const nextHeading = remaining.search(/^##\s+/m);
  return (nextHeading < 0 ? remaining : remaining.slice(0, nextHeading)).trim();
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function assertWithinRoot(root: string, candidate: string): void {
  const relation = relative(root, candidate);
  if (relation === '..' || relation.startsWith(`..${sep}`)) {
    throw new Error(`Path escapes the allowed root: ${candidate}.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function run(): Promise<void> {
  const rootDir = process.cwd();
  const prepared = await preparePublicContent({
    rootDir,
    manifestPath: resolve(rootDir, 'sites/pets/content/approvals.json'),
    outputDir: resolve(rootDir, 'sites/pets/.generated/articles')
  });
  process.stdout.write(`Prepared ${prepared.length} human-approved public article(s).\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await run();
}
