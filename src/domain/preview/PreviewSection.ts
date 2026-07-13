import type { PreviewSectionType } from './PreviewSectionType.ts';

export interface PreviewSection<TPayload> {
  id: string;
  title: string;
  type: PreviewSectionType;
  payload: TPayload;
}
