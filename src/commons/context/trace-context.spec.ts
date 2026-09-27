import { describe, expect, it } from 'vitest';
import {
  extractTraceId,
  parseCloudTraceContext,
  parseTraceparent,
} from './trace-context.js';

const TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736';
const OTHER_TRACE_ID = '105445aa7843bc8bf206b12000100000';

describe('parseTraceparent', () => {
  it.each([
    `00-${TRACE_ID}-00f067aa0ba902b7-01`,
    `00-${TRACE_ID}-00f067aa0ba902b7-00`,
  ])('reads the trace id from %s', (header) => {
    expect(parseTraceparent(header)).toBe(TRACE_ID);
  });

  it.each([
    ['absent', undefined],
    ['empty', ''],
    ['unknown version', `01-${TRACE_ID}-00f067aa0ba902b7-01`],
    ['uppercase hex', `00-${TRACE_ID.toUpperCase()}-00f067aa0ba902b7-01`],
    ['short trace id', `00-${TRACE_ID.slice(1)}-00f067aa0ba902b7-01`],
    ['short span id', `00-${TRACE_ID}-00f067aa0ba902b-01`],
    ['all-zero trace id', `00-${'0'.repeat(32)}-00f067aa0ba902b7-01`],
    ['all-zero span id', `00-${TRACE_ID}-${'0'.repeat(16)}-01`],
    ['trailing data', `00-${TRACE_ID}-00f067aa0ba902b7-01-extra`],
    ['injected newline', `00-${TRACE_ID}-00f067aa0ba902b7-01\nforged`],
    [
      'duplicate headers joined',
      `00-${TRACE_ID}-00f067aa0ba902b7-01, 00-${TRACE_ID}-00f067aa0ba902b7-01`,
    ],
  ])('ignores a malformed header (%s)', (_, header) => {
    expect(parseTraceparent(header)).toBeUndefined();
  });
});

describe('parseCloudTraceContext', () => {
  it.each([
    `${OTHER_TRACE_ID}/1;o=1`,
    `${OTHER_TRACE_ID}/12345678901234567890;o=0`,
    `${OTHER_TRACE_ID}/42`,
    `${OTHER_TRACE_ID.toUpperCase()}/42;o=1`,
  ])('reads the (lowercased) trace id from %s', (header) => {
    expect(parseCloudTraceContext(header)).toBe(OTHER_TRACE_ID);
  });

  it.each([
    ['absent', undefined],
    ['no span', OTHER_TRACE_ID],
    ['hex span', `${OTHER_TRACE_ID}/abc;o=1`],
    ['bad option', `${OTHER_TRACE_ID}/1;o=2`],
    ['short trace id', `${OTHER_TRACE_ID.slice(1)}/1;o=1`],
    ['all-zero trace id', `${'0'.repeat(32)}/1;o=1`],
    ['trailing data', `${OTHER_TRACE_ID}/1;o=1;x=y`],
  ])('ignores a malformed header (%s)', (_, header) => {
    expect(parseCloudTraceContext(header)).toBeUndefined();
  });
});

describe('extractTraceId', () => {
  it('prefers traceparent over x-cloud-trace-context', () => {
    expect(
      extractTraceId({
        traceparent: `00-${TRACE_ID}-00f067aa0ba902b7-01`,
        cloudTraceContext: `${OTHER_TRACE_ID}/1;o=1`,
      }),
    ).toBe(TRACE_ID);
  });

  it('falls back to x-cloud-trace-context when traceparent is missing or malformed', () => {
    expect(
      extractTraceId({
        traceparent: 'garbage',
        cloudTraceContext: `${OTHER_TRACE_ID}/1;o=1`,
      }),
    ).toBe(OTHER_TRACE_ID);
  });

  it('returns undefined when neither header is valid', () => {
    expect(
      extractTraceId({ traceparent: undefined, cloudTraceContext: 'nope' }),
    ).toBeUndefined();
  });
});
