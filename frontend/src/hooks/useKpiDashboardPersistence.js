import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";
import {
  buildKpiLocalStorageKeys,
  resolveKpiStorageScope,
} from "../utils/kpiStorageScope";

const AUTO_SAVE_MS = 2000;

function readJson(key) {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Loads and saves KPI dashboard state to the API (per organisation + section)
 * with localStorage as offline cache and one-time migration source.
 */
export function useKpiDashboardPersistence({
  section,
  currentUser,
  storagePrefixes,
  createDefaultStatRows,
  shouldSeedStatRows,
  createEmptySnapshot = null,
  normalizeSnapshot = (value) => value,
  hasSnapshot = false,
}) {
  const scope = resolveKpiStorageScope(currentUser);
  const statsKey = storagePrefixes?.stats || "";
  const targetsKey = storagePrefixes?.targets || "";
  const metaKey = storagePrefixes?.meta || "";
  const snapshotKey = storagePrefixes?.snapshot || "";

  // Stable string keys — do not recreate an object every render (that retriggers
  // hydration and leaves KPI pages blank).
  const keys = useMemo(
    () =>
      buildKpiLocalStorageKeys(scope, {
        stats: statsKey,
        targets: targetsKey,
        meta: metaKey,
        snapshot: snapshotKey || undefined,
      }),
    [scope, statsKey, targetsKey, metaKey, snapshotKey]
  );

  const [statRows, setStatRows] = useState(createDefaultStatRows);
  const [snapshot, setSnapshot] = useState(() =>
    createEmptySnapshot ? createEmptySnapshot() : null
  );
  const [targets, setTargets] = useState({});
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const skipAutoSaveRef = useRef(true);
  const autoSaveTimerRef = useRef(null);

  const createDefaultStatRowsRef = useRef(createDefaultStatRows);
  const shouldSeedStatRowsRef = useRef(shouldSeedStatRows);
  const createEmptySnapshotRef = useRef(createEmptySnapshot);
  const normalizeSnapshotRef = useRef(normalizeSnapshot);
  createDefaultStatRowsRef.current = createDefaultStatRows;
  shouldSeedStatRowsRef.current = shouldSeedStatRows;
  createEmptySnapshotRef.current = createEmptySnapshot;
  normalizeSnapshotRef.current = normalizeSnapshot;

  const normalizeStatRows = useCallback((rows) => {
    const createDefault = createDefaultStatRowsRef.current;
    const shouldSeed = shouldSeedStatRowsRef.current;
    if (!Array.isArray(rows) || rows.length === 0) return createDefault();
    return shouldSeed(rows) ? createDefault() : rows;
  }, []);

  const readLocalPayload = useCallback(() => {
    const parsedStats = readJson(keys.stats);
    const parsedTargets = readJson(keys.targets);
    const parsedMeta = readJson(keys.meta);
    const parsedSnapshot = hasSnapshot ? readJson(keys.snapshot) : null;

    if (!Array.isArray(parsedStats) || parsedStats.length === 0) return null;

    const emptySnapshot = createEmptySnapshotRef.current;
    const normalize = normalizeSnapshotRef.current;

    return {
      statRows: normalizeStatRows(parsedStats),
      targets: parsedTargets && typeof parsedTargets === "object" ? parsedTargets : {},
      snapshot:
        hasSnapshot && parsedSnapshot != null
          ? normalize(parsedSnapshot)
          : emptySnapshot?.() ?? null,
      lastSavedAt: parsedMeta?.lastSavedAt || null,
    };
  }, [keys.stats, keys.targets, keys.meta, keys.snapshot, hasSnapshot, normalizeStatRows]);

  const applyPayload = useCallback(
    (payload, updatedAt = null) => {
      if (!payload) return;
      const normalize = normalizeSnapshotRef.current;
      if (Array.isArray(payload.statRows) && payload.statRows.length > 0) {
        setStatRows(normalizeStatRows(payload.statRows));
      }
      if (payload.targets && typeof payload.targets === "object") {
        setTargets(payload.targets);
      }
      if (hasSnapshot && payload.snapshot != null) {
        setSnapshot(normalize(payload.snapshot));
      }
      const savedAt = updatedAt || payload.lastSavedAt || null;
      if (savedAt) setLastSavedAt(savedAt);
    },
    [hasSnapshot, normalizeStatRows]
  );

  const writeLocalPayload = useCallback(
    (payload) => {
      if (!payload?.statRows) return;
      localStorage.setItem(keys.stats, JSON.stringify(payload.statRows));
      localStorage.setItem(keys.targets, JSON.stringify(payload.targets || {}));
      localStorage.setItem(
        keys.meta,
        JSON.stringify({ lastSavedAt: payload.lastSavedAt || new Date().toISOString() })
      );
      if (hasSnapshot && keys.snapshot) {
        localStorage.setItem(keys.snapshot, JSON.stringify(payload.snapshot ?? null));
      }
    },
    [keys.stats, keys.targets, keys.meta, keys.snapshot, hasSnapshot]
  );

  const buildPayload = useCallback(
    (savedAt = new Date().toISOString()) => {
      const payload = {
        statRows,
        targets,
        lastSavedAt: savedAt,
      };
      if (hasSnapshot) payload.snapshot = snapshot;
      return payload;
    },
    [statRows, targets, snapshot, hasSnapshot]
  );

  const persistRemote = useCallback(
    async (payload) => {
      if (!scope) return null;
      const res = await api.put(`/kpi-dashboard/${section}`, { payload });
      return res.data?.dashboard ?? null;
    },
    [scope, section]
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      skipAutoSaveRef.current = true;

      if (!scope) {
        const localOnly = readLocalPayload();
        if (localOnly) applyPayload(localOnly);
        if (!cancelled) setHydrated(true);
        return;
      }

      try {
        const res = await api.get(`/kpi-dashboard/${section}`);
        const remote = res.data?.dashboard;
        if (cancelled) return;

        if (remote?.payload) {
          applyPayload(remote.payload, remote.updatedAt);
          writeLocalPayload({
            ...remote.payload,
            lastSavedAt: remote.updatedAt || remote.payload.lastSavedAt,
          });
        } else {
          const localPayload = readLocalPayload();
          if (localPayload) {
            applyPayload(localPayload);
            try {
              const migrated = await persistRemote(localPayload);
              if (!cancelled && migrated?.updatedAt) setLastSavedAt(migrated.updatedAt);
            } catch (err) {
              console.warn("KPI dashboard local migration failed:", err);
            }
          }
        }
      } catch (err) {
        console.warn("KPI dashboard remote load failed, using local cache:", err);
        const localPayload = readLocalPayload();
        if (localPayload) applyPayload(localPayload);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };

    setHydrated(false);
    load();

    return () => {
      cancelled = true;
    };
    // Only re-hydrate when organisation / section changes — not when callback identities churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: stable hydrate cycle
  }, [scope, section]);

  useEffect(() => {
    if (!hydrated) return;

    if (skipAutoSaveRef.current) {
      skipAutoSaveRef.current = false;
      return;
    }

    const payload = buildPayload();
    writeLocalPayload(payload);

    if (!scope) return undefined;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        const saved = await persistRemote(payload);
        if (saved?.updatedAt) setLastSavedAt(saved.updatedAt);
      } catch (err) {
        console.warn("KPI dashboard auto-save failed:", err);
      }
    }, AUTO_SAVE_MS);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [statRows, targets, snapshot, hydrated, scope, buildPayload, writeLocalPayload, persistRemote]);

  useEffect(() => {
    if (!hydrated) return;
    const ids = new Set(statRows.map((row) => row.id));
    setTargets((prev) => {
      const next = {};
      let changed = false;
      for (const [id, value] of Object.entries(prev)) {
        if (ids.has(id)) next[id] = value;
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [statRows, hydrated]);

  const updateTarget = useCallback((rowId, field, value) => {
    setTargets((prev) => ({
      ...prev,
      [rowId]: { ...(prev[rowId] || {}), [field]: value },
    }));
  }, []);

  const saveNow = useCallback(async () => {
    const savedAt = new Date().toISOString();
    const payload = buildPayload(savedAt);
    setSaving(true);
    try {
      writeLocalPayload(payload);
      if (scope) {
        const saved = await persistRemote(payload);
        setLastSavedAt(saved?.updatedAt || savedAt);
      } else {
        setLastSavedAt(savedAt);
      }
      return true;
    } finally {
      setSaving(false);
    }
  }, [buildPayload, writeLocalPayload, persistRemote, scope]);

  return {
    statRows,
    setStatRows,
    snapshot,
    setSnapshot,
    targets,
    setTargets,
    updateTarget,
    lastSavedAt,
    hydrated,
    saving,
    saveNow,
    scopeReady: Boolean(scope),
  };
}
