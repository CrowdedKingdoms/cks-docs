#!/usr/bin/env node
// Refuses internal references in the content this PUBLIC repository publishes.
//
// This repo builds three docs sites and serves three GraphQL SDLs and 2361
// generated reference pages. It had no content-policy gate at all, while both
// SDKs generated from the same upstream schema had one -- and the asymmetry was
// the defect rather than any single reference: the copy nobody had gated is
// where a sealed-repo name was eventually found, not because it was worse but
// because nothing had ever looked.
//
// TWO RULES, AND A DELIBERATE NON-RULE. What is gated here is narrow on purpose;
// the reasoning is written down beside each rule because the alternative is the
// exemption this gate's sibling in CrowdyCPP carried for weeks -- a correct
// diagnosis with nobody assigned to act on it, and nothing counting what it hid.
//
// ---------------------------------------------------------------------------
// WHY `cks-game-api` IS NOT GATED. Read this before adding it.
// ---------------------------------------------------------------------------
// It was considered and deliberately excluded, along with `game-api`.
//
// The test that decided it: gating it would have required an allowlist on the
// first run. It appears in 15 files, and in 13 of them it is simply correct --
// eleven are contributor-facing (this file's siblings in `scripts/`, `README.md`,
// `AGENTS.md`, CI) and describe the sibling-checkout build, including the
// promotion-order rule that CI structurally cannot enforce; two are reader-facing
// version requirements of the form "Requires `cks-game-api >= v0.12.3`".
//
// A rule that needs an allowlist on day one is telling you the TERM is wrong,
// not that the corpus is. And the reference is not a disclosure in any case: an
// integrator calling this API downloads `game-api.graphql` from this very site,
// so the name carries nothing they cannot read off the endpoint.
//
// If a future reader wants to gate it, the thing to gate is narrower than the
// name -- an INSTRUCTION naming a private checkout ("set these in
// `cks-game-api/.env`") is a broken instruction as well as a leak, because the
// reader has no such tree. Those were fixed at the three sites rather than
// pattern-matched, because the fix is to make the page followable and no regex
// expresses that.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SELF = 'scripts/check-content-policy.mjs';

// --- rule 1: names of repositories a reader has no route to -----------------
// Each of these is either sealed or an internal monorepo/wrapper. Unlike
// `cks-game-api` there is no artefact on this site whose existence implies them,
// so a mention is pure internal vocabulary -- and in every instance found so far
// it also pointed a reader at a tree they cannot open.
const PRIVATE_REPO_NAMES = [
  'cks-udp-api',        // sealed: the realtime runtime. Public vocabulary is "Buddy" / "replication API".
  'cks-michael-root',   // the operator wrapper.
  'cks-project-root',   // the project monorepo.
  'cks-platform-core',  // shared platform schema/lib.
  'cks-management-api', // archived; its surface is a filtered view of the game API.
];

// --- rule 2: infrastructure identity ----------------------------------------
// A repository name is a name. An AWS account id is an identifier for a real
// account, and the registry host and namespace beside it name a private
// artefact store. These are the only things this gate treats as more than
// vocabulary.
//
// The account-id pattern refuses a 12-digit run whose NEIGHBOURS are not hex or
// a hyphen. That is not defensive dressing -- the naive `\b[0-9]{12}\b` matches
// the tail of the canonical example UUID `550e8400-e29b-41d4-a716-446655440000`,
// which is in `docs-game-api/query-notes.md` and is entirely correct there. The
// naive rule would therefore have needed an allowlist on its first run, which by
// the test written above is a statement about the rule. Refining the pattern
// costs one lookaround and leaves the gate with no exceptions at all.
const INFRA_PATTERNS = [
  {
    id: 'aws-account-id',
    re: /(?<![0-9a-fA-F-])[0-9]{12}(?![0-9a-fA-F-])/g,
    why: 'a 12-digit AWS account id',
  },
  {
    id: 'ecr-registry-host',
    re: /[0-9]{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com/g,
    why: 'a private ECR registry host',
  },
  {
    // The namespace inside that registry. Gated by name because it is the one
    // part that survives redaction of the host: `crowd-rocks/<image>` is still a
    // private artefact path, and it appears nowhere else public, so a reader
    // encountering it learns an internal name and can act on none of it.
    id: 'ecr-namespace',
    re: /crowd-rocks/g,
    why: 'the private ECR namespace',
  },
];

// Binary and lockfile-ish things carry no prose. Everything else is read.
const SKIP_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.pdf',
  '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.zip', '.gz',
]);

/**
 * The corpus is DERIVED from the site config, not enumerated here.
 *
 * Every stale-corpus incident in this project came from a hardcoded list: a gate
 * that scanned two trees while five checkouts sat outside it, a search honouring
 * an ignore file that hid every repo shipping a browser client. A list of docs
 * plugin directories would go stale the first time somebody adds a docs section,
 * and the gate would keep printing OK about a tree it no longer covers.
 *
 * So the docs roots come out of `docusaurus.config.ts`'s own `path:` values --
 * the same declaration the build reads. `static/` and `src/` are added because
 * they are published too and are not declared as plugin paths.
 */
function deriveCorpusRoots() {
  const cfgPath = join(ROOT, 'docusaurus.config.ts');
  if (!existsSync(cfgPath)) {
    return { error: 'docusaurus.config.ts is missing; the corpus cannot be derived' };
  }
  const cfg = readFileSync(cfgPath, 'utf8');
  const declared = [...cfg.matchAll(/path:\s*'(docs[^']*)'/g)].map((m) => m[1]);
  const roots = [...new Set(declared)].sort();
  if (roots.length === 0) {
    return { error: "no docs plugin `path:` values found in docusaurus.config.ts" };
  }
  // Published but not declared as a plugin path.
  for (const extra of ['static', 'src']) {
    if (existsSync(join(ROOT, extra))) roots.push(extra);
  }
  const missing = roots.filter((r) => !existsSync(join(ROOT, r)));
  if (missing.length) {
    return { error: `declared docs path(s) absent from the tree: ${missing.join(', ')}` };
  }
  return { roots };
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walk(full, out);
    } else if (entry.isFile()) {
      if (!SKIP_EXT.has(extname(entry.name).toLowerCase())) out.push(full);
    }
  }
  return out;
}

/** Docusaurus omits `draft: true` pages from a PRODUCTION build. */
function isDraft(text) {
  const fm = text.startsWith('---') ? text.slice(0, text.indexOf('\n---', 3) + 4) : '';
  return /^draft:\s*true\s*$/m.test(fm);
}

export function scan(root = ROOT) {
  const { roots, error } = deriveCorpusRoots();
  if (error) return { error };

  const findings = [];
  let files = 0;
  let drafts = 0;

  for (const rel of roots) {
    for (const abs of walk(join(root, rel))) {
      const relPath = abs.slice(root.length + 1);
      if (relPath === SELF) continue;
      let text;
      try {
        text = readFileSync(abs, 'utf8');
      } catch {
        continue;
      }
      if (text.includes('\u0000')) continue; // binary that slipped the extension list
      files += 1;
      const draft = isDraft(text);
      if (draft) drafts += 1;

      const lines = text.split('\n');
      for (const term of PRIVATE_REPO_NAMES) {
        lines.forEach((line, i) => {
          if (line.includes(term)) {
            findings.push({ file: relPath, line: i + 1, rule: 'private-repo-name', hit: term, draft });
          }
        });
      }
      for (const { id, re, why } of INFRA_PATTERNS) {
        lines.forEach((line, i) => {
          for (const m of line.matchAll(re)) {
            findings.push({ file: relPath, line: i + 1, rule: id, hit: m[0], why, draft });
          }
        });
      }
    }
  }
  return { roots, files, drafts, findings };
}

function report() {
  const { roots, files, drafts, findings, error } = scan();

  if (error) {
    // Could-not-run is a THIRD outcome. A gate whose corpus cannot be derived
    // must not print the same thing as a gate that found nothing.
    console.error(`content-policy: COULD NOT RUN -- ${error}`);
    console.error('  Nothing was checked. This is not a pass.');
    return 3;
  }

  // The corpus size is printed on every run, and the draft count is called out
  // separately, because "published" means two different things here and they
  // differ on exactly the files that matter. Docusaurus omits `draft: true`
  // pages from a production build, so a gate scoped to the BUILT SITE would have
  // reported this repository clean while an AWS account id sat in a draft page
  // in a public repo -- readable by anyone, just not routable on the site.
  // The number is what makes that distinction visible to whoever reads the log.
  console.log(`corpus: ${files} file(s) across ${roots.length} published root(s): ${roots.join(' ')}`);
  console.log(`        including ${drafts} draft page(s) -- omitted from the built site, PUBLIC in this repo`);
  console.log(`rules:  ${PRIVATE_REPO_NAMES.length} private repo name(s), ${INFRA_PATTERNS.length} infrastructure pattern(s)`);
  console.log('        not gated, deliberately: cks-game-api / game-api (see the header)');

  if (findings.length === 0) {
    console.log('\nOK  no internal reference in anything this repo publishes');
    return 0;
  }

  console.error(`\nFAIL  ${findings.length} internal reference(s) in published content:\n`);
  for (const f of findings) {
    const tag = f.draft ? ' [DRAFT: not on the site, still public here]' : '';
    console.error(`  ${f.file}:${f.line}  ${f.rule}  ${f.hit}${tag}`);
  }
  console.error(`
What to do, by rule:
  private-repo-name   A reader has no route to these trees. If the line is an
                      INSTRUCTION, removing the name is half a fix -- the page
                      still cannot be followed. Make it work for an external
                      reader, or drop the step.
  aws-account-id      Remove it. An account id is an identifier for a real
  ecr-registry-host   account, not vocabulary, and no reader can act on it.

Do not add an exemption. This gate deliberately has none, and the one it
replaced in a sibling repo hid a real leak for weeks on two true premises.`);
  return 1;
}

// --- self-test ---------------------------------------------------------------
// A gate that has never been observed refusing is unproven. The case that
// matters most is the LAST one: an account id inside a draft page is what the
// obvious implementation -- scan the built site -- silently misses.
function selfTest() {
  const cases = [
    { name: 'clean line', text: 'Call the game API at `/graphql`.\n', expect: 0 },
    { name: 'cks-game-api is NOT gated', text: 'Requires `cks-game-api >= v0.12.3`.\n', expect: 0 },
    { name: 'game-api is NOT gated', text: 'Download `game-api.graphql`.\n', expect: 0 },
    { name: 'example UUID is NOT an account id', text: '"UUID": "550e8400-e29b-41d4-a716-446655440000"\n', expect: 0 },
    { name: 'sealed repo name', text: 'Owned by cks-udp-api.\n', expect: 1 },
    { name: 'monorepo path', text: 'See `cks-project-root/compute-examples/`.\n', expect: 1 },
    { name: 'wrapper name', text: '. cks-michael-root/scripts/tier-facts.sh\n', expect: 1 },
    { name: 'bare AWS account id', text: 'account 317700178317 owns it\n', expect: 1 },
    { name: 'ARN carries the id', text: 'arn:aws:iam::317700178317:role/x\n', expect: 1 },
    { name: 'ECR host (id + host = 2)', text: 'push 317700178317.dkr.ecr.us-east-2.amazonaws.com/x\n', expect: 2 },
    { name: 'ECR namespace survives host redaction', text: 'name: crowd-rocks/some-image\n', expect: 1 },
    {
      name: 'ACCOUNT ID IN A DRAFT -- the case a built-site corpus misses',
      text: '---\ndraft: true\n---\n\nlogin to 317700178317.dkr.ecr.us-east-2.amazonaws.com\n',
      expect: 2,
      mustBeDraft: true,
    },
  ];

  let failed = 0;
  for (const c of cases) {
    const lines = c.text.split('\n');
    const draft = isDraft(c.text);
    let n = 0;
    for (const term of PRIVATE_REPO_NAMES) {
      for (const line of lines) if (line.includes(term)) n += 1;
    }
    for (const { re } of INFRA_PATTERNS) {
      for (const line of lines) n += [...line.matchAll(re)].length;
    }
    const okCount = n === c.expect;
    const okDraft = c.mustBeDraft ? draft === true : true;
    const ok = okCount && okDraft;
    if (!ok) failed += 1;
    console.log(
      `  ${ok ? 'ok  ' : 'FAIL'}  ${c.name}` +
        (okCount ? '' : ` -- expected ${c.expect} finding(s), got ${n}`) +
        (okDraft ? '' : ' -- draft frontmatter was not recognised'),
    );
  }

  // The corpus must be derivable, and it must be derived rather than listed.
  const derived = deriveCorpusRoots();
  if (derived.error) {
    console.log(`  FAIL  corpus derivation -- ${derived.error}`);
    failed += 1;
  } else {
    const declaredCount = derived.roots.filter((r) => r.startsWith('docs')).length;
    const ok = declaredCount >= 5 && derived.roots.includes('static');
    if (!ok) failed += 1;
    console.log(
      `  ${ok ? 'ok  ' : 'FAIL'}  corpus derived from docusaurus.config.ts: ` +
        `${declaredCount} docs root(s) + ${derived.roots.length - declaredCount} extra`,
    );
  }

  console.log(failed === 0 ? '\nself-test OK' : `\nself-test FAILED (${failed})`);
  return failed === 0 ? 0 : 1;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  process.exit(process.argv.includes('--self-test') ? selfTest() : report());
}
