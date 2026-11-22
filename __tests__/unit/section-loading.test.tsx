import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageFrameSkeleton } from "@/components/ui/page-frame-skeleton";
import { RequirementShellSkeleton } from "@/components/requirements/requirement-shell-skeleton";
import ApplicationsLoading from "@/app/dashboard/applications/loading";
import ApplicationDetailLoading from "@/app/dashboard/applications/[id]/loading";
import FeesLoading from "@/app/dashboard/fees/loading";
import FeeDetailLoading from "@/app/dashboard/fees/[id]/loading";
import FeePaymentLoading from "@/app/dashboard/fees/[id]/payment/loading";
import FindTuitionsLoading from "@/app/dashboard/find-tuitions/loading";
import FindTutorsLoading from "@/app/dashboard/find-tutors/loading";
import PackageDetailLoading from "@/app/dashboard/find-tutors/packages/[id]/loading";
import ReportsLoading from "@/app/dashboard/reports/loading";
import RequirementLoading from "@/app/dashboard/requirements/loading";
import ApplicantsLoading from "@/app/dashboard/requirements/[id]/applicants/loading";
import TutorPackagesLoading from "@/app/dashboard/tutor/packages/loading";
import NewPackageLoading from "@/app/dashboard/tutor/packages/new/loading";
import EditPackageLoading from "@/app/dashboard/tutor/packages/[id]/edit/loading";
import PackageRequestsLoading from "@/app/dashboard/tutor/packages/[id]/requests/loading";
import TutorRequirementsLoading from "@/app/dashboard/tutor/requirements/loading";
import NewTutorRequirementLoading from "@/app/dashboard/tutor/requirements/new/loading";
import EditTutorRequirementLoading from "@/app/dashboard/tutor/requirements/[id]/edit/loading";
import TutorZonesLoading from "@/app/dashboard/tutor/zones/loading";

const SHELLS: [string, () => React.JSX.Element][] = [
  [
    "PageFrameSkeleton",
    () => <PageFrameSkeleton>{<p>content</p>}</PageFrameSkeleton>,
  ],
  ["RequirementShellSkeleton", () => <RequirementShellSkeleton />],
  ["applications", ApplicationsLoading],
  ["applications/[id]", ApplicationDetailLoading],
  ["fees", FeesLoading],
  ["fees/[id]", FeeDetailLoading],
  ["fees/[id]/payment", FeePaymentLoading],
  ["find-tuitions", FindTuitionsLoading],
  ["find-tutors", FindTutorsLoading],
  ["find-tutors/packages/[id]", PackageDetailLoading],
  ["reports", ReportsLoading],
  ["requirements", RequirementLoading],
  ["requirements/[id]/applicants", ApplicantsLoading],
  ["tutor/packages", TutorPackagesLoading],
  ["tutor/packages/new", NewPackageLoading],
  ["tutor/packages/[id]/edit", EditPackageLoading],
  ["tutor/packages/[id]/requests", PackageRequestsLoading],
  ["tutor/requirements", TutorRequirementsLoading],
  ["tutor/requirements/new", NewTutorRequirementLoading],
  ["tutor/requirements/[id]/edit", EditTutorRequirementLoading],
  ["tutor/zones", TutorZonesLoading],
];

describe("section loading skeletons", () => {
  it.each(SHELLS)(
    "%s announces a status and draws Skeletons",
    (_name, Shell) => {
      const { container } = render(<Shell />);
      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("Loading…");
      expect(status.querySelector(".sr-only")).toHaveTextContent("Loading…");
      const bars = container.querySelectorAll('[data-slot="skeleton"]');
      expect(bars.length).toBeGreaterThan(0);
    },
  );
});
