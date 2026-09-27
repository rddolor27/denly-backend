import { styleText } from 'node:util';
import { format, type Logform } from 'winston';
import {
  LOG_RECORD_LEVELS,
  type LogRecord,
  type LogRecordLevel,
} from './log-record.js';

/** Cloud Logging `LogSeverity` names (fatal -> CRITICAL, log -> INFO, verbose -> DEBUG). */
export const SEVERITY_BY_LEVEL: Readonly<Record<LogRecordLevel, string>> = {
  fatal: 'CRITICAL',
  error: 'ERROR',
  warn: 'WARNING',
  info: 'INFO',
  debug: 'DEBUG',
};

/** Special field Cloud Logging lifts into `LogEntry.trace`, grouping lines by request. */
export const CLOUD_TRACE_FIELD = 'logging.googleapis.com/trace';

// triple-beam's MESSAGE symbol (a global `Symbol.for`): the rendered line winston transports write.
const MESSAGE = Symbol.for('message');

/**
 * One Cloud Logging structured entry. Cloud Run ships stdout to Cloud Logging, which reads
 * `severity`, `message`, `time` (RFC 3339; a string `timestamp` would not be recognised) and the
 * trace field; Error Reporting reads `stack_trace`. The stack stays a JSON string, so a multi-line
 * trace is still one line on stdout (one log entry).
 */
export function toCloudLoggingEntry(
  record: LogRecord,
  gcpProjectId: string | undefined,
): Record<string, unknown> {
  return {
    severity: SEVERITY_BY_LEVEL[record.level],
    message: record.message,
    time: record.timestamp,
    ...(record.context !== undefined ? { context: record.context } : {}),
    ...(record.requestId !== undefined ? { requestId: record.requestId } : {}),
    ...(record.traceId !== undefined && gcpProjectId !== undefined
      ? {
          [CLOUD_TRACE_FIELD]: `projects/${gcpProjectId}/traces/${record.traceId}`,
        }
      : {}),
    ...(record.stack !== undefined ? { stack_trace: record.stack } : {}),
    ...(record.data !== undefined ? { data: record.data } : {}),
  };
}

type TextStyle = Parameters<typeof styleText>[0];

const LEVEL_STYLE: Readonly<Record<LogRecordLevel, TextStyle>> = {
  fatal: 'magenta',
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
};

/**
 * Local-dev line: `timestamp LEVEL [Context] message requestId=… {data}`, with a stack (if any)
 * on the following lines. Colours only when `stream` is a TTY that supports them (NO_COLOR and
 * FORCE_COLOR are honoured by `styleText`).
 */
export function formatPrettyLine(
  record: LogRecord,
  stream: NodeJS.WritableStream,
): string {
  const paint = (style: TextStyle, text: string): string =>
    styleText(style, text, { stream });

  const parts = [
    paint('gray', record.timestamp),
    paint(LEVEL_STYLE[record.level], record.level.toUpperCase().padEnd(5)),
    ...(record.context !== undefined
      ? [paint('yellow', `[${record.context}]`)]
      : []),
    record.message,
    ...(record.requestId !== undefined
      ? [paint('gray', `requestId=${record.requestId}`)]
      : []),
    ...(record.data !== undefined ? [JSON.stringify(record.data)] : []),
  ];
  const line = parts.join(' ');
  return record.stack !== undefined
    ? `${line}\n${paint('red', record.stack)}`
    : line;
}

export function cloudLoggingJsonFormat(
  gcpProjectId: string | undefined,
): Logform.Format {
  return format((info) => {
    info[MESSAGE] = JSON.stringify(
      toCloudLoggingEntry(readLogRecord(info), gcpProjectId),
    );
    return info;
  })();
}

export function prettyFormat(stream: NodeJS.WritableStream): Logform.Format {
  return format((info) => {
    info[MESSAGE] = formatPrettyLine(readLogRecord(info), stream);
    return info;
  })();
}

function isLogRecordLevel(level: string): level is LogRecordLevel {
  return Object.hasOwn(LOG_RECORD_LEVELS, level);
}

/** Reads back the `LogRecord` fields `AppLogger` put on the winston info object. */
function readLogRecord(info: Logform.TransformableInfo): LogRecord {
  const text = (key: string): string | undefined => {
    const value = info[key];
    return typeof value === 'string' ? value : undefined;
  };
  const context = text('context');
  const requestId = text('requestId');
  const traceId = text('traceId');
  const stack = text('stack');
  const data = info['data'];

  return {
    level: isLogRecordLevel(info.level) ? info.level : 'info',
    message: typeof info.message === 'string' ? info.message : '',
    timestamp: text('timestamp') ?? new Date().toISOString(),
    ...(context !== undefined ? { context } : {}),
    ...(requestId !== undefined ? { requestId } : {}),
    ...(traceId !== undefined ? { traceId } : {}),
    ...(stack !== undefined ? { stack } : {}),
    ...(data !== undefined ? { data } : {}),
  };
}
