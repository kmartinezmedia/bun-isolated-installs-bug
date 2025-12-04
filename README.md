# Bun Isolated Installs - Peer Dependency Resolution Bug

## Description

When using `linker = "isolated"` in a monorepo with mixed React versions, **transitive dependencies resolve peer dependencies to the wrong version**.

A package that explicitly depends on React 18 and has `@types/react@18` in devDependencies will have its transitive dependencies (like `@ariakit/react`) resolve their `react` peer dependency to React 19 if another workspace package depends on React 19—ignoring the consuming package's version constraints.

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

However, the `@ariakit/react` import resolves its `react` peer dependency to React 19 (from `apps/app-react19`), causing type mismatches.

**Type Resolution Chain:**
1. `lib-react18` imports `@ariakit/react`
2. With isolated installs, `@ariakit/react` is stored in `.bun/`
3. The `react` symlink inside `.bun/@ariakit+react*/node_modules/` points to `react@19.1.0`
4. `@ariakit/react`'s type definitions use `import("react")` which resolves to React 19 types
5. TypeScript sees a mismatch: `lib-react18` uses React 18 types, but `@ariakit/react` uses React 19 types

## Expected Behavior

- `packages/lib-react18` depends on `react@^18.3.1` and `@types/react@^18.3.27`
- `@ariakit/react` (a dependency of `lib-react18`) should resolve its `react` peer dependency to React 18
- TypeScript should see consistent React 18 types across all imports

## Actual Behavior

- `@ariakit/react` in `.bun/` has symlink `react -> react@19.1.0`
- TypeScript fails because `@ariakit/react`'s type definitions use `import("react")` which resolves to React 19 types
- This causes type errors like: `'bigint' is not assignable to type 'ReactNode'` (bigint was added to ReactNode in React 19)

## Reproduction Steps

```bash
# Install dependencies
bun install

# Check what version @ariakit resolves to
ls -la node_modules/.bun/@ariakit+react-core*/node_modules/react
# Expected: react@18.x
# Actual: react@19.x

# Try to typecheck lib-react18
bun run typecheck
# Will fail with React 18/19 type mismatch errors
```

## Monorepo Structure

```
├── bunfig.toml              # linker = "isolated"
├── package.json             # workspaces: packages/*, apps/*
├── apps/
│   └── app-react19/         # React 19 app (expo/react-native)
│       └── package.json     # react@19.1.0, @types/react@^19.1.0
└── packages/
    └── lib-react18/         # React 18 library
        ├── package.json     # react@^18.3.1, @types/react@^18.3.27
        └── src/
            └── index.tsx    # ❌ Gets React 19 types via @ariakit/react
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

With isolated installs, transitive dependencies are stored in `.bun/` and their peer dependencies are resolved based on what's available in the monorepo, not based on the consuming package's version requirements.

The peer dependency resolution appears to pick the highest available version (React 19) rather than respecting the version constraints of the package that depends on `@ariakit/react`.
