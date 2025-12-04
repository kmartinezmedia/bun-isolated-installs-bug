import React, { use, Suspense } from "react";

// React 19 specific feature: `use()` hook
// This hook only exists in React 19, will fail to compile with React 18 types

const dataPromise = Promise.resolve({ message: "Hello from React 19!" });

function DataComponent() {
  // `use()` is a React 19-only hook
  const data = use(dataPromise);
  return <div>{data.message}</div>;
}

export function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DataComponent />
    </Suspense>
  );
}

