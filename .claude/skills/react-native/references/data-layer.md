# Mobile data layer — TanStack Query + API client

Standing patterns for `denly-mobile`. Adapt names to what gets built; keep the rules.

## QueryClient defaults

```ts
// src/lib/query/client.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: (count, error) => !isClientError(error) && count < 2,   // never retry 4xx
      refetchOnWindowFocus: false,                                     // RN: wire focus manually
    },
    mutations: { retry: 0 },
  },
});
```

- Wire `onlineManager` to NetInfo and `focusManager` to `AppState` once, in the provider file.
- Persisted cache (async-storage persister) only if a recorded decision wants offline history.

## Query keys — one factory per feature

```ts
// src/features/scans/api/keys.ts
export const scanKeys = {
  all: ['scans'] as const,
  lists: () => [...scanKeys.all, 'list'] as const,
  list: (filters: ScanListFilters) => [...scanKeys.lists(), filters] as const,
  detail: (id: string) => [...scanKeys.all, 'detail', id] as const,
};
```

Keys are arrays, entity-first, and enumerate every input that changes the result. Invalidate the
narrowest key that covers the change.

## Hooks — one per endpoint, typed end to end

```ts
export function useScan(id: string | undefined) {
  return useQuery({
    queryKey: scanKeys.detail(id ?? ''),
    queryFn: () => api.scans.get(id!),        // guarded by `enabled`
    enabled: !!id,
    refetchInterval: (q) => (q.state.data?.status === 'processing' ? 2_000 : false),
  });
}

export function useSubmitScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (run: DetectionRun) => api.scans.submit(run),   // JSON body — the image never leaves the phone
    onSuccess: (scan) => {
      qc.setQueryData(scanKeys.detail(scan.id), scan);
      qc.invalidateQueries({ queryKey: scanKeys.lists() });
    },
  });
}
```

- Long-running server work (intelligence → analysis) is polled via `refetchInterval` keyed on
  status, or replaced by push/SSE later — the hook is the only place that changes. On-device
  detection, offline evaluator results and pack contents are not server state and never enter
  the query cache; the data-pack **manifest** is server state and is a normal `useQuery`.
- Mutations own their user feedback: the calling screen renders `isPending`/`error`; toasts or
  inline errors use the API's error `message` when it is user-safe, else the app's own sentence.
  Never surface transport text ("Network Error") to people.
- Optimistic updates only for local, reversible actions (favourite a scan), with
  `onMutate` snapshot → rollback in `onError` → `invalidateQueries` in `onSettled`.

## API client

- One client in `src/lib/api/` (fetch or axios — scaffold decision), base URL and timeout from
  config, `x-request-id` per request, JSON only (no image uploads in v1 — ADR 0002).
- Normalise errors to one `ApiError { status, code, message, details?, requestId? }` shape that
  matches the backend's error contract (`nestjs` skill). Hooks and screens only ever see `ApiError`.
- Validate responses at the boundary. The library is an open decision; until it is made, write
  small type guards for the few response types and keep them next to the client.
- Auth (ADR 0012): the client injects `Authorization: Bearer <access>`. The refresh token lives in
  the Keychain (`expo-secure-store`), the access token only in memory — never `AsyncStorage`, never
  module scope. On `401 ACCESS_TOKEN_EXPIRED` the client refreshes **once, single-flight** (every
  concurrent request awaits the same `POST /v1/auth/refresh`; two parallel refreshes of one token
  count as reuse and revoke the session), stores the rotated refresh token, retries. On
  `INVALID_REFRESH_TOKEN` / `INVALID_ACCESS_TOKEN` / `AUTHENTICATION_REQUIRED`: clear the Keychain,
  go to sign-in. The base URL includes `/api`.

## Client state

React state and context first. Add a store (e.g. Zustand) only when several unrelated screens
share non-server state that context makes awkward; record the decision. Server data never lives
in a store.
