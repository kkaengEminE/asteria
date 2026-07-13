import { PersistenceRevisionConflictError, type PageRequest, type PageResult, type RevisionCheck, type Revisioned } from '../../../services/persistence/index.ts';

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function parseJson<T>(value: unknown): T {
  return JSON.parse(String(value)) as T;
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createRevisioned<T>(value: T, revision: unknown): Revisioned<T> {
  return {
    value: clone(value),
    revision: Number(revision)
  };
}

export function assertRevision(entityName: string, actualRevision: number, revision?: RevisionCheck): void {
  if (revision?.expectedRevision !== undefined && revision.expectedRevision !== actualRevision) {
    throw new PersistenceRevisionConflictError(entityName, revision.expectedRevision, actualRevision);
  }
}

export function pageItems<T>(items: T[], query: PageRequest = {}): PageResult<T> {
  const offset = query.cursor ? Number.parseInt(query.cursor.value, 10) : 0;
  const start = Number.isFinite(offset) && offset > 0 ? offset : 0;
  const limit = query.limit ?? items.length;
  const page = items.slice(start, start + limit);
  const next = start + limit < items.length ? { value: String(start + limit) } : undefined;

  return {
    items: page,
    nextCursor: next
  };
}
