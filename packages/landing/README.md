# @adi-simple/landing

Next.js-based landing page for ADI Simple.

## Development

Run the development server:

```bash
bun run dev
```

The landing page will be available at http://localhost:3000

## Build

Build for production:

```bash
bun run build
```

## Start Production Server

After building, start the production server:

```bash
bun run start
```

## Tech Stack

- Next.js 15
- React 19
- Tailwind CSS 4
- TypeScript
- Shared UI components from `@adi-simple/ui`

## Structure

```
src/
├── app/
│   ├── layout.tsx      # Root layout
│   ├── page.tsx        # Home page
│   └── globals.css     # Global styles
└── global.d.ts         # Type declarations
```
