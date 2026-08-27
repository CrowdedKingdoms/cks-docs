import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// The reference generators read the PUBLISHED SDL under static/schema/, not the sibling
// API checkouts, so the reference and the schema the site serves are generated from the
// same bytes and cannot drift apart. `npm run sdl:gen` refreshes those files from the
// sibling repos and runs first in `prebuild`.
//
// There is no management schema source: cks-management-api was retired 2026-08-06 and
// its SDL is now derived from the unified cks-game-api schema by sdl:gen, filtered to
// scripts/management-surface.json.
const managementSchema = './static/schema/management-api.graphql';
const gameSchema = './static/schema/game-api.graphql';
const crowdyJsSchema = './static/schema/crowdyjs.graphql';

// ---------------------------------------------------------------------------------------
// WHICH SITE THIS BUILD IS.
//
// There are three documentation sites, one per branch -- dev, test and prod -- each simply
// "current" for its branch. There is no Docusaurus versioning: the promotion process is
// what absorbs churn, so the public prod site never sees it.
//
// THERE IS NO DEFAULT, and that is the point rather than an omission. A default of `prod`
// would produce a dev build wearing prod's clothes: prod's canonical URL in every
// `<link rel="canonical">`, prod's sitemap, and none of the tier marking -- with nothing
// failing anywhere. The marking on dev and test is only trustworthy if its ABSENCE means
// production, so an unset or unrecognised CKS_DOCS_TIER fails the build.
//
// A default of `dev` would be worse in the other direction, and it is a trap this project
// has already paid for: `afterburn` derived a browser-storage namespace from a regex that
// had stopped matching, so every tier computed the same fallback and three tiers silently
// shared one namespace. A fallback makes a missing prerequisite indistinguishable from a
// satisfied one.
//
// WHY THE ENVIRONMENT AND NOT THE BRANCH NAME. This file is promoted dev -> test -> prod,
// so anything branch-specific written into it is resolved by git on every promotion --
// silently, taking whichever side changed more recently, and just as quiet when it is
// wrong. Reading the tier from the environment keeps all three branches byte-identical
// here and puts the decision in the thing that starts the build.
//
// The table below is A TABLE AND NOT A RULE, for the same reason the hostnames it mirrors
// are one in infra-control-plane's `cp-lib/dns-tier.ts`: prod is UNLABELLED where the
// other two carry `.<tier>`. It is served at `docs.crowdedkingdoms.com`, and
// `docs.prod.crowdedkingdoms.com` does not resolve -- checked against DNS on 2026-08-27,
// after this file had been carrying the labelled form and pointing every canonical URL,
// sitemap entry and cross-tier banner link at a host that does not exist. A derivation
// would have produced exactly that string, which is the argument for the table.
// ---------------------------------------------------------------------------------------
const DOCS_TIERS = {
  dev: {
    url: 'https://docs.dev.crowdedkingdoms.com',
    label: 'dev',
    banner:
      'You are reading the <strong>dev</strong> documentation site. It tracks the <code>dev</code> branch and describes software that is not released. The public site is <a href="https://docs.crowdedkingdoms.com">docs.crowdedkingdoms.com</a>.',
    bannerBackground: '#7f1d1d',
    noindex: true,
  },
  test: {
    url: 'https://docs.test.crowdedkingdoms.com',
    label: 'test',
    banner:
      'You are reading the <strong>test</strong> documentation site. It tracks the <code>test</code> branch and describes a release candidate. The public site is <a href="https://docs.crowdedkingdoms.com">docs.crowdedkingdoms.com</a>.',
    bannerBackground: '#78350f',
    noindex: true,
  },
  prod: {
    url: 'https://docs.crowdedkingdoms.com',
    label: null,
    banner: null,
    bannerBackground: null,
    noindex: false,
  },
} as const;

type DocsTier = keyof typeof DOCS_TIERS;

function resolveDocsTier(): DocsTier {
  const raw = process.env.CKS_DOCS_TIER;
  const names = Object.keys(DOCS_TIERS).join('|');
  if (!raw) {
    throw new Error(
      [
        'CKS_DOCS_TIER is not set, and this build has no default tier.',
        '',
        'There are three documentation sites, one per branch, and which one is being built',
        'decides the canonical URL, the sitemap, whether every page carries a non-production',
        'banner, and whether search engines are asked not to index it. Guessing any of those',
        'produces a site that looks right and is wrong, so the build refuses instead.',
        '',
        `  CKS_DOCS_TIER=<${names}> npm run build`,
        '',
        'Use the tier matching the branch you are on; for a local preview of the site as',
        'readers see it, use prod.',
      ].join('\n'),
    );
  }
  if (!(raw in DOCS_TIERS)) {
    throw new Error(`CKS_DOCS_TIER='${raw}' is not one of ${names}.`);
  }
  return raw as DocsTier;
}

const docsTier = resolveDocsTier();
const site = DOCS_TIERS[docsTier];

const config: Config = {
  title: 'Crowded Kingdoms Docs',
  tagline: 'Massive worlds. No shards. No ceilings.',
  favicon: 'img/favicon.svg',

  future: {
    v4: true,
  },

  url: site.url,
  baseUrl: '/',

  // ONE HEADER PER PAGE, and it does not replace the `X-Robots-Tag` the CloudFront
  // response headers policy sets on the dev and test distributions -- the two cover
  // different files. A meta tag can only appear in HTML, so `/schema/game-api.graphql`
  // (the artifact both SDKs sync from, and the one an integrator is most likely to find
  // through a search engine) can be excluded only by the header. The header can only be
  // set by the distribution, so it is absent from a local `npm run serve`, which is why
  // both exist.
  //
  // NEITHER IS `robots.txt`, deliberately. `Disallow: /` blocks CRAWLING, not INDEXING: a
  // URL a search engine learns from any link can still be indexed with no snippet, and
  // because the crawler is then forbidden from fetching the page it can never see the
  // `noindex` that would have removed it. Disallowing is strictly worse than allowing here.
  ...(site.noindex
    ? {
        headTags: [
          {
            tagName: 'meta',
            attributes: {name: 'robots', content: 'noindex, nofollow'},
          },
        ],
      }
    : {}),

  organizationName: 'crowdedkingdomstudios',
  projectName: 'cks-docs',

  onBrokenLinks: 'throw',

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        // The "default" docs instance is repurposed as the Overview tab.
        docs: {
          id: 'default',
          path: 'docs',
          routeBasePath: '/overview',
          sidebarPath: './sidebars/overview.ts',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: [
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        hashed: true,
        indexBlog: false,
        docsRouteBasePath: [
          '/overview',
          '/management-api',
          '/game-api',
          '/replication-api',
          '/crowdyjs',
          '/crowdycpp',
          '/unreal-sdk',
          '/management-ui',
          '/operators',
          '/build-a-game',
          '/releases',
        ],
        docsDir: [
          'docs',
          'docs-management-api',
          'docs-game-api',
          'docs-udp-api',
          'docs-crowdyjs',
          'docs-crowdycpp',
          'docs-unreal-sdk',
          'docs-management-ui',
          'docs-operators',
          'docs-build-a-game',
          'docs-releases',
        ],
      },
    ],
  ],

  plugins: [
    // -------- Per-project docs instances (multi-instance plugin-content-docs) --------
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'mgmt-api',
        path: 'docs-management-api',
        routeBasePath: '/management-api',
        sidebarPath: './sidebars/mgmtApi.ts',
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'game-api',
        path: 'docs-game-api',
        routeBasePath: '/game-api',
        sidebarPath: './sidebars/gameApi.ts',
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'replication-api',
        path: 'docs-udp-api',
        routeBasePath: '/replication-api',
        sidebarPath: './sidebars/udpApi.ts',
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'operators',
        path: 'docs-operators',
        routeBasePath: '/operators',
        sidebarPath: './sidebars/operators.ts',
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'crowdyjs',
        path: 'docs-crowdyjs',
        routeBasePath: '/crowdyjs',
        sidebarPath: './sidebars/crowdyjs.ts',
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'crowdycpp',
        path: 'docs-crowdycpp',
        routeBasePath: '/crowdycpp',
        sidebarPath: './sidebars/crowdycpp.ts',
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'unreal-sdk',
        path: 'docs-unreal-sdk',
        routeBasePath: '/unreal-sdk',
        sidebarPath: './sidebars/unrealSdk.ts',
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'mgmt-ui',
        path: 'docs-management-ui',
        routeBasePath: '/management-ui',
        sidebarPath: './sidebars/mgmtUi.ts',
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'build-a-game',
        path: 'docs-build-a-game',
        routeBasePath: '/build-a-game',
        sidebarPath: './sidebars/buildAGame.ts',
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'releases',
        path: 'docs-releases',
        routeBasePath: '/releases',
        sidebarPath: './sidebars/releases.ts',
      },
    ],

    // -------- GraphQL schema reference generators (nested into host instance) --------
    // Each call generates Markdown into the host docs instance's `reference/graphql/` folder
    // at build time. We commit the generated output, so it shows up in `git status` after
    // a build; that is intentional and matches the @graphql-markdown/docusaurus default.
    [
      '@graphql-markdown/docusaurus',
      {
        id: 'gql-mgmt',
        schema: managementSchema,
        rootPath: './docs-management-api',
        baseURL: 'reference/graphql',
        homepage: './docs-management-api/reference/graphql-overview.md',
        loaders: {
          GraphQLFileLoader: '@graphql-tools/graphql-file-loader',
        },
      },
    ],
    [
      '@graphql-markdown/docusaurus',
      {
        id: 'gql-game',
        schema: gameSchema,
        rootPath: './docs-game-api',
        baseURL: 'reference/graphql',
        homepage: './docs-game-api/reference/graphql-overview.md',
        loaders: {
          GraphQLFileLoader: '@graphql-tools/graphql-file-loader',
        },
      },
    ],
    [
      '@graphql-markdown/docusaurus',
      {
        id: 'gql-crowdyjs',
        schema: crowdyJsSchema,
        rootPath: './docs-crowdyjs',
        baseURL: 'reference/graphql',
        homepage: './docs-crowdyjs/reference/graphql-overview.md',
        loaders: {
          GraphQLFileLoader: '@graphql-tools/graphql-file-loader',
        },
      },
    ],
  ],

  themeConfig: {
    image: 'img/favicon.svg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    // THE TIER HAS TO BE VISIBLE, because a dev docs site that looks identical to prod is
    // a support incident waiting to happen: somebody reads a page describing unreleased
    // behaviour, believes it, and files a bug against production. Two markings, chosen so
    // that neither one alone has to carry it.
    //
    // The bar is `isCloseable: false` -- a banner a reader dismisses once and never sees
    // again is a banner that is absent for every page after the first, which is the same
    // failure as not having one. The navbar title carries the tier too, because that is
    // what stays on screen after the bar scrolls away and what appears in a screenshot
    // pasted into a bug report.
    //
    // Prod gets NEITHER, and that absence is load-bearing: it is what makes the marking on
    // the other two mean something. See the tier table at the top of this file.
    ...(site.banner
      ? {
          announcementBar: {
            id: `cks-docs-tier-${docsTier}`,
            content: site.banner,
            backgroundColor: site.bannerBackground!,
            textColor: '#ffffff',
            isCloseable: false,
          },
        }
      : {}),
    navbar: {
      title: site.label ? `Docs · ${site.label}` : 'Docs',
      logo: {
        alt: 'Crowded Kingdoms',
        src: 'img/wordmark.svg',
        srcDark: 'img/wordmark-dark.svg',
        height: 32,
      },
      items: [
        {to: '/overview/intro', label: 'Overview', position: 'left'},
        {
          type: 'dropdown',
          label: 'APIs',
          position: 'left',
          items: [
            {
              type: 'docSidebar',
              docsPluginId: 'mgmt-api',
              sidebarId: 'sidebar',
              label: 'Management API',
            },
            {
              type: 'docSidebar',
              docsPluginId: 'game-api',
              sidebarId: 'sidebar',
              label: 'Game API',
            },
            {
              type: 'docSidebar',
              docsPluginId: 'replication-api',
              sidebarId: 'sidebar',
              label: 'Replication API',
            },
          ],
        },
        {
          type: 'docSidebar',
          docsPluginId: 'mgmt-ui',
          sidebarId: 'sidebar',
          position: 'left',
          label: 'Portal',
        },
        {
          type: 'docSidebar',
          docsPluginId: 'operators',
          sidebarId: 'sidebar',
          position: 'left',
          label: 'Operators',
        },
        {
          type: 'dropdown',
          label: 'SDKs',
          position: 'left',
          items: [
            {
              type: 'docSidebar',
              docsPluginId: 'crowdyjs',
              sidebarId: 'sidebar',
              label: 'CrowdyJS',
            },
            {
              type: 'docSidebar',
              docsPluginId: 'crowdycpp',
              sidebarId: 'sidebar',
              label: 'CrowdyCPP',
            },
            {
              type: 'docSidebar',
              docsPluginId: 'unreal-sdk',
              sidebarId: 'sidebar',
              label: 'Unreal SDK',
            },
            {
              type: 'docSidebar',
              docsPluginId: 'build-a-game',
              sidebarId: 'sidebar',
              label: 'Build a game',
            },
          ],
        },
        {to: '/releases/intro', label: 'Changelog', position: 'right'},
        {
          href: 'https://discord.gg/x7tMKGwHf',
          label: 'Discord',
          position: 'right',
        },
        {
          type: 'docsVersionDropdown',
          docsPluginId: 'default',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'APIs',
          items: [
            {label: 'Management API', to: '/management-api/intro'},
            {label: 'Game API', to: '/game-api/intro'},
            {label: 'Replication API', to: '/replication-api/intro'},
          ],
        },
        {
          title: 'SDKs',
          items: [
            {label: 'CrowdyJS', to: '/crowdyjs/intro'},
            {label: 'CrowdyCPP', to: '/crowdycpp/intro'},
            {label: 'Build a game', to: '/build-a-game/intro'},
            {label: 'Unreal SDK', to: '/unreal-sdk/intro'},
          ],
        },
        {
          title: 'Portal',
          items: [
            {label: 'Management UI', to: '/management-ui/intro'},
            {label: 'Dev tier', to: '/management-ui/dev-tier'},
            {label: 'Create your first app', to: '/management-ui/create-your-first-app'},
            {label: 'Shared platform apps', to: '/management-ui/environments'},
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Discord',
              href: 'https://discord.gg/x7tMKGwHf',
            },
            {
              label: 'Portal app',
              href: 'https://app.crowdedkingdoms.com',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Crowded Kingdom Studios, Inc.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'graphql', 'yaml', 'typescript', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
