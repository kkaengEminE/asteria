export interface AssetRegistration {
  id: string;
  filename: string;
  mimeType: string;
  category?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  content?: string | Uint8Array;
  storagePath?: string;
  storageUri?: string;
}
