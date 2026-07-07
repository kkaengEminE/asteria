import type { PromptVariables } from './PromptVariables.ts';
import { PromptVariableError } from './PromptVariables.ts';

const variablePattern = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;

export interface PromptTemplateDefinition {
  key: string;
  content: string;
  source: 'shared' | 'magazine';
  path?: string;
}

export class PromptTemplate {
  readonly key: string;
  readonly content: string;
  readonly source: 'shared' | 'magazine';
  readonly path?: string;

  constructor(definition: PromptTemplateDefinition) {
    this.key = definition.key;
    this.content = definition.content;
    this.source = definition.source;
    this.path = definition.path;
  }

  getRequiredVariables(): string[] {
    const variables = new Set<string>();

    for (const match of this.content.matchAll(variablePattern)) {
      const variableName = match[1];

      if (variableName) {
        variables.add(variableName);
      }
    }

    return [...variables].sort();
  }

  validateVariables(variables: PromptVariables): void {
    const missingVariables = this.getRequiredVariables().filter((name) => variables[name] === undefined);

    if (missingVariables.length > 0) {
      throw new PromptVariableError(`Missing prompt variables: ${missingVariables.join(', ')}`);
    }
  }

  render(variables: PromptVariables): string {
    this.validateVariables(variables);

    return this.content.replace(variablePattern, (_, variableName: string) => String(variables[variableName]));
  }
}

