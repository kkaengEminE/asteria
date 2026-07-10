export interface PublishingDestination {
  type: string;
  name: string;
  enabled: boolean;
  dryRunOnly?: boolean;
  metadata?: Record<string, unknown>;
}
