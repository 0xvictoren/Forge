"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ShelbyClientProvider } from "@shelby-protocol/react";
import { useState } from "react";
import { getShelbyBrowserClient } from "@/lib/shelby-browser";

export function ShelbyProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const shelbyClient = getShelbyBrowserClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ShelbyClientProvider client={shelbyClient}>{children}</ShelbyClientProvider>
    </QueryClientProvider>
  );
}
