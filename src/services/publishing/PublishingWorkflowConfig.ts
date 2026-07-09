export interface PublishingWorkflowConfig {
  publishingEnabled: boolean;
  dryRun: boolean;
  requireApproval: boolean;
}

export interface PublishingWorkflowEnvironment {
  ASTERIA_PUBLISHING_ENABLED?: string;
  ASTERIA_PUBLISHING_DRY_RUN?: string;
}

export function createPublishingWorkflowConfig(
  config: Partial<PublishingWorkflowConfig> = {}
): PublishingWorkflowConfig {
  return {
    publishingEnabled: config.publishingEnabled ?? false,
    dryRun: config.dryRun ?? true,
    requireApproval: config.requireApproval ?? true
  };
}

export function createPublishingWorkflowConfigFromEnv(
  env: PublishingWorkflowEnvironment = process.env
): PublishingWorkflowConfig {
  return createPublishingWorkflowConfig({
    publishingEnabled: env.ASTERIA_PUBLISHING_ENABLED === 'true',
    dryRun: env.ASTERIA_PUBLISHING_DRY_RUN === 'false' ? false : true,
    requireApproval: true
  });
}
