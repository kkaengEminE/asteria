import type { AIMessage } from '../AIMessage.ts';
import type { AIRequest } from '../AIRequest.ts';
import type { AIResponse } from '../AIResponse.ts';
import { createAIUsage } from '../AIUsage.ts';
import type { OpenAIConfig } from './OpenAIConfig.ts';

export interface OpenAIResponsesRequestBody {
  model: string;
  input: Array<{
    role: string;
    content: string;
  }>;
  temperature?: number;
  max_output_tokens?: number;
  metadata?: Record<string, string>;
}

export interface OpenAIResponsesBody {
  id?: string;
  model?: string;
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  status?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

export function mapAIRequestToOpenAIRequest(request: AIRequest, config: OpenAIConfig): OpenAIResponsesRequestBody {
  return {
    model: request.model ?? config.model,
    input: createInputMessages(request),
    temperature: request.temperature,
    max_output_tokens: request.maxTokens,
    metadata: stringifyMetadata(request.metadata)
  };
}

export function mapOpenAIResponseToAIResponse(body: OpenAIResponsesBody, config: OpenAIConfig): AIResponse {
  const content = extractOutputText(body);
  const promptTokens = body.usage?.input_tokens ?? 0;
  const completionTokens = body.usage?.output_tokens ?? 0;

  return {
    content,
    finishReason: body.status === 'incomplete' ? 'length' : 'stop',
    usage: createAIUsage(promptTokens, completionTokens),
    model: body.model ?? config.model,
    provider: 'openai',
    metadata: {
      openAIResponseId: body.id,
      status: body.status
    }
  };
}

export function extractOpenAIErrorMessage(body: unknown): string {
  if (isOpenAIResponsesBody(body) && body.error?.message) {
    return body.error.message;
  }

  return 'OpenAI request failed.';
}

export function isOpenAIResponsesBody(body: unknown): body is OpenAIResponsesBody {
  return typeof body === 'object' && body !== null;
}

function createInputMessages(request: AIRequest): AIMessage[] {
  const messages: AIMessage[] = [];

  if (request.systemPrompt) {
    messages.push({
      role: 'system',
      content: request.systemPrompt
    });
  }

  if (request.messages) {
    messages.push(...request.messages);
  }

  if (request.userPrompt) {
    messages.push({
      role: 'user',
      content: request.userPrompt
    });
  }

  return messages.map((message) => ({
    role: message.role,
    content: message.content
  }));
}

function extractOutputText(body: OpenAIResponsesBody): string {
  if (body.output_text) {
    return body.output_text;
  }

  return (
    body.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter((text): text is string => Boolean(text))
      .join('\n') ?? ''
  );
}

function stringifyMetadata(metadata: Record<string, unknown> | undefined): Record<string, string> | undefined {
  if (!metadata) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key, value]) => key.trim().length > 0 && value !== undefined)
      .map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)])
  );
}
