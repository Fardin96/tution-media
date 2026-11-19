"use client";

import { useState } from "react";
import { AdminDialog } from "@/components/admin/admin-ui";
import { CaseForm } from "@/components/cases/case-form";
import { errorCodeMessage } from "@/lib/api-errors";
import {
  DISPUTE_TYPE_HINT,
  DISPUTE_TYPE_LABEL,
  DISPUTE_TYPE_ORDER,
  useCreateDispute,
} from "@/lib/cases";
import { ApiError } from "@/lib/profile";
import { toastError, toastSuccess } from "@/lib/toast";

const CHOICES = DISPUTE_TYPE_ORDER.map((value) => ({
  value,
  label: DISPUTE_TYPE_LABEL[value],
  hint: DISPUTE_TYPE_HINT[value],
}));

export function DisputeDialog({
  applicationId,
  open,
  onOpenChange,
}: {
  applicationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateDispute();
  const [serverError, setServerError] = useState<string>();

  return (
    <AdminDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setServerError(undefined);
        onOpenChange(next);
      }}
      title="Open a dispute"
      description="A problem with this tuition that you want us to step in on: no-show, quality, payment or schedule."
      busy={create.isPending}
    >
      <CaseForm
        legend="What kind of problem?"
        name="dispute-type"
        choices={CHOICES}
        choiceError="Pick the kind of problem."
        detailsLabel="Details"
        detailsHint="What happened, and what would put it right?"
        note="An admin will review it. You can follow the status on your dashboard."
        submitLabel="Open dispute"
        pending={create.isPending}
        serverError={serverError}
        onCancel={() => onOpenChange(false)}
        onSubmit={(type, details) => {
          setServerError(undefined);
          create.mutate(
            { applicationId, type, details },
            {
              onSuccess: () => {
                onOpenChange(false);
                toastSuccess("Dispute opened");
              },
              onError: (err) => {
                if (err instanceof ApiError && err.status === 409) {
                  setServerError(errorCodeMessage(err) ?? err.message);
                  return;
                }
                toastError("Couldn't open the dispute.", err);
              },
            },
          );
        }}
      />
    </AdminDialog>
  );
}
