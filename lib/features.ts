export const FEATURE_FLAGS = {
  DELETE_ACCOUNT: "delete_account",
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export interface FeatureFlags {
  DELETE_ACCOUNT: boolean;
}

export const DEFAULT_FLAGS: FeatureFlags = {
  DELETE_ACCOUNT: false,
};

/**
 * Reads feature flags from a runtime source.
 * shortcut: currently env-based; swap this to query your admin config store
 * (DB, KV, Edge Config, etc.) when the admin dashboard lands.
 */
export async function getFeatureFlags(): Promise<FeatureFlags> {
  return {
    DELETE_ACCOUNT: process.env.NEXT_PUBLIC_FEATURE_DELETE_ACCOUNT === "true",
  };
}

export function isFeatureEnabled(
  flag: FeatureFlag,
  flags: FeatureFlags,
): boolean {
  return flags[flag] ?? false;
}
