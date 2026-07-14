import { useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAutoFormDirty } from "./useAutoFormDirty";
import { useUnsavedFormGuard } from "./useUnsavedFormGuard.jsx";
import { resolveSitepackModuleTitle, sitepackNavState } from "../utils/sitepackContext";
import { monitoringFolderPath, monitoringSitePath } from "../utils/monitoringContext";
import {
    isTemplatesPageEditContext,
    templatesPageListUrl,
} from "../utils/templatePageContext";

/**
 * Standard leave/save guard for general forms and site-pack form fills.
 */
export function useGeneralFormLeave({
    enabled,
    loading,
    watchDeps = [],
    siteId,
    subfolderId,
    category,
    listPath,
    subfolderName,
    saving,
    canQuickSave,
    onQuickSave,
    onOpenSaveDialog,
}) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const monitoringSection = searchParams.get("monitoringSection");
    const leaveAfterSaveRef = useRef(false);
    const resolvedSubfolderName =
        subfolderName || searchParams.get("subfolderName") || undefined;
    const resolvedListPath = listPath || searchParams.get("listPath") || "";

    const navigateBack = useCallback(() => {
        const embedded = searchParams.get("embedded") === "true";
        if (embedded) {
            try {
                window.parent?.postMessage(
                    {
                        type: "sitemate:monitoring-form-done",
                        monitoringSection,
                        siteId,
                        subfolderId,
                        listPath: resolvedListPath || undefined,
                    },
                    window.location.origin
                );
            } catch {
                /* ignore cross-window errors */
            }
            return;
        }
        if (monitoringSection && siteId) {
            if (subfolderId) {
                navigate(monitoringFolderPath(monitoringSection, siteId, subfolderId));
            } else {
                navigate(monitoringSitePath(monitoringSection, siteId));
            }
            return;
        }
        if (monitoringSection) {
            if (resolvedListPath) {
                navigate(resolvedListPath);
                return;
            }
            navigate(monitoringSitePath(monitoringSection));
            return;
        }
        if (siteId) {
            navigate("/sitepack-management", {
                state: sitepackNavState({
                    siteId,
                    subfolderId,
                    subfolderName: resolvedSubfolderName,
                    moduleTitle: resolveSitepackModuleTitle(category, { siteId, subfolderId }),
                }),
            });
            return;
        }
        if (resolvedListPath) {
            navigate(resolvedListPath);
            return;
        }
        const concernPathByCategory = {
            "Health & Safety concern": "/report-health-safety",
            "Quality concern": "/report-quality",
            "Positive observation": "/report-positive",
            "Sustainability concern": "/report-environmental",
        };
        if (category && concernPathByCategory[category]) {
            navigate(concernPathByCategory[category]);
            return;
        }
        if (isTemplatesPageEditContext(searchParams)) {
            navigate(templatesPageListUrl());
            return;
        }
        navigate("/general-forms");
    }, [
        navigate,
        monitoringSection,
        siteId,
        subfolderId,
        resolvedSubfolderName,
        category,
        resolvedListPath,
        searchParams,
    ]);

    const { isDirty, resetDirty } = useAutoFormDirty(watchDeps, { enabled, loading });

    const { requestLeave, consumePendingNavigation, UnsavedDialog } = useUnsavedFormGuard({
        enabled,
        isDirty,
        onLeave: navigateBack,
        saving,
        onPromptSave: async () => {
            if (canQuickSave && onQuickSave) {
                const ok = await onQuickSave();
                if (ok) {
                    resetDirty();
                    return true;
                }
                return false;
            }
            leaveAfterSaveRef.current = true;
            onOpenSaveDialog?.();
            return false;
        },
    });

    const finishSaveAndNavigate = useCallback(() => {
        resetDirty();
        if (leaveAfterSaveRef.current) {
            leaveAfterSaveRef.current = false;
            if (!consumePendingNavigation()) navigateBack();
        } else {
            navigateBack();
        }
    }, [resetDirty, consumePendingNavigation, navigateBack]);

    return {
        isDirty,
        resetDirty,
        navigateBack: requestLeave,
        finishSaveAndNavigate,
        leaveAfterSaveRef,
        UnsavedDialog,
    };
}
