import type { LoggerService } from '@nestjs/common';
import { createLogger, type Logger, transports } from 'winston';
import type { LoggingConfig } from '@/config/app-config.service.js';
import { LogFormat } from '@/config/env.validation.js';
import { getRequestId, getTraceId } from '../context/request-context.js';
import { cloudLoggingJsonFormat, prettyFormat } from './log-formats.js';
import {
  LOG_RECORD_LEVELS,
  type LogCall,
  type LogRecordLevel,
  parseErrorCall,
  parseLogCall,
} from './log-record.js';

/**
 * The app-wide Nest logger (installed with `app.useLogger` in `main.ts`). Code keeps calling
 * `new Logger(X.name)`; the facade forwards here and this writes through winston to stdout:
 * Cloud Logging JSON in deployed environments, a readable line locally. Request and trace ids
 * come from the request's `AsyncLocalStorage` context, read at call time.
 */
export class AppLogger implements LoggerService {
  private readonly logger: Logger;

  constructor(
    config: LoggingConfig,
    destination: NodeJS.WritableStream = process.stdout,
  ) {
    this.logger = createLogger({
      levels: LOG_RECORD_LEVELS,
      level: config.level,
      format:
        config.format === LogFormat.JSON
          ? cloudLoggingJsonFormat(config.gcpProjectId)
          : prettyFormat(destination),
      // Everything on stdout, one entry per line ("\n" also on Windows, for identical output).
      transports: [new transports.Stream({ stream: destination, eol: '\n' })],
      exitOnError: false,
    });
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', () => parseLogCall(message, optionalParams));
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', () => parseErrorCall(message, optionalParams));
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', () => parseLogCall(message, optionalParams));
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', () => parseLogCall(message, optionalParams));
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', () => parseLogCall(message, optionalParams));
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', () => parseErrorCall(message, optionalParams));
  }

  private write(level: LogRecordLevel, parse: () => LogCall): void {
    // Skip parsing and payload sanitising entirely for filtered-out levels.
    if (!this.logger.isLevelEnabled(level)) return;

    // Read the request context now: winston may finish the write after this call returns.
    const requestId = getRequestId();
    const traceId = getTraceId();
    const { message, ...fields } = parse();
    this.logger.log({
      level,
      message,
      timestamp: new Date().toISOString(),
      ...fields,
      ...(requestId !== undefined ? { requestId } : {}),
      ...(traceId !== undefined ? { traceId } : {}),
    });
  }
}
