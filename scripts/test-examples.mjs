// Optional smoke test that the documented example operations still run against a live
// sandbox. It SKIPS (exit 0) unless SANDBOX_GRAPHQL_URL and SANDBOX_TOKEN are set, so it
// never blocks a build that has no sandbox. When those are set (e.g. a dev-tier endpoint
// + scoped read-only token), it executes a few read operations and fails on GraphQL
// errors — keeping the docs examples honest. Extend `operations` as the seed data grows.
import process from 'node:process';

const url = process.env.SANDBOX_GRAPHQL_URL;
const token = process.env.SANDBOX_TOKEN;

if (!url || !token) {
  console.log(
    '[test:examples] SKIP: set SANDBOX_GRAPHQL_URL and SANDBOX_TOKEN to smoke-test the documented example operations.',
  );
  process.exit(0);
}

// Read-only operations safe to run against a seeded sandbox.
//
// TWO TOKENS, BECAUSE ONE CANNOT WORK, and this is the defect the first real run of this
// script exposed. `usersPaginated` is a MANAGEMENT operation and refuses an app-scoped
// token ("This is an app-scoped gameplay token; it cannot perform management operations");
// `gameModelLint` and `gameModelAppDiagnostics` are APP-scoped and need a token minted for
// the app. So a single `SANDBOX_TOKEN` can satisfy some of this corpus and never all of
// it, and the script reported "all example operations passed" for as long as the corpus
// happened to contain only the one kind.
//
// `SANDBOX_TOKEN` keeps its meaning (the identity session token) so existing callers are
// unaffected. Anything it cannot reach is SKIPPED rather than failed, the same reasoning as
// the whole-script skip above, one level down.
const appToken = process.env.SANDBOX_APP_TOKEN;
const appId = process.env.SANDBOX_APP_ID;

const operations = [
  // `usersPaginated` used to be the only entry here and REQUIRES SUPER ADMIN ("Super admin
  // required", FORBIDDEN), so no sandbox token a normal operator can mint would ever pass
  // it. A gate whose only case cannot succeed is a gate nobody can turn on, which is why
  // it had never been run. These two are the same shape of check against surfaces an
  // ordinary org-admin session actually holds, and they exercise the pagination envelope
  // the docs document.
  {
    name: 'me',
    query: 'query{ me{ userId email } }',
    variables: {},
  },
  {
    name: 'apps',
    query:
      'query($l:Int){ apps(limit:$l){ items{ appId name slug } pageInfo{ totalCount limit offset } } }',
    variables: { l: 1 },
  },
  // The two surfaces the docs tell a developer to run before shipping. Selecting every
  // field the prose names is the point: a renamed or removed field fails here rather than
  // being discovered by a reader copying the example.
  {
    name: 'gameModelLint',
    scope: 'app',
    query:
      'query($a:BigInt!){ gameModelLint(appId:$a){ appId clean errorCount warningCount ' +
      'findings{ code severity subjectKind subject message remedy count } } }',
    variables: { a: appId },
  },
  {
    name: 'gameModelAppDiagnostics',
    scope: 'app',
    query:
      'query($a:BigInt!){ gameModelAppDiagnostics(appId:$a){ containerCount propertyCount ' +
      'automationCount events24h automationEvents24h notificationsEmitted24h ' +
      'notificationsUndeliverable24h topFunctions{ functionName invocations failures } } }',
    variables: { a: appId },
  },
];

let failed = 0;
let skipped = 0;
for (const op of operations) {
  const wantsApp = op.scope === 'app';
  if (wantsApp && (!appToken || !appId)) {
    console.log(
      `[test:examples] SKIP ${op.name}: set SANDBOX_APP_TOKEN and SANDBOX_APP_ID to exercise it.`,
    );
    skipped += 1;
    continue;
  }
  const bearer = wantsApp ? appToken : token;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ query: op.query, variables: op.variables }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.errors) {
      console.error(`[test:examples] FAIL ${op.name}:`, JSON.stringify(json.errors ?? res.status));
      failed += 1;
    } else {
      console.log(`[test:examples] ok ${op.name}`);
    }
  } catch (err) {
    console.error(`[test:examples] ERROR ${op.name}:`, err.message);
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`[test:examples] ${failed} example operation(s) failed.`);
  process.exit(1);
}
// Report the skip count rather than swallowing it: "all passed" over a corpus of zero is
// the failure mode this whole script is prone to, so say how much was actually exercised.
console.log(
  `[test:examples] ${operations.length - skipped}/${operations.length} example operation(s) passed` +
    (skipped > 0 ? `, ${skipped} skipped for want of SANDBOX_APP_ID.` : '.'),
);
