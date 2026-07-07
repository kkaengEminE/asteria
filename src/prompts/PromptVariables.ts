export type PromptVariableValue = string | number | boolean;

export type PromptVariables = Record<string, PromptVariableValue>;

export class PromptVariableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PromptVariableError';
  }
}

