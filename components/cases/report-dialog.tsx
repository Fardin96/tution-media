"use client";

import { useState } from "react";
import { AdminDialog } from "@/components/admin/admin-ui";
import { CaseForm } from "@/components/cases/case-form";
import { errorCodeMessage } from "@/lib/api-errors";
import {
  REPORT_CATEGORY_HINT,
  REPORT_CATEGORY_LABEL,
  REPORT_CATEGORY_ORDER,
  useCreateReport,
} from "@/lib/cases";
import { ApiError } from "@/lib/profile";
import { toastError, toastSuccess } from "@/lib/toast";

const CHOICES = REPORT_CATEGORY_ORDER.map((value) => ({
  value,
  label: REPORT_CATEGORY_LABEL[value],
  hint: REPORT_CATEGORY_HINT[value],
}));

export function ReportDialog({
  applicationId,
  targetName,
  open,
  onOpenChange,
}: {
  applicationId: string;
  targetName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateReport();
  const [serverError, setServerError] = useState<string>();

  return (
    <AdminDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setServerError(undefined);
        onOpenChange(next);
      }}
      title={`Report ${targetName}`}
      description="Tell us what happened. An admin will read it."
      busy={create.isPending}
    >
      <CaseForm
        legend="What's the problem?"
        name="report-category"
        choices={CHOICES}
        choiceError="Pick what the problem is."
        detailsLabel="Details"
        detailsHint="What happened, and when?"
        note="Reports are private. The other person isn't told who reported them."
        submitLabel="Send report"
        pending={create.isPending}
        serverError={serverError}
        onCancel={() => onOpenChange(false)}
        onSubmit={(category, details) => {
          setServerError(undefined);
          create.mutate(
            { applicationId, category, details },
            {
              onSuccess: () => {
                onOpenChange(false);
                toastSuccess("Report sent");
              },
              onError: (err) => {
                if (err instanceof ApiError && err.status === 409) {
                  setServerError(errorCodeMessage(err) ?? err.message);
                  return;
                }
                toastError("Couldn't send the report.", err);
              },
            },
          );
        }}
      />
    </AdminDialog>
  );
}
