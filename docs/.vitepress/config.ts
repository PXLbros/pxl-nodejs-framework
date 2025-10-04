import { defineConfig } from 'vitepress';
// Dynamically import package.json for version badge / dropdown
import pkg from '../../package.json' with { type: 'json' };

export default defineConfig({
  title: 'PXL Node.js Framework',
  description: 'Opinionated modular TypeScript framework for scalable backends',
  base: '/pxl-nodejs-framework/',
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/getting-started' },
      { text: 'Concepts', link: '/concepts/application' },
      { text: 'Modules', link: '/concepts/webserver' },
      { text: 'Performance', link: '/concepts/performance' },
      { text: 'API (TypeDoc)', link: 'https://pxlbros.github.io/pxl-nodejs-framework/' },
      {
        text: `v${pkg.version}`,
        items: [
          { text: 'Changelog', link: 'https://github.com/PXLbros/pxl-nodejs-framework/blob/main/CHANGELOG.md' },
          { text: 'Source', link: 'https://github.com/PXLbros/pxl-nodejs-framework' },
        ],
      },
    ],
    sidebar: {
      '/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Why PXL', link: '/' },
            { text: 'Getting Started', link: '/getting-started' },
            { text: 'Configuration Overview', link: '/guides/configuration' },
            { text: 'Environment Variables', link: '/guides/env' },
            { text: 'Architecture (Coming Soon)', link: '/architecture' },
          ],
        },
        {
          text: 'Core Concepts',
          collapsed: false,
          items: [
            { text: 'Application', link: '/concepts/application' },
            { text: 'Lifecycle', link: '/concepts/lifecycle' },
            { text: 'Cluster', link: '/concepts/cluster' },
            { text: 'Services', link: '/concepts/services' },
            { text: 'Utilities', link: '/concepts/util' },
            { text: 'Performance', link: '/concepts/performance' },
            { text: 'Logger', link: '/concepts/logger' },
            { text: 'Commands (CLI)', link: '/concepts/command' },
            { text: 'Auth / JWT', link: '/concepts/auth' },
            { text: 'API Requester', link: '/concepts/api-requester' },
          ],
        },
        {
          text: 'Modules',
          collapsed: false,
          items: [
            { text: 'Web Server', link: '/concepts/webserver' },
            { text: 'WebSocket', link: '/concepts/websocket' },
            { text: 'Queue', link: '/concepts/queue' },
            { text: 'Cache / Redis', link: '/concepts/cache' },
            { text: 'Database', link: '/concepts/database' },
            { text: 'Request Context', link: '/concepts/util' },
          ],
        },
        {
          text: 'Guides',
          collapsed: false,
          items: [
            { text: 'Commands & CLI', link: '/guides/commands' },
            { text: 'Typed Routes & Schemas', link: '/guides/typed-routes' },
            { text: 'Testing', link: '/guides/testing' },
            { text: 'Simple Load Test', link: '/guides/simple-load-test' },
            { text: 'Deployment', link: '/guides/deployment' },
            { text: 'Scaling & Clustering', link: '/guides/scaling' },
            { text: 'Performance Monitoring', link: '/guides/performance-monitoring' },
            { text: 'Logging & Observability', link: '/guides/logging' },
            { text: 'Error Handling', link: '/guides/error-handling' },
          ],
        },
        {
          text: 'Reference',
          collapsed: true,
          items: [
            { text: 'API (TypeDoc)', link: 'https://pxlbros.github.io/pxl-nodejs-framework/' },
            { text: 'Changelog', link: 'https://github.com/PXLbros/pxl-nodejs-framework/blob/main/CHANGELOG.md' },
          ],
        },
      ],
    },
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/PXLbros/pxl-nodejs-framework' }],
    footer: {
      message: 'Released under the ISC License.',
      copyright: `Copyright © 2024-${new Date().getFullYear()} PXL`,
    },
    editLink: {
      pattern: 'https://github.com/PXLbros/pxl-nodejs-framework/edit/main/docs/:path',
      text: 'Suggest changes to this page',
    },
  },
});
