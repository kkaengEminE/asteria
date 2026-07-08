export interface AIModel {
  id: string;
  provider?: string;
  displayName?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  supportsStreaming?: boolean;
  metadata?: Record<string, unknown>;
}
