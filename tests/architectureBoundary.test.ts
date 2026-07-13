import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, normalize, relative, resolve } from 'node:path';
import { test } from 'node:test';

const srcRoot = join(process.cwd(), 'src');
const domainRoot = join(srcRoot, 'domain');
const previewRoot = join(domainRoot, 'preview');
const providerRoot = join(srcRoot, 'providers');
const persistenceRoot = join(srcRoot, 'services', 'persistence');
const publishingServiceRoots = [
  join(srcRoot, 'services', 'publishing'),
  join(srcRoot, 'services', 'publisher'),
  join(srcRoot, 'services', 'scheduler')
];
const workflowRoot = join(process.cwd(), 'src', 'workflows');
const concreteProviderImportPatterns = [
  /from\s+['"][^'"]*providers\/ai\/(?:openai|gemini)[^'"]*['"]/,
  /from\s+['"][^'"]*providers\/publisher\/[^'"]*['"]/,
  /from\s+['"][^'"]*providers\/image\/[^'"]*['"]/,
  /from\s+['"][^'"]*providers\/monetization\/[^'"]*['"]/,
  /from\s+['"][^'"]*providers\/storage\/[^'"]*['"]/
];

test('workflows do not import concrete provider implementations', async () => {
  const files = await listTypeScriptFiles(workflowRoot);
  const violations: string[] = [];

  for (const file of files) {
    const source = await readFile(file, 'utf8');

    for (const pattern of concreteProviderImportPatterns) {
      if (pattern.test(source)) {
        violations.push(file.replace(`${process.cwd()}/`, ''));
      }
    }
  }

  assert.deepEqual(violations, []);
});

test('workflows do not import concrete persistence adapters', async () => {
  const files = await listTypeScriptFiles(workflowRoot);
  const violations: string[] = [];

  for (const file of files) {
    const source = await readFile(file, 'utf8');

    if (/from\s+['"][^'"]*services\/persistence\/inMemory[^'"]*['"]/.test(source)) {
      violations.push(file.replace(`${process.cwd()}/`, ''));
    }
  }

  assert.deepEqual(violations, []);
});

test('domain does not import services workflows runtime or providers', async () => {
  const files = await listTypeScriptFiles(domainRoot);
  const violations: string[] = [];
  const forbiddenPatterns = [
    /from\s+['"][^'"]*services\//,
    /from\s+['"][^'"]*workflows\//,
    /from\s+['"][^'"]*providers\//,
    /from\s+['"][^'"]*magazines\//
  ];

  for (const file of files) {
    const source = await readFile(file, 'utf8');

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(source)) {
        violations.push(file.replace(`${process.cwd()}/`, ''));
      }
    }
  }

  assert.deepEqual(violations, []);
});

test('preview domain does not import runtime workflows providers or CLI scripts', async () => {
  const files = await listTypeScriptFiles(previewRoot);
  const violations: string[] = [];
  const forbiddenPatterns = [
    /from\s+['"][^'"]*magazines\//,
    /from\s+['"][^'"]*workflows\//,
    /from\s+['"][^'"]*providers\//,
    /from\s+['"][^'"]*scripts\//
  ];

  for (const file of files) {
    const source = await readFile(file, 'utf8');

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(source)) {
        violations.push(file.replace(`${process.cwd()}/`, ''));
      }
    }
  }

  assert.deepEqual(violations, []);
});


test('provider adapters do not import workflows', async () => {
  const files = await listTypeScriptFiles(providerRoot);
  const violations: string[] = [];

  for (const file of files) {
    const source = await readFile(file, 'utf8');

    if (/from\s+['"][^'"]*workflows\//.test(source)) {
      violations.push(file.replace(`${process.cwd()}/`, ''));
    }
  }

  assert.deepEqual(violations, []);
});

test('provider adapters do not import legacy core contracts', async () => {
  const files = await listTypeScriptFiles(providerRoot);
  const violations: string[] = [];

  for (const file of files) {
    const source = await readFile(file, 'utf8');

    if (/from\s+['"][^'"]*core\//.test(source)) {
      violations.push(file.replace(`${process.cwd()}/`, ''));
    }
  }

  assert.deepEqual(violations, []);
});

test('publishing and scheduler services use provider-neutral publisher contracts', async () => {
  const files = (await Promise.all(publishingServiceRoots.map((root) => listTypeScriptFiles(root)))).flat();
  const violations: string[] = [];
  const forbiddenPatterns = [
    /from\s+['"][^'"]*core\/Publisher/,
    /\bPublishingPayload\b/,
    /\bPublishingResult\b/,
    /\bcreatePublishingPayload\b/
  ];

  for (const file of files) {
    const source = await readFile(file, 'utf8');

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(source)) {
        violations.push(file.replace(`${process.cwd()}/`, ''));
        break;
      }
    }
  }

  assert.deepEqual(violations, []);
});

test('persistence ports do not import database or orm packages', async () => {
  const files = await listTypeScriptFiles(persistenceRoot);
  const violations: string[] = [];
  const forbiddenPatterns = [
    /from\s+['"][^'"]*(?:sqlite|postgres|prisma|drizzle|typeorm|sequelize|knex)[^'"]*['"]/i,
    /(?:sqlite|postgres|prisma|drizzle|typeorm|sequelize|knex)/i
  ];

  for (const file of files) {
    const source = await readFile(file, 'utf8');

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(source)) {
        violations.push(file.replace(`${process.cwd()}/`, ''));
        break;
      }
    }
  }

  assert.deepEqual(violations, []);
});

test('source files do not contain relative import cycles', async () => {
  const files = await listTypeScriptFiles(srcRoot);
  const fileSet = new Set(files.map((file) => normalize(file)));
  const graph = new Map<string, string[]>();

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const dependencies = extractRelativeImports(source)
      .map((specifier) => resolveImport(file, specifier, fileSet))
      .filter((dependency): dependency is string => Boolean(dependency));

    graph.set(normalize(file), dependencies);
  }

  const cycle = findCycle(graph);

  assert.equal(cycle, undefined, cycle ? `Import cycle detected: ${cycle.join(' -> ')}` : undefined);
});

async function listTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return listTypeScriptFiles(path);
    }

    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
  }));

  return files.flat();
}

function extractRelativeImports(source: string): string[] {
  const imports: string[] = [];
  const importPattern = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = importPattern.exec(source)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

function resolveImport(fromFile: string, specifier: string, fileSet: Set<string>): string | undefined {
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    join(base, 'index.ts')
  ].map((candidate) => normalize(candidate));

  return candidates.find((candidate) => fileSet.has(candidate));
}

function findCycle(graph: Map<string, string[]>): string[] | undefined {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  for (const node of graph.keys()) {
    const cycle = visit(node, graph, visiting, visited, stack);

    if (cycle) {
      return cycle.map((file) => relative(process.cwd(), file));
    }
  }

  return undefined;
}

function visit(
  node: string,
  graph: Map<string, string[]>,
  visiting: Set<string>,
  visited: Set<string>,
  stack: string[]
): string[] | undefined {
  if (visited.has(node)) {
    return undefined;
  }

  if (visiting.has(node)) {
    const cycleStart = stack.indexOf(node);

    return [...stack.slice(cycleStart), node];
  }

  visiting.add(node);
  stack.push(node);

  for (const dependency of graph.get(node) ?? []) {
    const cycle = visit(dependency, graph, visiting, visited, stack);

    if (cycle) {
      return cycle;
    }
  }

  stack.pop();
  visiting.delete(node);
  visited.add(node);

  return undefined;
}
