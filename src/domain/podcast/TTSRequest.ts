import { createTTSSegment, type TTSSegment } from './TTSSegment.ts';

export interface TTSRequest {
  language: string;
  voice: string;
  segments: TTSSegment[];
  metadata?: Record<string, unknown>;
}

export class TTSRequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TTSRequestValidationError';
  }
}

export function createTTSRequest(request: TTSRequest): TTSRequest {
  if (!request.language || request.language.trim().length === 0) {
    throw new TTSRequestValidationError('TTS request requires language.');
  }

  if (!request.voice || request.voice.trim().length === 0) {
    throw new TTSRequestValidationError('TTS request requires voice.');
  }

  if (!Array.isArray(request.segments) || request.segments.length === 0) {
    throw new TTSRequestValidationError('TTS request requires at least one segment.');
  }

  return {
    ...request,
    language: request.language.trim(),
    voice: request.voice.trim(),
    segments: request.segments.map(createTTSSegment)
  };
}
