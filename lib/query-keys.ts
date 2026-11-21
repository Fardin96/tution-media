import type { QueryClient } from "@tanstack/react-query";

export type RequirementStatus = "active" | "archived" | "all";
export type ZoneRequestStatus = "PENDING" | "APPROVED" | "DENIED";

export const queryKeys = {
  me: ["me"] as const,
  match: ["match"] as const,
  /** The signed-in student's own requirements. */
  requirements: {
    mine: ["requirements", "mine"] as const,
    detail: (id: string) => ["requirements", "detail", id] as const,
  },
  tutor: {
    requirements: {
      all: ["tutor", "requirements"] as const,
      list: (status: RequirementStatus = "active") =>
        ["tutor", "requirements", { status }] as const,
      detail: (id: string) => ["tutor", "requirements", id] as const,
    },
    zones: ["tutor", "zones"] as const,
    zoneRequests: ["tutor", "zone-requests"] as const,
    profileSubjects: ["tutor", "profile-subjects"] as const,
  },
  admin: {
    all: ["admin"] as const,
    zoneRequestsAll: ["admin", "zone-requests"] as const,
    zoneRequests: (filters: { status: ZoneRequestStatus }) =>
      ["admin", "zone-requests", filters] as const,
    team: ["admin", "team"] as const,
    accountsAll: ["admin", "accounts"] as const,
    accounts: <F extends object>(filters: F) =>
      ["admin", "accounts", "list", filters] as const,
    account: (id: string) => ["admin", "accounts", "detail", id] as const,
    applications: <F extends object>(filters: F) =>
      ["admin", "applications", filters] as const,
    feesAll: ["admin", "fees"] as const,
    fees: <F extends object>(filters: F) =>
      ["admin", "fees", "list", filters] as const,
    fee: (id: string) => ["admin", "fees", "detail", id] as const,
    paymentsAll: ["admin", "payment-attempts"] as const,
    paymentAttempts: <F extends object>(filters: F) =>
      ["admin", "payment-attempts", "list", filters] as const,
    paymentSummary: ["admin", "payment-attempts", "summary"] as const,
    paymentAttempt: (tranId: string) =>
      ["admin", "payment-attempts", "detail", tranId] as const,
    promoCodesAll: ["admin", "promo-codes"] as const,
    promoCodes: <F extends object>(filters: F) =>
      ["admin", "promo-codes", "list", filters] as const,
    promoCode: (id: string) => ["admin", "promo-codes", "detail", id] as const,
    refundsAll: ["admin", "refunds"] as const,
    refunds: <F extends object>(filters: F) =>
      ["admin", "refunds", "list", filters] as const,
    refund: (id: string) => ["admin", "refunds", "detail", id] as const,
    packagesAll: ["admin", "packages"] as const,
    packages: <F extends object>(filters: F) =>
      ["admin", "packages", "list", filters] as const,
    package: (id: string) => ["admin", "packages", "detail", id] as const,
    subjects: ["admin", "subjects"] as const,
    areas: <F extends object>(filters: F) =>
      ["admin", "areas", filters] as const,
    areasAll: ["admin", "areas"] as const,
    settings: ["admin", "settings"] as const,
    auditLogs: <F extends object>(filters: F) =>
      ["admin", "audit-logs", filters] as const,
    verificationsAll: ["admin", "verifications"] as const,
    verifications: (kind: "tutors" | "students", filters: object) =>
      ["admin", "verifications", kind, filters] as const,
    videosAll: ["admin", "videos"] as const,
    videos: <F extends object>(filters: F) =>
      ["admin", "videos", filters] as const,
    filesAll: ["admin", "files"] as const,
    files: <F extends object>(filters: F) =>
      ["admin", "files", "list", filters] as const,
    fileStats: ["admin", "files", "stats"] as const,
    /** One account's upload history and active upload block. */
    uploadHistory: (accountId: string) =>
      ["admin", "uploads", accountId] as const,
    uploadsAll: ["admin", "uploads"] as const,
    blogAll: ["admin", "blog"] as const,
    blogPosts: <F extends object>(filters: F) =>
      ["admin", "blog", "list", filters] as const,
    blogPost: (id: string) => ["admin", "blog", "detail", id] as const,
    reviewsAll: ["admin", "reviews"] as const,
    reviews: <F extends object>(filters: F) =>
      ["admin", "reviews", "list", filters] as const,
    reportsAll: ["admin", "reports"] as const,
    reports: <F extends object>(filters: F) =>
      ["admin", "reports", "list", filters] as const,
    report: (id: string) => ["admin", "reports", "detail", id] as const,
    disputesAll: ["admin", "disputes"] as const,
    disputes: <F extends object>(filters: F) =>
      ["admin", "disputes", "list", filters] as const,
    dispute: (id: string) => ["admin", "disputes", "detail", id] as const,
  },
  /** Public GET /subjects: the live subject list for pickers and labels. */
  subjects: ["subjects"] as const,
  /** Public GET /areas: the live area list for pickers and labels. */
  areas: ["areas"] as const,
  packages: { mine: ["packages", "mine"] as const },
  fees: {
    all: ["fees"] as const,
    mine: ["fees", "mine"] as const,
    detail: (id: string) => ["fees", "detail", id] as const,
    attempt: (feeId: string, tranId: string) =>
      ["fees", "attempt", feeId, tranId] as const,
  },
  /** Public GET /tutors/:id. Shared by the public profile page and any profile-data reader. */
  tutors: {
    profile: (id: string) => ["tutors", "profile", id] as const,
  },
  lookups: { education: ["lookups", "education"] as const },
  /** GET /phone-verification: whether the caller's role must verify a phone, and the profile's number. */
  phoneVerification: {
    status: ["phone-verification", "status"] as const,
  },
  /** GET /files/upload-status: whether an admin paused the caller's uploads. */
  uploadStatus: ["upload-status"] as const,
  blog: {
    all: ["blog"] as const,
    list: ["blog", "list"] as const,
    post: (slug: string) => ["blog", "post", slug] as const,
  },
  applications: {
    all: ["applications"] as const,
    list: (status?: string) =>
      ["applications", "list", { status: status ?? "ALL" }] as const,
    detail: (id: string) => ["applications", "detail", id] as const,
    forRequirement: (id: string) =>
      ["applications", "requirement", id] as const,
    forPackage: (id: string) => ["applications", "package", id] as const,
    // Under applications so every application write refreshes them: accepting an applicant fills the tuition.
    recommended: (requirementId: string) =>
      ["applications", "recommended", requirementId] as const,
    studentRequirement: (requirementId: string) =>
      ["applications", "student-requirement", requirementId] as const,
  },
  reviews: {
    all: ["reviews"] as const,
    mine: (applicationId?: string) =>
      ["reviews", "mine", { applicationId: applicationId ?? null }] as const,
    tutor: (tutorId: string) => ["reviews", "tutor", tutorId] as const,
    student: (studentId: string) => ["reviews", "student", studentId] as const,
  },
  /** Reports and disputes the signed-in user filed. */
  cases: {
    all: ["cases"] as const,
    reports: ["cases", "reports"] as const,
    disputes: (applicationId?: string) =>
      ["cases", "disputes", { applicationId: applicationId ?? null }] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: ["notifications", "list"] as const,
    unreadCount: ["notifications", "unread-count"] as const,
  },
  browse: {
    all: ["browse"] as const,
    requirements: <F extends object>(filters: F) =>
      ["browse", "requirements", filters] as const,
    packages: <F extends object>(filters: F) =>
      ["browse", "packages", filters] as const,
    package: (id: string) => ["browse", "package", id] as const,
    tutors: <F extends object>(filters: F) =>
      ["browse", "tutors", filters] as const,
    nearbyTutors: (radiusMeters: number) =>
      ["browse", "tutors", "nearby", radiusMeters] as const,
  },
};

/** Any application change (apply, act, reopen) moves the lists, the detail, browse rows that show myApplication, and me. */
export function invalidateApplications(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.applications.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.browse.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.me }),
    invalidateNotifications(queryClient),
  ]);
}

/** A settled or refused payment moves the tutor's fee list, the fee detail and the application's fee summary. */
export function invalidateFees(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.fees.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.applications.all }),
  ]);
}

/** Alerts are written by application changes, so the bell's list and unread count refresh with them. */
export function invalidateNotifications(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.notifications.all,
  });
}

/** Every tutor-requirement mutation invalidates the same keys; the prefix covers all status lists and details. */
export function invalidateTutorRequirements(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.tutor.requirements.all,
    }),
    queryClient.invalidateQueries({ queryKey: queryKeys.me }),
    queryClient.invalidateQueries({ queryKey: queryKeys.match }),
  ]);
}

/** Package writes move the tutor's list, the student browse and detail, request lists (expired on close) and alerts. */
export function invalidatePackages(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.packages.mine }),
    invalidateApplications(queryClient),
  ]);
}

/** Profile writes (#28-31) change what the public tutor profile shows: details, areas, subjects. */
export function invalidateTutorProfile(
  queryClient: QueryClient,
  tutorId: string,
) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.tutors.profile(tutorId),
  });
}

/** Zone writes change the zone list and, through cascades, requirement sets and apply readiness. */
export function invalidateTutorZones(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.tutor.zones }),
    invalidateTutorRequirements(queryClient),
  ]);
}

/** A verified phone changes the status and the profile's number, so both refetch. */
export function invalidatePhoneVerification(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.phoneVerification.status,
    }),
    queryClient.invalidateQueries({ queryKey: queryKeys.me }),
  ]);
}
