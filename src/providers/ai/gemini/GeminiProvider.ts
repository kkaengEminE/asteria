import { AIProviderError, type AIErrorCode } from '../AIError.ts';
import type { ContentRequest, PublishingPackage } from '../../../domain/content/index.ts';
import type { AIHealthCheckResult, AIProvider } from '../AIProvider.ts';
import { getAIRequestText, validateAIRequest, type AIRequest } from '../AIRequest.ts';
import type { AIResponse } from '../AIResponse.ts';
import { createAIUsage, type AIUsage } from '../AIUsage.ts';
import { countApproximateTokens } from '../MockAIProvider.ts';
import { createProviderToken } from '../../ProviderToken.ts';
import {
  createGeminiConfigFromEnv,
  validateGeminiConfig,
  type GeminiConfig,
  type GeminiEnvironment
} from './GeminiConfig.ts';
import {
  createGeminiPublishingPackageRequest,
  extractGeminiErrorMessage,
  GeminiOutputParseError,
  isGeminiGenerateContentBody,
  mapAIRequestToGeminiRequest,
  mapGeminiContentToPublishingPackage,
  mapGeminiResponseToAIResponse
} from './GeminiMapper.ts';
import { FetchGeminiTransport, type GeminiTransport } from './GeminiTransport.ts';

export const geminiProviderToken = createProviderToken<AIProvider>(
  'AI',
  'gemini',
  'Gemini adapter behind the provider-agnostic AIProvider interface.'
);

export interface GeminiProviderOptions {
  config?: GeminiConfig;
  env?: GeminiEnvironment;
  transport?: GeminiTransport;
}

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  private readonly config: GeminiConfig;
  private readonly transport: GeminiTransport;

  constructor(options: GeminiProviderOptions = {}) {
    this.config = options.config ?? createGeminiConfigFromEnv(options.env);
    validateGeminiConfig(this.config);
    this.transport = options.transport ?? new FetchGeminiTransport();
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    validateAIRequest(request);
    this.assertReadyForExternalRequest();

    const response = await this.transport.request(this.config, {
      path: `/models/${encodeURIComponent(request.model ?? this.config.model)}:generateContent`,
      body: mapAIRequestToGeminiRequest(request)
    });

    if (response.status < 200 || response.status >= 300) {
      throw new AIProviderError(mapStatusToAIErrorCode(response.status), extractGeminiErrorMessage(response.body), {
        provider: this.name,
        metadata: {
          status: response.status
        }
      });
    }

    if (!isGeminiGenerateContentBody(response.body)) {
      throw new AIProviderError('Unknown', 'Gemini response body was not an object.', {
        provider: this.name,
        retryable: false
      });
    }

    const aiResponse = mapGeminiResponseToAIResponse(response.body, this.config);

    if (aiResponse.content.trim().length === 0) {
      throw new AIProviderError('InvalidRequest', 'Gemini response did not include generated text.', {
        provider: this.name,
        retryable: false
      });
    }

    return aiResponse;
  }

  async generatePublishingPackage(request: ContentRequest): Promise<PublishingPackage> {
    const response = await this.generate(createGeminiPublishingPackageRequest(request, this.config));

    try {
      const publishingPackage = mapGeminiContentToPublishingPackage(response.content, request);

      return {
        ...publishingPackage,
        metadata: {
          ...publishingPackage.metadata,
          provider: this.name,
          model: response.model,
          usage: response.usage,
          geminiFinishReason: response.metadata?.finishReason
        }
      };
    } catch (error) {
      const message = error instanceof GeminiOutputParseError
        ? [
            'Gemini publishing package parse failed.',
            `Provider: ${this.name}.`,
            `Model: ${response.model}.`,
            `Parse error: ${error.parseError}.`,
            `Raw response preview: ${error.rawResponsePreview}`
          ].join(' ')
        : error instanceof Error
          ? error.message
          : String(error);

      throw new AIProviderError('InvalidRequest', message, {
        provider: this.name,
        retryable: false,
        metadata: error instanceof GeminiOutputParseError
          ? {
              provider: this.name,
              model: response.model,
              parseError: error.parseError,
              rawResponsePreview: error.rawResponsePreview
            }
          : undefined
      });
    }
  }

  async *stream(_request: AIRequest): AsyncIterable<AIResponse> {
    throw new AIProviderError('ProviderUnavailable', 'Gemini streaming is not implemented yet.', {
      provider: this.name,
      retryable: false
    });
  }

  async countTokens(request: AIRequest): Promise<AIUsage> {
    validateAIRequest(request);
    return createAIUsage(countApproximateTokens(getAIRequestText(request)), 0);
  }

  async healthCheck(): Promise<AIHealthCheckResult> {
    if (!this.config.productionEnabled) {
      return {
        ok: false,
        provider: this.name,
        model: this.config.model,
        message: 'Gemini production mode is disabled. Set GEMINI_PRODUCTION_ENABLED=true.',
        metadata: {
          productionEnabled: false
        }
      };
    }

    if (!this.config.apiKey) {
      return {
        ok: false,
        provider: this.name,
        model: this.config.model,
        message: 'Gemini API key is missing. Set GEMINI_API_KEY.',
        metadata: {
          productionEnabled: true
        }
      };
    }

    return {
      ok: true,
      provider: this.name,
      model: this.config.model,
      message: 'Gemini adapter is configured.',
      metadata: {
        productionEnabled: true
      }
    };
  }

  private assertReadyForExternalRequest(): void {
    if (!this.config.productionEnabled) {
      throw new AIProviderError('ProviderUnavailable', 'Gemini production mode is disabled. Set GEMINI_PRODUCTION_ENABLED=true.', {
        provider: this.name,
        retryable: false
      });
    }

    if (!this.config.apiKey) {
      throw new AIProviderError('Authentication', 'Gemini API key is missing. Set GEMINI_API_KEY.', {
        provider: this.name,
        retryable: false
      });
    }
  }
}

export function mapStatusToAIErrorCode(status: number): AIErrorCode {
  if (status === 401 || status === 403) {
    return 'Authentication';
  }

  if (status === 408 || status === 504) {
    return 'Timeout';
  }

  if (status === 429) {
    return 'RateLimit';
  }

  if (status >= 500) {
    return 'ProviderUnavailable';
  }

  if (status >= 400) {
    return 'InvalidRequest';
  }

  return 'Unknown';
}
