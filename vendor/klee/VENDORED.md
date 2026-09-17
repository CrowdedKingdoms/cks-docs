# Vendored: Klee

Klee is a standalone Unreal Engine Blueprint visualizer for the web (MIT, see `LICENSE`).
Upstream: https://github.com/joined-forces/klee, commit `3c694f280ea1702624f81e7b0d20b9292d635cc5`
(2025-10-12), copied on 2026-09-17. `src/`, `plugins/`, `LICENSE` and `README.md` are
byte-for-byte copies of that commit; nothing under `src/` was edited. Two things were added
beside the copy rather than inside it: `plugins/crowdy.plugin.ts`, a Klee plugin that gives the
Crowdy custom Blueprint nodes their editor titles (upstream's `plugins/` folder is empty and is
discovered by `loadPlugins()` through `require.context`, which this site's bundler supports), and
the site-side plugin `src/plugins/klee-vendor` in the docs repo, which aliases `@vendor/klee` to
`src/klee.ts` here and strips the `/// #if DEBUG_UI ... /// #endif` blocks that upstream's
`ifdef-loader` removes at build time (the code inside draws debug outlines and must not run).
The folder is excluded from the site's `tsc` typecheck because upstream is not strict-clean; the
bundler compiles it with Babel, which does not type-check. To re-vendor, replace `src/`,
`plugins/` (keeping `crowdy.plugin.ts`), `LICENSE` and `README.md`, then update the commit here.
