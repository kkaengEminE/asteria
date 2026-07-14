export type PostgreSQLValue = string | number | boolean | null | Record<string, unknown> | unknown[];

export interface PostgreSQLRow {
  [column: string]: unknown;
}

export interface PostgreSQLQueryResult<Row extends PostgreSQLRow = PostgreSQLRow> {
  rows: Row[];
  rowCount: number;
}

export interface PostgreSQLConnection {
  query<Row extends PostgreSQLRow = PostgreSQLRow>(
    sql: string,
    values?: readonly PostgreSQLValue[]
  ): Promise<PostgreSQLQueryResult<Row>>;
  transaction<T>(callback: (connection: PostgreSQLConnection) => Promise<T>): Promise<T>;
  healthCheck(): Promise<boolean>;
  close?(): Promise<void>;
}
