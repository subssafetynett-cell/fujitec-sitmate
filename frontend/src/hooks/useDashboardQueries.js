import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  fetchDashboardStats,
  fetchFormResponsesList,
  fetchAllFormResponsesList,
  fetchSectionDashboardStats,
} from "../services/api";
import { useAuth } from "../context/AuthContext";

function scopeKey(currentUser) {
  return currentUser?.actingClientId || currentUser?.clientId || currentUser?.id || "anon";
}

const DASHBOARD_STALE_MS = 3 * 60_000;

export function useDashboardStatsQuery() {
  const { currentUser } = useAuth();
  const key = scopeKey(currentUser);

  return useQuery({
    queryKey: ["dashboard", "stats", key],
    queryFn: fetchDashboardStats,
    enabled: Boolean(currentUser?.id),
    staleTime: DASHBOARD_STALE_MS,
    placeholderData: keepPreviousData,
  });
}

export function useSectionDashboardStatsQuery(sectionKey) {
  const { currentUser } = useAuth();
  const key = scopeKey(currentUser);

  return useQuery({
    queryKey: ["dashboard", "section", sectionKey, key],
    queryFn: () => fetchSectionDashboardStats(sectionKey),
    enabled: Boolean(sectionKey && currentUser?.id),
    staleTime: DASHBOARD_STALE_MS,
    placeholderData: keepPreviousData,
  });
}

export function useFormResponsesListQuery(params = {}, options = {}) {
  const { currentUser } = useAuth();
  const key = scopeKey(currentUser);
  const { fetchAll = false, enabled = true, ...queryOptions } = options;

  return useQuery({
    queryKey: ["form-responses", key, params, fetchAll ? "all" : "page"],
    queryFn: () =>
      fetchAll ? fetchAllFormResponsesList(params) : fetchFormResponsesList(params),
    enabled: Boolean(currentUser?.id) && enabled,
    ...queryOptions,
  });
}
