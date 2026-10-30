import type { LoggerService } from '@nestjs/common';
import type { FastifyBaseLogger } from 'fastify';

/** Nest passes the logging context as the last string argument. */
function context(rest: unknown[]): string | undefined {
  const last = rest.at(-1);
  return typeof last === 'string' ? last : undefined;
}

/** Routes Nest's own framework logs through the app's pino logger. */
export class PinoNestLogger implements LoggerService {
  constructor(private readonly logger: FastifyBaseLogger) {}

  log(message: unknown, ...rest: unknown[]): void {
    this.logger.info({ context: context(rest) }, String(message));
  }
  error(message: unknown, ...rest: unknown[]): void {
    this.logger.error({ context: context(rest) }, String(message));
  }
  warn(message: unknown, ...rest: unknown[]): void {
    this.logger.warn({ context: context(rest) }, String(message));
  }
  debug(message: unknown, ...rest: unknown[]): void {
    this.logger.debug({ context: context(rest) }, String(message));
  }
  verbose(message: unknown, ...rest: unknown[]): void {
    this.logger.trace({ context: context(rest) }, String(message));
  }
  fatal(message: unknown, ...rest: unknown[]): void {
    this.logger.fatal({ context: context(rest) }, String(message));
  }
}
