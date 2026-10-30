import {
  UnprocessableEntityException,
  type PipeTransform,
} from '@nestjs/common';
import { z } from 'zod';

/** Field name → messages, the `errors` member of a validation `Problem`. */
export function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const [field, messages] of Object.entries(
    z.flattenError(error).fieldErrors,
  )) {
    errors[field] = messages as string[];
  }
  return errors;
}

/** Parses a value with a zod schema; failures become a 422 with field errors. */
export class ZodPipe<T extends z.ZodType>
  implements PipeTransform<unknown, z.output<T>>
{
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw new UnprocessableEntityException({
      errors: toFieldErrors(result.error),
    });
  }
}
