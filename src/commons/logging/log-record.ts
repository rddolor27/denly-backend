/** winston levels, most severe first. `LOG_LEVEL` picks the threshold; `fatal` always passes. */
export const LOG_RECORD_LEVELS = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
} as const;

export type LogRecordLevel = keyof typeof LOG_RECORD_LEVELS;

/** One Nest `Logger` call, normalised: what the caller said, before request context is added. */
export interface LogCall {
  readonly message: string;
  readonly context?: string;
  readonly stack?: string;
  /** Non-string message and extra arguments, already passed through `toLogSafe`. */
  readonly data?: unknown;
}

/** What the formats render: a `LogCall` plus level, time and the request's ids. */
export interface LogRecord extends LogCall {
  readonly level: LogRecordLevel;
  readonly timestamp: string;
  readonly requestId?: string;
  readonly traceId?: string;
}

// Same heuristic as Nest's ConsoleLogger: "<first line>\n    at <frame>:<line>:<col>".
const STACK_PATTERN = /^.+\n\s+at .+:\d+:\d+/;

/**
 * `log` / `warn` / `debug` / `verbose` call shape. A contextual `new Logger(Ctx)` appends `Ctx`
 * as the last argument, so a trailing string is the context; anything between the message and
 * the context goes under `data`.
 */
export function parseLogCall(
  message: unknown,
  params: readonly unknown[],
): LogCall {
  const { context, rest } = splitContext(params);
  return buildCall(message, context, undefined, rest);
}

/**
 * `error` / `fatal` call shape: `(message, stack?, context?)`. A contextual `Logger` always pads
 * a missing stack with `undefined` before the context; the static `Logger.error(msg, stack)` has
 * no context, which is why a lone argument is a stack only when it looks like one.
 */
export function parseErrorCall(
  message: unknown,
  params: readonly unknown[],
): LogCall {
  const [only] = params;
  if (
    params.length === 1 &&
    typeof only === 'string' &&
    STACK_PATTERN.test(only)
  ) {
    return buildCall(message, undefined, only, []);
  }

  const { context, rest } = splitContext(params);
  const [first, ...extras] = rest;
  if (typeof first === 'string') {
    return buildCall(message, context, first, extras);
  }
  return buildCall(
    message,
    context,
    undefined,
    first === undefined ? extras : rest,
  );
}

function splitContext(params: readonly unknown[]): {
  readonly context?: string;
  readonly rest: readonly unknown[];
} {
  const last = params.at(-1);
  return typeof last === 'string'
    ? { context: last, rest: params.slice(0, -1) }
    : { rest: params };
}

function buildCall(
  message: unknown,
  context: string | undefined,
  stack: string | undefined,
  extras: readonly unknown[],
): LogCall {
  const values: unknown[] = [];
  let text: string;
  let errorStack: string | undefined;

  if (typeof message === 'string') {
    text = message;
  } else if (message instanceof Error) {
    text = message.message.length > 0 ? message.message : message.name;
    errorStack = message.stack;
  } else if (typeof message === 'object' && message !== null) {
    // Structured payload: keep it structured under `data`, never stringified into `message`.
    const inner: unknown = Reflect.get(message, 'message');
    text = typeof inner === 'string' ? inner : '';
    values.push(message);
  } else if (typeof message === 'function') {
    text = '[Function]';
  } else {
    text = String(message);
  }

  values.push(...extras.filter((value) => value !== undefined));
  const finalStack =
    stack !== undefined && stack.length > 0 ? stack : errorStack;
  const data = values.length === 1 ? values[0] : values;

  return {
    message: text,
    ...(context !== undefined ? { context } : {}),
    ...(finalStack !== undefined ? { stack: finalStack } : {}),
    ...(values.length > 0 ? { data: toLogSafe(data) } : {}),
  };
}

const MAX_DEPTH = 5;
const MAX_ENTRIES = 50;
const MAX_STRING_LENGTH = 2_000;
// Defence in depth: a payload that happens to carry one of these never reaches the log.
const SENSITIVE_KEY =
  /password|passwd|secret|token|authorization|cookie|api[-_]?key|email/i;

/**
 * Converts any value into something `JSON.stringify` can always serialise, bounded in depth,
 * breadth and string length: circular references, BigInts, binary buffers (never image bytes in
 * logs), class instances like a full request object and sensitive keys are all defused here.
 */
export function toLogSafe(
  value: unknown,
  depth = 0,
  ancestors: readonly object[] = [],
): unknown {
  switch (typeof value) {
    case 'string':
      return value.length > MAX_STRING_LENGTH
        ? `${value.slice(0, MAX_STRING_LENGTH)}...[${value.length - MAX_STRING_LENGTH} more chars]`
        : value;
    case 'number':
      return Number.isFinite(value) ? value : String(value);
    case 'boolean':
      return value;
    case 'bigint':
      return value.toString();
    case 'symbol':
      return value.toString();
    case 'undefined':
    case 'function':
      return undefined;
  }

  if (typeof value !== 'object' || value === null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
  }
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    return `[binary ${value.byteLength} bytes]`;
  }
  if (ancestors.includes(value)) return '[Circular]';
  if (depth >= MAX_DEPTH) return Array.isArray(value) ? '[Array]' : '[Object]';

  const path = [...ancestors, value];
  if (Array.isArray(value)) {
    const items: unknown[] = value
      .slice(0, MAX_ENTRIES)
      .map((item: unknown) => toLogSafe(item, depth + 1, path) ?? null);
    if (value.length > MAX_ENTRIES) {
      items.push(`...[${value.length - MAX_ENTRIES} more items]`);
    }
    return items;
  }

  const keys = Object.keys(value);
  const result: Record<string, unknown> = {};
  for (const key of keys.slice(0, MAX_ENTRIES)) {
    result[key] = SENSITIVE_KEY.test(key)
      ? '[REDACTED]'
      : toLogSafe(Reflect.get(value, key), depth + 1, path);
  }
  if (keys.length > MAX_ENTRIES) {
    result['...'] = `${keys.length - MAX_ENTRIES} more keys`;
  }
  return result;
}
