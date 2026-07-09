import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface LoadEnvFileOptions {
  path?: string;
  env?: NodeJS.ProcessEnv;
}

export interface LoadEnvFileResult {
  path: string;
  loaded: string[];
  skipped: string[];
  found: boolean;
}

export function loadEnvFile(options: LoadEnvFileOptions = {}): LoadEnvFileResult {
  const envPath = resolve(options.path ?? '.env');
  const env = options.env ?? process.env;

  if (!existsSync(envPath)) {
    return {
      path: envPath,
      loaded: [],
      skipped: [],
      found: false
    };
  }

  const loaded: string[] = [];
  const skipped: string[] = [];
  const content = readFileSync(envPath, 'utf8');

  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);

    if (!parsed) {
      continue;
    }

    if (env[parsed.key] !== undefined) {
      skipped.push(parsed.key);
      continue;
    }

    env[parsed.key] = parsed.value;
    loaded.push(parsed.key);
  }

  return {
    path: envPath,
    loaded,
    skipped,
    found: true
  };
}

function parseEnvLine(line: string): { key: string; value: string } | undefined {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith('#')) {
    return undefined;
  }

  const separatorIndex = trimmed.indexOf('=');

  if (separatorIndex <= 0) {
    return undefined;
  }

  const key = trimmed.slice(0, separatorIndex).trim();

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return undefined;
  }

  return {
    key,
    value: normalizeEnvValue(trimmed.slice(separatorIndex + 1).trim())
  };
}

function normalizeEnvValue(value: string): string {
  const quote = value[0];

  if ((quote === '"' || quote === "'") && value[value.length - 1] === quote) {
    return value.slice(1, -1);
  }

  const commentIndex = value.indexOf(' #');

  return (commentIndex >= 0 ? value.slice(0, commentIndex) : value).trim();
}
