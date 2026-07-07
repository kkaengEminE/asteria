import type { ImageCategory } from '../../../domain/image/index.ts';

export interface GoogleDriveImageRecord {
  id: string;
  filename: string;
  title?: string;
  description?: string;
  tags?: string[];
  category?: ImageCategory;
  width?: number;
  height?: number;
  rating?: number;
  favorite?: boolean;
  driveFileId: string;
  mockUri: string;
  takenAt?: string;
  checksum?: string;
}

