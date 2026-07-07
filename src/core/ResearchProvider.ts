import type { ResearchQuery, ResearchResult } from './types';

export interface ResearchProvider {
  readonly name: string;
  search(query: ResearchQuery): Promise<ResearchResult[]>;
}

