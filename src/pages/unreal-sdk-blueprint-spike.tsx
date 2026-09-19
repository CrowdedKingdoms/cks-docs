import type {ReactNode} from 'react';
import Layout from '@theme/Layout';
import Blueprint from '@site/src/components/Blueprint';

// Every Blueprint snippet on one page, for the renderer check in scripts/blueprint-component.spec.ts
// and for eyeballing a graph outside a docs page. Keep the list in step with static/bp/unreal-sdk/.
export const SNIPPETS = [
  'qs-login',
  'qs-entity',
  'qs-event',
  'qs-model-read',
  'identity-policies',
  'ch-create',
  'ch-publish',
  'conn-events',
  'despawn',
  'ec-is-owned',
  'ec-on-spawned',
  'host-check-server',
  'host-gate',
  'own-grant',
  'own-request',
  'recipient-each',
  'rpc-mark-event',
  'spawn-entity',
  'state-mark',
  'state-onrep',
  'state-static-dirty',
  'video-receive',
  'gm-repnotify',
  'gm-read',
  'ping-subscribe',
  'fx-apply-node',
  'fx-apply-result',
  'fn-invoke',
  'coll-query',
  'seed-status',
  'kit-combat',
  'kit-leaderboard',
  'sess-create',
  'sess-join',
  'sess-query',
  'sess-leave',
  'auth-login',
  'auth-register',
  'auth-magic',
  'auth-social',
  'auth-events',
  'signin-widget',
  'team-create',
  'team-join',
  'team-query',
  'team-events',
  'avatar-set',
  'avatar-get',
  'avatar-events',
  'voice-toggle',
];

export default function UnrealSdkBlueprintSpike(): ReactNode {
  return (
    <Layout title="Blueprint snippets" noFooter>
      <main className="container margin-vert--lg">
        <h1>Blueprint snippets</h1>
        {SNIPPETS.map((id) => (
          <Blueprint key={id} src={id} title={id} height={420} />
        ))}
        <Blueprint src="does-not-exist" title="Missing file" height={120} />
      </main>
    </Layout>
  );
}
