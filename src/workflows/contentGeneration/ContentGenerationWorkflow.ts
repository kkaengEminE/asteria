import {
  createContentRequest,
  type ContentRequest,
  type PublishingPackage
} from '../../domain/content/index.ts';
import type { AuditContext } from '../../domain/audit/index.ts';
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
import type { AuditLog } from '../../services/auditLog/index.ts';
import { RetryService, type RetryServiceExecuteOptions } from '../../services/retry/index.ts';
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
  auditLog?: AuditLog;
  retryService?: RetryService;
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
  private readonly auditLog?: AuditLog;
  private readonly retryService: RetryService;

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
    this.auditLog = options.auditLog;
    this.editorialApprovalService = options.editorialApprovalService ?? new EditorialApprovalService({
      auditLog: options.auditLog
    });
    this.parser = options.parser ?? new StructuredOutputParser();
    this.retryService = options.retryService ?? new RetryService();
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
    const auditContext = createContentGenerationAuditContext(normalizedRequest);

    const retryResult = await this.retryService.execute(
      async (attemptNumber) => {
        const retryCount = attemptNumber - 1;
        const generated = await this.aiProvider.generatePublishingPackage(normalizedRequest);
        const parsed = this.parser.parsePublishingPackage(generated);
        this.auditLog?.append({
          type: 'CONTENT_GENERATED',
          actor: {
            type: 'workflow',
            id: 'content-generation',
            name: 'ContentGenerationWorkflow'
          },
          context: auditContext,
          message: `Content generated for topic: ${normalizedRequest.topic}.`,
          metadata: {
            providerName: parsed.publishingPackage.metadata?.provider ?? this.aiProvider.name,
            modelName: parsed.publishingPackage.metadata?.model,
            retryCount
          }
        });
        const qualityReport = this.qualityValidator.validate(parsed.publishingPackage);
        this.auditLog?.append({
          type: 'QUALITY_EVALUATED',
          actor: {
            type: 'service',
            id: 'content-quality',
            name: 'ContentQualityValidator'
          },
          context: auditContext,
          message: `Quality evaluated with score ${qualityReport.score}.`,
          metadata: {
            score: qualityReport.score,
            valid: qualityReport.valid,
            errorCount: qualityReport.errors.length,
            warningCount: qualityReport.warnings.length
          }
        });
        const editorialReview = this.editorialReviewService.review(parsed.publishingPackage);
        this.auditLog?.append({
          type: 'EDITORIAL_REVIEW_COMPLETED',
          actor: {
            type: 'service',
            id: 'editorial-review',
            name: 'EditorialReviewService'
          },
          context: auditContext,
          message: `Editorial review completed with result ${editorialReview.result}.`,
          metadata: {
            result: editorialReview.result,
            score: editorialReview.score,
            issueCount: editorialReview.issues.length
          }
        });
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
          realGenerationReview,
          auditContext
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
          retryCount,
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
      },
      createContentGenerationRetryOptions(this.maxRetries)
    );

    if (retryResult.status === 'success' && retryResult.value) {
      return retryResult.value;
    }

    throw retryResult.error instanceof Error ? retryResult.error : new Error(String(retryResult.error));
  }
}

function createContentGenerationRetryOptions(maxRetries: number): RetryServiceExecuteOptions {
  return {
    policy: {
      maxAttempts: maxRetries + 1,
      delayMs: 0
    },
    classifyError(error) {
      return {
        code: getRetryErrorCode(error),
        message: error instanceof Error ? error.message : String(error),
        retryable: isRecoverableContentGenerationError(error)
      };
    }
  };
}

function getRetryErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string') {
    return (error as { code: string }).code;
  }

  if (error instanceof Error && error.name !== 'Error') {
    return error.name;
  }

  return 'unknown';
}

function createContentGenerationAuditContext(request: ContentRequest): AuditContext {
  return {
    entityId: String(request.metadata?.magazineSlug ?? request.topic),
    entityType: 'publishingPackage',
    magazineSlug: stringMetadata(request.metadata?.magazineSlug),
    topic: request.topic,
    metadata: {
      language: request.language,
      magazineName: request.magazineName,
      dryRun: request.metadata?.dryRun
    }
  };
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
