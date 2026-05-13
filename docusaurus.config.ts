import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Crowded Kingdom Studios Docs',
  tagline: 'APIs, SDKs, and operator runbooks for CKS',
  favicon: 'img/favicon.ico',

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
        id: 'udp-api',
        path: 'docs-udp-api',
        routeBasePath: '/udp-api',
        sidebarPath: './sidebars/udpApi.ts',
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
        id: 'unreal-sdk',
        path: 'docs-unreal-sdk',
        routeBasePath: '/unreal-sdk',
        sidebarPath: './sidebars/unrealSdk.ts',
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
        id: 'mgmt-ui',
        path: 'docs-management-ui',
        routeBasePath: '/management-ui',
        sidebarPath: './sidebars/mgmtUi.ts',
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
        schema: '../cks-graphql-api/schema.gql',
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
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'CKS Docs',
      logo: {
        alt: 'Crowded Kingdom Studios',
        src: 'img/logo.svg',
      },
      items: [
        {to: '/overview/intro', label: 'Overview', position: 'left'},
        {
          type: 'docSidebar',
          docsPluginId: 'mgmt-api',
          sidebarId: 'sidebar',
          position: 'left',
          label: 'Management API',
        },
        {
          type: 'docSidebar',
          docsPluginId: 'game-api',
          sidebarId: 'sidebar',
          position: 'left',
          label: 'Game API',
        },
        {
          type: 'docSidebar',
          docsPluginId: 'udp-api',
          sidebarId: 'sidebar',
          position: 'left',
          label: 'UDP API',
        },
        {
          type: 'docSidebar',
          docsPluginId: 'crowdyjs',
          sidebarId: 'sidebar',
          position: 'left',
          label: 'CrowdyJS',
        },
        {
          type: 'docSidebar',
          docsPluginId: 'unreal-sdk',
          sidebarId: 'sidebar',
          position: 'left',
          label: 'Unreal SDK',
        },
        {
          type: 'docSidebar',
          docsPluginId: 'operators',
          sidebarId: 'sidebar',
          position: 'left',
          label: 'Operators',
        },
        {
          type: 'docSidebar',
          docsPluginId: 'mgmt-ui',
          sidebarId: 'sidebar',
          position: 'left',
          label: 'Management UI',
        },
        {
          type: 'docSidebar',
          docsPluginId: 'releases',
          sidebarId: 'sidebar',
          position: 'left',
          label: 'Releases',
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
            {label: 'UDP API', to: '/udp-api/intro'},
          ],
        },
        {
          title: 'SDKs',
          items: [
            {label: 'CrowdyJS', to: '/crowdyjs/intro'},
            {label: 'Unreal SDK', to: '/unreal-sdk/intro'},
          ],
        },
        {
          title: 'Ops',
          items: [
            {label: 'Operators', to: '/operators/intro'},
            {label: 'Releases', to: '/releases/intro'},
            {label: 'Management UI', to: '/management-ui/intro'},
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
