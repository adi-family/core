# @adi-simple/ui

Reusable UI components library for the ADI Simple monorepo.

## Components

This package provides a collection of UI components styled with Tailwind CSS:

- **Badge** - Status and category indicators with variants
- **Button** - Interactive buttons with multiple variants and sizes
- **Card** - Container components with header, content, and footer sections
- **Combobox** - Searchable select dropdown
- **EmptyState** - Placeholder for empty data states
- **Input** - Text input fields
- **Label** - Form labels
- **LoadingState** - Loading indicators
- **Select** - Dropdown select component
- **Table** - Data table with header, body, and footer

## Viewing Components

### Option 1: Storybook (Recommended)

View all components interactively with Storybook:

```bash
# From project root
bun run storybook
```

Then open http://localhost:6006 in your browser.

### Option 2: Demo Page

A standalone demo page is available at `packages/ui/demo.tsx`. To run it:

```bash
# From packages/ui directory
npx vite --port 3001
```

Then open http://localhost:3001 in your browser.

## Usage

### Installation

This package is part of the workspace and can be added to any package:

```json
{
  "dependencies": {
    "@adi-simple/ui": "workspace:*"
  }
}
```

### Importing Components

```tsx
import { Button, Card, Badge } from "@adi-simple/ui"

function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <h2>Title</h2>
        <Badge variant="success">Active</Badge>
      </CardHeader>
      <CardContent>
        <p>Content goes here</p>
      </CardContent>
      <CardFooter>
        <Button variant="default">Action</Button>
      </CardFooter>
    </Card>
  )
}
```

## Component Examples

### Button

```tsx
import { Button } from "@adi-simple/ui"

// Variants
<Button variant="default">Default</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Outline</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
```

### Badge

```tsx
import { Badge } from "@adi-simple/ui"
import { Circle } from "lucide-react"

// Variants
<Badge variant="success">Success</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="danger">Error</Badge>
<Badge variant="info">Info</Badge>

// With icon
<Badge variant="success" icon={Circle}>Active</Badge>
```

### Card

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@adi-simple/ui"

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Optional description</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Your content here</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### Input & Label

```tsx
import { Input, Label } from "@adi-simple/ui"

<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    type="email"
    placeholder="you@example.com"
  />
</div>
```

### Combobox (Searchable Select)

```tsx
import { Combobox } from "@adi-simple/ui"
import { useState } from "react"

const options = [
  { value: "react", label: "React" },
  { value: "vue", label: "Vue" },
  { value: "angular", label: "Angular" },
]

function MyComponent() {
  const [value, setValue] = useState("")

  return (
    <Combobox
      options={options}
      value={value}
      onChange={setValue}
      placeholder="Select framework..."
    />
  )
}
```

### Table

```tsx
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableCaption } from "@adi-simple/ui"

<Table>
  <TableCaption>User list</TableCaption>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Email</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>John Doe</TableCell>
      <TableCell>john@example.com</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

### Utilities

The package also exports utility functions:

```tsx
import { cn } from "@adi-simple/ui/lib/utils"

// Merge Tailwind classes without conflicts
const className = cn(
  "base-class",
  condition && "conditional-class",
  "text-gray-900"
)
```

## Development

### Type Checking

```bash
bun run typecheck
```

### Linting

```bash
bun run lint
```

### Running Demo

```bash
# Option 1: Using npm/npx (recommended for Vite)
cd packages/ui
npx vite --port 3001

# Option 2: Using Storybook (from root)
bun run storybook
```

## Dependencies

- **React 19** - UI library
- **Tailwind CSS** - Styling
- **class-variance-authority** - Variant-based component styling
- **clsx** - Conditional classNames
- **tailwind-merge** - Merge Tailwind classes without conflicts
- **lucide-react** - Icon library

## Component Files

All components are located in `packages/ui/src/`:
- `badge.tsx` - Badge component
- `button.tsx` - Button component
- `card.tsx` - Card component with subcomponents
- `combobox.tsx` - Searchable select component
- `empty-state.tsx` - Empty state placeholder
- `input.tsx` - Input component
- `label.tsx` - Label component
- `loading-state.tsx` - Loading state placeholder
- `select.tsx` - Select dropdown
- `table.tsx` - Table component with subcomponents
- `index.ts` - Barrel export file

## Storybook Stories

Each component has a corresponding `.stories.tsx` file for Storybook documentation and testing.
