// W3C Trace Context: version "00", 32-hex trace id, 16-hex parent (span) id, 2-hex flags,
// lowercase only (https://www.w3.org/TR/trace-context/#traceparent-header).
const TRACEPARENT_PATTERN = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/;

// Google's legacy header: TRACE_ID/SPAN_ID;o=OPTIONS — 32-hex trace id, decimal span id.
const CLOUD_TRACE_CONTEXT_PATTERN = /^([0-9a-f]{32})\/(\d{1,20})(?:;o=[01])?$/i;

const ALL_ZERO = /^0+$/;

/** The trace id of a W3C `traceparent` header, or `undefined` when absent or malformed. */
export function parseTraceparent(
  header: string | undefined,
): string | undefined {
  if (header === undefined) return undefined;
  const match = TRACEPARENT_PATTERN.exec(header);
  const traceId = match?.[1];
  const spanId = match?.[2];
  if (traceId === undefined || spanId === undefined) return undefined;
  // All-zero ids are explicitly invalid in the spec.
  if (ALL_ZERO.test(traceId) || ALL_ZERO.test(spanId)) return undefined;
  return traceId;
}

/** The trace id of an `x-cloud-trace-context` header, or `undefined` when absent or malformed. */
export function parseCloudTraceContext(
  header: string | undefined,
): string | undefined {
  if (header === undefined) return undefined;
  const traceId = CLOUD_TRACE_CONTEXT_PATTERN.exec(header)?.[1]?.toLowerCase();
  if (traceId === undefined || ALL_ZERO.test(traceId)) return undefined;
  return traceId;
}

/** `traceparent` wins; `x-cloud-trace-context` is the fallback. Malformed headers are ignored. */
export function extractTraceId(headers: {
  readonly traceparent: string | undefined;
  readonly cloudTraceContext: string | undefined;
}): string | undefined {
  return (
    parseTraceparent(headers.traceparent) ??
    parseCloudTraceContext(headers.cloudTraceContext)
  );
}
