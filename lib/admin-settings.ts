import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import { queryKeys } from "./query-keys";

export type PlatformSetting = Schemas["PlatformSettingItem"];
export type SettingKey = PlatformSetting["key"];
export type SettingValue = PlatformSetting["value"];

export const settingsApi = {
  list: () => unwrap(client.GET("/api/v1/admin/settings")),
  update: (key: SettingKey, value: SettingValue) =>
    unwrap(
      client.PUT("/api/v1/admin/settings/{key}", {
        params: { path: { key } },
        body: { value },
      }),
    ),
};

export function useAdminSettings() {
  return useQuery({
    queryKey: queryKeys.admin.settings,
    queryFn: settingsApi.list,
    staleTime: 15_000,
  });
}

/** A saved setting changes what /me reports (for example the verification gates), so me refreshes too. */
export function useUpdateSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: SettingKey; value: SettingValue }) =>
      settingsApi.update(key, value),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.settings }),
        queryClient.invalidateQueries({ queryKey: queryKeys.me }),
      ]),
  });
}

/** Commission is a percent from 0 to 100 with at most two decimal places. */
export function validateCommission(text: string): string | undefined {
  const trimmed = text.trim();
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(trimmed) || Number(trimmed) > 100)
    return "Enter a number from 0 to 100.";
  const fraction = trimmed.split(".")[1] ?? "";
  if (fraction.length > 2) return "Use at most 2 decimal places.";
  return undefined;
}
