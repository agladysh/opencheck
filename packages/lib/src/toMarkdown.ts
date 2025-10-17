import yaml from 'yaml';
import type { Json, JsonObject } from './types/json.ts';

/**
 * Converts various identifier formats to title case.
 *
 * Handles camelCase, kebab-case, snake_case, dot.case, and combinations.
 * All delimiters are treated as word separators.
 *
 * @param id - The identifier string to convert
 * @returns The formatted title string
 *
 * @example
 * ```ts
 * idToTitle('camel.case-string_titleIdentifier') // 'Camel Case String Title Identifier'
 * idToTitle('simpleWord') // 'Simple Word'
 * idToTitle('kebab-case') // 'Kebab Case'
 * idToTitle('snake_case') // 'Snake Case'
 * ```
 */
export function idToTitle(id: string): string {
  if (!id) {
    return '';
  }

  // Common acronyms to capitalize (case-insensitive word boundaries)
  const acronyms = ['ai', 'api', 'url', 'http', 'https', 'json', 'xml', 'html', 'css', 'js', 'ts'];

  return (
    id
      // Replace hyphenated prefixes/suffixes with temporary markers
      .replace(/\b(non|anti|pre|post|co|ex|self|well|re|un|multi|sub|super|inter|over|under|cross)-(\w+)/gi, '$1◆$2')
      .replace(
        /(\w+)-(like|based|oriented|focused|driven|aware|free|proof|ready|friendly|specific|related)\b/gi,
        '$1◆$2'
      )
      // Split on dots, hyphens, underscores, and camelCase boundaries
      .split(/[.\-_]|(?=[A-Z])/)
      .filter(Boolean)
      .map((word) => {
        const lowerWord = word.toLowerCase();
        // Check if word is a common acronym
        if (acronyms.includes(lowerWord)) {
          return word.toUpperCase();
        }
        // Otherwise capitalize first letter only
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ')
      // Restore hyphens
      .replace(/◆/g, '-')
  );
}

function valueToMarkdown(value: Json): string {
  const type = typeof value;
  if (type === 'string' || type === 'number') {
    return String(value);
  }
  return '```yaml\n' + yaml.stringify(value) + '```';
}

export function responseToMarkdown(response: JsonObject): string {
  const paragraphs: string[] = [];
  for (const [k, v] of Object.entries(response)) {
    if (k === 'remarks') {
      continue;
    }

    paragraphs.push(`# ${idToTitle(k.trim())}`);
    paragraphs.push(valueToMarkdown(v));
  }
  return paragraphs.join('\n\n');
}
