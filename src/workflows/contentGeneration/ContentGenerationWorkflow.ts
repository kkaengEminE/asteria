import {
  createContentRequest,
  type ContentRequest,
  type PublishingPackage
} from '../../domain/content/index.ts';
import type { ApprovalResult } from '../../domain/approval/index.ts';
import type { EditorialReview } from '../../domain/editorialReview/index.ts';
import { AIProviderError, type AIProvider } from '../../providers/ai/index.ts';
import {
  DEFAULT_PROMPT_VERSION,
  composePrompt,
  createDefaultPromptAssetRegistry,
  type ComposedPrompt,
  type PromptAssetRegistry,
  type PromptProfileName,
  type PromptVersion,
} from '../../prompts/index.ts';
import { ContentQualityValidator, type ContentQualityReport } from '../../services/contentQuality/index.ts';
import { EditorialApprovalService } from '../../services/editorialApproval/index.ts';
import { EditorialReviewService } from '../../services/editorialReview/index.ts';
import { RealGenerationReviewService, type RealGenerationReview } from '../../services/realGenerationReview/index.ts';
import {
  StructuredOutputError,
  StructuredOutputParser,
  isRecoverableStructuredOutputError
} from '../../services/structuredOutput/index.ts';

export interface ContentGenerationWorkflowOptions {
  aiProvider: AIProvider;
  maxRetries?: number;
  promptVersion?: PromptVersion;
  promptId?: string;
  promptProfile?: PromptProfileName;
  promptRegistry?: PromptAssetRegistry;
  qualityValidator?: ContentQualityValidator;
  editorialReviewService?: EditorialReviewService;
  realGenerationReviewService?: RealGenerationReviewService;
  editorialApprovalService?: EditorialApprovalService;
  parser?: StructuredOutputParser;
}

export interface ContentGenerationMetadata {
  providerName: string;
  modelName?: string;
  language?: string;
  tokenUsage?: unknown;
  promptProfile: string;
  promptVersion: PromptVersion;
  promptId: string;
  promptIds: string[];
  renderedVariables: Record<string, unknown>;
  renderedPromptPreview: string;
  composedPromptPreview: string;
  retryCount: number;
  validationResult: 'valid';
  validationErrors: string[];
  qualityScore: number;
  qualityReport: ContentQualityReport;
  editorialReview: EditorialReview;
  reviewScore: number;
  reviewResult: EditorialReview['result'];
  reviewSummary: string;
  reviewIssues: EditorialReview['issues'];
  realGenerationReview: RealGenerationReview;
  realGenerationThresholdResult: RealGenerationReview['thresholdResult'];
  approvalResult: ApprovalResult;
  approvalDecision: ApprovalResult['decision'];
  generationDurationMs: number;
}

export class ContentGenerationWorkflow {
  private readonly aiProvider: AIProvider;
  private readonly maxRetries: number;
  private readonly promptVersion: PromptVersion;
  private readonly promptId: string;
  private readonly promptProfile: PromptProfileName;
  private readonly promptRegistry?: PromptAssetRegistry;
  private readonly qualityValidator: ContentQualityValidator;
  private readonly editorialReviewService: EditorialReviewService;
  private readonly realGenerationReviewService: RealGenerationReviewService;
  private readonly editorialApprovalService: EditorialApprovalService;
  private readonly parser: StructuredOutputParser;

  constructor(options: ContentGenerationWorkflowOptions) {
    this.aiProvider = options.aiProvider;
    this.maxRetries = options.maxRetries ?? 1;
    this.promptVersion = options.promptVersion ?? DEFAULT_PROMPT_VERSION;
    this.promptId = options.promptId ?? 'content.article';
    this.promptProfile = options.promptProfile ?? 'default';
    this.promptRegistry = options.promptRegistry;
    this.qualityValidator = options.qualityValidator ?? new ContentQualityValidator();
    this.editorialReviewService = options.editorialReviewService ?? new EditorialReviewService();
    this.realGenerationReviewService = options.realGenerationReviewService ?? new RealGenerationReviewService();
    this.editorialApprovalService = options.editorialApprovalService ?? new EditorialApprovalService();
    this.parser = options.parser ?? new StructuredOutputParser();
  }

  async execute(request: ContentRequest): Promise<PublishingPackage> {
    const startedAt = Date.now();
    const promptRegistry = this.promptRegistry ?? (await createDefaultPromptAssetRegistry());
    const composedPrompt = composePrompt({
      registry: promptRegistry,
      profile: this.promptProfile,
      version: this.promptVersion,
      variables: createPromptVariables(request)
    });
    const normalizedRequest = createContentRequest({
      ...request,
      metadata: {
        ...request.metadata,
        promptProfile: composedPrompt.profile,
        promptId: this.promptId,
        promptIds: composedPrompt.promptIds,
        promptVersion: this.promptVersion,
        renderedPrompt: composedPrompt.rendered,
        renderedVariables: composedPrompt.variables,
        composedPromptPreview: previewComposedPrompt(composedPrompt)
      }
    });
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const generated = await this.aiProvider.generatePublishingPackage(normalizedRequest);
        const parsed = this.parser.parsePublishingPackage(generated);
        const qualityReport = this.qualityValidator.validate(parsed.publishingPackage);
        const editorialReview = this.editorialReviewService.review(parsed.publishingPackage);
        const realGenerationReview = this.realGenerationReviewService.review(
          parsed.publishingPackage,
          qualityReport,
          editorialReview
        );
        const approvalResult = this.editorialApprovalService.evaluate({
          validationResult: 'valid',
          validationErrors: parsed.validation.errors,
          qualityReport,
          editorialReview,
          realGenerationReview
        });

        return attachGenerationMetadata(parsed.publishingPackage, {
          providerName: stringMetadata(parsed.publishingPackage.metadata?.provider) ?? this.aiProvider.name,
          modelName: stringMetadata(parsed.publishingPackage.metadata?.model),
          language: normalizedRequest.language,
          tokenUsage: parsed.publishingPackage.metadata?.usage,
          promptProfile: composedPrompt.profile,
          promptVersion: this.promptVersion,
          promptId: this.promptId,
          promptIds: composedPrompt.promptIds,
          renderedVariables: composedPrompt.variables,
          renderedPromptPreview: previewComposedPrompt(composedPrompt),
          composedPromptPreview: previewComposedPrompt(composedPrompt),
          retryCount: attempt,
          validationResult: 'valid',
          validationErrors: parsed.validation.errors,
          qualityScore: qualityReport.score,
          qualityReport,
          editorialReview,
          reviewScore: editorialReview.score,
          reviewResult: editorialReview.result,
          reviewSummary: editorialReview.summary,
          reviewIssues: editorialReview.issues,
          realGenerationReview,
          realGenerationThresholdResult: realGenerationReview.thresholdResult,
          approvalResult,
          approvalDecision: approvalResult.decision,
          generationDurationMs: Date.now() - startedAt
        });
      } catch (error) {
        lastError = error;

        if (attempt >= this.maxRetries || !isRecoverableContentGenerationError(error)) {
          throw error;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}

export function attachGenerationMetadata(
  publishingPackage: PublishingPackage,
  metadata: ContentGenerationMetadata
): PublishingPackage {
  return {
    ...publishingPackage,
    metadata: {
      ...publishingPackage.metadata,
      providerName: metadata.providerName,
      modelName: metadata.modelName,
      language: metadata.language,
      tokenUsage: metadata.tokenUsage,
      promptProfile: metadata.promptProfile,
      promptId: metadata.promptId,
      promptIds: metadata.promptIds,
      promptVersion: metadata.promptVersion,
      renderedVariables: metadata.renderedVariables,
      renderedPromptPreview: metadata.renderedPromptPreview,
      composedPromptPreview: metadata.composedPromptPreview,
      retryCount: metadata.retryCount,
      validationResult: metadata.validationResult,
      validationErrors: metadata.validationErrors,
      qualityScore: metadata.qualityScore,
      qualityReport: metadata.qualityReport,
      editorialReview: metadata.editorialReview,
      reviewScore: metadata.reviewScore,
      reviewResult: metadata.reviewResult,
      reviewSummary: metadata.reviewSummary,
      reviewIssues: metadata.reviewIssues,
      realGenerationReview: metadata.realGenerationReview,
      realGenerationThresholdResult: metadata.realGenerationThresholdResult,
      approvalResult: metadata.approvalResult,
      approvalDecision: metadata.approvalDecision,
      generationDurationMs: metadata.generationDurationMs
    }
  };
}

function stringMetadata(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

export function createPromptVariables(request: ContentRequest): Record<string, string> {
  return {
    topic: request.topic,
    language: request.language ?? 'ko-KR',
    audience: request.audience ?? 'general readers',
    tone: request.tone ?? 'clear, useful, and trustworthy',
    magazineName: request.magazineName ?? 'Asteria Magazine'
  };
}

function previewComposedPrompt(composedPrompt: ComposedPrompt, maxLength = 1200): string {
  return composedPrompt.rendered.length > maxLength
    ? `${composedPrompt.rendered.slice(0, maxLength)}...`
    : composedPrompt.rendered;
}

export function isRecoverableContentGenerationError(error: unknown): boolean {
  if (isRecoverableStructuredOutputError(error)) {
    return true;
  }

  if (error instanceof AIProviderError) {
    return ['InvalidRequest', 'Timeout', 'RateLimit', 'ProviderUnavailable', 'Unknown'].includes(error.code);
  }

  if (error instanceof StructuredOutputError) {
    return error.recoverable;
  }

  return false;
}
