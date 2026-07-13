import { createTTSSegment, type TTSSegment } from './TTSSegment.ts';

export interface PodcastChapter {
  title: string;
  summary: string;
  order: number;
}

export interface PodcastScript {
  spokenIntro: string;
  spokenOutro: string;
  narration: string;
  chapters: PodcastChapter[];
  ttsSegments: TTSSegment[];
  estimatedDurationSeconds: number;
}

export class PodcastScriptValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PodcastScriptValidationError';
  }
}

export function createPodcastScript(script: PodcastScript): PodcastScript {
  if (!script.spokenIntro || script.spokenIntro.trim().length === 0) {
    throw new PodcastScriptValidationError('Podcast script requires spoken intro.');
  }

  if (!script.spokenOutro || script.spokenOutro.trim().length === 0) {
    throw new PodcastScriptValidationError('Podcast script requires spoken outro.');
  }

  if (!script.narration || script.narration.trim().length === 0) {
    throw new PodcastScriptValidationError('Podcast script requires narration.');
  }

  if (!Array.isArray(script.chapters) || script.chapters.length === 0) {
    throw new PodcastScriptValidationError('Podcast script requires at least one chapter.');
  }

  if (!Array.isArray(script.ttsSegments) || script.ttsSegments.length === 0) {
    throw new PodcastScriptValidationError('Podcast script requires TTS segments.');
  }

  return {
    ...script,
    spokenIntro: script.spokenIntro.trim(),
    spokenOutro: script.spokenOutro.trim(),
    narration: script.narration.trim(),
    chapters: script.chapters.map((chapter, index) => ({
      title: chapter.title.trim(),
      summary: chapter.summary.trim(),
      order: chapter.order || index + 1
    })),
    ttsSegments: script.ttsSegments.map(createTTSSegment),
    estimatedDurationSeconds: Math.ceil(script.estimatedDurationSeconds)
  };
}
