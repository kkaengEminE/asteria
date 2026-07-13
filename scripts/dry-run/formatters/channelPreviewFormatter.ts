import type { InstagramContentPackage } from '../../../src/domain/instagram/index.ts';
import type { PodcastContentPackage } from '../../../src/domain/podcast/index.ts';
import type { DryRunResult } from '../../../src/services/dryRun/index.ts';

export function formatInstagramPreview(result: DryRunResult): string {
  const preview = result.previewReport.channels.find((channel) => channel.channel === 'instagram')?.payload as
    | InstagramContentPackage
    | undefined;

  if (!preview) {
    return 'Unavailable';
  }

  return [
    `Magazine: ${preview.magazineName}`,
    `Language: ${preview.language}`,
    `Short Caption: ${preview.post.caption.short}`,
    'Long Caption:',
    preview.post.caption.long,
    `CTA: ${preview.post.caption.cta}`,
    `Primary Hashtags: ${preview.post.hashtags.primary.join(' ') || 'Unavailable'}`,
    `Secondary Hashtags: ${preview.post.hashtags.secondary.join(' ') || 'Unavailable'}`,
    `Branded Hashtags: ${preview.post.hashtags.branded.join(' ') || 'Unavailable'}`,
    `Alt Text: ${preview.post.altText}`,
    `Image Reference: ${preview.post.imageSelectionReference ?? 'Unavailable'}`,
    `Source SEO Keywords: ${preview.source.seoKeywords.join(', ') || 'Unavailable'}`
  ].join('\n');
}

export function formatPodcastPreview(result: DryRunResult): string {
  const preview = result.previewReport.channels.find((channel) => channel.channel === 'podcast')?.payload as
    | PodcastContentPackage
    | undefined;

  if (!preview) {
    return 'Unavailable';
  }

  return [
    `Episode Title: ${preview.episode.title}`,
    `Language: ${preview.episode.language}`,
    `Voice: ${preview.ttsRequest.voice}`,
    `Estimated Duration: ${preview.episode.script.estimatedDurationSeconds}s`,
    'Spoken Intro:',
    preview.episode.script.spokenIntro,
    'Chapters:',
    preview.episode.script.chapters
      .map((chapter) => `${chapter.order}. ${chapter.title}: ${chapter.summary}`)
      .join('\n'),
    'TTS Segments:',
    preview.ttsRequest.segments
      .map((segment) => `${segment.id} [${segment.role}] ${segment.estimatedDurationSeconds}s`)
      .join('\n'),
    'Spoken Outro:',
    preview.episode.script.spokenOutro,
    `Instagram Hook Used: ${preview.source.instagramShortCaption ?? 'Unavailable'}`
  ].join('\n');
}
