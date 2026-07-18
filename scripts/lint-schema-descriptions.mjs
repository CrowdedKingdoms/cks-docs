// Agent-readiness guard: every public root field (Query/Mutation/Subscription) and its
// arguments must carry a GraphQL description, so introspecting agents always have
// guidance. Runs against the published SDL committed under static/schema/ (produced by
// `npm run sdl:gen`), so it needs no database or sibling repo checkout.
//
// Policy: missing descriptions on root fields/args of the STRICT APIs fail the build;
// gaps elsewhere (SDKs, types, enums) are reported as warnings. Run via `npm run lint:schema`.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSchema } from 'graphql';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');

const SCHEMAS = [
  { name: 'Management API', file: 'static/schema/management-api.graphql', strict: true },
  { name: 'Game API', file: 'static/schema/game-api.graphql', strict: true },
  { name: 'CrowdyJS', file: 'static/schema/crowdyjs.graphql', strict: false },
];

let errors = 0;
let warnings = 0;

for (const { name, file, strict } of SCHEMAS) {
  const path = resolve(repo, file);
  if (!existsSync(path)) {
    console.warn(`[lint:schema] skip (missing): ${file}`);
    continue;
  }
  const schema = buildSchema(readFileSync(path, 'utf8'));
  const roots = [schema.getQueryType(), schema.getMutationType(), schema.getSubscriptionType()].filter(Boolean);

  let fieldCount = 0;
  let missing = 0;
  let guarded = 0;
  const report = strict ? (m) => { console.error(`  ERROR ${m}`); errors++; } : (m) => { console.warn(`  warn  ${m}`); warnings++; };
  // The @requiresPermission directive (when applied) must be declared in the SDL,
  // else buildSchema() above would have thrown. Here we sanity-check that each
  // application carries a non-empty scope + permission and report coverage.
  const hasRequiresPermission = (field) => {
    const applied = (field.astNode?.directives ?? []).filter(
      (d) => d.name.value === 'requiresPermission',
    );
    for (const d of applied) {
      const argByName = Object.fromEntries(
        (d.arguments ?? []).map((a) => [a.name.value, a.value]),
      );
      const scope = argByName.scope?.value;
      const permission = argByName.permission?.value;
      if (!scope || !permission) {
        report(`[${name}] field ${field.name} has a malformed @requiresPermission (scope/permission required)`);
      }
    }
    return applied.length > 0;
  };

  for (const root of roots) {
    for (const [fieldName, field] of Object.entries(root.getFields())) {
      fieldCount++;
      if (hasRequiresPermission(field)) guarded++;
      if (!field.description || !field.description.trim()) {
        report(`[${name}] ${root.name}.${fieldName} has no description`);
        missing++;
      }
      for (const arg of field.args) {
        // The conventional single `input` object wrapper documents its shape on the
        // input type's own fields, so its arg-level description is redundant. Every
        // other (typically scalar) argument must still carry a description.
        if (arg.name === 'input') continue;
        if (!arg.description || !arg.description.trim()) {
          report(`[${name}] ${root.name}.${fieldName}(${arg.name}:) has no description`);
          missing++;
        }
      }
    }
  }
  console.log(`[lint:schema] ${name}: ${fieldCount} root fields checked, ${missing} undocumented field/arg(s), ${guarded} with @requiresPermission ${strict ? '(strict)' : '(warn-only)'}.`);
}

if (errors > 0) {
  console.error(`\n[lint:schema] FAIL: ${errors} required description(s) missing (${warnings} warning(s)).`);
  process.exit(1);
}
console.log(`\n[lint:schema] OK (${warnings} warning(s)). All required public root fields/args are documented.`);
