export interface JsonRepairResult {
  text: string;
  repaired: boolean;
}

export function repairCommonJsonText(value: string): JsonRepairResult {
  let repaired = false;
  let output = '';
  let inString = false;
  let escaped = false;
  const stack: string[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (inString) {
      if (escaped) {
        output += char;
        escaped = false;
        continue;
      }

      if (char === '\\') {
        output += char;
        escaped = true;
        continue;
      }

      if (char === '\n') {
        output += '\\n';
        repaired = true;
        continue;
      }

      if (char === '\r') {
        output += '\\r';
        repaired = true;
        continue;
      }

      if (char === '"') {
        if (isLikelyStringTerminator(value, index)) {
          output += char;
          inString = false;
        } else {
          output += '\\"';
          repaired = true;
        }

        continue;
      }

      output += char;
      continue;
    }

    if (char === '"') {
      output += char;
      inString = true;
      continue;
    }

    if (char === '{') {
      stack.push('}');
      output += char;
      continue;
    }

    if (char === '[') {
      stack.push(']');
      output += char;
      continue;
    }

    if (char === '}' || char === ']') {
      if (stack[stack.length - 1] === char) {
        stack.pop();
      }

      output += char;
      continue;
    }

    output += char;
  }

  if (inString) {
    output += '"';
    repaired = true;
  }

  while (stack.length > 0) {
    output += stack.pop();
    repaired = true;
  }

  return {
    text: output,
    repaired
  };
}

export function truncateForPreview(value: string, maxLength = 500): string {
  const normalized = value.replace(/\s+/g, ' ').trim();

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function isLikelyStringTerminator(value: string, quoteIndex: number): boolean {
  for (let index = quoteIndex + 1; index < value.length; index += 1) {
    const char = value[index];

    if (/\s/.test(char)) {
      continue;
    }

    return char === ':' || char === ',' || char === '}' || char === ']';
  }

  return true;
}
