import { pathToFileURL } from 'node:url';
import { loadEnvFile } from '../src/config/index.ts';
import { createAsteriaApiServer } from '../src/api/index.ts';

if (isMainModule()) {
  loadEnvFile();

  const port = parsePort(process.env.ASTERIA_API_PORT ?? process.env.PORT);
  const server = createAsteriaApiServer();

  server.listen(port, () => {
    console.log(`Asteria API listening on http://127.0.0.1:${port}`);
  });
}

function parsePort(value: string | undefined): number {
  const parsed = value ? Number.parseInt(value, 10) : 3000;
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : 3000;
}

function isMainModule(): boolean {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}
