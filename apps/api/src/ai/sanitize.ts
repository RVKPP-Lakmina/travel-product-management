/**
 * Every string that reaches an OpenAI prompt goes through this first —
 * whether it came directly from a request body or was read back out of the
 * database (product descriptions are exactly as untrusted the second time
 * around; this is the second-order/stored-injection defense).
 *
 * What it strips, and why:
 *   - C0/C1 control characters: no legitimate reason for a control byte in
 *     a natural-language prompt; some can confuse downstream log/terminal
 *     rendering.
 *   - Zero-width and bidi-override characters: the standard toolkit for
 *     hiding text from a human reviewer while a model (or a terminal)
 *     still processes it — e.g. reversing visual text order or splicing
 *     in invisible tokens.
 *   - The literal untrusted-input delimiter tokens: without this, a user
 *     could type a fake closing delimiter and attempt to make the model
 *     believe the untrusted block ended early, with subsequent "system"-
 *     looking text outside it.
 *   - Collapses whitespace and hard-truncates to the caller's cap.
 */

const CONTROL_CODEPOINTS: [number, number][] = [
  [0x00, 0x08],
  [0x0b, 0x0c],
  [0x0e, 0x1f],
  [0x7f, 0x9f],
];

// Zero-width space/joiners/marks (U+200B-U+200F), bidi override/embedding
// controls (U+202A-U+202E), and the UTF-8 BOM (U+FEFF).
const HIDDEN_CODEPOINTS: [number, number][] = [
  [0x200b, 0x200f],
  [0x202a, 0x202e],
  [0xfeff, 0xfeff],
];

function stripCodepointRanges(input: string, ranges: [number, number][]): string {
  let out = '';
  for (const ch of input) {
    const cp = ch.codePointAt(0) ?? 0;
    const isStripped = ranges.some(([lo, hi]) => cp >= lo && cp <= hi);
    if (!isStripped) out += ch;
  }
  return out;
}

const DELIMITER_START = 'UNTRUSTED_USER_INPUT';
const DELIMITER_END_TOKEN = 'END_UNTRUSTED_USER_INPUT';

function stripDelimiterTokens(input: string): string {
  // Remove any occurrence of the exact delimiter marker substrings,
  // including the surrounding angle-bracket fences, so user text can never
  // forge a fake boundary once wrapped by wrapUntrusted() below.
  return input.split(DELIMITER_START).join(' ').split(DELIMITER_END_TOKEN).join(' ');
}

export function sanitize(input: string, maxLength: number): string {
  let s = input.normalize('NFKC');
  s = stripCodepointRanges(s, CONTROL_CODEPOINTS);
  s = stripCodepointRanges(s, HIDDEN_CODEPOINTS);
  s = stripDelimiterTokens(s);
  s = s.split(/\s+/).filter(Boolean).join(' ').trim();
  if (s.length > maxLength) {
    s = s.slice(0, maxLength);
  }
  return s;
}

const UNTRUSTED_FENCE_START = '<<<' + DELIMITER_START;
const UNTRUSTED_FENCE_END = DELIMITER_END_TOKEN + '>>>';

/**
 * Wraps already-sanitized text in the delimiter block referenced by the
 * static system prompts (generation/prompt.ts, search/prompt.ts). The
 * delimiter tokens are stripped from `sanitized` by `sanitize()` above
 * before this is ever called, so a caller cannot forge a fake boundary.
 */
export function wrapUntrusted(sanitized: string): string {
  return [UNTRUSTED_FENCE_START, sanitized, UNTRUSTED_FENCE_END].join('\n');
}
