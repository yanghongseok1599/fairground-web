# Dependency security maintenance

The locked tooling no longer installs `braces` or `micromatch`. Next ESLint,
next-sitemap, ts-morph and shadcn resolve their `fast-glob` dependency to the
private [tooling adapter](../../packages/tooling-glob/README.md), whose independent
engine is `tinyglobby@0.2.17`. This replaces the vulnerable code instead of
changing its identity or filtering npm advisories.

The former postinstall patch for `braces@3.0.3` has been retired. The upstream
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) still has
no official patched version at the time of this change; it is absent from this
dependency graph.

## Commands

- `npm ci`: reproducibly installs the lockfile, links the local adapter and checks all four callers. An explicit `--omit=dev` install checks the runtime caller and any installed development callers; absent runtime dependencies still fail.
- `npm run security:dependencies`: checks the lock, installed caller resolution and pinned engine without modifying files.
- `npm run test:dependencies`: runs malicious-pattern regressions, actual tooling integration and the preceding dependency-upgrade regressions.
- `npm run security:audit`: runs the original, unfiltered npm audit. Nothing is excluded or downgraded.

Startup, build and lint run the graph check first. Upgrading a reviewed caller
fails the check until its API usage and compatibility are reviewed; do not simply
change the accepted version. Run all relevant tests and the normal development
build with its Supabase parity gate. This task does not change database schemas.

## Scope

The adapter preserves the API and options used by the current four callers,
including shadcn CSS discovery and sitemap static-export discovery. It is not a
general fast-glob replacement. Its README lists rejected options and pattern
forms, including finite-depth patterns with static directory prefixes. Numeric
and alphabetic ranges retain their padding and steps through the independently
pinned `fill-range@7.1.1` helper, capped at 1,000 values per range and 65,536
normalized characters before allocation. Unsupported
inputs fail explicitly so future tooling changes cannot silently omit files.

Pattern length and nesting are bounded before parsing. This addresses the
original recursion trigger, not every possible resource cost of arbitrary
regular expressions or glob patterns. Keep the module isolated and small.

The root direct dependency `fast-glob: file:packages/tooling-glob` and override
`fast-glob: $fast-glob` must change together. It retains the installed package's
honest name `@fairground/tooling-glob`. Always verify a clean `npm ci` and `npm ls`
after changing this arrangement. Do not use absolute local paths in the lockfile.

When upstream removes the vulnerable engine or releases a verified correction,
re-evaluate and retire this adapter as one change with the lock, hooks and tests.
