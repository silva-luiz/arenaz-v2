import type { ComponentProps } from 'react';
import { cn } from './cn';
import { CONTROL_CLASSES } from './control';

export type TextareaProps = ComponentProps<'textarea'>;

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(CONTROL_CLASSES, 'min-h-28 resize-y py-3', className)}
      {...props}
    />
  );
}
