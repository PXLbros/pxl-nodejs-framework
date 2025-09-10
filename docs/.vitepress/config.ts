import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'PXL Node.js Framework',
  description: 'Opinionated application framework for building scalable Node.js services',
  base: '/pxl-nodejs-framework/',
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Concepts', link: '/concepts/application' },
      { text: 'Guides', link: '/guides/configuration' },
      { text: 'API (TypeDoc)', link: 'https://pxlbros.github.io/pxl-nodejs-framework/' },
    ],
    sidebar: {
      '/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Why PXL', link: '/' },
            { text: 'Getting Started', link: '/getting-started' },
          ],
        },
        {
          text: 'Core Concepts',
          collapsed: false,
          items: [
            { text: 'Application', link: '/concepts/application' },
            { text: 'Lifecycle', link: '/concepts/lifecycle' },
            { text: 'Cluster', link: '/concepts/cluster' },
            { text: 'Web Server', link: '/concepts/webserver' },
            { text: 'WebSocket', link: '/concepts/websocket' },
            { text: 'Database', link: '/concepts/database' },
            { text: 'Queue', link: '/concepts/queue' },
            { text: 'Cache / Redis', link: '/concepts/cache' },
            { text: 'Logger', link: '/concepts/logger' },
            { text: 'Services', link: '/concepts/services' },
            { text: 'Utilities', link: '/concepts/util' },
            { text: 'Performance', link: '/concepts/performance' },
            { text: 'Commands (CLI)', link: '/concepts/command' },
            { text: 'API Requester', link: '/concepts/api-requester' },
            { text: 'Auth / JWT', link: '/concepts/auth' },
          ],
        },
        {
          text: 'Guides',
          collapsed: true,
          items: [
            { text: 'Configuration', link: '/guides/configuration' },
            { text: 'Environment Variables', link: '/guides/env' },
            { text: 'Deployment', link: '/guides/deployment' },
            { text: 'Testing', link: '/guides/testing' },
            { text: 'Performance Monitoring', link: '/guides/performance-monitoring' },
            { text: 'Scaling & Clustering', link: '/guides/scaling' },
          ],
        },
        {
          text: 'Reference',
          collapsed: true,
          items: [{ text: 'API (TypeDoc)', link: 'https://pxlbros.github.io/pxl-nodejs-framework/' }],
        },
      ],
    },
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/PXLbros/pxl-nodejs-framework' }],
    footer: {
      message: 'Released under the ISC License.',
      copyright: 'Copyright © 2024-Present PXL',
    },
    editLink: {
      pattern: 'https://github.com/PXLbros/pxl-nodejs-framework/edit/main/docs/:path',
      text: 'Suggest changes to this page',
    },
  },
});
