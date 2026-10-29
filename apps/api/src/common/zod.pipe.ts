import {
  UnprocessableEntityException,
  type PipeTransform,
} from '@nestjs/common';
import { z } from 'zod';

/** Parses a value with a zod schema; failures become a 422 with field errors. */
export class ZodPipe<T extends z.ZodType> implements PipeTransform<
  unknown,
  z.output<T>
> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    const errors: Record<string, string[]> = {};
    for (const [field, messages] of Object.entries(
      z.flattenError(result.error).fieldErrors,
    )) {
      errors[field] = messages as string[];
    }
    throw new UnprocessableEntityException({ errors });
  }
}
