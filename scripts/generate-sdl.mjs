// Publishes each sibling GraphQL API's SDL as a downloadable static file so agents
// and integrators can fetch the raw schema at a stable URL:
//   /schema/management-api.graphql
//   /schema/game-api.graphql
//   /schema/crowdyjs.graphql
//
// Source schemas are the code-first `schema.gql` files each API regenerates on boot.
// Run via `npm run sdl:gen` (also chained from `prebuild`). The output is committed so
// the SDL is served even when CI builds with `docusaurus build` (which skips prebuild).
//
// The management SDL has no repository of its own since cks-management-api was retired
// on 2026-08-06. It is DERIVED from the unified cks-game-api schema by keeping the root
// fields listed in scripts/management-surface.json and pruning to the types those
// fields can reach.
//
// This script REFUSES rather than skipping. It used to `console.warn` and `continue` on
// a missing source, which meant deleting cks-management-api left a stale
// management-api.graphql published forever while `sdl:gen` printed "published 2/3" and
// exited 0 — and `lint:schema` then validated the stale file and reported OK. A
// checker's failure mode is a quiet pass.
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, print, visit } from 'graphql';

const here = dirname(fileURLToPath(import.meta.url));
const docsRepo = resolve(here, '..'); // cks-docs/
const siblingRoot = resolve(docsRepo, '..'); // cks-project-root/ (sibling API repos live here)
const outDir = resolve(docsRepo, 'static/schema');

const gameSchema =
  process.env.CKS_DOCS_GAME_SCHEMA ?? resolve(siblingRoot, 'cks-game-api/schema.gql');
const crowdyJsSchema =
  process.env.CKS_DOCS_CROWDYJS_SCHEMA ?? resolve(siblingRoot, 'CrowdyJS/schema.gql');
const surfaceFile = resolve(here, 'management-surface.json');

const ROOT_TYPES = ['Query', 'Mutation', 'Subscription'];
const BUILTIN_SCALARS = new Set(['Int', 'Float', 'String', 'Boolean', 'ID']);

function die(message) {
  console.error(`[sdl:gen] FATAL: ${message}`);
  process.exit(1);
}

function readSource(label, path) {
  if (!existsSync(path)) {
    die(
      `${label} source missing: ${path}\n` +
        `Boot that API once to regenerate its schema.gql, or set its ` +
        `CKS_DOCS_*_SCHEMA override. Refusing to republish a stale SDL.`,
    );
  }
  return readFileSync(path, 'utf8');
}

// --- derive the management SDL from the unified schema ------------------------

/** Every type name mentioned anywhere under an AST node. */
function typeNamesIn(node) {
  const names = [];
  visit(node, { NamedType: (n) => void names.push(n.name.value) });
  return names;
}

function deriveManagementSdl(gameSdl, surface) {
  const doc = parse(gameSdl);
  const byName = new Map();
  for (const def of doc.definitions) {
    if (def.name) {
      const list = byName.get(def.name.value) ?? [];
      list.push(def);
      byName.set(def.name.value, list);
    }
  }

  // 1. Keep only the allowlisted root fields, and refuse if one has disappeared.
  const missing = [];
  const keptRoots = new Map();
  for (const rootType of ROOT_TYPES) {
    const wanted = surface.include[rootType];
    if (!wanted?.length) continue;
    const defs = (byName.get(rootType) ?? []).filter(
      (d) => d.kind === 'ObjectTypeDefinition' || d.kind === 'ObjectTypeExtension',
    );
    const available = new Set(defs.flatMap((d) => (d.fields ?? []).map((f) => f.name.value)));
    for (const field of wanted) {
      if (!available.has(field)) missing.push(`${rootType}.${field}`);
    }
    const kept = defs
      .flatMap((d) => d.fields ?? [])
      .filter((f) => wanted.includes(f.name.value));
    if (kept.length) keptRoots.set(rootType, { def: defs[0], fields: kept });
  }

  if (missing.length) {
    die(
      `${missing.length} allowlisted management root field(s) are no longer in the ` +
        `unified schema:\n  ${missing.join('\n  ')}\n` +
        `If that is deliberate, move them to "retired" in ` +
        `scripts/management-surface.json with a reason. If not, the management ` +
        `surface just lost a field.`,
    );
  }

  // 2. Walk out from those fields to every type they can reach.
  const reachable = new Set();
  const queue = [];
  const enqueue = (name) => {
    if (!name || BUILTIN_SCALARS.has(name) || reachable.has(name)) return;
    reachable.add(name);
    queue.push(name);
  };
  for (const { fields } of keptRoots.values()) {
    for (const f of fields) typeNamesIn(f).forEach(enqueue);
  }
  while (queue.length) {
    for (const def of byName.get(queue.shift()) ?? []) typeNamesIn(def).forEach(enqueue);
  }

  // 3. Emit: the trimmed root types, every reachable type, and all directives.
  const out = [];
  for (const def of doc.definitions) {
    if (def.kind === 'DirectiveDefinition') {
      out.push(def);
      continue;
    }
    const name = def.name?.value;
    if (!name) continue;
    if (ROOT_TYPES.includes(name)) {
      const kept = keptRoots.get(name);
      if (kept && kept.def === def) out.push({ ...def, fields: kept.fields });
      continue;
    }
    if (reachable.has(name)) out.push(def);
  }

  const header =
    `# DERIVED FILE - do not edit.\n` +
    `# Generated by scripts/generate-sdl.mjs from the unified cks-game-api schema,\n` +
    `# filtered to the management surface in scripts/management-surface.json.\n` +
    `# cks-management-api was retired 2026-08-06; this SDL has no repository of its own.\n\n`;
  return { sdl: header + print({ ...doc, definitions: out }), rootCount: [...keptRoots.values()].reduce((a, r) => a + r.fields.length, 0) };
}

// --- run ----------------------------------------------------------------------

mkdirSync(outDir, { recursive: true });

if (!existsSync(surfaceFile)) die(`management surface allowlist missing: ${surfaceFile}`);
const surface = JSON.parse(readFileSync(surfaceFile, 'utf8'));

const gameSdl = readSource('Game API', gameSchema);
const crowdyJsSdl = readSource('CrowdyJS', crowdyJsSchema);

const { sdl: managementSdl, rootCount } = deriveManagementSdl(gameSdl, surface);

const published = [
  ['management-api.graphql', managementSdl, `derived from ${gameSchema} (${rootCount} root fields)`],
  ['game-api.graphql', gameSdl, gameSchema],
  ['crowdyjs.graphql', crowdyJsSdl, crowdyJsSchema],
];

for (const [name, contents, from] of published) {
  writeFileSync(resolve(outDir, name), contents);
  console.log(`[sdl:gen] ${from} -> static/schema/${name}`);
}

// Second count, derived a different way: every file the site serves must exist and be
// non-empty on disk after the run. A write that produced nothing must not read as OK.
const EXPECTED = published.length;
let onDisk = 0;
for (const [name] of published) {
  const path = resolve(outDir, name);
  if (existsSync(path) && readFileSync(path, 'utf8').trim().length > 0) onDisk += 1;
}
if (onDisk !== EXPECTED) {
  die(`published ${onDisk}/${EXPECTED} schema file(s) — every SDL the site serves must be written.`);
}
console.log(`[sdl:gen] published ${onDisk}/${EXPECTED} schema file(s).`);
