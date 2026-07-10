export interface StorageFileMetadata {
  id: string;
  path: string;
  name: string;
  size: number;
  contentType?: string;
  checksum?: string;
  createdAt?: string;
  updatedAt?: string;
  provider?: string;
  metadata?: Record<string, unknown>;
}
