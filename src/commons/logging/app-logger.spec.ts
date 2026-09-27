import { PassThrough } from 'node:stream';
import { stripVTControlCharacters } from 'node:util';
import { ConsoleLogger, Logger } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import type { LoggingConfig } from '@/config/app-config.service.js';
import { AppLogLevel, LogFormat } from '@/config/env.validation.js';
import { requestContextStorage } from '../context/request-context.js';
import { AppLogger } from './app-logger.js';

const TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736';
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function capture(config: Partial<LoggingConfig> = {}) {
  const stream = new PassThrough();
  let output = '';
  stream.on('data', (chunk: Buffer) => {
    output += chunk.toString('utf8');
  });
  const logger = new AppLogger(
    { level: AppLogLevel.DEBUG, format: LogFormat.JSON, ...config },
    stream,
  );

  // winston writes through piped streams; one macrotask lets every queued write land.
  const lines = async (): Promise<string[]> => {
    await new Promise((resolve) => setImmediate(resolve));
    return output.split('\n').filter((line) => line.length > 0);
  };
  const entries = async (): Promise<Record<string, unknown>[]> =>
    (await lines()).map((line) => JSON.parse(line) as Record<string, unknown>);

  return { logger, lines, entries };
}

describe('AppLogger (json)', () => {
  it('writes one Cloud Logging JSON object per line', async () => {
    const { logger, lines, entries } = capture();

    logger.log('scan stored', 'ScansService');

    expect(await lines()).toHaveLength(1);
    const [entry] = await entries();
    expect(entry).toEqual({
      severity: 'INFO',
      message: 'scan stored',
      time: expect.stringMatching(ISO_TIMESTAMP) as unknown,
      context: 'ScansService',
    });
  });

  it.each([
    ['log', 'INFO'],
    ['warn', 'WARNING'],
    ['debug', 'DEBUG'],
    ['verbose', 'DEBUG'],
    ['error', 'ERROR'],
    ['fatal', 'CRITICAL'],
  ] as const)('maps %s to severity %s', async (method, severity) => {
    const { logger, entries } = capture();

    logger[method]('message', 'Ctx');

    const [entry] = await entries();
    expect(entry?.['severity']).toBe(severity);
  });

  it('adds requestId and the trace field only inside a request that has them', async () => {
    const { logger, entries } = capture({ gcpProjectId: 'denly-prod' });

    logger.log('outside a request', 'Ctx');
    requestContextStorage.run({ requestId: 'req-1' }, () =>
      logger.log('no trace header', 'Ctx'),
    );
    requestContextStorage.run({ requestId: 'req-2', traceId: TRACE_ID }, () =>
      logger.log('traced', 'Ctx'),
    );

    const [outside, untraced, traced] = await entries();
    expect(outside).not.toHaveProperty('requestId');
    expect(outside).not.toHaveProperty(['logging.googleapis.com/trace']);
    expect(untraced?.['requestId']).toBe('req-1');
    expect(untraced).not.toHaveProperty(['logging.googleapis.com/trace']);
    expect(traced?.['requestId']).toBe('req-2');
    expect(traced?.['logging.googleapis.com/trace']).toBe(
      `projects/denly-prod/traces/${TRACE_ID}`,
    );
  });

  it('omits the trace field when GCP_PROJECT_ID is not configured', async () => {
    const { logger, entries } = capture();

    requestContextStorage.run({ requestId: 'req-1', traceId: TRACE_ID }, () =>
      logger.log('traced', 'Ctx'),
    );

    const [entry] = await entries();
    expect(entry?.['requestId']).toBe('req-1');
    expect(entry).not.toHaveProperty(['logging.googleapis.com/trace']);
  });

  it('keeps an error stack in stack_trace on the same line', async () => {
    const { logger, lines, entries } = capture();
    const error = new Error('database unreachable');

    logger.error('[catch] GET /api/health -> 500', error.stack, 'Filter');

    expect(await lines()).toHaveLength(1);
    const [entry] = await entries();
    expect(entry).toMatchObject({
      severity: 'ERROR',
      message: '[catch] GET /api/health -> 500',
      context: 'Filter',
      stack_trace: error.stack,
    });
    expect(entry?.['stack_trace']).toContain('\n    at ');
  });

  it('uses message and stack of an Error passed as the message', async () => {
    const { logger, entries } = capture();
    const error = new Error('kaput');

    logger.error(error, undefined, 'ExceptionHandler');

    const [entry] = await entries();
    expect(entry).toMatchObject({
      message: 'kaput',
      context: 'ExceptionHandler',
      stack_trace: error.stack,
    });
  });

  it('puts an object message under data, never into message', async () => {
    const { logger, entries } = capture();

    logger.log({ message: 'scan stored', scanId: 's-1' }, 'ScansService');
    logger.warn({ scanId: 's-2', password: 'hunter2' }, 'ScansService');

    const [withMessage, withoutMessage] = await entries();
    expect(withMessage).toMatchObject({
      message: 'scan stored',
      data: { message: 'scan stored', scanId: 's-1' },
    });
    expect(withoutMessage).toMatchObject({
      message: '',
      data: { scanId: 's-2', password: '[REDACTED]' },
    });
  });

  it('drops calls below LOG_LEVEL but always keeps fatal', async () => {
    const { logger, entries } = capture({ level: AppLogLevel.WARN });

    logger.debug('d');
    logger.verbose('v');
    logger.log('l');
    logger.warn('w');
    logger.error('e');
    logger.fatal('f');

    expect((await entries()).map((entry) => entry['message'])).toEqual([
      'w',
      'e',
      'f',
    ]);
  });

  it('keeps only error and fatal at LOG_LEVEL=error', async () => {
    const { logger, entries } = capture({ level: AppLogLevel.ERROR });

    logger.warn('w');
    logger.error('e');
    logger.fatal('f');

    expect((await entries()).map((entry) => entry['severity'])).toEqual([
      'ERROR',
      'CRITICAL',
    ]);
  });
});

describe('AppLogger behind the Nest Logger facade', () => {
  afterEach(() => {
    Logger.overrideLogger(new ConsoleLogger());
  });

  it('receives context and stack from new Logger(X) calls', async () => {
    const { logger, entries } = capture();
    Logger.overrideLogger(logger);
    const facade = new Logger('ScansService');
    const error = new Error('boom');

    facade.log('[submit] stored');
    facade.error('[submit] failed', error.stack);
    facade.error('[submit] failed without stack');

    const [log, withStack, withoutStack] = await entries();
    expect(log).toMatchObject({
      message: '[submit] stored',
      context: 'ScansService',
    });
    expect(withStack).toMatchObject({
      context: 'ScansService',
      stack_trace: error.stack,
    });
    expect(withoutStack).toMatchObject({ context: 'ScansService' });
    expect(withoutStack).not.toHaveProperty('stack_trace');
  });
});

describe('AppLogger (pretty)', () => {
  it('writes a readable line with level, context, message and requestId', async () => {
    const { logger, lines } = capture({ format: LogFormat.PRETTY });

    requestContextStorage.run({ requestId: 'req-1' }, () =>
      logger.log('scan stored', 'ScansService'),
    );

    const [line] = (await lines()).map((raw) => stripVTControlCharacters(raw));
    expect(line).toMatch(
      /^\d{4}-\d{2}-\d{2}T\S+Z INFO {2}\[ScansService\] scan stored requestId=req-1$/,
    );
  });

  it('prints the stack under the error line', async () => {
    const { logger, lines } = capture({ format: LogFormat.PRETTY });
    const error = new Error('boom');

    logger.error('failed', error.stack, 'Ctx');

    const output = (await lines()).map((raw) => stripVTControlCharacters(raw));
    expect(output[0]).toMatch(/ ERROR \[Ctx\] failed$/);
    expect(output[1]).toBe('Error: boom');
  });
});
