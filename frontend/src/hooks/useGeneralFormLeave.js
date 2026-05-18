import { useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAutoFormDirty } from "./useAutoFormDirty";
import { useUnsavedFormGuard } from "./useUnsavedFormGuard.jsx";

/**
 * Standard leave/save guard for general forms and site-pack form fills.
 */
export function useGeneralFormLeave({
    enabled,
    loading,
    watchDeps = [],
    siteId,
    category,
    listPath,
    saving,
    canQuickSave,
    onQuickSave,
    onOpenSaveDialog,
}) {
    const navigate = useNavigate();
    const leaveAfterSaveRef = useRef(false);

    const navigateBack = useCallback(() => {
        if (siteId) {
            navigate("/sitepack-management", {
                state: { siteId, moduleTitle: category },
            });
        } else if (listPath) {
            navigate(listPath);
        } else {
            navigate("/general-forms");
        }
    }, [navigate, siteId, category, listPath]);

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
