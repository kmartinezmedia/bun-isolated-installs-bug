import { Popover, PopoverHeading } from "@ariakit/react";
import React from "react";

// This component uses @ariakit/react which has React as a peer dependency
// With isolated installs, @ariakit resolves to React 19 even though:
// 1. This package explicitly depends on React 18
// 2. Root package.json has overrides for react@18 and @types/react@18

export function MyPopover({ children }: { children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverHeading>Title</PopoverHeading>
      {children}
    </Popover>
  );
}
