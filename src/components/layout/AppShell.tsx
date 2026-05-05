"use client";

import { ReactNode } from "react";
import TopBar from "./TopBar";

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-bg-primary">
      <TopBar />
      <main className="absolute inset-0 top-16 bottom-0 w-full">
        {children}
      </main>
    </div>
  );
}
