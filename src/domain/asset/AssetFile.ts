import type { Asset } from './Asset.ts';

export interface AssetFile {
  asset: Asset;
  content: Uint8Array;
}
