import {
  createPostgreSQLPersistenceComposition,
  createPostgreSQLPersistenceConfigFromEnv,
  createPostgreSQLPoolConnection
} from '../src/providers/persistence/postgresql/index.ts';

async function main(): Promise<void> {
  const config = createPostgreSQLPersistenceConfigFromEnv(process.env);
  const connection = createPostgreSQLPoolConnection(config);

  try {
    await connection.healthCheck();
    await createPostgreSQLPersistenceComposition({
      connection
    });
    console.log('PostgreSQL smoke test passed.');
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
