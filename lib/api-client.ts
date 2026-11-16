import createClient from "openapi-fetch";
import { API_URL, apiFetch } from "./api";
import type { components, paths } from "./api-types";
import { toApiError } from "./profile";

/** Request and response shapes from tuition-api's OpenAPI document. */
export type Schemas = components["schemas"];

// Relative URLs need an origin for `new Request()` when NEXT_PUBLIC_API_URL is unset.
const baseUrl =
  API_URL || (typeof window !== "undefined" ? window.location.origin : "");

/**
 * Typed client for tuition-api: paths, params, bodies and responses are checked against
 * lib/api-types.ts. Requests go through apiFetch, so they keep the bearer token and the
 * refresh-and-retry on 401.
 */
export const client = createClient<paths>({
  baseUrl,
  fetch: async (request) =>
    apiFetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body ? await request.text() : undefined,
      signal: request.signal,
    }),
});

/**
 * Resolves to the response data, or throws the same ApiError that parseJson throws.
 * `await unwrap(client.GET("/api/v1/tutors/me/zones"))`
 */
export async function unwrap<D>(
  call: Promise<{ data?: D; error?: unknown; response: Response }>,
): Promise<D> {
  const { data, error, response } = await call;
  if (!response.ok) throw toApiError(response.status, error);
  return data as D;
}
