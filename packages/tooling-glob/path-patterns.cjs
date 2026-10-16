'use strict';

const MAX_PATH_ALTERNATIVES = 1_000;

// tinyglobby normalizes paths before matching. A slash-bearing brace such as
// {./apps/web,./apps/admin} must therefore become separate paths first. Scalar
// braces stay with the engine; this is not a general brace-expansion library.
function pathAlternatives(pattern) {
  const stack = [];
  let bracket = false;
  let quote = null;
  let parentheses = 0;
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === '\\') {
      index += 1;
      continue;
    }
    if (character === '[' && quote === null) bracket = true;
    if (bracket) {
      if (character === ']') bracket = false;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      if (quote === null) {
        quote = character;
        for (const group of stack) group.quoted = true;
      }
      else if (quote === character) quote = null;
      continue;
    }
    if (quote === null && character === '(') parentheses += 1;
    if (quote === null && character === ')') parentheses = Math.max(0, parentheses - 1);
    if (character === '{') {
      stack.push({
        start: index, commas: [], slash: false, parentheses,
        quoted: quote !== null || stack.at(-1)?.quoted === true,
        dollar: pattern[index - 1] === '$' || stack.at(-1)?.dollar === true,
      });
    } else if (character === ',' && stack.length > 0 && parentheses === stack.at(-1).parentheses) {
      stack.at(-1).commas.push(index);
    } else if (character === '/' && stack.length > 0) {
      for (const group of stack) group.slash = true;
    } else if (character === '}' && stack.length > 0) {
      const group = stack.pop();
      if (!group.slash || group.commas.length === 0) continue;
      if (group.quoted || group.dollar) {
        throw new TypeError('Quoted or dollar-prefixed path brace alternatives are not supported');
      }
      const bounds = [group.start, ...group.commas, index];
      return {
        start: group.start, end: index + 1,
        alternatives: bounds.slice(1).map((end, part) => [bounds[part] + 1, end]),
      };
    }
  }
  return null;
}

function expandPathAlternatives(pattern, maxLength = 65_536) {
  const patterns = [pattern];
  let length = pattern.length;
  for (let index = 0; index < patterns.length;) {
    const current = patterns[index];
    const group = pathAlternatives(current);
    if (group === null) {
      index += 1;
      continue;
    }
    const count = patterns.length - 1 + group.alternatives.length;
    if (count > MAX_PATH_ALTERNATIVES) {
      throw new RangeError(`Path brace expansion exceeds ${MAX_PATH_ALTERNATIVES} alternatives`);
    }
    const outsideLength = current.length - (group.end - group.start);
    const nextLength = length - current.length + group.alternatives.reduce(
      (total, [start, end]) => total + outsideLength + end - start, 0,
    );
    // Check the entire generated set before allocating repeated prefixes or
    // suffixes. Iteration, count and total bytes remain bounded even for products.
    if (nextLength > maxLength) {
      throw new RangeError(`Expanded path patterns exceed ${maxLength} characters`);
    }
    const prefix = current.slice(0, group.start);
    const suffix = current.slice(group.end);
    patterns.splice(index, 1, ...group.alternatives.map(
      ([start, end]) => prefix + current.slice(start, end) + suffix,
    ));
    length = nextLength;
  }
  return [...new Set(patterns.filter(Boolean))];
}

module.exports = { expandPathAlternatives };
