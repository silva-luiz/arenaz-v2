import { UnprocessableEntityException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ZodPipe } from '../src/common/zod.pipe.js';

const pipe = new ZodPipe(z.object({ name: z.string().min(2) }));

describe('ZodPipe', () => {
  it('retorna o valor parseado', () => {
    expect(pipe.transform({ name: 'Ana' })).toEqual({ name: 'Ana' });
  });

  it('lança 422 com erros por campo', () => {
    let thrown: unknown;
    try {
      pipe.transform({ name: 'A' });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(UnprocessableEntityException);
    expect(
      (thrown as UnprocessableEntityException).getResponse(),
    ).toMatchObject({
      errors: { name: [expect.any(String)] },
    });
  });
});
