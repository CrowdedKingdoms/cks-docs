import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

type Card = {
  title: string;
  description: string;
  to: string;
};

const cards: Card[] = [
  {
    title: 'Management API',
    description:
      'Identity, organizations, RBAC, the apps marketplace, billing, quotas, and the control-plane operator surface.',
    to: '/management-api/intro',
  },
  {
    title: 'Game API',
    description:
      'Runtime / world / replication GraphQL surface: chunks, voxels, actors, avatars, and the UDP proxy over GraphQL subscriptions.',
    to: '/game-api/intro',
  },
  {
    title: 'UDP API',
    description:
      'Buddy wire-protocol reference for clients with native UDP capabilities. Authoring in progress.',
    to: '/udp-api/intro',
  },
  {
    title: 'CrowdyJS SDK',
    description:
      'Browser-first TypeScript SDK that wraps both APIs behind a single typed CrowdyClient with shared auth.',
    to: '/crowdyjs/intro',
  },
  {
    title: 'Unreal SDK',
    description:
      'Native Unreal Engine SDK. Placeholder until the source is vendored into the monorepo.',
    to: '/unreal-sdk/intro',
  },
  {
    title: 'Operators',
    description:
      'Day-to-day runbook for /admin/control-plane/* — change orders, environment manifests, secrets, audit.',
    to: '/operators/intro',
  },
  {
    title: 'Management UI',
    description:
      'React 19 frontend that serves super admins, org members, and end users plus the public marketplace.',
    to: '/management-ui/intro',
  },
  {
    title: 'Releases',
    description:
      'Environment release manifests in releases/*.yaml and the v0.1.x promotion flow.',
    to: '/releases/intro',
  },
];

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link className="button button--secondary button--lg" to="/overview/intro">
            Start with the Overview
          </Link>
        </div>
      </div>
    </header>
  );
}

function ProjectCards() {
  return (
    <section className={styles.cards}>
      <div className="container">
        <div className="row">
          {cards.map((card) => (
            <div key={card.to} className={clsx('col col--4', styles.cardCol)}>
              <Link to={card.to} className={clsx('card', styles.card)}>
                <div className="card__header">
                  <Heading as="h3">{card.title}</Heading>
                </div>
                <div className="card__body">
                  <p>{card.description}</p>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="Docs for the Crowded Kingdom Studios platform: Management API, Game API, UDP API, SDKs, and operator runbooks.">
      <HomepageHeader />
      <main>
        <ProjectCards />
      </main>
    </Layout>
  );
}
