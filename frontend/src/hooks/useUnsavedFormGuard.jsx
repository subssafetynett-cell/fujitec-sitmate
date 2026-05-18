import { useCallback, useEffect, useRef, useState } from "react";
import UnsavedChangesDialog from "../components/UnsavedChangesDialog";

/**
 * Prompts before leaving when the form has unsaved changes (back button, browser refresh/close).
 * Uses explicit requestLeave() for in-app navigation — not useBlocker (requires a data router).
 */
export function useUnsavedFormGuard({
    enabled = true,
    isDirty = false,
    onLeave,
    onPromptSave,
    saving = false,
}) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const proceedRef = useRef(null);

    useEffect(() => {
        if (!enabled || !isDirty) return undefined;
        const onBeforeUnload = (event) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [enabled, isDirty]);

    const consumePendingNavigation = useCallback(() => {
        const proceed = proceedRef.current;
        proceedRef.current = null;
        if (proceed) {
            proceed();
            return true;
        }
        return false;
    }, []);

    const requestLeave = useCallback(() => {
        if (!enabled || !isDirty) {
            onLeave?.();
            return;
        }
        proceedRef.current = onLeave;
        setDialogOpen(true);
    }, [enabled, isDirty, onLeave]);

    const closeDialog = useCallback(() => {
        setDialogOpen(false);
        proceedRef.current = null;
    }, []);

    const handleCancel = useCallback(() => {
        closeDialog();
    }, [closeDialog]);

    const handleDiscard = useCallback(() => {
        setDialogOpen(false);
        const proceed = proceedRef.current;
        proceedRef.current = null;
        proceed?.();
    }, []);

    const handleSave = useCallback(async () => {
        if (!onPromptSave) return;
        const saved = await onPromptSave();
        if (!saved) return;
        setDialogOpen(false);
        const proceed = proceedRef.current;
        proceedRef.current = null;
        proceed?.();
    }, [onPromptSave]);

    const UnsavedDialog = (
        <UnsavedChangesDialog
            open={dialogOpen}
            onCancel={handleCancel}
            onDiscard={handleDiscard}
            onSave={handleSave}
            saving={saving}
        />
    );

    return {
        requestLeave,
        consumePendingNavigation,
        closeUnsavedDialog: closeDialog,
        UnsavedDialog,
    };
}
