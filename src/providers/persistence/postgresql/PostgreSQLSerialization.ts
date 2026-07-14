import { PersistenceRevisionConflictError, type PageRequest, type PageResult, type RevisionCheck, type Revisioned } from '../../../services/persistence/index.ts';
import type { PostgreSQLRow } from './PostgreSQLConnection.ts';

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function parseJson<T>(value: unknown): T {
  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }

  return JSON.parse(JSON.stringify(value ?? null)) as T;
}

export function clone<T>(value: T): T {
  return parseJson<T>(stringifyJson(value));
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

export function createRevisionConflict(entityName: string, expectedRevision: number, actualRevision: number): PersistenceRevisionConflictError {
  return new PersistenceRevisionConflictError(entityName, expectedRevision, actualRevision);
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

export function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function timestampString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

export function rowRevision(row: PostgreSQLRow): number {
  return Number(row.revision);
}
