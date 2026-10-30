import type { Problem } from '@arenaz/contracts';
import {
  HttpException,
  NotFoundException,
  type ArgumentsHost,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ProblemFilter } from '../src/common/problem.filter.js';
import { PublicServiceUnavailableException } from '../src/common/public-service-unavailable.exception.js';

/** Runs the filter against a stub reply and returns the problem it sent. */
function run(exception: unknown): Problem {
  let sent: Problem | undefined;
  const reply = {
    status: () => reply,
    header: () => reply,
    send: (body: Problem) => {
      sent = body;
      return reply;
    },
  };
  const request = { log: { error: vi.fn() } };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => reply,
    }),
  } as unknown as ArgumentsHost;

  new ProblemFilter().catch(exception, host);
  if (sent === undefined) throw new Error('the filter sent nothing');
  return sent;
}

describe('ProblemFilter: 5xx detail', () => {
  it.each([500, 502, 503, 504])(
    'HttpException("interno-secreto", %i) não expõe detail',
    (status) => {
      const problem = run(new HttpException('interno-secreto', status));

      expect(problem.status).toBe(status);
      expect(problem).not.toHaveProperty('detail');
      expect(JSON.stringify(problem)).not.toContain('interno-secreto');
    },
  );

  it('um Error comum vira 500 sem detail', () => {
    const problem = run(new Error('segredo interno'));

    expect(problem.status).toBe(500);
    expect(problem).not.toHaveProperty('detail');
    expect(JSON.stringify(problem)).not.toContain('segredo');
  });

  it('PublicServiceUnavailableException mantém a mensagem pt-BR como detail', () => {
    const problem = run(
      new PublicServiceUnavailableException(
        'Serviço fora do ar, tente de novo',
      ),
    );

    expect(problem).toMatchObject({
      status: 503,
      title: 'Serviço indisponível',
      detail: 'Serviço fora do ar, tente de novo',
    });
  });

  it('erros 4xx continuam expondo a mensagem', () => {
    expect(run(new NotFoundException('CEP não encontrado')).detail).toBe(
      'CEP não encontrado',
    );
  });
});
