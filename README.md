# Bun Isolated Installs - @types Resolution Bug

## Description

When using `linker = "isolated"` in a monorepo with mixed React versions, **`@types/react` is hoisted incorrectly**, causing TypeScript type mismatches even though the runtime `react` package resolves correctly.

A workspace that explicitly depends on `@types/react@18` will have its transitive dependencies (like `@ariakit/react`) resolve their `react` type imports to `@types/react@19` via a hoisted symlink at `.bun/node_modules/@types/react`.

## The Problem

In `packages/lib-react18/src/index.tsx`:

```tsx
import { Popover, PopoverHeading } from "@ariakit/react";
import React from "react";

export function MyPopover({ children }: { children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverHeading>Title</PopoverHeading>
      {children}
    </Popover>
  );
}
```

This component lives in `lib-react18` which explicitly depends on:
- `react@^18.3.1`
- `@types/react@^18.3.27`

**Runtime resolution is correct:**
```bash
ls -la node_modules/.bun/@ariakit+react*/node_modules/react
# react -> ../../react@18.3.1/node_modules/react ✓
```

**But TypeScript type resolution is wrong:**
```
# From tsc --traceResolution:

# lib-react18/src/index.tsx importing 'react':
Module 'react' resolved to '@types/react@18.3.27' ✓

# @ariakit/react's .d.ts files importing 'react':
Resolving real path for '.../node_modules/.bun/node_modules/@types/react'
  → result '.../@types+react@19.2.7/node_modules/@types/react' ✗
```

**Type Resolution Chain:**
1. `lib-react18` imports `@ariakit/react`
2. `@ariakit/react`'s `.d.ts` files have `import { ReactNode } from 'react'`
3. TypeScript resolves this through `.bun/node_modules/@types/react` (hoisted)
4. The hoisted `@types/react` symlink points to `@types/react@19.2.7`
5. TypeScript sees a mismatch: `lib-react18` uses React 18 types, but `@ariakit/react` uses React 19 types

## Expected Behavior

- `packages/lib-react18` depends on `@types/react@^18.3.27`
- `@ariakit/react`'s type imports should resolve to `@types/react@18` (consistent with consuming workspace)
- TypeScript should see consistent React 18 types across all imports

## Actual Behavior

- Runtime `react` resolves correctly to `react@18.3.1` ✓
- But `@types/react` is hoisted at `.bun/node_modules/@types/react` → `@types/react@19.2.7` ✗
- TypeScript fails with type mismatch errors:

```
error TS2786: 'PopoverHeading' cannot be used as a JSX component.
  Its type '...' is not a valid JSX element type.
    Type 'ReactElement<any, string | JSXElementConstructor<any>>' is not assignable to type 'ReactNode'.
      Property 'children' is missing in type 'ReactElement<...>' but required in type 'ReactPortal'.
```

## Reproduction Steps

```bash
# Install dependencies
bun install

# Verify runtime react resolves correctly (it does!)
ls -la node_modules/.bun/@ariakit+react*/node_modules/react
# Shows: react -> ../../react@18.3.1/node_modules/react

# Check the hoisted @types/react (this is the bug)
ls -la node_modules/.bun/node_modules/@types/react
# Shows: @types/react -> ../../@types+react@19.2.7/node_modules/@types/react

# Run typecheck - will fail
cd packages/lib-react18
bunx tsc --noEmit

# See the type resolution issue
bunx tsc --traceResolution 2>&1 | grep "@types+react@19"
```

## Monorepo Structure

```
├── bunfig.toml              # linker = "isolated"
├── package.json             # workspaces: packages/*, apps/*
├── node_modules/.bun/
│   ├── node_modules/
│   │   └── @types/react     # ❌ Hoisted symlink → @types/react@19.2.7
│   ├── @types+react@18.3.27/
│   └── @types+react@19.2.7/
├── apps/
│   └── app-react19/         # React 19 app (expo/react-native)
│       └── package.json     # react@19.1.0, @types/react@^19.1.0
└── packages/
    └── lib-react18/         # React 18 library
        ├── package.json     # react@^18.3.1, @types/react@^18.3.27
        └── src/
            └── index.tsx    # ❌ @ariakit types resolve to React 19
```

## Environment

- Bun version: 1.3.3
- OS: macOS

## Workaround

Exclude the React 19 workspace from the monorepo:

```json
{
  "workspaces": ["packages/*", "apps/*", "!apps/app-react19"]
}
```

## Root Cause

With isolated installs, `@types/*` packages are hoisted to `.bun/node_modules/@types/`. When multiple versions of `@types/react` exist in the monorepo, the hoisted symlink points to one version (appears to be the highest), and transitive dependencies' type imports resolve through this hoisted path rather than respecting the consuming workspace's version constraints.

The runtime `react` package resolves correctly per-workspace, but `@types/react` does not.
