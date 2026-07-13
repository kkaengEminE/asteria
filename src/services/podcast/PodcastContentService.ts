import type { PublishingPackage } from '../../domain/content/index.ts';
import type { InstagramContentPackage } from '../../domain/instagram/index.ts';
import type { MagazineProfile } from '../../domain/magazineProfile/index.ts';
import {
  createPodcastContentPackage,
  type PodcastChapter,
  type PodcastContentPackage,
  type TTSSegment
} from '../../domain/podcast/index.ts';

export interface GeneratePodcastContentOptions {
  publishingPackage: PublishingPackage;
  magazineProfile: MagazineProfile;
  instagramPreview?: InstagramContentPackage;
}

const WORDS_PER_MINUTE = 150;

export class PodcastContentService {
  generate(options: GeneratePodcastContentOptions): PodcastContentPackage {
    const { publishingPackage, magazineProfile, instagramPreview } = options;
    const articleTitle = publishingPackage.article.title;
    const chapters = createChapters(publishingPackage);
    const spokenIntro = createIntro(articleTitle, magazineProfile, instagramPreview);
    const spokenOutro = createOutro(magazineProfile, instagramPreview);
    const chapterSegments = chapters.map((chapter) => createChapterSegment(chapter, magazineProfile));
    const ttsSegments: TTSSegment[] = [
      createSegment('intro', 'intro', spokenIntro, magazineProfile),
      ...chapterSegments,
      createSegment('outro', 'outro', spokenOutro, magazineProfile)
    ];
    const narration = ttsSegments.map((segment) => segment.text).join('\n\n');
    const estimatedDurationSeconds = ttsSegments.reduce(
      (total, segment) => total + segment.estimatedDurationSeconds,
      0
    );

    return createPodcastContentPackage({
      episode: {
        title: `${articleTitle} - audio brief`,
        description: publishingPackage.summary.text || publishingPackage.article.summary,
        language: publishingPackage.article.language ?? magazineProfile.language,
        magazineName: magazineProfile.name,
        script: {
          spokenIntro,
          spokenOutro,
          narration,
          chapters,
          ttsSegments,
          estimatedDurationSeconds
        },
        metadata: {
          dryRun: true,
          providerNeutral: true,
          tone: magazineProfile.tone
        }
      },
      ttsRequest: {
        language: publishingPackage.article.language ?? magazineProfile.language,
        voice: selectVoiceHint(magazineProfile),
        segments: ttsSegments,
        metadata: {
          dryRun: true,
          providerNeutral: true,
          generatedFrom: 'PodcastContentService'
        }
      },
      source: {
        articleTitle,
        magazineId: magazineProfile.id,
        instagramShortCaption: instagramPreview?.post.caption.short
      },
      metadata: {
        dryRun: true,
        sourcePackage: 'PublishingPackage',
        instagramPreviewUsed: Boolean(instagramPreview)
      }
    });
  }
}

function createIntro(
  articleTitle: string,
  profile: MagazineProfile,
  instagramPreview?: InstagramContentPackage
): string {
  const socialHook = instagramPreview?.post.caption.short
    ? `Today's social hook is: ${trimTrailingPunctuation(instagramPreview.post.caption.short)}.`
    : `Today's topic comes from ${profile.name}.`;

  return [
    `Welcome to ${profile.name}.`,
    socialHook,
    `In this short audio brief, we will cover ${articleTitle}.`
  ].join(' ');
}

function trimTrailingPunctuation(value: string): string {
  return value.trim().replace(/[.!?]+$/u, '');
}

function createOutro(profile: MagazineProfile, instagramPreview?: InstagramContentPackage): string {
  const cta = instagramPreview?.post.caption.cta
    ? instagramPreview.post.caption.cta
    : `Save this ${profile.id} episode for your next care routine.`;

  return [
    `That is the quick brief from ${profile.name}.`,
    cta,
    'Publishing and audio distribution remain disabled in this dry run.'
  ].join(' ');
}

function createChapters(pkg: PublishingPackage): PodcastChapter[] {
  const faq = pkg.faq[0];

  return [
    {
      order: 1,
      title: 'Overview',
      summary: pkg.summary.text || pkg.article.summary
    },
    {
      order: 2,
      title: 'Key Takeaways',
      summary: firstSentences(pkg.article.body, 2)
    },
    {
      order: 3,
      title: 'Listener Question',
      summary: faq ? `${faq.question} ${faq.answer}` : pkg.productPrompt.prompt
    }
  ];
}

function createChapterSegment(chapter: PodcastChapter, profile: MagazineProfile): TTSSegment {
  return createSegment(
    `chapter-${chapter.order}`,
    'chapter',
    `Chapter ${chapter.order}: ${chapter.title}. ${chapter.summary}`,
    profile,
    {
      chapterTitle: chapter.title
    }
  );
}

function createSegment(
  id: string,
  role: TTSSegment['role'],
  text: string,
  profile: MagazineProfile,
  metadata?: Record<string, unknown>
): TTSSegment {
  return {
    id,
    role,
    text,
    voiceHint: selectVoiceHint(profile),
    estimatedDurationSeconds: estimateDurationSeconds(text),
    metadata
  };
}

function estimateDurationSeconds(text: string): number {
  const wordCount = Math.max(1, text.trim().split(/\s+/u).filter(Boolean).length);

  return Math.max(3, Math.ceil((wordCount / WORDS_PER_MINUTE) * 60));
}

function selectVoiceHint(profile: MagazineProfile): string {
  return profile.language.startsWith('ko') ? 'warm-ko-neutral' : 'warm-editorial-neutral';
}

function firstSentences(value: string, sentenceCount: number): string {
  const sentences = value
    .split(/(?<=[.!?。！？])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return sentences.slice(0, sentenceCount).join(' ') || value.trim();
}
