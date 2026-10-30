import type { Problem } from '@arenaz/contracts';
import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { PublicServiceUnavailableException } from './public-service-unavailable.exception.js';

export const PROBLEM_CONTENT_TYPE = 'application/problem+json; charset=utf-8';

const TITLES: Record<number, string> = {
  400: 'Requisição inválida',
  401: 'Não autenticado',
  403: 'Acesso negado',
  404: 'Não encontrado',
  409: 'Conflito',
  422: 'Dados inválidos',
  429: 'Muitas requisições',
  500: 'Erro interno',
  503: 'Serviço indisponível',
};

export function titleFor(status: number): string {
  const fallback = status >= 500 ? TITLES[500] : TITLES[400];
  return TITLES[status] ?? fallback ?? 'Erro interno';
}

/** Nest's router answers unknown routes with an English "Cannot GET /x". */
const ROUTER_NOT_FOUND = /^Cannot [A-Z]+ \//;

function fromHttpException(exception: HttpException): Problem {
  const status = exception.getStatus();
  const problem: Problem = {
    type: 'about:blank',
    title: titleFor(status),
    status,
  };
  // 5xx details stay hidden (they may carry internals), except for the
  // exception type whose message is written for the end user.
  if (
    status >= 500 &&
    !(exception instanceof PublicServiceUnavailableException)
  ) {
    return problem;
  }

  const body = exception.getResponse();
  if (typeof body === 'string') {
    problem.detail = body;
    return problem;
  }
  const { message, error, errors } = body as Record<string, unknown>;
  if (
    typeof message === 'string' &&
    message !== error &&
    !ROUTER_NOT_FOUND.test(message)
  ) {
    problem.detail = message;
  }
  if (typeof errors === 'object' && errors !== null) {
    problem.errors = errors as Record<string, string[]>;
  }
  return problem;
}

/** Client errors raised by Fastify itself (bad JSON, payload too large...). */
export function fastifyClientStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { statusCode } = error as { statusCode?: unknown };
  return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500
    ? statusCode
    : undefined;
}

@Catch()
export class ProblemFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();

    let problem: Problem;
    if (exception instanceof HttpException) {
      problem = fromHttpException(exception);
    } else {
      const status = fastifyClientStatus(exception);
      if (status === undefined) {
        // The stack goes to the log only, never into the response body.
        request.log.error({ err: exception }, 'Erro não tratado');
        problem = {
          type: 'about:blank',
          title: titleFor(HttpStatus.INTERNAL_SERVER_ERROR),
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        };
      } else {
        problem = { type: 'about:blank', title: titleFor(status), status };
      }
    }

    sendProblem(reply, problem);
  }
}

/** Writes a `Problem` as `application/problem+json`. */
export function sendProblem(reply: FastifyReply, problem: Problem): void {
  void reply
    .status(problem.status)
    .header('content-type', PROBLEM_CONTENT_TYPE)
    .send(problem);
}
