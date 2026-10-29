'use client';

import { signInSchema, type SignInInput } from '@arenaz/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, Button, Field, Input } from '@arenaz/ui';
import { GENERIC_ERROR, authClient, parseAuthError } from '@/lib/auth-client';
import { safeNext } from '@/lib/safe-next';

const FIELDS = ['email', 'password'] as const;

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: SignInInput) {
    setFormError(null);
    try {
      const { error } = await authClient.signIn.email(values);
      if (error) {
        const { message, fieldErrors } = parseAuthError(error);
        for (const field of FIELDS) {
          const text = fieldErrors[field]?.[0];
          if (text) setError(field, { message: text });
        }
        setFormError(message);
        return;
      }
    } catch {
      setFormError(GENERIC_ERROR);
      return;
    }
    router.replace(safeNext(next) as Route);
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void handleSubmit(onSubmit)(event);
      }}
      className="flex flex-col gap-5"
    >
      <Alert tone="error">{formError}</Alert>
      <Field label="E-mail" error={errors.email?.message}>
        <Input type="email" autoComplete="email" {...register('email')} />
      </Field>
      <Field label="Senha" error={errors.password?.message}>
        <Input
          type="password"
          autoComplete="current-password"
          {...register('password')}
        />
      </Field>
      <Button type="submit" loading={isSubmitting}>
        Entrar
      </Button>
      <p className="text-center text-sm text-muted">
        Ainda não tem conta?{' '}
        <Link
          href={next ? { pathname: '/cadastro', query: { next } } : '/cadastro'}
          className="font-semibold text-brand underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Criar conta
        </Link>
      </p>
    </form>
  );
}
