import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => SQLiteDatabase;
};

export interface SQLiteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SQLiteStatement;
  close(): void;
}

export interface SQLiteStatement {
  run(...params: SQLiteValue[]): { changes: number; lastInsertRowid: number | bigint };
  get(...params: SQLiteValue[]): SQLiteRow | undefined;
  all(...params: SQLiteValue[]): SQLiteRow[];
}

export type SQLiteValue = string | number | bigint | null | Uint8Array;
export type SQLiteRow = Record<string, unknown>;

export class SQLiteConnection {
  readonly database: SQLiteDatabase;
  readonly databasePath: string;

  constructor(databasePath: string) {
    this.databasePath = databasePath;
    this.database = new DatabaseSync(databasePath);
    this.database.exec('PRAGMA foreign_keys = ON;');
    this.database.exec('PRAGMA journal_mode = WAL;');
  }

  close(): void {
    this.database.close();
  }
}
