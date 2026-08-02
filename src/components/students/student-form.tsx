"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import {
  createStudentSchema,
  updateStudentSchema,
  type CreateStudentInput,
  type UpdateStudentInput,
} from "@/lib/validations/student.schema";
import { createStudentAction, updateStudentAction } from "@/actions/student.actions";
import { Gender } from "@/types";
import type { AutoEnrollSummary } from "@/services/student.service";
import type { StudentWithProgramme, Serialized } from "@/types";

interface ProgrammeOption {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}
interface AcademicYearOption {
  id: string;
  name: string;
  isCurrent: boolean;
}

type Props =
  | { mode: "create"; programmes: ProgrammeOption[]; academicYears: AcademicYearOption[]; student?: never }
  | { mode: "edit"; programmes: ProgrammeOption[]; academicYears?: never; student: StudentWithProgramme };

export function StudentForm(props: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  // Set once the server reports PROGRAMME_CHANGE_HAS_PAYMENTS — flips the
  // form into a confirmation state requiring `force` + `changeReason`.
  const [needsProgrammeChangeConfirm, setNeedsProgrammeChangeConfirm] = useState(false);

  const isEdit = props.mode === "edit";
  const schema = isEdit ? updateStudentSchema : createStudentSchema;

  const form = useForm<CreateStudentInput & UpdateStudentInput>({
    resolver: zodResolver(schema as any),
    defaultValues: isEdit
      ? {
          firstName: props.student.user.firstName,
          lastName: props.student.user.lastName,
          email: props.student.user.email,
          dateOfBirth: props.student.dateOfBirth ?? undefined,
          gender: props.student.gender ?? undefined,
          phone: props.student.phone ?? "",
          address: props.student.address ?? "",
          programmeId: props.student.programmeId,
        }
      : { gender: undefined },
  });

  function onSubmit(values: CreateStudentInput & UpdateStudentInput) {
    setServerError(null);
    startTransition(async () => {
      const result = isEdit
        ? await updateStudentAction(props.student.id, values)
        : await createStudentAction(values);

      if (result.success) {
        toast.success(isEdit ? "Student updated." : "Student enrolled successfully.");

        if (!isEdit) {
          // `result.data` is a union across the create/update action return
          // types, so TS can't narrow it on its own — createStudentAction is
          // the only branch that ever attaches `autoEnrollment`, and we've
          // already confirmed `!isEdit` above, so this cast is safe.
          const createData = result.data as Serialized<StudentWithProgramme> & {
            autoEnrollment?: AutoEnrollSummary;
          };
          const autoEnrollment = createData.autoEnrollment;

          if (autoEnrollment) {
            const { enrolledCourseCodes, skippedNoOffering, skippedCapacity } = autoEnrollment;

            if (enrolledCourseCodes.length > 0) {
              toast.info(
                `Auto-enrolled in ${enrolledCourseCodes.length} programme course(s): ${enrolledCourseCodes.join(", ")}`
              );
            }
            if (skippedNoOffering.length > 0) {
              toast.warning(
                `No course offering exists yet for this year for: ${skippedNoOffering.join(", ")}. Create an offering, then enroll the student manually.`
              );
            }
            if (skippedCapacity.length > 0) {
              toast.warning(
                `These programme courses are already at capacity: ${skippedCapacity.join(", ")}. Enroll manually once space opens up.`
              );
            }
          }
        }

        router.push("/students");
        router.refresh();
        return;
      }

      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof (CreateStudentInput & UpdateStudentInput), {
            message: messages?.[0],
          });
        }
      }

      // Edge case UX: turn the blocking error into an inline confirmation
      // instead of a dead-end toast.
      if (result.error.includes("recorded payment")) {
        setNeedsProgrammeChangeConfirm(true);
      }

      setServerError(result.error);
    });
  }

  const dobValue = form.watch("dateOfBirth");

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {serverError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{serverError}</AlertTitle>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" {...form.register("firstName")} />
          {form.formState.errors.firstName && (
            <p className="text-xs text-destructive">{form.formState.errors.firstName.message}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" {...form.register("lastName")} />
          {form.formState.errors.lastName && (
            <p className="text-xs text-destructive">{form.formState.errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" {...form.register("email")} />
        {form.formState.errors.email && (
          <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dateOfBirth">Date of birth</Label>
          <Input
            id="dateOfBirth"
            type="date"
            defaultValue={dobValue ? new Date(dobValue).toISOString().slice(0, 10) : undefined}
            {...form.register("dateOfBirth")}
          />
          {form.formState.errors.dateOfBirth && (
            <p className="text-xs text-destructive">{form.formState.errors.dateOfBirth.message as string}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Gender</Label>
          <Select
            items={Object.values(Gender).map((g) => ({
              value: g,
              label: g.charAt(0) + g.slice(1).toLowerCase(),
            }))}
            defaultValue={isEdit ? props.student.gender ?? undefined : undefined}
            onValueChange={(v) => form.setValue("gender", v as Gender)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(Gender).map((g) => (
                <SelectItem key={g} value={g}>
                  {g.charAt(0) + g.slice(1).toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" {...form.register("phone")} />
          {form.formState.errors.phone && (
            <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Programme</Label>
          <Select
            items={props.programmes
              .filter((p) => p.isActive || (isEdit && p.id === props.student.programmeId))
              .map((p) => ({
                value: p.id,
                label: `${p.code} — ${p.name}${!p.isActive ? " (inactive — cannot select)" : ""}`,
              }))}
            defaultValue={isEdit ? props.student.programmeId : undefined}
            onValueChange={(v) => {
              form.setValue("programmeId", v ?? '');
              setNeedsProgrammeChangeConfirm(false); 
              form.setValue("force", false as any);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select programme" />
            </SelectTrigger>
            <SelectContent>
              {props.programmes
                .filter((p) => p.isActive || (isEdit && p.id === props.student.programmeId))
                .map((p) => (
                  <SelectItem key={p.id} value={p.id} disabled={!p.isActive}>
                    {p.code} — {p.name}
                    {!p.isActive ? " (inactive — cannot select)" : ""}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {form.formState.errors.programmeId && (
            <p className="text-xs text-destructive">{form.formState.errors.programmeId.message}</p>
          )}
        </div>
      </div>

      {!isEdit && (
        <div className="flex flex-col gap-1.5">
          <Label>Admission academic year</Label>
          <Select
            items={props.academicYears.map((y) => ({
              value: y.id,
              label: `${y.name}${y.isCurrent ? " (current)" : ""}`,
            }))}
            onValueChange={(v) => form.setValue("admissionAcademicYearId", v as string)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Defaults to current academic year" />
            </SelectTrigger>
            <SelectContent>
              {props.academicYears.map((y) => (
                <SelectItem key={y.id} value={y.id}>
                  {y.name}
                  {y.isCurrent ? " (current)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="address">Address</Label>
        <Textarea id="address" rows={2} {...form.register("address")} />
      </div>

      {needsProgrammeChangeConfirm && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Confirm programme change</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>
              This student has existing payment records. Past invoices won't change, but future billing will
              follow the new programme. Provide a reason to proceed.
            </p>
            <Textarea
              placeholder="Reason for programme change (required)"
              {...form.register("changeReason")}
            />
            {form.formState.errors.changeReason && (
              <p className="text-xs text-destructive">{form.formState.errors.changeReason.message}</p>
            )}
            <Button
              type="button"
              variant="secondary"
              className="w-fit"
              onClick={() => {
                form.setValue("force", true as any);
                form.handleSubmit(onSubmit)();
              }}
            >
              Confirm and change programme
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Enroll student"}
        </Button>
      </div>
    </form>
  );
}