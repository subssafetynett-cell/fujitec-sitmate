import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusPill } from "@/components/sheq/status-pill";
import type { NcEvidence, NonConformance, User } from "@/data/sheq";
import {
  ApiError,
  approveNcResponse,
  approveNonConformance,
  rejectNcResponse,
  rejectNonConformance,
  saveNcResponse,
} from "@/lib/api";
import { uploadFileToCloudinary } from "@/lib/cloudinary-upload";
import { isCompanyAdmin, isSuperAdmin } from "@/lib/auth";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nc: NonConformance | null;
  actor: User | null;
  onChanged: (nc: NonConformance) => void;
  onEditRejected?: (nc: NonConformance) => void;
};

function ncStatus(nc: NonConformance) {
  return nc.status || nc.stage;
}

export function NcDetailDialog({
  open,
  onOpenChange,
  nc,
  actor,
  onChanged,
  onEditRejected,
}: Props) {
  const [reason, setReason] = useState("");
  const [reviewComments, setReviewComments] = useState("");
  const [correction, setCorrection] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [evidence, setEvidence] = useState<NcEvidence[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!nc || !open) return;
    setReason("");
    setReviewComments("");
    setCorrection(nc.response?.correction ?? "");
    setRootCause(nc.response?.rootCause ?? "");
    setCorrectiveAction(nc.response?.correctiveAction ?? "");
    setEvidence(nc.response?.evidence ?? []);
  }, [nc, open]);

  if (!nc) return null;

  const status = ncStatus(nc);
  const isAdmin = isCompanyAdmin(actor) || isSuperAdmin(actor);
  const isReporter = actor?.id === nc.reporterId;
  const isResponsible = actor?.id === nc.responsiblePersonId;
  const canRespond =
    isResponsible &&
    ["Assigned", "Draft", "In Progress", "Reopened"].includes(status);
  const canApproveRaise = isAdmin && status === "Pending Admin Approval";
  const canReviewResponse = isAdmin && status === "Pending Admin Review";

  async function run(action: () => Promise<NonConformance>, okMsg: string) {
    setBusy(true);
    try {
      const updated = await action();
      toast.success(okMsg);
      onChanged(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(file: File) {
    try {
      const { url, uploaded } = await uploadFileToCloudinary(file, {
        folder: "sheq-harmony/nc-evidence",
        resourceType: "auto",
      });
      setEvidence((prev) => [
        ...prev,
        { name: file.name, url, mimeType: file.type },
      ]);
      toast.success(uploaded ? "Evidence uploaded" : "Evidence attached");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to upload");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {nc.id}
            <StatusPill value={status} />
          </DialogTitle>
          <DialogDescription>{nc.title}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 text-sm">
          <div className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Reporter:</span>{" "}
              {nc.reporterName || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Responsible:</span>{" "}
              {nc.responsiblePersonName || nc.owner}
            </p>
            <p>
              <span className="text-muted-foreground">Site:</span> {nc.site}
            </p>
            <p>
              <span className="text-muted-foreground">Due:</span>{" "}
              {nc.dueDate || nc.due || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Priority:</span>{" "}
              {nc.priority || nc.severity}
            </p>
            <p>
              <span className="text-muted-foreground">Company:</span>{" "}
              {nc.company || "—"}
            </p>
            {nc.auditRef ? (
              <p className="sm:col-span-2">
                <span className="text-muted-foreground">Audit:</span> {nc.auditRef}
              </p>
            ) : null}
            {nc.description ? (
              <p className="sm:col-span-2 whitespace-pre-wrap">
                <span className="text-muted-foreground">Description:</span>
                <br />
                {nc.description}
              </p>
            ) : null}
            {nc.rejectionReason ? (
              <p className="sm:col-span-2 rounded-lg bg-destructive/5 p-2 text-destructive">
                Rejection: {nc.rejectionReason}
              </p>
            ) : null}
            {nc.adminReviewComments ? (
              <p className="sm:col-span-2 rounded-lg bg-muted p-2">
                Admin comments: {nc.adminReviewComments}
              </p>
            ) : null}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Timeline</h3>
            <ol className="space-y-2 border-l border-border pl-4">
              {(nc.timeline ?? []).length === 0 ? (
                <li className="text-muted-foreground">No timeline events yet.</li>
              ) : (
                [...(nc.timeline ?? [])]
                  .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1))
                  .map((entry) => (
                    <li key={entry.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-primary" />
                      <p className="font-medium">{entry.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.userName} · {entry.role} ·{" "}
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                      {entry.comments ? (
                        <p className="mt-0.5 text-xs">{entry.comments}</p>
                      ) : null}
                    </li>
                  ))
              )}
            </ol>
          </div>

          {canRespond ? (
            <div className="grid gap-3 rounded-xl border border-border p-3">
              <h3 className="text-sm font-semibold">Respond to finding</h3>
              <div className="grid gap-2">
                <Label>What correction has been done to eliminate the nonconformity?</Label>
                <Textarea
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                  className="min-h-20 rounded-xl"
                />
              </div>
              <div className="grid gap-2">
                <Label>What is the root cause?</Label>
                <Textarea
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  className="min-h-20 rounded-xl"
                />
              </div>
              <div className="grid gap-2">
                <Label>
                  What corrective action has been taken to eliminate the root cause?
                </Label>
                <Textarea
                  value={correctiveAction}
                  onChange={(e) => setCorrectiveAction(e.target.value)}
                  className="min-h-20 rounded-xl"
                />
              </div>
              <div className="grid gap-2">
                <Label>Evidence (images, PDF, documents)</Label>
                <Input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,application/pdf"
                  className="rounded-xl"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    for (const file of files) void onUpload(file);
                    e.target.value = "";
                  }}
                />
                {evidence.length > 0 ? (
                  <ul className="text-xs text-muted-foreground">
                    {evidence.map((ev) => (
                      <li key={ev.url}>
                        <a href={ev.url} target="_blank" rel="noreferrer" className="underline">
                          {ev.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () =>
                        saveNcResponse(nc.id, {
                          correction,
                          rootCause,
                          correctiveAction,
                          evidence,
                          submit: false,
                        }),
                      "Draft saved",
                    )
                  }
                >
                  Save draft
                </Button>
                <Button
                  type="button"
                  className="rounded-xl"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () =>
                        saveNcResponse(nc.id, {
                          correction,
                          rootCause,
                          correctiveAction,
                          evidence,
                          submit: true,
                        }),
                      "Response submitted for review",
                    )
                  }
                >
                  Submit response
                </Button>
              </div>
            </div>
          ) : null}

          {nc.response && !canRespond ? (
            <div className="grid gap-2 rounded-xl border border-border p-3">
              <h3 className="text-sm font-semibold">Submitted response</h3>
              <p>
                <span className="text-muted-foreground">Correction:</span>{" "}
                {nc.response.correction}
              </p>
              <p>
                <span className="text-muted-foreground">Root cause:</span>{" "}
                {nc.response.rootCause}
              </p>
              <p>
                <span className="text-muted-foreground">Corrective action:</span>{" "}
                {nc.response.correctiveAction}
              </p>
            </div>
          ) : null}

          {canApproveRaise ? (
            <div className="grid gap-2 rounded-xl border border-border p-3">
              <h3 className="text-sm font-semibold">Admin approval</h3>
              <Label>Rejection reason (required if rejecting)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-16 rounded-xl"
                placeholder="Reason for rejection…"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="rounded-xl"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => approveNonConformance(nc.id),
                      "NC approved and assigned",
                    )
                  }
                >
                  Approve & assign
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="rounded-xl"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => rejectNonConformance(nc.id, reason),
                      "NC rejected",
                    )
                  }
                >
                  Reject
                </Button>
              </div>
            </div>
          ) : null}

          {canReviewResponse ? (
            <div className="grid gap-2 rounded-xl border border-border p-3">
              <h3 className="text-sm font-semibold">Review response</h3>
              <Label>Comments (required if rejecting)</Label>
              <Textarea
                value={reviewComments}
                onChange={(e) => setReviewComments(e.target.value)}
                className="min-h-16 rounded-xl"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="rounded-xl"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => approveNcResponse(nc.id, reviewComments),
                      "NC closed",
                    )
                  }
                >
                  Approve & close
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="rounded-xl"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => rejectNcResponse(nc.id, reviewComments),
                      "Response rejected — reopened",
                    )
                  }
                >
                  Reject & reopen
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          {isReporter && status === "Rejected" && onEditRejected ? (
            <Button
              type="button"
              className="rounded-xl"
              onClick={() => {
                onOpenChange(false);
                onEditRejected(nc);
              }}
            >
              Edit & resubmit
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
