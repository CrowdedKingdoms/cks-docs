import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Crowded Kingdoms Docs',
  tagline: 'Massive worlds. No shards. No ceilings.',
  favicon: 'img/favicon.svg',

  future: {
    v4: true,
  },

  url: 'https://docs.crowdedkingdoms.com',
  baseUrl: '/',

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
        schema: '../cks-management-api/schema.gql',
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
        schema: '../cks-game-api/schema.gql',
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
        schema: '../CrowdyJS/schema.gql',
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
    navbar: {
      title: 'Docs',
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
