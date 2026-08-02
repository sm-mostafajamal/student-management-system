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
import { cn } from "@/lib/utils";

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

  const { register, watch, setValue, handleSubmit, reset, setError, clearErrors, formState } =
    useForm<FormValues>({
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
  const errors = formState.errors;

  function closeAndReset() {
    setOpen(false);
    setConfirming(false);
    setServerError(null);
    clearErrors();
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

  // Maps server-side Zod fieldErrors (snake/camel keys from
  // `flatten().fieldErrors`) onto react-hook-form fields so the
  // matching inputs actually get highlighted + an inline message.
  function applyServerFieldErrors(fieldErrors?: Record<string, string[]>) {
    if (!fieldErrors) return;
    for (const [field, messages] of Object.entries(fieldErrors)) {
      if (!messages?.length) continue;
      setError(field as keyof FormValues, {
        type: "server",
        message: messages[0],
      });
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
    clearErrors();

    startTransition(async () => {
      const result = await changeStudentStatusAction(studentId, payload);
      if (result.success) {
        toast.success(`Status changed to ${result.data.newStatus}.`);
        closeAndReset();
        return;
      }

      setServerError(result.error);
      applyServerFieldErrors(result.fieldErrors);
      setConfirming(false);
    });
  }

  const inputClass = (hasError: boolean) =>
    cn(hasError && "border-destructive focus-visible:ring-destructive");

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
                    clearErrors();
                    setServerError(null);
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
                    <Textarea
                      id="reason"
                      rows={2}
                      className={inputClass(!!errors.reason)}
                      {...register("reason", {
                        required: "Reason is required.",
                        minLength: {
                          value: 5,
                          message: "Reason must be at least 5 characters.",
                        },
                      })}
                    />
                    {errors.reason && (
                      <p className="text-xs text-destructive">{errors.reason.message}</p>
                    )}
                  </div>

                  {targetStatus === StudentStatus.DEFERRED && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="deferredDate">Deferred date</Label>
                        <Input
                          id="deferredDate"
                          type="date"
                          className={inputClass(!!errors.deferredDate)}
                          {...register("deferredDate")}
                        />
                        {errors.deferredDate && (
                          <p className="text-xs text-destructive">{errors.deferredDate.message}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="expectedReturnDate">Expected return (required)</Label>
                        <Input
                          id="expectedReturnDate"
                          type="date"
                          className={inputClass(!!errors.expectedReturnDate)}
                          {...register("expectedReturnDate", { required: "Expected return date is required." })}
                        />
                        {errors.expectedReturnDate && (
                          <p className="text-xs text-destructive">{errors.expectedReturnDate.message}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {targetStatus === StudentStatus.WITHDRAWN && (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="withdrawalDate">Withdrawal date</Label>
                      <Input
                        id="withdrawalDate"
                        type="date"
                        className={inputClass(!!errors.withdrawalDate)}
                        {...register("withdrawalDate")}
                      />
                      {errors.withdrawalDate && (
                        <p className="text-xs text-destructive">{errors.withdrawalDate.message}</p>
                      )}
                    </div>
                  )}

                  {targetStatus === StudentStatus.COMPLETED && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="completionDate">Completion date</Label>
                        <Input
                          id="completionDate"
                          type="date"
                          className={inputClass(!!errors.completionDate)}
                          {...register("completionDate")}
                        />
                        {errors.completionDate && (
                          <p className="text-xs text-destructive">{errors.completionDate.message}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="award">Award (required)</Label>
                        <Input
                          id="award"
                          placeholder="e.g. BSc in Computer Science"
                          className={inputClass(!!errors.award)}
                          {...register("award", {
                            required: "Award / qualification title is required.",
                            minLength: { value: 2, message: "Award / qualification title is required." },
                          })}
                        />
                        {errors.award && (
                          <p className="text-xs text-destructive">{errors.award.message}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {targetStatus === StudentStatus.ENROLLED && (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="effectiveDate">Effective date</Label>
                      <Input
                        id="effectiveDate"
                        type="date"
                        className={inputClass(!!errors.effectiveDate)}
                        {...register("effectiveDate")}
                      />
                      {errors.effectiveDate && (
                        <p className="text-xs text-destructive">{errors.effectiveDate.message}</p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      rows={2}
                      className={inputClass(!!errors.notes)}
                      {...register("notes")}
                    />
                    {errors.notes && (
                      <p className="text-xs text-destructive">{errors.notes.message}</p>
                    )}
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