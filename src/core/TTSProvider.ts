import type { AudioAsset, LocaleCode } from './types';

export interface TTSRequest {
  text: string;
  language: LocaleCode;
  voice?: string;
  metadata?: Record<string, unknown>;
}

export interface TTSProvider {
  readonly name: string;
  synthesize(request: TTSRequest): Promise<AudioAsset>;
}

