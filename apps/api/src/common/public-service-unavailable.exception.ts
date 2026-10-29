import { ServiceUnavailableException } from '@nestjs/common';

/**
 * A 503 whose message is written for the end user (pt-BR, no internals).
 * `ProblemFilter` exposes its message as `detail`; for every other 5xx
 * exception the detail is dropped, so a raw `err.message` can never leak.
 */
export class PublicServiceUnavailableException extends ServiceUnavailableException {
  constructor(message: string) {
    super(message);
    this.name = 'PublicServiceUnavailableException';
  }
}
