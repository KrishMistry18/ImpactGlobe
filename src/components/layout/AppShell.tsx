"use client";

import type { ReactNode } from "react";
import { Header } from "./Header";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-bg-primary">
      <Header />
      <main className="absolute inset-x-0 bottom-0 top-14">{children}</main>
    </div>
  );
}
