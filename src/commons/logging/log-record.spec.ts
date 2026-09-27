import { describe, expect, it } from 'vitest';
import { parseErrorCall, parseLogCall, toLogSafe } from './log-record.js';

const STACK = new Error('boom').stack ?? '';

describe('parseLogCall', () => {
  it('reads a bare message', () => {
    expect(parseLogCall('hello', [])).toEqual({ message: 'hello' });
  });

  it('treats a trailing string as the context', () => {
    expect(parseLogCall('hello', ['Ctx'])).toEqual({
      message: 'hello',
      context: 'Ctx',
    });
  });

  it('puts arguments between message and context under data', () => {
    expect(parseLogCall('hello', [{ scanId: 's-1' }, 'Ctx'])).toEqual({
      message: 'hello',
      context: 'Ctx',
      data: { scanId: 's-1' },
    });
  });

  it('stringifies primitive messages', () => {
    expect(parseLogCall(42, [])).toEqual({ message: '42' });
  });
});

describe('parseErrorCall', () => {
  it('reads (message, stack, context) from a contextual Logger', () => {
    expect(parseErrorCall('failed', [STACK, 'Ctx'])).toEqual({
      message: 'failed',
      context: 'Ctx',
      stack: STACK,
    });
  });

  it('reads (message, undefined, context) — the facade pads a missing stack', () => {
    expect(parseErrorCall('failed', [undefined, 'Ctx'])).toEqual({
      message: 'failed',
      context: 'Ctx',
    });
  });

  it('reads a lone stack from the static Logger.error(message, stack)', () => {
    expect(parseErrorCall('failed', [STACK])).toEqual({
      message: 'failed',
      stack: STACK,
    });
  });

  it('reads a lone non-stack string as the context', () => {
    expect(parseErrorCall('failed', ['Ctx'])).toEqual({
      message: 'failed',
      context: 'Ctx',
    });
  });

  it('takes message and stack from an Error message', () => {
    const error = new Error('kaput');
    expect(parseErrorCall(error, [undefined, 'Ctx'])).toEqual({
      message: 'kaput',
      context: 'Ctx',
      stack: error.stack,
    });
  });

  it('prefers an explicit stack over the Error own stack', () => {
    expect(parseErrorCall(new Error('kaput'), [STACK, 'Ctx']).stack).toBe(
      STACK,
    );
  });

  it('keeps a non-string second argument as data', () => {
    expect(parseErrorCall('failed', [{ code: 'X' }, 'Ctx'])).toEqual({
      message: 'failed',
      context: 'Ctx',
      data: { code: 'X' },
    });
  });
});

describe('toLogSafe', () => {
  it('breaks circular references', () => {
    const node: Record<string, unknown> = { id: 1 };
    node['self'] = node;
    expect(toLogSafe(node)).toEqual({ id: 1, self: '[Circular]' });
  });

  it('serialises values JSON cannot', () => {
    expect(
      toLogSafe({
        big: 10n,
        when: new Date('2026-09-27T00:00:00.000Z'),
        error: new TypeError('bad'),
        fn: () => 1,
      }),
    ).toEqual({
      big: '10',
      when: '2026-09-27T00:00:00.000Z',
      error: { name: 'TypeError', message: 'bad' },
      fn: undefined,
    });
  });

  it('never dumps binary data', () => {
    expect(toLogSafe({ image: Buffer.alloc(2048) })).toEqual({
      image: '[binary 2048 bytes]',
    });
  });

  it('redacts sensitive keys', () => {
    expect(
      toLogSafe({
        password: 'p',
        refreshToken: 't',
        Authorization: 'Bearer x',
        email: 'a@b.c',
        userId: 'u-1',
      }),
    ).toEqual({
      password: '[REDACTED]',
      refreshToken: '[REDACTED]',
      Authorization: '[REDACTED]',
      email: '[REDACTED]',
      userId: 'u-1',
    });
  });

  it('bounds depth, breadth and string length', () => {
    const deep = { a: { b: { c: { d: { e: { f: 1 } } } } } };
    expect(JSON.stringify(toLogSafe(deep))).toBe(
      '{"a":{"b":{"c":{"d":{"e":"[Object]"}}}}}',
    );

    const wide = toLogSafe(Array.from({ length: 60 }, (_, i) => i));
    expect(wide).toHaveLength(51);
    expect((wide as unknown[])[50]).toBe('...[10 more items]');

    const long = toLogSafe('x'.repeat(2_010));
    expect(long).toBe(`${'x'.repeat(2_000)}...[10 more chars]`);
  });
});
