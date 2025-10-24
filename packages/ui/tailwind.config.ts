import type { Config } from 'tailwindcss'

export default {
  content: [
    './demo.tsx',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      borderRadius: {
        none: '0',
        DEFAULT: '0',
      },
    },
  },
} satisfies Config
