"use client";

import { useCallback } from "react";
import {
  useQueryClient,
  type FetchQueryOptions,
  type QueryKey,
} from "@tanstack/react-query";

/**
 * Starts loading a detail page's data as soon as the user shows intent (pointer over the
 * link, keyboard focus, or a touch), so the page opens with its data already in the cache.
 * Pass the same options the page's hook uses (a `queryOptions(...)` factory), so the key and
 * fetcher match. prefetchQuery dedupes and skips data that is still fresh.
 *
 *   const intent = useIntentPrefetch();
 *   <Link href={...} {...intent(applicationQueryOptions(id))}>
 */
export function useIntentPrefetch() {
  const queryClient = useQueryClient();
  return useCallback(
    <TData, TError, TQueryKey extends QueryKey>(
      options: FetchQueryOptions<TData, TError, TData, TQueryKey>,
    ) => {
      const prefetch = () => {
        void queryClient.prefetchQuery(options);
      };
      return {
        onMouseEnter: prefetch,
        onFocus: prefetch,
        onTouchStart: prefetch,
      };
    },
    [queryClient],
  );
}
