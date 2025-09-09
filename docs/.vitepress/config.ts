import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'PXL Node.js Framework',
  description: 'Opinionated application framework for building scalable Node.js services',
  base: '/pxl-nodejs-framework/',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Concepts', link: '/concepts/application' },
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
            { text: 'Web Server', link: '/concepts/webserver' },
            { text: 'WebSocket', link: '/concepts/websocket' },
            { text: 'Database', link: '/concepts/database' },
            { text: 'Queue', link: '/concepts/queue' },
            { text: 'Cache / Redis', link: '/concepts/cache' },
            { text: 'Logger', link: '/concepts/logger' },
            { text: 'Services', link: '/concepts/services' },
            { text: 'Utilities', link: '/concepts/util' },
          ],
        },
        {
          text: 'Guides',
          collapsed: true,
          items: [
            { text: 'Configuration', link: '/guides/configuration' },
            { text: 'Environment Variables', link: '/guides/env' },
            { text: 'Deployment', link: '/guides/deployment' },
          ],
        },
      ],
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/PXLbros/pxl-nodejs-framework' }],
    footer: {
      message: 'Released under the ISC License.',
      copyright: 'Copyright © 2024-Present PXL',
    },
  },
});
