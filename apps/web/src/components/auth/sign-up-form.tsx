'use client';

import { signUpSchema, type SignUpInput } from '@arenaz/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { GENERIC_ERROR, authClient, parseAuthError } from '@/lib/auth-client';
import { safeNext } from '@/lib/safe-next';
import { primaryButton } from '@/components/ui/button-styles';
import { Field } from './field';
import { FormAlert } from './form-alert';

const FIELDS = ['name', 'email', 'password'] as const;

export function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  async function onSubmit(values: SignUpInput) {
    setFormError(null);
    try {
      const { error } = await authClient.signUp.email(values);
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
      <FormAlert message={formError} />
      <Field
        id="name"
        label="Nome"
        autoComplete="name"
        registration={register('name')}
        error={errors.name?.message}
      />
      <Field
        id="email"
        label="E-mail"
        type="email"
        autoComplete="email"
        registration={register('email')}
        error={errors.email?.message}
      />
      <Field
        id="password"
        label="Senha"
        type="password"
        autoComplete="new-password"
        registration={register('password')}
        error={errors.password?.message}
      />
      <button type="submit" disabled={isSubmitting} className={primaryButton}>
        Criar conta
      </button>
      <p className="text-center text-sm text-muted">
        Já tem conta?{' '}
        <Link
          href={next ? { pathname: '/entrar', query: { next } } : '/entrar'}
          className="font-semibold text-brand underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Entrar
        </Link>
      </p>
    </form>
  );
}
