export interface AIProviderRequest {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  metadata?: Record<string, unknown>;
}

export interface AIProviderResponse {
  text: string;
  model?: string;
  usage?: Record<string, number>;
  metadata?: Record<string, unknown>;
}

export interface AIProvider {
  readonly name: string;
  generate(request: AIProviderRequest): Promise<AIProviderResponse>;
}

