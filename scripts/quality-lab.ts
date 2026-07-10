import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEnvFile } from '../src/config/index.ts';
import { runMagazineDryRun, type DryRunResult } from '../src/magazines/runtime/index.ts';

type QualityLabAIMode = 'mock' | 'openai' | 'gemini';

export interface QualityLabArgs {
  topicsFile: string;
  magazine: string;
  aiMode: QualityLabAIMode;
  language?: string;
  output?: string;
}

export interface QualityLabTopicResult {
  topic: string;
  result: DryRunResult;
}

export interface QualityLabSummary {
  topicCount: number;
  averageQualityScore: number;
  averageReviewScore: number;
  approvalDistribution: Record<string, number>;
  failedTopics: string[];
  retryCount: number;
}

if (isMainModule()) {
  await runQualityLabCli(process.argv.slice(2));
}

export async function runQualityLabCli(argv: string[]): Promise<void> {
  loadEnvFile();
  const args = parseQualityLabArgs(argv);
  const topics = await loadTopics(args.topicsFile);
  const results: QualityLabTopicResult[] = [];

  for (const topic of topics) {
    const result = await runMagazineDryRun({
      topic,
      magazineSlug: args.magazine,
      aiMode: args.aiMode,
      language: args.language
    });

    results.push({
      topic,
      result
    });
  }

  const outputPath = resolve(args.output ?? createDefaultOutputPath(args.topicsFile));
  const markdown = formatQualityLabReport({
    topicsFile: args.topicsFile,
    magazine: args.magazine,
    aiMode: args.aiMode,
    language: args.language,
    results,
    summary: summarizeQualityLabResults(results)
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, markdown, 'utf8');
  console.log(`Quality Lab report written to ${outputPath}`);
}

export function parseQualityLabArgs(args: string[]): QualityLabArgs {
  let topicsFile: string | undefined;
  let magazine = process.env.ASTERIA_MAGAZINE || 'cat';
  let aiMode: QualityLabAIMode = parseAIMode(process.env.ASTERIA_AI_MODE);
  let language: string | undefined;
  let output: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--ai') {
      aiMode = parseAIMode(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith('--ai=')) {
      aiMode = parseAIMode(arg.slice('--ai='.length));
      continue;
    }

    if (arg === '--magazine') {
      magazine = parseMagazine(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith('--magazine=')) {
      magazine = parseMagazine(arg.slice('--magazine='.length));
      continue;
    }

    if (arg === '--language') {
      language = args[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith('--language=')) {
      language = arg.slice('--language='.length);
      continue;
    }

    if (arg === '--output') {
      output = args[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith('--output=')) {
      output = arg.slice('--output='.length);
      continue;
    }

    if (!topicsFile) {
      topicsFile = arg;
    }
  }

  if (!topicsFile) {
    throw new Error('Quality Lab requires a topics file. Example: npm run quality-lab -- topics.txt --ai gemini --language ko-KR');
  }

  return {
    topicsFile,
    magazine,
    aiMode,
    language,
    output
  };
}

export async function loadTopics(path: string): Promise<string[]> {
  const content = await readFile(path, 'utf8');

  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

export function summarizeQualityLabResults(results: QualityLabTopicResult[]): QualityLabSummary {
  const qualityScores = results
    .map((item) => item.result.contentGenerationMetadata?.qualityScore)
    .filter((score): score is number => typeof score === 'number');
  const reviewScores = results
    .map((item) => item.result.contentGenerationMetadata?.reviewScore)
    .filter((score): score is number => typeof score === 'number');
  const approvalDistribution: Record<string, number> = {};
  let retryCount = 0;

  for (const item of results) {
    const approval = item.result.contentGenerationMetadata?.approvalDecision ?? 'UNAVAILABLE';
    approvalDistribution[approval] = (approvalDistribution[approval] ?? 0) + 1;
    retryCount += item.result.contentGenerationMetadata?.retryCount ?? 0;
  }

  return {
    topicCount: results.length,
    averageQualityScore: average(qualityScores),
    averageReviewScore: average(reviewScores),
    approvalDistribution,
    failedTopics: results
      .filter((item) => item.result.workflowStatus === 'failed')
      .map((item) => item.topic),
    retryCount
  };
}

export function formatQualityLabReport(options: {
  topicsFile: string;
  magazine: string;
  aiMode: QualityLabAIMode;
  language?: string;
  results: QualityLabTopicResult[];
  summary: QualityLabSummary;
}): string {
  return [
    '# Asteria Quality Lab Report',
    '',
    `Topics File: ${options.topicsFile}`,
    `Magazine: ${options.magazine}`,
    `AI Mode: ${options.aiMode}`,
    `Language: ${options.language ?? 'default'}`,
    `Generated At: ${new Date().toISOString()}`,
    '',
    '## Overall Report',
    '',
    `Topic Count: ${options.summary.topicCount}`,
    `Average Quality Score: ${formatNumber(options.summary.averageQualityScore)}`,
    `Average Review Score: ${formatNumber(options.summary.averageReviewScore)}`,
    `Approval Distribution: ${formatApprovalDistribution(options.summary.approvalDistribution)}`,
    `Failed Topics: ${options.summary.failedTopics.length > 0 ? options.summary.failedTopics.join(', ') : 'None'}`,
    `Retry Count: ${options.summary.retryCount}`,
    '',
    '## Topic Results',
    '',
    ...options.results.flatMap((item, index) => formatTopicResult(item, index + 1))
  ].join('\n');
}

function formatTopicResult(item: QualityLabTopicResult, index: number): string[] {
  const pkg = item.result.publishingPackage;
  const metadata = item.result.contentGenerationMetadata;

  return [
    `### ${index}. ${item.topic}`,
    '',
    `Topic: ${item.topic}`,
    `Title: ${pkg?.article.title ?? 'Unavailable'}`,
    `Summary: ${pkg?.summary.text ?? pkg?.article.summary ?? 'Unavailable'}`,
    `Quality Score: ${metadata?.qualityScore ?? 'Unavailable'}`,
    `Review Score: ${metadata?.reviewScore ?? 'Unavailable'}`,
    `Approval: ${metadata?.approvalDecision ?? 'Unavailable'}`,
    `Generation Time: ${metadata?.generationDurationMs ?? 'Unavailable'}ms`,
    `Token Usage: ${formatTokenUsage(metadata?.tokenUsage)}`,
    item.result.workflowStatus === 'failed' ? `Error: ${item.result.error ?? 'Unknown error'}` : '',
    ''
  ].filter(Boolean);
}

function parseMagazine(value: string | undefined): string {
  return value && value.trim().length > 0 ? value.trim() : 'cat';
}

function parseAIMode(value: string | undefined): QualityLabAIMode {
  return value === 'openai' || value === 'gemini' ? value : 'mock';
}

function createDefaultOutputPath(topicsFile: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const name = basename(topicsFile).replace(/\.[^.]+$/, '') || 'topics';

  return `reports/quality-lab/${name}-${stamp}.md`;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatApprovalDistribution(distribution: Record<string, number>): string {
  const entries = Object.entries(distribution);

  return entries.length > 0
    ? entries.map(([decision, count]) => `${decision}=${count}`).join(', ')
    : 'None';
}

function formatTokenUsage(usage: unknown): string {
  if (!usage || typeof usage !== 'object') {
    return 'Unavailable';
  }

  const value = usage as {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };

  return `prompt=${value.promptTokens ?? 0}, completion=${value.completionTokens ?? 0}, total=${value.totalTokens ?? 0}`;
}

function isMainModule(): boolean {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}
