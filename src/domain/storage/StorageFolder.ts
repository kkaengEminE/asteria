export interface StorageFolder {
  id: string;
  path: string;
  name: string;
  createdAt?: string;
  provider?: string;
  metadata?: Record<string, unknown>;
}
