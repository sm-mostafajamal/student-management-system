"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { StudentStatus } from "@/types";
import { changeStudentStatusAction } from "@/actions/enrollment-status.actions";
import { getAllowedNextStatuses } from "@/lib/enrollment-status-rules";
import { StudentStatusBadge } from "./status-badge";

interface FormValues {
  targetStatus: StudentStatus | "";
  reason: string;
  notes: string;
  effectiveDate: string;
  deferredDate: string;
  expectedReturnDate: string;
  withdrawalDate: string;
  completionDate: string;
  award: string;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export function ChangeStatusModal({
  studentId,
  currentStatus,
}: {
  studentId: string;
  currentStatus: StudentStatus;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const allowedNext = getAllowedNextStatuses(currentStatus);

  const { register, watch, setValue, handleSubmit, reset, formState } = useForm<FormValues>({
    defaultValues: {
      targetStatus: "",
      reason: "",
      notes: "",
      effectiveDate: todayIso(),
      deferredDate: todayIso(),
      expectedReturnDate: "",
      withdrawalDate: todayIso(),
      completionDate: todayIso(),
      award: "",
    },
  });

  const targetStatus = watch("targetStatus");

  function closeAndReset() {
    setOpen(false);
    setConfirming(false);
    setServerError(null);
    reset();
  }

  function buildPayload(values: FormValues) {
    switch (values.targetStatus) {
      case StudentStatus.DEFERRED:
        return {
          targetStatus: values.targetStatus,
          reason: values.reason,
          notes: values.notes,
          deferredDate: values.deferredDate,
          expectedReturnDate: values.expectedReturnDate,
        };
      case StudentStatus.WITHDRAWN:
        return {
          targetStatus: values.targetStatus,
          reason: values.reason,
          notes: values.notes,
          withdrawalDate: values.withdrawalDate,
        };
      case StudentStatus.COMPLETED:
        return {
          targetStatus: values.targetStatus,
          reason: values.reason,
          notes: values.notes,
          completionDate: values.completionDate,
          award: values.award,
        };
      case StudentStatus.ENROLLED:
        return {
          targetStatus: values.targetStatus,
          reason: values.reason,
          notes: values.notes,
          effectiveDate: values.effectiveDate,
        };
      default:
        return null;
    }
  }

  function onSubmit(values: FormValues) {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    const payload = buildPayload(values);
    if (!payload) return;

    setServerError(null);
    startTransition(async () => {
      const result = await changeStudentStatusAction(studentId, payload);
      if (result.success) {
        toast.success(`Status changed to ${result.data.newStatus}.`);
        closeAndReset();
        return;
      }
      setServerError(result.error);
      setConfirming(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) closeAndReset();
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" disabled={allowedNext.length === 0}>
            Change Status
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change enrollment status</DialogTitle>
          <DialogDescription>
            Current status:{" "}
            <span className="inline-flex align-middle ml-1">
              <StudentStatusBadge status={currentStatus} />
            </span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {serverError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{serverError}</AlertTitle>
            </Alert>
          )}

          {allowedNext.length === 0 ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{currentStatus} is a terminal status — no further changes are allowed.</AlertTitle>
            </Alert>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>New status</Label>
                <Select
                items={allowedNext.map((s) => ({ value: s, label: s }))}
                value={targetStatus}
                onValueChange={(v) => {
                    setValue("targetStatus", v as StudentStatus);
                    setConfirming(false);
                }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select the next status" />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedNext.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.charAt(0) + s.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {targetStatus && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="reason">Reason (required)</Label>
                    <Textarea id="reason" rows={2} {...register("reason", { required: true })} />
                    {formState.errors.reason && (
                      <p className="text-xs text-destructive">Reason is required.</p>
                    )}
                  </div>

                  {targetStatus === StudentStatus.DEFERRED && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="deferredDate">Deferred date</Label>
                        <Input id="deferredDate" type="date" {...register("deferredDate")} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="expectedReturnDate">Expected return (required)</Label>
                        <Input
                          id="expectedReturnDate"
                          type="date"
                          {...register("expectedReturnDate", { required: true })}
                        />
                      </div>
                    </div>
                  )}

                  {targetStatus === StudentStatus.WITHDRAWN && (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="withdrawalDate">Withdrawal date</Label>
                      <Input id="withdrawalDate" type="date" {...register("withdrawalDate")} />
                    </div>
                  )}

                  {targetStatus === StudentStatus.COMPLETED && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="completionDate">Completion date</Label>
                        <Input id="completionDate" type="date" {...register("completionDate")} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="award">Award (required)</Label>
                        <Input id="award" placeholder="e.g. BSc in Computer Science" {...register("award", { required: true })} />
                      </div>
                    </div>
                  )}

                  {targetStatus === StudentStatus.ENROLLED && (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="effectiveDate">Effective date</Label>
                      <Input id="effectiveDate" type="date" {...register("effectiveDate")} />
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea id="notes" rows={2} {...register("notes")} />
                  </div>
                </>
              )}
            </>
          )}

          {confirming && targetStatus && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="flex items-center gap-2">
                Confirm: <StudentStatusBadge status={currentStatus} /> <ArrowRight className="h-3.5 w-3.5" />{" "}
                <StudentStatusBadge status={targetStatus} />
              </AlertTitle>
              <AlertDescription>
                This updates the student&apos;s enrollment record, adjusts affected course registrations, and is
                recorded in the status history. This cannot be undone from the UI.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeAndReset} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || allowedNext.length === 0 || !targetStatus}>
              {isPending ? "Saving…" : confirming ? "Confirm change" : "Continue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}