import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { loadEnvFile } from '../src/config/index.ts';

test('env loader reads .env values automatically', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'asteria-env-loader-'));
  const env: NodeJS.ProcessEnv = {};
  const path = join(dir, '.env');

  await writeFile(path, [
    'GEMINI_API_KEY=gemini-key',
    'GEMINI_PRODUCTION_ENABLED=true',
    'GEMINI_MODEL=gemini-2.5-flash',
    'OPENAI_API_KEY=openai-key',
    'OPENAI_PRODUCTION_ENABLED=true',
    'OPENAI_MODEL=gpt-test'
  ].join('\n'));

  const result = loadEnvFile({ path, env });

  assert.equal(result.found, true);
  assert.equal(env.GEMINI_API_KEY, 'gemini-key');
  assert.equal(env.GEMINI_PRODUCTION_ENABLED, 'true');
  assert.equal(env.GEMINI_MODEL, 'gemini-2.5-flash');
  assert.equal(env.OPENAI_API_KEY, 'openai-key');
  assert.equal(env.OPENAI_PRODUCTION_ENABLED, 'true');
  assert.equal(env.OPENAI_MODEL, 'gpt-test');
});

test('env loader preserves exported environment values over .env', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'asteria-env-override-'));
  const env: NodeJS.ProcessEnv = {
    GEMINI_MODEL: 'exported-model'
  };
  const path = join(dir, '.env');

  await writeFile(path, 'GEMINI_MODEL=gemini-2.5-flash\nGEMINI_PRODUCTION_ENABLED=true');

  const result = loadEnvFile({ path, env });

  assert.equal(env.GEMINI_MODEL, 'exported-model');
  assert.equal(env.GEMINI_PRODUCTION_ENABLED, 'true');
  assert.deepEqual(result.skipped, ['GEMINI_MODEL']);
});
