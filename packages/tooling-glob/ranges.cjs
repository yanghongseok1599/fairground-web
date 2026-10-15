'use strict';

/* eslint-disable @typescript-eslint/no-require-imports -- Shared by the callable CommonJS adapter. */
const fillRange = require('fill-range');

const RANGE = /^(-?\d+|[A-Za-z])\.\.(-?\d+|[A-Za-z])(?:\.\.(-?\d+))?$/;
const INTEGER = /^-?\d+$/;
const MAX_RANGE_VALUES = 1_000;
const GLOB_SPECIAL = /[\\*?[\]{}(),!+@|]/g;

function escapeValue(value) {
  return String(value).replace(GLOB_SPECIAL, '\\$&');
}

function safeInteger(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    throw new RangeError('Brace range endpoints and steps must be safe integers');
  }
  return BigInt(number);
}

function padded(value) {
  const unsigned = value.startsWith('-') ? value.slice(1) : value;
  return unsigned.length > 1 && unsigned.startsWith('0');
}

// Compute an exact output-size bound without asking fill-range to allocate any
// values. In particular, a small count with enormous zero padding is not cheap.
function describeRange(match) {
  const [, start, end, explicitStep] = match;
  const stepText = explicitStep ?? '1';
  const signedStep = safeInteger(stepText);
  const absoluteStep = signedStep < 0n ? -signedStep : signedStep;
  const step = absoluteStep === 0n ? 1n : absoluteStep;
  const numeric = INTEGER.test(start) && INTEGER.test(end);
  let first;
  let last;
  let width = 0;
  if (numeric) {
    first = safeInteger(start);
    last = safeInteger(end);
    if ([start, end, stepText].some(padded)) {
      width = Math.max(start.length, end.length, stepText.length);
    }
  } else {
    // fill-range also accepts single-digit/letter combinations as character
    // ranges. Multi-character numeric/letter mixtures have ambiguous semantics.
    if (start.length !== 1 || end.length !== 1) {
      throw new TypeError('Mixed character ranges require single-character endpoints');
    }
    first = BigInt(start.charCodeAt(0));
    last = BigInt(end.charCodeAt(0));
  }
  const distance = first > last ? first - last : last - first;
  const count = distance / step + 1n;
  if (count > BigInt(MAX_RANGE_VALUES)) {
    throw new RangeError(`Brace range exceeds ${MAX_RANGE_VALUES} values`);
  }
  const countNumber = Number(count);
  // Multiple alternatives need two braces and count-1 commas. A singleton
  // needs no braces, since {a} would otherwise be treated as literal text.
  let length = countNumber > 1 ? countNumber + 1 : 0;
  const increment = first > last ? -step : step;
  for (let index = 0, value = first; index < countNumber; index += 1, value += increment) {
    length += numeric
      ? Math.max(width, value.toString().length)
      : escapeValue(String.fromCharCode(Number(value))).length;
  }
  return { start, end, stepText, count: countNumber, length };
}

function normalizeRanges(pattern, maxLength = 65_536) {
  const stack = [];
  const replacements = [];
  let brackets = 0;
  let quote = null;
  let length = pattern.length;
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === '\\') {
      index += 1;
      continue;
    }
    if (quote !== null) {
      if (character === quote) {
        quote = null;
      } else if (character === '{') {
        const closing = pattern.indexOf('}', index + 1);
        if (closing !== -1 && RANGE.test(pattern.slice(index + 1, closing))) {
          throw new TypeError('Quoted brace ranges are not supported by the tooling glob adapter');
        }
      }
      continue;
    }
    if (character === '[') {
      brackets += 1;
      continue;
    }
    if (brackets > 0) {
      if (character === ']') brackets -= 1;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
    } else if (character === '{') {
      stack.push({ index, dollar: pattern[index - 1] === '$' || stack.at(-1)?.dollar === true });
    } else if (character === '}' && stack.length > 0) {
      const opening = stack.pop();
      const match = RANGE.exec(pattern.slice(opening.index + 1, index));
      if (!match) continue;
      if (opening.dollar) {
        throw new TypeError('Dollar-prefixed brace ranges are not supported by the tooling glob adapter');
      }
      const descriptor = describeRange(match);
      length += descriptor.length - (index - opening.index + 1);
      replacements.push({ from: opening.index, to: index + 1, ...descriptor });
    }
  }
  // This precedes fillRange and any padded value construction for every token.
  if (length > maxLength) {
    throw new RangeError(`Normalized pattern exceeds ${maxLength} characters`);
  }
  if (replacements.length === 0) return pattern;
  const parts = [];
  let previous = 0;
  // Range tokens have scalar bodies, so replacements cannot overlap.
  for (const replacement of replacements) {
    const values = fillRange(replacement.start, replacement.end, replacement.stepText, { strictRanges: true });
    if (values.length !== replacement.count) throw new Error('Unexpected fill-range result count');
    const escaped = values.map(escapeValue);
    parts.push(pattern.slice(previous, replacement.from));
    parts.push(escaped.length === 1 ? escaped[0] : `{${escaped.join(',')}}`);
    previous = replacement.to;
  }
  parts.push(pattern.slice(previous));
  const result = parts.join('');
  if (result.length !== length || result.length > maxLength) {
    throw new Error('Unexpected fill-range normalized length');
  }
  return result;
}

module.exports = { normalizeRanges };
