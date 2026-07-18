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
  external?: boolean;
};

type CardSection = {
  id: string;
  title: string;
  cards: Card[];
};

const sections: CardSection[] = [
  {
    id: 'start-here',
    title: 'Start Here',
    cards: [
      {
        title: 'Platform Overview',
        description:
          'How the Management, Game, and Replication APIs fit together.',
        to: '/overview/intro',
      },
      {
        title: 'Quickstart',
        description:
          'Build a collaborative multiplayer canvas step by step.',
        to: '/build-a-game/intro',
      },
      {
        title: 'Authentication',
        description:
          'Passwordless sign-in, session tokens, and app-scoped access.',
        to: '/management-api/authentication',
      },
    ],
  },
  {
    id: 'build',
    title: 'Build',
    cards: [
      {
        title: 'Game API',
        description:
          'Create and manage worlds, actors, avatars, chunks, and real-time state.',
        to: '/game-api/intro',
      },
      {
        title: 'CrowdyJS SDK',
        description:
          'A typed TypeScript SDK for building browser-based Crowded Kingdoms experiences.',
        to: '/crowdyjs/intro',
      },
      {
        title: 'Unreal SDK',
        description:
          'Native Unreal Engine integration for Management, Game, and Replication APIs.',
        to: '/unreal-sdk/intro',
      },
      {
        title: 'Replication API',
        description:
          'Connect native clients directly to Crowded Kingdoms replication infrastructure.',
        to: '/replication-api/intro',
      },
    ],
  },
  {
    id: 'operate',
    title: 'Operate',
    cards: [
      {
        title: 'Management API',
        description:
          'Manage organizations, applications, access, billing, and dedicated environments.',
        to: '/management-api/intro',
      },
      {
        title: 'Management Portal',
        description:
          'Web portal for org dashboards, apps, billing, and environments.',
        to: '/management-ui/intro',
      },
      {
        title: 'Billing and Environments',
        description:
          'Shared platform billing, usage limits, and environment models.',
        to: '/management-api/shared-environment',
      },
    ],
  },
];

const resources: Card[] = [
  {
    title: 'Changelog',
    description: 'Notable API and SDK changes, newest first.',
    to: '/releases/intro',
  },
  {
    title: 'Discord',
    description: 'Community support, questions, and product updates.',
    to: 'https://discord.gg/x7tMKGwHf',
    external: true,
  },
];

function HomepageHeader() {
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <p className={styles.heroBadge}>Beta</p>
        <Heading as="h1" className={styles.heroTitle}>
          Build on Crowded Kingdoms
        </Heading>
        <p className={styles.heroSubtitle}>
          APIs and SDKs for massive real-time worlds, shared state, and spatial
          replication.
        </p>
        <div className={styles.buttons}>
          <Link
            className={clsx('button button--lg', styles.heroCtaPrimary)}
            to="/build-a-game/intro">
            Start Building
          </Link>
          <Link
            className={clsx('button button--lg', styles.heroCta)}
            to="/overview/intro">
            Read the Overview
          </Link>
          <Link
            className={clsx('button button--lg', styles.heroCta)}
            href="https://app.crowdedkingdoms.com">
            Get API Access
          </Link>
        </div>
      </div>
    </header>
  );
}

function DocCard({card}: {card: Card}) {
  const className = clsx('card', styles.card);
  const body = (
    <>
      <div className="card__header">
        <Heading as="h3" className={styles.cardTitle}>
          {card.title}
        </Heading>
      </div>
      <div className="card__body">
        <p className={styles.cardDescription}>{card.description}</p>
      </div>
    </>
  );

  if (card.external) {
    return (
      <a
        href={card.to}
        className={className}
        target="_blank"
        rel="noopener noreferrer">
        {body}
      </a>
    );
  }

  return (
    <Link to={card.to} className={className}>
      {body}
    </Link>
  );
}

function CardGrid({cards}: {cards: Card[]}) {
  return (
    <div className="row">
      {cards.map((card) => (
        <div key={card.to} className={clsx('col col--4', styles.cardCol)}>
          <DocCard card={card} />
        </div>
      ))}
    </div>
  );
}

function ProjectSections() {
  return (
    <div className={styles.sections}>
      {sections.map((section) => (
        <section
          key={section.id}
          id={section.id}
          className={styles.section}
          aria-labelledby={`${section.id}-heading`}>
          <div className="container">
            <Heading
              as="h2"
              id={`${section.id}-heading`}
              className={styles.sectionTitle}>
              {section.title}
            </Heading>
            <CardGrid cards={section.cards} />
          </div>
        </section>
      ))}
      <section
        id="resources"
        className={styles.section}
        aria-labelledby="resources-heading">
        <div className="container">
          <Heading as="h2" id="resources-heading" className={styles.sectionTitle}>
            Changelog and Support
          </Heading>
          <CardGrid cards={resources} />
        </div>
      </section>
    </div>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="APIs and SDKs for massive real-time worlds, shared state, and spatial replication. Start building on Crowded Kingdoms.">
      <HomepageHeader />
      <main>
        <ProjectSections />
      </main>
    </Layout>
  );
}
