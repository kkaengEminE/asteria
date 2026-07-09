import { AIProviderError, type AIErrorCode } from '../AIError.ts';
import type { ContentRequest, PublishingPackage } from '../../../domain/content/index.ts';
import type { AIProvider, AIHealthCheckResult } from '../AIProvider.ts';
import { getAIRequestText, validateAIRequest, type AIRequest } from '../AIRequest.ts';
import type { AIResponse } from '../AIResponse.ts';
import { createAIUsage, type AIUsage } from '../AIUsage.ts';
import { countApproximateTokens } from '../MockAIProvider.ts';
import { createProviderToken } from '../../ProviderToken.ts';
import {
  createOpenAIConfigFromEnv,
  validateOpenAIConfig,
  type OpenAIConfig,
  type OpenAIEnvironment
} from './OpenAIConfig.ts';
import {
  extractOpenAIErrorMessage,
  createOpenAIPublishingPackageRequest,
  isOpenAIResponsesBody,
  mapAIRequestToOpenAIRequest,
  mapOpenAIContentToPublishingPackage,
  mapOpenAIResponseToAIResponse
} from './OpenAIMapper.ts';
import { FetchOpenAITransport, type OpenAITransport } from './OpenAITransport.ts';

export const openAIProviderToken = createProviderToken<AIProvider>(
  'AI',
  'openai',
  'OpenAI adapter behind the provider-agnostic AIProvider interface.'
);

export interface OpenAIProviderOptions {
  config?: OpenAIConfig;
  env?: OpenAIEnvironment;
  transport?: OpenAITransport;
}

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  private readonly config: OpenAIConfig;
  private readonly transport: OpenAITransport;

  constructor(options: OpenAIProviderOptions = {}) {
    this.config = options.config ?? createOpenAIConfigFromEnv(options.env);
    validateOpenAIConfig(this.config);
    this.transport = options.transport ?? new FetchOpenAITransport();
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    validateAIRequest(request);
    this.assertReadyForExternalRequest();

    const response = await this.transport.request(this.config, {
      path: '/responses',
      body: mapAIRequestToOpenAIRequest(request, this.config)
    });

    if (response.status < 200 || response.status >= 300) {
      throw new AIProviderError(mapStatusToAIErrorCode(response.status), extractOpenAIErrorMessage(response.body), {
        provider: this.name,
        metadata: {
          status: response.status
        }
      });
    }

    if (!isOpenAIResponsesBody(response.body)) {
      throw new AIProviderError('Unknown', 'OpenAI response body was not an object.', {
        provider: this.name,
        retryable: false
      });
    }

    return mapOpenAIResponseToAIResponse(response.body, this.config);
  }

  async generatePublishingPackage(request: ContentRequest): Promise<PublishingPackage> {
    const response = await this.generate(createOpenAIPublishingPackageRequest(request, this.config));

    try {
      const publishingPackage = mapOpenAIContentToPublishingPackage(response.content, request);

      return {
        ...publishingPackage,
        metadata: {
          ...publishingPackage.metadata,
          provider: this.name,
          model: response.model,
          usage: response.usage,
          openAIResponseId: response.metadata?.openAIResponseId
        }
      };
    } catch (error) {
      throw new AIProviderError('InvalidRequest', error instanceof Error ? error.message : String(error), {
        provider: this.name,
        retryable: false
      });
    }
  }

  async *stream(_request: AIRequest): AsyncIterable<AIResponse> {
    throw new AIProviderError('ProviderUnavailable', 'OpenAI streaming is not implemented yet.', {
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
        message: 'OpenAI production mode is disabled.',
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
        message: 'OpenAI API key is missing.',
        metadata: {
          productionEnabled: true
        }
      };
    }

    return {
      ok: true,
      provider: this.name,
      model: this.config.model,
      message: 'OpenAI adapter is configured.',
      metadata: {
        productionEnabled: true
      }
    };
  }

  private assertReadyForExternalRequest(): void {
    if (!this.config.productionEnabled) {
      throw new AIProviderError('ProviderUnavailable', 'OpenAI production mode is disabled.', {
        provider: this.name,
        retryable: false
      });
    }

    if (!this.config.apiKey) {
      throw new AIProviderError('Authentication', 'OpenAI API key is missing.', {
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
