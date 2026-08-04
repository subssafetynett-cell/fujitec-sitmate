import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";

import type { SheqPayload } from "@/data/sheq";
import { fetchSheqData } from "@/lib/api";

const SheqContext = createContext<SheqPayload | null>(null);

export function SheqProvider({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: ["sheq"],
    queryFn: fetchSheqData,
    staleTime: 60_000,
    retry: 2,
  });

  if (query.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Loading SHEQ data…</p>
        </div>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-foreground">Unable to reach the API</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Start the backend (`npm run dev:backend`) and ensure{" "}
            <code className="rounded bg-muted px-1">VITE_API_URL</code> points to it.
          </p>
          <button
            type="button"
            className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => query.refetch()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return <SheqContext.Provider value={query.data}>{children}</SheqContext.Provider>;
}

export function useSheq(): SheqPayload {
  const value = useContext(SheqContext);
  if (!value) {
    throw new Error("useSheq must be used within SheqProvider");
  }
  return value;
}
