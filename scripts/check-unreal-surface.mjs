#!/usr/bin/env node
// Is every public symbol of the Unreal SDK mentioned somewhere in docs-unreal-sdk/?
//
// The surface comes from static/helpers/unreal-sdk/sdk-surface.json, which is generated
// in the SDK repository (scripts/Export-SdkSurface.ps1 in crowdy-sdk) and copied here.
// This script never reads SDK source: it compares that inventory against the pages and
// says what nobody has written about yet.
//
// A symbol is covered when it appears as a whole word in any page (front matter
// excluded), OR when some page embeds a <SurfaceTable> that renders its row (read the same
// way src/components/SurfaceTable.tsx does: honouring `filter`, `includeEditor` and
// `includeAllowlisted`, from src/generated/unreal-sdk/<table>.json). What "it" means for the
// prose check depends on the group:
//
//   functions        `name` or `display_name`
//   delegates        `name`
//   settings         every property `name`; the class counts as covered when all are,
//                    and the report is per property (`Class::Property`)
//   cpp_functions    `name`, in a page that also mentions the `owner` (file-scope
//                    functions have no owner and need only the name)
//   everything else  `id`
//
// cpp_functions with test_helper, implementation or deprecated set are skipped, and
// those with blueprint set are the same functions as the `functions` group and are
// counted there only. Entries with editor_module set are listed in their own section
// because they are usually allowlisted wholesale (reason `editor`).
//
// scripts/unreal-surface-allowlist.json names symbols that are deliberately not
// documented. Three outcomes: 0 = nothing missing, 1 = something is missing (or
// --report, which prints and exits 0), 3 = could not run.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');

const SURFACE = 'static/helpers/unreal-sdk/sdk-surface.json';
const ALLOWLIST = 'scripts/unreal-surface-allowlist.json';
const DOCS = 'docs-unreal-sdk';
const REASONS = new Set(['internal', 'deprecated', 'mass', 'editor']);

const argv = process.argv.slice(2);
const REPORT = argv.includes('--report');
const JSON_OUT = argv.includes('--json');

const say = (s) => { if (!JSON_OUT) console.log(s); };
const bad = (s) => console.error(s);

// --- inputs --------------------------------------------------------------------------

const surfacePath = resolve(repo, SURFACE);
if (!existsSync(surfacePath)) {
  bad(
    `[check-unreal-surface] COULD NOT RUN: ${SURFACE} is missing.\n` +
      `  It is generated in the crowdy-sdk repository by scripts/Export-SdkSurface.ps1 and\n` +
      `  copied here. Run that generator and copy Saved/DocsExport/sdk-surface.json over.`,
  );
  process.exit(3);
}
const surface = JSON.parse(readFileSync(surfacePath, 'utf8'));
const isSample = surface.generated === 'sample';

const allowlistPath = resolve(repo, ALLOWLIST);
const allowlistRaw = existsSync(allowlistPath) ? JSON.parse(readFileSync(allowlistPath, 'utf8')) : [];
const allowlist = new Map();
for (const entry of allowlistRaw) {
  if (!entry || typeof entry.id !== 'string') continue; // the _comment entry
  if (!REASONS.has(entry.reason)) {
    bad(`[check-unreal-surface] COULD NOT RUN: ${ALLOWLIST} entry ${entry.id} has reason ` +
      `'${entry.reason}', expected one of ${[...REASONS].join('|')}.`);
    process.exit(3);
  }
  allowlist.set(entry.id, entry);
}

// --- corpus --------------------------------------------------------------------------

function walk(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.mdx?$/.test(name)) out.push(full);
  }
  return out;
}

function stripFrontMatter(text) {
  if (!text.startsWith('---')) return text;
  const end = text.indexOf('\n---', 3);
  return end < 0 ? text : text.slice(end + 4);
}

const pages = walk(resolve(repo, DOCS)).map((file) => ({
  path: relative(repo, file).replace(/\\/g, '/'),
  text: stripFrontMatter(readFileSync(file, 'utf8').replace(/\r\n/g, '\n')),
}));

// --- generated reference tables --------------------------------------------------------
//
// A page can also cover a symbol by embedding it in a <SurfaceTable table="..."/> (rendered
// from src/generated/unreal-sdk/<table>.json, scripts/build-unreal-reference.mjs), rather
// than naming it in prose. Read every embed the same way src/components/SurfaceTable.tsx
// renders it, honouring `filter`, `includeEditor` and `includeAllowlisted`, and treat each
// row's `id` that survives as mentioned.
const GENERATED_DIR = 'src/generated/unreal-sdk';
const TABLE_FILE = {
  subsystems: 'subsystems',
  async_actions: 'async-actions',
  delegates: 'delegates',
  cvars: 'cvars',
  settings: 'settings',
  meta_keys: 'meta-keys',
  enums: 'enums',
  log_categories: 'log-categories',
  structs: 'structs',
};

const tableCache = new Map();
function loadTable(file) {
  if (tableCache.has(file)) return tableCache.get(file);
  const path = resolve(repo, GENERATED_DIR, `${file}.json`);
  const data = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
  tableCache.set(file, data);
  return data;
}

function rowMatchesFilter(row, filter) {
  if (!filter) return true;
  const eq = filter.indexOf('=');
  if (eq < 0) return true;
  const key = filter.slice(0, eq).trim();
  const want = filter.slice(eq + 1).trim();
  const have = row[key];
  if (Array.isArray(have)) return have.includes(want);
  return String(have) === want;
}

// group -> Set of ids covered by some page's rendered table embed.
const tableCoveredIds = new Map();
const embedRe = /<SurfaceTable([\s\S]*?)\/>/g;
for (const page of pages) {
  for (const match of page.text.matchAll(embedRe)) {
    const attrs = match[1];
    const tableName = /table\s*=\s*"([^"]+)"/.exec(attrs)?.[1];
    const group = Object.entries(TABLE_FILE).find(([, file]) => file === tableName)?.[0];
    if (!group) continue;
    const data = loadTable(tableName);
    if (!data) continue;
    const includeEditor = /\bincludeEditor\b/.test(attrs);
    const includeAllowlisted = /\bincludeAllowlisted\b/.test(attrs);
    const filter = /filter\s*=\s*"([^"]*)"/.exec(attrs)?.[1];
    const set = tableCoveredIds.get(group) ?? new Set();
    for (const row of data.rows) {
      if (!includeEditor && row.editor) continue;
      if (!includeAllowlisted && row.allowlist) continue;
      if (!rowMatchesFilter(row, filter)) continue;
      set.add(row.id);
    }
    tableCoveredIds.set(group, set);
  }
}
const tableCovers = (group, id) => tableCoveredIds.get(group)?.has(id) === true;

// Whole word: not touching an identifier character on either side. Ids may carry `::`
// and `.`, so the test is on the page text rather than on a token set.
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (term) => new RegExp(`(?<![A-Za-z0-9_])${escape(term)}(?![A-Za-z0-9_])`);
const pagesMentioning = (term) => {
  const re = wordRe(term);
  return pages.filter((p) => re.test(p.text));
};
const anyPageMentions = (...terms) => terms.some((t) => t && pagesMentioning(t).length > 0);

// --- rules ---------------------------------------------------------------------------

// Each rule: how one entry is judged. Returns true when the docs cover it.
const RULES = {
  functions: (e) => anyPageMentions(e.name, e.display_name),
  delegates: (e) => anyPageMentions(e.name),
  async_actions: (e) => anyPageMentions(e.id),
  subsystems: (e) => anyPageMentions(e.id),
  structs: (e) => anyPageMentions(e.id),
  enums: (e) => anyPageMentions(e.id),
  cvars: (e) => anyPageMentions(e.id),
  meta_keys: (e) => anyPageMentions(e.id),
  log_categories: (e) => anyPageMentions(e.id),
  cpp_types: (e) => anyPageMentions(e.id),
  cpp_delegates: (e) => anyPageMentions(e.id),
  cpp_macros: (e) => anyPageMentions(e.id),
  cpp_functions: (e) => {
    if (!e.owner) return anyPageMentions(e.name);
    const ownerRe = wordRe(e.owner);
    return pagesMentioning(e.name).some((p) => ownerRe.test(p.text));
  },
};

// Why an entry is not judged at all. Returns a label, or undefined to judge it.
function skipReason(group, e) {
  if (group !== 'cpp_functions') return undefined;
  if (e.blueprint) return 'blueprint (counted under functions)';
  if (e.test_helper) return 'test helper';
  if (e.implementation) return 'implementation';
  if (e.deprecated) return 'deprecated';
  return undefined;
}

// settings are judged per property, so they are flattened into synthetic entries first.
function settingsEntries(list) {
  const out = [];
  for (const s of list) {
    for (const p of s.properties ?? []) {
      out.push({
        id: `${s.id}::${p.name}`,
        settingsClass: s.id,
        name: p.name,
        module: s.module,
        owner: s.id,
        editor_module: s.editor_module,
      });
    }
  }
  return out;
}

const ownerOf = (group, e) => {
  if (group === 'cpp_functions' || group === 'settings') return e.owner || '(file scope)';
  if (group === 'cpp_types') return e.scope || '(top level)';
  return e.class || e.owner || '(no class)';
};

// --- judge ---------------------------------------------------------------------------

const groups = {};
const seenAllowlist = new Set();

for (const group of Object.keys(RULES).concat('settings')) {
  const raw = surface[group];
  if (!Array.isArray(raw)) continue;
  const list = group === 'settings' ? settingsEntries(raw) : raw;

  // Overloads share an id; judge each id once.
  const byId = new Map();
  for (const e of list) if (!byId.has(e.id)) byId.set(e.id, e);

  const result = { total: byId.size, covered: 0, allowlisted: 0, skipped: 0, missing: [], skippedWhy: {} };
  for (const e of byId.values()) {
    const skip = skipReason(group, e);
    if (skip) {
      result.skipped += 1;
      result.skippedWhy[skip] = (result.skippedWhy[skip] ?? 0) + 1;
      continue;
    }
    const allowed = allowlist.get(e.id) ?? (e.settingsClass ? allowlist.get(e.settingsClass) : undefined);
    if (allowed) {
      seenAllowlist.add(allowed.id);
      result.allowlisted += 1;
      continue;
    }
    if (tableCovers(group, e.id)) {
      result.covered += 1;
      continue;
    }
    const rule = group === 'settings' ? (x) => anyPageMentions(x.name) : RULES[group];
    if (rule(e)) {
      result.covered += 1;
      continue;
    }
    result.missing.push({
      id: e.id,
      module: e.module ?? '(no module)',
      owner: ownerOf(group, e),
      name: e.name ?? e.id,
      display_name: e.display_name,
      editor_module: e.editor_module === true,
    });
  }
  result.missing.sort((a, b) =>
    a.module.localeCompare(b.module) || a.owner.localeCompare(b.owner) || a.id.localeCompare(b.id),
  );
  groups[group] = result;
}

const staleAllowlist = [...allowlist.keys()].filter((id) => !seenAllowlist.has(id));
const missingTotal = Object.values(groups).reduce((n, g) => n + g.missing.length, 0);

// --- output --------------------------------------------------------------------------

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      {
        surface: SURFACE,
        generated: surface.generated,
        sdk_version: surface.sdk_version,
        sample: isSample,
        pages: pages.length,
        groups,
        stale_allowlist: staleAllowlist,
      },
      null,
      2,
    ),
  );
} else {
  say(`[check-unreal-surface] surface ${SURFACE} (sdk ${surface.sdk_version}, generated ${surface.generated})`);
  say(`[check-unreal-surface] corpus  ${pages.length} page(s) under ${DOCS}/`);
  if (isSample) {
    bad(`[check-unreal-surface] WARNING: the surface file is a SAMPLE, not a real export. ` +
      `Coverage numbers below describe the sample only.`);
  }
  say('');
  const w = (s, n) => String(s).padStart(n);
  say(`  ${'group'.padEnd(16)}${w('total', 7)}${w('covered', 9)}${w('allowed', 9)}${w('skipped', 9)}${w('missing', 9)}`);
  for (const [group, g] of Object.entries(groups)) {
    say(`  ${group.padEnd(16)}${w(g.total, 7)}${w(g.covered, 9)}${w(g.allowlisted, 9)}${w(g.skipped, 9)}${w(g.missing.length, 9)}`);
  }
  for (const [group, g] of Object.entries(groups)) {
    const why = Object.entries(g.skippedWhy);
    if (why.length) say(`  ${group} skipped: ${why.map(([k, v]) => `${v} ${k}`).join(', ')}`);
  }

  const printMissing = (title, filter) => {
    const lines = [];
    for (const [group, g] of Object.entries(groups)) {
      const items = g.missing.filter(filter);
      if (!items.length) continue;
      lines.push(`\n  ${group} (${items.length})`);
      let module = '';
      let owner = '';
      for (const m of items) {
        if (m.module !== module) {
          module = m.module;
          owner = '';
          lines.push(`    ${module}`);
        }
        if (m.owner !== owner) {
          owner = m.owner;
          lines.push(`      ${owner}`);
        }
        const label = m.display_name && m.display_name !== m.name ? `${m.name}  (${m.display_name})` : m.name;
        lines.push(`        ${label}`);
      }
    }
    if (!lines.length) return;
    say(`\n${title}`);
    for (const l of lines) say(l);
  };
  printMissing('MISSING (module, then class or owner):', (m) => !m.editor_module);
  printMissing('MISSING, EDITOR MODULE (allowlist reason "editor" if the editor surface is out of scope):', (m) => m.editor_module);

  if (staleAllowlist.length) {
    say(`\n  allowlist entries matching nothing in the surface (stale?): ${staleAllowlist.join(', ')}`);
  }
  say('');
}

if (missingTotal === 0) {
  say(`[check-unreal-surface] OK  every surface symbol is documented or allowlisted`);
  process.exit(0);
}
if (REPORT) {
  say(`[check-unreal-surface] ${missingTotal} symbol(s) missing (--report: not failing)`);
  process.exit(0);
}
bad(`[check-unreal-surface] FAIL  ${missingTotal} symbol(s) are neither documented nor allowlisted.`);
process.exit(1);
