export type TTSSegmentRole = 'intro' | 'chapter' | 'outro';

export interface TTSSegment {
  id: string;
  role: TTSSegmentRole;
  text: string;
  voiceHint?: string;
  estimatedDurationSeconds: number;
  metadata?: Record<string, unknown>;
}

export class TTSSegmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TTSSegmentValidationError';
  }
}

export function createTTSSegment(segment: TTSSegment): TTSSegment {
  if (!segment.id || segment.id.trim().length === 0) {
    throw new TTSSegmentValidationError('TTS segment requires id.');
  }

  if (!segment.text || segment.text.trim().length === 0) {
    throw new TTSSegmentValidationError('TTS segment requires text.');
  }

  if (segment.estimatedDurationSeconds <= 0) {
    throw new TTSSegmentValidationError('TTS segment estimated duration must be greater than 0.');
  }

  return {
    ...segment,
    id: segment.id.trim(),
    text: segment.text.trim(),
    estimatedDurationSeconds: Math.ceil(segment.estimatedDurationSeconds)
  };
}
