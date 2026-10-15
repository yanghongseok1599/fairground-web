'use strict';

/* eslint-disable @typescript-eslint/no-require-imports -- The audited callers require a callable CommonJS export. */
const path = require('node:path');
const tinyglobby = require('tinyglobby');
const { normalizeRanges } = require('./ranges.cjs');
const { expandPathAlternatives } = require('./path-patterns.cjs');

const MAX_PATTERN_LENGTH = 65_536;
const MAX_PATTERN_DEPTH = 100;
const BOOLEAN_OPTIONS = new Set([
  'absolute', 'braceExpansion', 'caseSensitiveMatch', 'dot', 'extglob',
  'followSymbolicLinks', 'globstar', 'onlyDirectories', 'onlyFiles',
]);
const SUPPORTED_OPTIONS = new Set([...BOOLEAN_OPTIONS, 'cwd', 'deep', 'ignore']);

function unsupported(message) {
  return new TypeError(`@fairground/tooling-glob: ${message}`);
}

function validatePattern(pattern, label) {
  if (typeof pattern !== 'string' || pattern.length === 0) {
    throw unsupported(`${label} must be a non-empty string`);
  }
  if (pattern.length > MAX_PATTERN_LENGTH) {
    throw new RangeError(`${label} exceeds ${MAX_PATTERN_LENGTH} characters`);
  }

  // Iterative and deliberately conservative: a mismatched closer cannot cancel
  // an opener of the other kind, including in malformed/unclosed input.
  const stack = [];
  for (let i = 0; i < pattern.length; i += 1) {
    const character = pattern[i];
    if (character === '\\') {
      i += 1;
    } else if (character === '{' || character === '(') {
      stack.push({ character, position: i });
      if (stack.length > MAX_PATTERN_DEPTH) {
        throw new RangeError(`${label} exceeds nesting depth ${MAX_PATTERN_DEPTH}`);
      }
    } else if (character === '}' || character === ')') {
      const opener = stack[stack.length - 1];
      const expected = character === '}' ? '{' : '(';
      if (opener?.character !== expected) continue;
      stack.pop();
    }
  }
  return pattern;
}

function validatePatterns(input, label) {
  const patterns = typeof input === 'string' ? [input] : input;
  if (!Array.isArray(patterns)) {
    throw unsupported(`${label} must be a string or an array of strings`);
  }
  // Array.from also visits holes rather than silently skipping invalid entries.
  return Array.from(patterns, (pattern, index) => validatePattern(pattern, `${label}[${index}]`));
}

function negative(pattern) {
  return pattern.startsWith('!') && !pattern.startsWith('!(');
}

function outputStyle(pattern) {
  if (path.isAbsolute(pattern)) return 'absolute';
  return pattern.startsWith('./') ? 'dot' : 'relative';
}

function prepare(input, options = {}) {
  let patterns = validatePatterns(input, 'patterns');
  if (options === null || typeof options !== 'object' || Array.isArray(options)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(options))) {
    throw unsupported('options must be a plain object');
  }
  const translated = {};
  for (const key of Reflect.ownKeys(options)) {
    if (!SUPPORTED_OPTIONS.has(key)) throw unsupported(`unsupported option ${String(key)}`);
    const value = options[key];
    if (value === undefined) continue;
    if (BOOLEAN_OPTIONS.has(key) && typeof value !== 'boolean') {
      throw unsupported(`${key} must be a boolean`);
    }
    translated[key] = value;
  }
  if (translated.cwd !== undefined && typeof translated.cwd !== 'string') {
    throw unsupported('cwd must be a string');
  }
  translated.ignore = options.ignore === undefined ? [] : validatePatterns(options.ignore, 'ignore');
  if (translated.braceExpansion !== false) {
    const expand = (pattern) => expandPathAlternatives(normalizeRanges(pattern, MAX_PATTERN_LENGTH), MAX_PATTERN_LENGTH);
    patterns = patterns.flatMap(expand);
    translated.ignore = translated.ignore.flatMap(expand);
  }
  if (translated.ignore.some(negative)) {
    throw unsupported('negated ignore entries are not supported; use a positive ignore pattern');
  }
  if (patterns.some((pattern) => pattern.startsWith('!!'))) {
    throw unsupported('multiple leading negations are not supported');
  }
  const positivePatterns = patterns.filter((pattern) => !negative(pattern));
  const styles = new Set(positivePatterns.map(outputStyle));
  if (styles.size > 1 && translated.absolute !== true) {
    throw unsupported('mixed absolute, ./ and relative patterns require absolute: true');
  }
  const style = [...styles][0];
  if (style === 'absolute') translated.absolute = true;

  if (translated.deep !== undefined && translated.deep !== Infinity) {
    if (!Number.isSafeInteger(translated.deep) || translated.deep < 0) {
      throw unsupported('deep must be a non-negative safe integer or Infinity');
    }
    for (const pattern of positivePatterns) {
      const relative = pattern.startsWith('./') ? pattern.slice(2) : pattern;
      if (relative.includes('/') && !relative.startsWith('**/')) {
        throw unsupported('finite deep supports only cwd-level or **/ patterns');
      }
    }
    // fast-glob counts the first cwd level as 1; fdir counts it as 0. Its other
    // task-base depth semantics are intentionally outside this adapter's scope.
    translated.deep = Math.max(0, translated.deep - 1);
  }
  translated.expandDirectories = false;
  const normalizePositive = (pattern, index) => {
    if (translated.globstar === false) return pattern;
    // fast-glob does not return the traversal base for a terminal globstar.
    const normalizedPattern = pattern === '**' || pattern.endsWith('/**') ? `${pattern}/*` : pattern;
    return validatePattern(normalizedPattern, `normalized patterns[${index}]`);
  };
  const ignores = [...translated.ignore, ...patterns.filter(negative).map((pattern) => pattern.slice(1))];
  const directoryIgnores = ignores.filter((pattern) => pattern.endsWith('/'));
  translated.ignore = ignores.filter((pattern) => !pattern.endsWith('/'));
  const trailing = (pattern) => pattern.endsWith('/');
  const trimSlash = (pattern) => pattern.replace(/\/+$/, '') || '/';
  const onlyFiles = translated.onlyFiles !== false && translated.onlyDirectories !== true;
  const queries = [];
  const addQuery = (selected, overrides = {}, slash = false) => {
    if (selected.length === 0) return;
    queries.push({ patterns: selected.map(normalizePositive), options: { ...translated, ...overrides }, slash });
  };
  if (!positivePatterns.some(trailing) && directoryIgnores.length === 0) {
    addQuery(positivePatterns);
  } else {
    if (translated.onlyDirectories !== true) {
      addQuery(positivePatterns.filter((pattern) => !trailing(pattern)), { onlyFiles: true, onlyDirectories: false });
    }
    if (!onlyFiles) {
      // A static directory path keeps its explicit slash in fast-glob output;
      // dynamic directory patterns do not. Keep the two result sets distinct.
      const staticTrailing = new Set(positivePatterns.filter((pattern) => trailing(pattern)
        && !tinyglobby.isDynamicPattern(pattern, translated)));
      addQuery(positivePatterns.filter((pattern) => !staticTrailing.has(pattern)).map(trimSlash), { onlyFiles: false, onlyDirectories: true });
      addQuery([...staticTrailing].map(trimSlash), { onlyFiles: false, onlyDirectories: true }, true);
    }
  }
  return {
    queries, options: translated,
    // These exclusions affect directory entries, never traversal or files.
    directoryIgnores: queries.some((query) => query.options.onlyDirectories)
      ? directoryIgnores.map(trimSlash) : [],
    prefixDot: style === 'dot' && !translated.absolute,
  };
}

function formatResults(groups, excludedDirectories, prepared) {
  const absolutePath = (result) => path.resolve(prepared.options.cwd || process.cwd(), result);
  const excluded = new Set(excludedDirectories.map(absolutePath));
  return [...new Set(groups.flatMap((results, index) => results.flatMap((result) => {
    const query = prepared.queries[index];
    if (query.options.onlyDirectories && excluded.has(absolutePath(result))) return [];
    const clean = result.length > 1 && result.endsWith('/') ? result.slice(0, -1) : result;
    const formatted = prepared.prefixDot && !clean.startsWith('./') ? `./${clean}` : clean;
    return [query.slash ? `${formatted}/` : formatted];
  })))];
}

function directoryIgnoreOptions(prepared) {
  // A trailing-slash negative must not prune children. Obtain its directory
  // matches separately and subtract entries after the positive crawls finish.
  return { ...prepared.options, ignore: [], absolute: true, dot: true, onlyDirectories: true, onlyFiles: false };
}

// Keep validation inside the async function: callers receive rejected promises,
// as they do from fast-glob, rather than unexpected synchronous exceptions.
async function glob(patterns, options) {
  const prepared = prepare(patterns, options);
  const groups = await Promise.all(prepared.queries.map((query) => tinyglobby.glob(query.patterns, query.options)));
  const excluded = prepared.directoryIgnores.length === 0 ? []
    : await tinyglobby.glob(prepared.directoryIgnores, directoryIgnoreOptions(prepared));
  return formatResults(groups, excluded, prepared);
}

function globSync(patterns, options) {
  const prepared = prepare(patterns, options);
  const groups = prepared.queries.map((query) => tinyglobby.globSync(query.patterns, query.options));
  const excluded = prepared.directoryIgnores.length === 0 ? []
    : tinyglobby.globSync(prepared.directoryIgnores, directoryIgnoreOptions(prepared));
  return formatResults(groups, excluded, prepared);
}

// Explicit assignments preserve named imports when Node loads this CJS module
// through an ESM caller as well as the callable CommonJS/default interface.
module.exports = glob;
module.exports.glob = glob;
module.exports.async = glob;
module.exports.sync = globSync;
module.exports.globSync = globSync;
