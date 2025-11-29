import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'ADI Simple',
  description: 'Task automation and worker orchestration platform',
  base: '/core/',

  themeConfig: {
    socialLinks: [
      { icon: 'github', link: 'https://github.com/adi-family/core' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present ADI Family'
    }
  }
})
