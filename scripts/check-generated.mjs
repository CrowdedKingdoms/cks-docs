// Are the COMMITTED generated files still what their generators produce?
//
// This repo commits 2364 generated files — three published SDLs under static/schema/
// and 2361 GraphQL reference pages under docs-*/reference/graphql/ — and nothing
// regenerated or compared them. They are committed on purpose: both workflows build
// with `npx docusaurus build`, which skips the npm `prebuild` that runs sdl:gen and
// graphql:gen, so the committed copies are what the site serves. The comment on
// generate-sdl.mjs has said so all along. What was missing is the other half: a
// generated file in the build path is refreshed whether you remember or not, and one
// outside it drifts silently.
//
// It drifted. On 2026-08-21 ck-api v1.60.0 corrected a batch of error-code
// descriptions; the hand-written docs pages were corrected in the same cycle; and
// static/schema/game-api.graphql went on publishing `Throws CONFLICT` for a refusal
// that no longer carries that code — from the published SDL, which is the artefact an
// integrator is most likely to trust over any prose about it. Found by hand.
//
// THREE HOPS, AND ONLY ONE OF THEM CAN CATCH THAT.
//
//   1. copy         <sibling>/schema.gql            -> static/schema/{game-api,crowdyjs}.graphql
//   2. derivation   static/schema/game-api.graphql  -> static/schema/management-api.graphql
//   3. reference    static/schema/*.graphql         -> docs-*/reference/graphql/**
//
// Hops 2 and 3 are entirely in-repo, so they run anywhere, need no token and have no
// cross-repo pairing to get wrong. They are also NOT what went wrong. Measured against
// the incident: with static/schema/ at the stale commit, `graphql:gen` reproduced all
// 2361 reference pages byte-for-byte and hop 3 reported OK — the pages were perfectly
// consistent with a stale SDL, because both were generated together the previous time.
// A gate wired only where it is cheap to wire would have gone green over the exact
// event that motivated it, which is the oldest failure in this codebase's book: a check
// that cannot fail for the reason you care about is not a check.
//
// So hop 1 is the one that pays, and hop 1 needs a sibling checkout of a PRIVATE repo
// (cks-game-api) from a PUBLIC one (this). That is why the wiring is split, and why
// each mode prints what it cannot see rather than leaving a reader to assume a green
// run means all three hops passed:
//
//   --sources=committed   hops 2 and 3.       Docs CI. No siblings, no secret.
//   --sources=siblings    hops 1, 2 and 3.    An operator with the trees checked out.
//   --copy-only           hop 1.              The wrapper's Loop A. Needs NO node_modules.
//
// `--copy-only` compares bytes rather than running sdl:gen, because the wrapper clones
// this repo without installing it. That is an assertion about the generator, not a
// second copy of it: `--self-test` runs the real sdl:gen and refuses if its two
// published outputs are ever anything but byte-identical to their inputs. Change the
// generator to transform the game SDL and that fixture fails, which is the sentence
// telling you the wrapper's cheap check has stopped being equivalent.
//
// Three outcomes, never two. 0 = checked and matching, 1 = DRIFT, 3 = COULD NOT RUN.
// A missing sibling, an absent node_modules or a working tree that is already dirty in
// the generated paths all answer 3: this cannot judge a file somebody is mid-edit on,
// and it must not report the generator's output as drift when the diff was there first.
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valueOf = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : fallback;
};

const SELF_TEST = has('--self-test');
const COPY_ONLY = has('--copy-only');
const SOURCES = COPY_ONLY ? 'siblings' : valueOf('--sources', 'committed');
const WRITE = has('--write');

// Where the sibling checkouts live. Defaults to the parent directory, which is what
// cks-project-root looks like on an operator's box and inside the wrapper.
const siblingRoot = resolve(valueOf('--sibling-root', resolve(repo, '..')));

// THE COPY HOP, as data. Each entry says: this committed file is a byte copy of that
// file in that sibling repo. generate-sdl.mjs is the code that makes it true and
// --self-test is what proves it still does.
const COPIES = [
  { published: 'static/schema/game-api.graphql', repo: 'cks-game-api', source: 'schema.gql' },
  { published: 'static/schema/crowdyjs.graphql', repo: 'CrowdyJS', source: 'schema.gql' },
];

const DERIVED = 'static/schema/management-api.graphql';
const REFERENCE_PATHS = [
  'docs-management-api/reference/graphql',
  'docs-game-api/reference/graphql',
  'docs-crowdyjs/reference/graphql',
];

let drift = 0;
let couldNotRun = 0;
const verified = [];

const say = (s) => console.log(s);
const bad = (s) => console.error(s);

function git(args, cwd = repo) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

/** Tracked-or-untracked changes under the given pathspecs, as a sorted list. */
function dirtyUnder(paths) {
  const out = git(['status', '--porcelain', '--', ...paths]);
  return out
    .split('\n')
    .map((l) => l.slice(3).trim())
    .filter(Boolean)
    .sort();
}

/**
 * Run one generator and report whether it changed anything under `paths`.
 *
 * Pre-existing dirt is a COULD NOT RUN and not a pass: a person mid-edit under these
 * paths is either regenerating (in which case there is nothing to check yet) or
 * hand-editing a generated file (in which case the honest answer is "your tree is not
 * in a state I can judge"), and neither is "matching".
 */
function checkGenerator({ id, describe, paths, run, env }) {
  const already = dirtyUnder(paths);
  if (already.length) {
    bad(
      `\n[${id}] COULD NOT RUN — ${already.length} file(s) under these paths are already ` +
        `modified, so a diff after regenerating would not be evidence about the generator:\n` +
        already
          .slice(0, 8)
          .map((f) => `    ${f}`)
          .join('\n') +
        (already.length > 8 ? `\n    … and ${already.length - 8} more` : '') +
        `\n  Commit or stash them and run this again. If you EDITED one of those by hand,\n` +
        `  that is the defect rather than a state to tidy up: every file under these\n` +
        `  paths is generated output, and the next regeneration will discard it.`,
    );
    couldNotRun += 1;
    return;
  }

  try {
    run(env);
  } catch (err) {
    bad(
      `\n[${id}] COULD NOT RUN — the generator itself failed, so this says nothing ` +
        `about whether the committed output is current:\n    ${String(err.message).split('\n')[0]}`,
    );
    couldNotRun += 1;
    return;
  }

  const changed = dirtyUnder(paths);
  if (changed.length === 0) {
    say(`[${id}] OK  ${describe}`);
    verified.push(id);
    return;
  }

  drift += 1;
  bad(
    `\n[${id}] DRIFT — ${changed.length} committed file(s) are not what the generator ` +
      `produces:\n` +
      changed
        .slice(0, 20)
        .map((f) => `    ${f}`)
        .join('\n') +
      (changed.length > 20 ? `\n    … and ${changed.length - 20} more` : ''),
  );
  if (WRITE) {
    bad(`  Left in place (--write). Commit them.`);
  } else {
    git(['checkout', '--', ...paths]);
    git(['clean', '-qfd', '--', ...paths]);
    bad(`  Reverted. Re-run with --write, or regenerate: ${describe}`);
  }
}

// --- hop 1: the copy -----------------------------------------------------------------

function checkCopies() {
  const missing = COPIES.filter((c) => !existsSync(resolve(siblingRoot, c.repo, c.source)));
  if (missing.length) {
    bad(
      `\n[copy] COULD NOT RUN — ${missing.length} sibling schema(s) are not checked out ` +
        `under ${siblingRoot}:\n` +
        missing.map((c) => `    ${c.repo}/${c.source}`).join('\n') +
        `\n  This is the ONLY hop that can catch a published SDL left behind by an API\n` +
        `  release, so it must not read as a pass. Point --sibling-root at a tree that\n` +
        `  has them, or run this from the wrapper.`,
    );
    couldNotRun += 1;
    return;
  }

  for (const c of COPIES) {
    const dir = resolve(siblingRoot, c.repo);
    const sourcePath = resolve(dir, c.source);
    const publishedPath = resolve(repo, c.published);
    const source = readFileSync(sourcePath);
    const published = existsSync(publishedPath) ? readFileSync(publishedPath) : Buffer.alloc(0);
    const at = describeCheckout(dir, c.source);
    const same = source.equals(published);

    // THE CORPUS'S OWN FRESHNESS IS PART OF THE VERDICT, in BOTH directions, and this
    // gate reported the wrong thing in both until it was run for real. The sibling
    // here is an operator's working checkout, on whatever branch and however far
    // behind they left it. So:
    //
    //   equal + sibling current   -> OK. The published SDL is the API's.
    //   equal + sibling behind    -> the published SDL matches a schema that is ITSELF
    //                                out of date. That is the drift being hunted,
    //                                wearing agreement as a disguise.
    //   differs + sibling current -> DRIFT. Regenerate.
    //   differs + sibling behind  -> unattributable. Regenerating HERE would publish
    //                                an SDL older than the API, which is worse than
    //                                the stale one already committed.
    //
    // Only the first is a pass and only the third is drift; the other two are a third
    // outcome. Nothing is fetched to decide this — reading a remote-tracking ref is
    // reading this box's memory, and the message says so rather than implying it asked
    // the remote.
    if (!at.judgeable) {
      couldNotRun += 1;
      bad(
        `\n[copy] COULD NOT RUN — ${c.repo} is ${at.why}, so the comparison against\n` +
          `  ${c.published} cannot be attributed. The two files ${same ? 'AGREE' : 'DIFFER'},\n` +
          `  and against a ${at.why} checkout that means${
            same
              ? ' the published SDL may be as out of date as the checkout is.'
              : ' either the docs are stale or the checkout is —\n  and regenerating from it would publish an SDL OLDER than the API.'
          }\n` +
          `  Sibling at: ${at.label}\n` +
          `  Put ${c.repo} on the branch this docs tree pairs with, up to date with its\n` +
          `  own origin, and run this again. (Nothing was fetched: that is a cached\n` +
          `  remote-tracking ref.)`,
      );
      continue;
    }

    if (same) {
      say(`[copy] OK  ${c.published} == ${c.repo}/${c.source} (${at.label})`);
      verified.push(`copy:${c.repo}`);
      continue;
    }
    drift += 1;
    bad(
      `\n[copy] DRIFT — ${c.published} is not a copy of ${c.repo}/${c.source} (${at.label}).\n` +
        `  The published SDL is describing a schema the API no longer has, or a schema\n` +
        `  it does not have yet. Regenerate and commit:\n` +
        `      npm run sdl:gen && npm run graphql:gen\n` +
        `  ORDER MATTERS: sdl:gen dies rather than warns on a management root field that\n` +
        `  is gone, so this repo must never be published AHEAD of the API it documents.`,
    );
  }
}

/**
 * What a sibling checkout is sitting at, and whether it is fit to be judged against.
 *
 * `judgeable` is false when the source file is uncommitted, when the checkout is behind
 * its upstream, or when there is no upstream to compare with (a detached pin, which is
 * what CI hands you). Being AHEAD is fine: a docs tree paired with an API branch that
 * has moved on is exactly the state this gate is meant to name.
 */
function describeCheckout(dir, sourceFile) {
  let sha = '';
  try {
    sha = git(['rev-parse', '--short', 'HEAD'], dir).trim();
  } catch {
    return { label: 'not a git checkout', judgeable: false, why: 'not a git checkout' };
  }

  let branch = '';
  try {
    branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], dir).trim();
  } catch {
    /* detached */
  }

  let dirty = false;
  try {
    dirty = git(['status', '--porcelain', '--', sourceFile], dir).trim().length > 0;
  } catch {
    /* ignore */
  }

  let ahead = 0;
  let behind = 0;
  let upstream = '';
  try {
    upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], dir).trim();
    const counts = git(['rev-list', '--left-right', '--count', '@{u}...HEAD'], dir).trim();
    [behind, ahead] = counts.split(/\s+/).map(Number);
  } catch {
    upstream = '';
  }

  const label =
    `${branch && branch !== 'HEAD' ? branch : 'detached'} ${sha}` +
    (upstream ? ` vs ${upstream}: ${behind} behind, ${ahead} ahead` : ' (no upstream)') +
    (dirty ? `, ${sourceFile} UNCOMMITTED` : '');

  if (dirty) return { label, judgeable: false, why: `carrying an uncommitted ${sourceFile}` };
  if (!upstream) return { label, judgeable: false, why: 'detached with no upstream' };
  if (behind > 0) return { label, judgeable: false, why: `${behind} commit(s) behind ${upstream}` };
  return { label, judgeable: true, why: '' };
}

// --- the generators ------------------------------------------------------------------

function runSdlGen(env) {
  execFileSync(process.execPath, [resolve(here, 'generate-sdl.mjs')], {
    cwd: repo,
    stdio: 'pipe',
    env: { ...process.env, ...env },
  });
}

function runGraphqlGen() {
  execFileSync('npm', ['run', '--silent', 'graphql:gen'], {
    cwd: repo,
    stdio: 'pipe',
    env: process.env,
  });
}

// --- self-test: watch it refuse ------------------------------------------------------

/**
 * Two fixtures, and the second is the load-bearing one.
 *
 * 1. The copy hop refuses a published SDL that differs from its source by one byte.
 * 2. sdl:gen's two published outputs really ARE byte copies of their inputs. That is
 *    the assumption --copy-only rests on, and the moment somebody teaches the generator
 *    to filter the game SDL the wrapper's cheap comparison silently starts reporting
 *    drift on every run. This fixture is the sentence that tells them.
 */
function selfTest() {
  let failures = 0;
  const check = (name, ok, detail) => {
    say(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok || !detail ? '' : `\n        ${detail}`}`);
    if (!ok) failures += 1;
  };

  say('[self-test] the copy comparison, and the assumption it rests on');

  // 1. one byte of difference must be found.
  const a = Buffer.from('type Query { a: Int }\n');
  const b = Buffer.from('type Query { a: Int }');
  check('a trailing newline is a difference', !a.equals(b));
  check('identical bytes compare equal', a.equals(Buffer.from(a)));

  // 2. sdl:gen copies rather than transforms.
  //
  // The fixture input is the REAL committed game SDL with one marker line appended,
  // rather than a hand-written toy: a toy has to satisfy the whole management surface
  // (177 allowlisted root fields) or generate-sdl.mjs refuses before reaching the
  // question, and a fixture that has to be maintained alongside an allowlist is a
  // second copy of the allowlist. The marker is what makes "copied" falsifiable — a
  // generator that parsed and re-printed would drop a comment.
  const tmp = mkdtempSync(resolve(tmpdir(), 'sdlgen-'));
  const before = [...COPIES.map((c) => c.published), DERIVED].map((p) => ({
    path: p,
    bytes: existsSync(resolve(repo, p)) ? readFileSync(resolve(repo, p)) : null,
  }));
  try {
    const marker = '\n# check-generated self-test marker\n';
    const gameIn = Buffer.concat([
      readFileSync(resolve(repo, 'static/schema/game-api.graphql')),
      Buffer.from(marker),
    ]);
    const jsIn = Buffer.concat([
      readFileSync(resolve(repo, 'static/schema/crowdyjs.graphql')),
      Buffer.from(marker),
    ]);
    const gamePath = resolve(tmp, 'game.gql');
    const jsPath = resolve(tmp, 'crowdy.gql');
    writeFileSync(gamePath, gameIn);
    writeFileSync(jsPath, jsIn);
    mkdirSync(resolve(repo, 'static/schema'), { recursive: true });

    let generated = true;
    try {
      runSdlGen({ CKS_DOCS_GAME_SCHEMA: gamePath, CKS_DOCS_CROWDYJS_SCHEMA: jsPath });
    } catch (err) {
      generated = false;
      check(
        'sdl:gen runs against the committed SDL as its own input',
        false,
        String(err.stderr ?? err.message)
          .split('\n')
          .slice(0, 3)
          .join(' | '),
      );
    }

    if (generated) {
      const gameOut = readFileSync(resolve(repo, 'static/schema/game-api.graphql'));
      const jsOut = readFileSync(resolve(repo, 'static/schema/crowdyjs.graphql'));
      check(
        'sdl:gen publishes the game SDL byte-for-byte, so --copy-only is equivalent',
        gameOut.equals(gameIn),
        'generate-sdl.mjs now TRANSFORMS the game SDL. The wrapper runs --copy-only, ' +
          'which compares bytes: teach it the transform, or move hop 1 somewhere that ' +
          'can run the real generator.',
      );
      check('sdl:gen publishes the CrowdyJS SDL byte-for-byte', jsOut.equals(jsIn));
      const derived = readFileSync(resolve(repo, DERIVED), 'utf8');
      check(
        'the management SDL is DERIVED, not copied (no marker, and it says so)',
        !derived.includes('self-test marker') && derived.includes('DERIVED FILE'),
      );
    }
  } finally {
    // Put the real published files back whatever happened above.
    for (const { path, bytes } of before) {
      if (bytes) writeFileSync(resolve(repo, path), bytes);
    }
    rmSync(tmp, { recursive: true, force: true });
  }

  const stillClean = dirtyUnder(['static/schema']);
  check(
    'the self-test left the published SDL exactly as it found it',
    stillClean.length === 0,
    stillClean.join(', '),
  );

  return failures;
}

// --- run -----------------------------------------------------------------------------

if (SELF_TEST) {
  const failures = selfTest();
  say('');
  if (failures) {
    bad(`[self-test] ${failures} assertion(s) failed.`);
    process.exit(1);
  }
  say('[self-test] OK');
  process.exit(0);
}

say(`[check-generated] repo ${repo}`);
say(`[check-generated] mode ${COPY_ONLY ? 'copy-only' : `sources=${SOURCES}`}`);

if (SOURCES === 'siblings') {
  checkCopies();
}

if (!COPY_ONLY) {
  // Hop 2. Pointed at the COMMITTED game SDL when there is no sibling, which is what
  // makes this runnable in docs CI: the only file that can change is the derived one.
  const gameSource =
    SOURCES === 'siblings'
      ? resolve(siblingRoot, 'cks-game-api/schema.gql')
      : resolve(repo, 'static/schema/game-api.graphql');
  const jsSource =
    SOURCES === 'siblings'
      ? resolve(siblingRoot, 'CrowdyJS/schema.gql')
      : resolve(repo, 'static/schema/crowdyjs.graphql');

  if (!existsSync(gameSource) || !existsSync(jsSource)) {
    bad(
      `\n[derivation] COULD NOT RUN — a source SDL is missing:\n` +
        `    ${gameSource}\n    ${jsSource}`,
    );
    couldNotRun += 1;
  } else {
    checkGenerator({
      id: 'derivation',
      describe: 'npm run sdl:gen  (management-api.graphql, derived from the game SDL)',
      paths: ['static/schema'],
      run: (env) => runSdlGen(env),
      env: { CKS_DOCS_GAME_SCHEMA: gameSource, CKS_DOCS_CROWDYJS_SCHEMA: jsSource },
    });
  }

  // Hop 3. Needs docusaurus, so it needs node_modules; absent, that is a third outcome.
  if (!existsSync(resolve(repo, 'node_modules/@graphql-markdown/docusaurus'))) {
    bad(
      `\n[reference] COULD NOT RUN — @graphql-markdown/docusaurus is not installed, so ` +
        `the 2361 committed reference pages were not compared. Run \`npm ci\` first.`,
    );
    couldNotRun += 1;
  } else {
    checkGenerator({
      id: 'reference',
      describe: 'npm run graphql:gen  (docs-*/reference/graphql/**)',
      paths: REFERENCE_PATHS,
      run: () => runGraphqlGen(),
    });
  }
}

// WHAT THIS RUN COULD NOT SEE, stated by the run itself rather than left to a reader.
// A green line above means "the hops I attempted match"; without this paragraph a
// committed-sources run reads as "the published SDL is current", which is the one claim
// it cannot make.
say('');
if (SOURCES !== 'siblings') {
  say(
    '[check-generated] NOT CHECKED HERE: hop 1, whether static/schema/{game-api,crowdyjs}.graphql\n' +
      '                 still match the sibling repos they are copied from. That needs a checkout of\n' +
      '                 cks-game-api, which is PRIVATE, from this repo, which is PUBLIC — an access\n' +
      "                 decision rather than an oversight. It runs in the wrapper's Loop A as\n" +
      '                 `check-generated.mjs --copy-only`, and it is the hop that catches a published\n' +
      '                 SDL left behind by an API release. Hops 2 and 3 are self-consistency and\n' +
      '                 stayed green through the drift that motivated this gate.',
  );
} else if (COPY_ONLY) {
  say(
    '[check-generated] NOT CHECKED HERE: hops 2 and 3, the management derivation and the 2361\n' +
      '                 reference pages. Both are in-repo and run in Docs CI on every push.',
  );
}

if (drift) {
  bad(`\n[check-generated] ${drift} generated artefact(s) have DRIFTED from their generator.`);
  process.exit(1);
}
if (couldNotRun) {
  bad(
    `\n[check-generated] COULD NOT RUN (${couldNotRun}). Not a pass: nothing above was ` +
      `established about the artefact(s) named.`,
  );
  process.exit(3);
}
say(`[check-generated] OK — ${verified.length} artefact(s) match their generator: ${verified.join(', ')}`);
