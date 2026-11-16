"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invalidateTutorRequirements } from "@/lib/query-keys";
import { toastError, toastSuccess } from "@/lib/toast";
import {
  tutorRequirementApi,
  type TutorRequirement,
} from "@/lib/tutor-requirements";

interface RestoreOptions {
  quiet?: boolean;
}

export function useSetActions() {
  const queryClient = useQueryClient();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function restore(set: TutorRequirement, options: RestoreOptions = {}) {
    setPendingId(set.id);
    try {
      await tutorRequirementApi.restore(set.id);
      await invalidateTutorRequirements(queryClient);
      if (!options.quiet) toastSuccess("Set restored.");
    } catch (err) {
      toastError("Couldn't restore this set.", err);
    } finally {
      setPendingId(null);
    }
  }

  async function archive(set: TutorRequirement) {
    setPendingId(set.id);
    try {
      await tutorRequirementApi.archive(set.id);
      await invalidateTutorRequirements(queryClient);
      toast("Set archived.", {
        action: {
          label: "Undo",
          onClick: () => {
            void restore(set, { quiet: true });
          },
        },
      });
    } catch (err) {
      toastError("Couldn't archive this set.", err);
    } finally {
      setPendingId(null);
    }
  }

  async function makeDefault(set: TutorRequirement) {
    setPendingId(set.id);
    try {
      await tutorRequirementApi.setDefault(set.id);
      await invalidateTutorRequirements(queryClient);
      toastSuccess("Default set changed.");
    } catch (err) {
      toastError("Couldn't change the default set.", err);
    } finally {
      setPendingId(null);
    }
  }

  return { archive, restore, makeDefault, pendingId };
}
