// Publishes each sibling GraphQL API's SDL as a downloadable static file so agents
// and integrators can fetch the raw schema at a stable URL:
//   /schema/management-api.graphql
//   /schema/game-api.graphql
//   /schema/crowdyjs.graphql
//
// Source schemas are the code-first `schema.gql` files each API regenerates on boot.
// Run via `npm run sdl:gen` (also chained from `prebuild`). The output is committed so
// the SDL is served even when CI builds with `docusaurus build` (which skips prebuild).
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const docsRepo = resolve(here, '..'); // cks-docs/
const siblingRoot = resolve(docsRepo, '..'); // cks-project-root/ (sibling API repos live here)
const outDir = resolve(docsRepo, 'static/schema');

const sources = [
  { from: 'cks-management-api/schema.gql', to: 'management-api.graphql' },
  { from: 'cks-game-api/schema.gql', to: 'game-api.graphql' },
  { from: 'CrowdyJS/schema.gql', to: 'crowdyjs.graphql' },
];

mkdirSync(outDir, { recursive: true });

let copied = 0;
for (const { from, to } of sources) {
  const src = resolve(siblingRoot, from);
  if (!existsSync(src)) {
    console.warn(`[sdl:gen] skip (source missing): ${from}`);
    continue;
  }
  copyFileSync(src, resolve(outDir, to));
  console.log(`[sdl:gen] ${from} -> static/schema/${to}`);
  copied += 1;
}

console.log(`[sdl:gen] published ${copied}/${sources.length} schema file(s).`);
