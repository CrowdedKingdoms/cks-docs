# Vendored: Klee

Klee is a standalone Unreal Engine Blueprint visualizer for the web (MIT, see `LICENSE`).
Upstream: https://github.com/joined-forces/klee, commit `3c694f280ea1702624f81e7b0d20b9292d635cc5`
(2025-10-12), copied on 2026-09-17. `LICENSE`, `README.md`, and `src/` started as a
byte-for-byte copy of that commit. `src/` then received a small CodeQL patch and is no longer
pristine: the parser refuses a method name that is not a function on the registry, looks parsers
up in a `Map` instead of a prototype object, replaces every quote or tab rather than the first,
and avoids a backtracking pin regex. Those edits are only in:

- `src/parser/blueprint-parser-utils.ts`
- `src/parser/node-parser-registry.ts`
- `src/parser/node.parser.ts`
- `src/parser/pin-property.parser.ts`
- `src/parser/node-parsers/generic-node.parser.ts`
- `src/parser/node-parsers/select-node.parser.ts`

Two things were added beside the copy rather than inside it: `plugins/crowdy.plugin.ts`, a Klee
plugin that gives the Crowdy custom Blueprint nodes their editor titles (upstream's `plugins/`
folder is empty and is discovered by `loadPlugins()` through `require.context`, which this site's
bundler supports), and the site-side plugin `src/plugins/klee-vendor` in the docs repo, which
aliases `@vendor/klee` to `src/klee.ts` here and strips the `/// #if DEBUG_UI ... /// #endif`
blocks that upstream's `ifdef-loader` removes at build time (the code inside draws debug outlines
and must not run). The folder is excluded from the site's `tsc` typecheck because upstream is not
strict-clean; the bundler compiles it with Babel, which does not type-check. To re-vendor, replace
`src/`, `plugins/` (keeping `crowdy.plugin.ts`), `LICENSE` and `README.md`, re-apply the parser
patch above, then update the commit here.
