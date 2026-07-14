import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, relative, resolve } from 'node:path';
import { runMagazineDryRun, type DryRunResult } from '../magazines/runtime/index.ts';
import {
  GenerateApiRequestError,
  validateGenerateApiRequest,
  type GenerateApiRequest
} from './GenerateApiRequest.ts';

export interface AsteriaApiServerOptions {
  generate?: GenerateHandler;
  maxBodyBytes?: number;
  publicDir?: string;
}

export type GenerateHandler = (request: GenerateApiRequest) => Promise<DryRunResult>;

export interface AsteriaApiRequest {
  method: string;
  path: string;
  bodyText: string;
}

export interface AsteriaApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
}

const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;

export function createAsteriaApiServer(options: AsteriaApiServerOptions = {}): Server {
  const generate = options.generate ?? defaultGenerate;
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const publicDir = options.publicDir ?? join(process.cwd(), 'public');

  return createServer(async (request, response) => {
    await handleAsteriaApiRequest(request, response, {
      generate,
      maxBodyBytes,
      publicDir
    });
  });
}

export async function processAsteriaApiRequest(
  request: AsteriaApiRequest,
  options: AsteriaApiServerOptions = {}
): Promise<AsteriaApiResponse> {
  const generate = options.generate ?? defaultGenerate;
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;

  if (request.path !== '/generate') {
    return jsonResponse(404, {
      error: 'not_found',
      message: 'Route not found.'
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, {
      error: 'method_not_allowed',
      message: 'POST /generate is required.'
    }, {
      Allow: 'POST'
    });
  }

  try {
    const body = parseJsonBody(request.bodyText, maxBodyBytes);
    const generateRequest = validateGenerateApiRequest(body);
    const result = await generate(generateRequest);

    return jsonResponse(200, result);
  } catch (error) {
    if (error instanceof GenerateApiRequestError || error instanceof SyntaxError) {
      return jsonResponse(400, {
        error: 'invalid_request',
        message: error.message
      });
    }

    return jsonResponse(500, {
      error: 'internal_error',
      message: error instanceof Error ? error.message : 'Unknown API error.'
    });
  }
}

async function handleAsteriaApiRequest(
  request: IncomingMessage,
  response: ServerResponse,
  options: Required<AsteriaApiServerOptions>
): Promise<void> {
  const path = parsePath(request);

  if (request.method === 'GET' && path !== '/generate') {
    const staticResponse = await serveStaticAsset(path, options.publicDir);
    writeStaticResponse(response, staticResponse);
    return;
  }

  const bodyText = request.method === 'POST'
    ? await readBodyText(request, options.maxBodyBytes)
    : '';
  const apiResponse = await processAsteriaApiRequest({
    method: request.method ?? 'GET',
    path,
    bodyText
  }, options);

  writeApiResponse(response, apiResponse);
}

async function defaultGenerate(request: GenerateApiRequest): Promise<DryRunResult> {
  return runMagazineDryRun({
    topic: request.topic,
    magazineSlug: request.magazine,
    language: request.language
  });
}

async function readBodyText(request: IncomingMessage, maxBodyBytes: number): Promise<string> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;

    if (totalBytes > maxBodyBytes) {
      throw new GenerateApiRequestError('Request body is too large.');
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString('utf8');
}

function parseJsonBody(bodyText: string, maxBodyBytes: number): unknown {
  if (Buffer.byteLength(bodyText) > maxBodyBytes) {
    throw new GenerateApiRequestError('Request body is too large.');
  }

  const body = bodyText.trim();

  if (body.length === 0) {
    throw new GenerateApiRequestError('Request body is required.');
  }

  return JSON.parse(body);
}

function parsePath(request: IncomingMessage): string {
  const url = new URL(request.url ?? '/', 'http://localhost');
  return url.pathname;
}

function jsonResponse(statusCode: number, body: unknown, headers: Record<string, string> = {}): AsteriaApiResponse {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers
    },
    body
  };
}

function writeApiResponse(response: ServerResponse, apiResponse: AsteriaApiResponse): void {
  response.statusCode = apiResponse.statusCode;

  for (const [name, value] of Object.entries(apiResponse.headers)) {
    response.setHeader(name, value);
  }

  response.end(JSON.stringify(apiResponse.body));
}

async function serveStaticAsset(path: string, publicDir: string): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> {
  const filename = path === '/' ? 'index.html' : path.replace(/^\/+/, '');
  const root = resolve(publicDir);
  const filePath = resolve(root, normalize(filename));
  const relation = relative(root, filePath);

  if (relation.startsWith('..') || relation === '' || relation.includes('..')) {
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8'
      },
      body: 'Not found'
    };
  }

  try {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType(filePath)
      },
      body: await readFile(filePath, 'utf8')
    };
  } catch {
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8'
      },
      body: 'Not found'
    };
  }
}

function contentType(filePath: string): string {
  switch (extname(filePath)) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    default:
      return 'text/plain; charset=utf-8';
  }
}

function writeStaticResponse(
  response: ServerResponse,
  staticResponse: { statusCode: number; headers: Record<string, string>; body: string }
): void {
  response.statusCode = staticResponse.statusCode;

  for (const [name, value] of Object.entries(staticResponse.headers)) {
    response.setHeader(name, value);
  }

  response.end(staticResponse.body);
}
