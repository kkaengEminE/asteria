import { pathToFileURL } from 'node:url';
import { loadEnvFile } from '../src/config/index.ts';
import { runMagazineDryRun } from '../src/magazines/runtime/index.ts';
import {
  formatGeneratedArticle,
  formatPublishingPackage,
  formatSeoPreview
} from './dry-run/formatters/contentFormatter.ts';
import { formatInstagramPreview, formatPodcastPreview } from './dry-run/formatters/channelPreviewFormatter.ts';
import { formatSelectedImage } from './dry-run/formatters/mediaFormatter.ts';
import { formatMonetizationPreview } from './dry-run/formatters/monetizationFormatter.ts';
import { formatAuditTimeline, formatMetricsSummary, formatRetryMetadata } from './dry-run/formatters/observabilityFormatter.ts';
import {
  formatExecutionPreview,
  formatPublisher,
  formatPublishingQueue,
  formatPublishPreview,
  formatScheduler
} from './dry-run/formatters/publishingFormatter.ts';

if (isMainModule()) {
  await runDryRunCli(process.argv.slice(2));
}

export async function runDryRunCli(argv: string[]): Promise<void> {
  loadEnvFile();
  const args = parseDryRunArgs(argv);
  const result = await runMagazineDryRun({
    topic: args.topic,
    magazineSlug: args.magazine,
    aiMode: args.aiMode,
    affiliateMode: args.affiliateMode,
    language: args.language
  });

  console.log(formatDryRunReport(result));
}

export function formatDryRunReport(result: Awaited<ReturnType<typeof runMagazineDryRun>>): string {
  const providerName = result.contentGenerationMetadata?.providerName;

  return [
    'Asteria Dry Run',
    '',
    `Magazine: ${result.magazine?.name ?? 'Unavailable'}`,
    `Topic: ${result.topic}`,
    `Workflow Status: ${result.workflowStatus}`,
    `Executed Steps: ${result.executedSteps.length > 0 ? result.executedSteps.join(' -> ') : 'None'}`,
    '',
    'Rendered Prompt Preview:',
    result.renderedPromptPreview ?? 'Unavailable',
    '',
    `${providerName === 'mock-ai' || !providerName ? 'Generated Mock Article' : 'Generated Article'}:`,
    formatGeneratedArticle(result),
    '',
    'SEO Preview:',
    formatSeoPreview(result),
    '',
    'Publishing Package:',
    formatPublishingPackage(result),
    '',
    'Monetization Preview:',
    formatMonetizationPreview(result),
    '',
    'Selected Image:',
    formatSelectedImage(result),
    '',
    'Instagram Preview:',
    formatInstagramPreview(result),
    '',
    'Podcast Preview:',
    formatPodcastPreview(result),
    '',
    'Publishing Queue:',
    formatPublishingQueue(result),
    '',
    'Scheduler:',
    formatScheduler(result),
    '',
    'Execution Preview:',
    formatExecutionPreview(result),
    '',
    'Publisher:',
    formatPublisher(result),
    '',
    'Metrics Summary:',
    formatMetricsSummary(result),
    '',
    'Audit Timeline:',
    formatAuditTimeline(result),
    '',
    'Retry Metadata:',
    formatRetryMetadata(result),
    '',
    'Publish Preview:',
    formatPublishPreview(result),
    '',
    result.error ? `Error: ${result.error}` : 'No external APIs were called. Nothing was published.'
  ].join('\n');
}

export function parseDryRunArgs(args: string[]): {
  topic?: string;
  magazine: string;
  aiMode: 'mock' | 'openai' | 'gemini';
  affiliateMode: 'mock' | 'coupang';
  language?: string;
} {
  const topicParts: string[] = [];
  let magazine = process.env.ASTERIA_MAGAZINE || 'cat';
  let aiMode: 'mock' | 'openai' | 'gemini' = parseAIMode(process.env.ASTERIA_AI_MODE);
  let affiliateMode: 'mock' | 'coupang' = parseAffiliateMode(process.env.ASTERIA_AFFILIATE_MODE);
  let language: string | undefined;

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

    if (arg === '--affiliate') {
      affiliateMode = parseAffiliateMode(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith('--affiliate=')) {
      affiliateMode = parseAffiliateMode(arg.slice('--affiliate='.length));
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

    topicParts.push(arg);
  }

  return {
    topic: topicParts.join(' ') || undefined,
    magazine,
    aiMode,
    affiliateMode,
    language
  };
}

function parseMagazine(value: string | undefined): string {
  return value && value.trim().length > 0 ? value.trim() : 'cat';
}

function parseAIMode(value: string | undefined): 'mock' | 'openai' | 'gemini' {
  return value === 'openai' || value === 'gemini' ? value : 'mock';
}

function parseAffiliateMode(value: string | undefined): 'mock' | 'coupang' {
  return value === 'coupang' ? value : 'mock';
}

function isMainModule(): boolean {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}
