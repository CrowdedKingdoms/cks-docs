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
const operations = [
  {
    name: 'usersPaginated',
    query:
      'query($l:Int,$o:Int){ usersPaginated(limit:$l,offset:$o){ pageInfo{ totalCount limit offset } } }',
    variables: { l: 1, o: 0 },
  },
];

let failed = 0;
for (const op of operations) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
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
console.log('[test:examples] all example operations passed.');
