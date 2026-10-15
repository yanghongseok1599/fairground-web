# FairGround tooling glob adapter

This private package replaces the glob engine used by the locked Next ESLint,
next-sitemap, ts-morph and shadcn tooling. It has its own name and version and
uses pinned `tinyglobby@0.2.17` and `fill-range@7.1.1`. It contains no copy of fast-glob, micromatch or
braces. The root npm override supplies it to those existing callers.

This is a deliberately scoped compatibility adapter, not an implementation of
the whole fast-glob API. Updating any caller requires checking its glob calls
and running the dependency compatibility tests again.

Supported entry points are the callable async default, `glob`, `async`, `sync`
and `globSync`. Supported options are `cwd`, `absolute`, `onlyFiles`,
`onlyDirectories`, `ignore`, `deep`, `dot`, `caseSensitiveMatch`,
`braceExpansion`, `extglob`, `globstar` and `followSymbolicLinks`. Unknown options
fail explicitly; streams, tasks, custom filesystems, object results and other
fast-glob APIs are not supplied.

Directory expansion is disabled, absolute patterns retain absolute output,
`./` patterns retain their prefix. Dynamic directory results omit trailing
slashes; an explicitly supplied static directory path retains its slash.
Mixed output styles need explicit `absolute: true`. A positive terminal `/**`
or `/**/` does not include its traversal base. A trailing `/` selects directories
only. Trailing-slash negatives and ignore entries exclude directory results,
without pruning descendants or excluding files. When needed, mixed file and
directory results use separate crawls; directory-only exclusions are matched in
an additional directory crawl and subtracted from results, never traversal.
That exclusion crawl retains any finite depth limit from the positive query.
Finite `deep` supports cwd-level and
`**/` patterns, as used by shadcn, and translates the engines' one-level counting
difference. Other finite-depth bases are rejected because fast-glob's grouped
task semantics differ. Negated ignore entries and repeated leading negations
are also rejected. Numeric/alphabetic brace ranges, including descending,
negative, padded and stepped ranges, are normalized to comma alternatives with
the same `fill-range` version used by the original tooling. Each range is limited
to 1,000 values. Endpoints and steps must be safe integers; ambiguous mixtures of
multi-character numeric and alphabetic endpoints are rejected. Escaped ranges,
character classes and `braceExpansion: false` are left untouched. Generated
character values are escaped so punctuation does not become glob syntax.
Quoted or dollar-prefixed brace range forms are explicitly rejected because the
engines otherwise select different literal filenames for them. Ordinary quoted
filenames without range syntax are not rejected by this range compatibility check.

Slash-bearing comma brace alternatives are expanded before tinyglobby's path
normalization, so `{./apps/web,./apps/admin}` retains both paths and their output
prefixes. Nested scalar alternatives remain with the engine. This narrow helper
is iterative and limits each input pattern to 1,000 generated alternatives and
65,536 characters across the complete generated set, checking both bounds before
allocation. Products exceeding these bounds fail explicitly. Quoted or
dollar-prefixed path brace alternatives are rejected rather than silently
normalizing them into different paths. Escaped braces and `braceExpansion: false`
remain unexpanded by this helper.

Before entering the glob engine, all pattern and ignore strings must have at
most 65,536 characters and 100 nested unescaped braces/parentheses. The iterative
check also counts unmatched openings, and mismatched closing characters cannot
decrease the depth. Range counts and the complete normalized pattern length are
checked before generating values, including potentially large zero padding.
Non-string entries and sparse arrays fail. This bounds the
specific deeply nested pattern trigger; it does not claim general safety for
every hostile glob/regular expression, arbitrary option accessor or filesystem.

Upstream guidance:

- [tinyglobby migration](https://superchupu.dev/tinyglobby/migration)
- [tinyglobby API](https://superchupu.dev/tinyglobby/documentation)

The upstream migration documentation explicitly calls out directory expansion,
depth counting and filesystem adapter differences. Keep this compatibility layer
small rather than silently accepting additional caller capabilities.
