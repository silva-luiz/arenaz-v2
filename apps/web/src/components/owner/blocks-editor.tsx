'use client';

import { blockInputSchema, blockSchema, type Block } from '@arenaz/contracts';
import { Alert, Button, Field, Input, Select } from '@arenaz/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiSend } from '@/lib/api-client';
import { formatBlockRange, toSaoPauloIso } from '@/lib/sao-paulo';
import { TIME_OPTIONS } from './time-options';

const DEFAULT_START = 18 * 60;
const DEFAULT_END = 22 * 60;
const DATE_MISSING = 'Informe a data';

type Notice = { tone: 'error' | 'success'; text: string } | null;
type FormField = 'date' | 'startsAt' | 'endsAt' | 'reason';
type FormErrors = Partial<Record<FormField, string>>;

function isFormField(key: string): key is FormField {
  return key === 'startsAt' || key === 'endsAt' || key === 'reason';
}

function byStart(a: Block, b: Block): number {
  return Date.parse(a.startsAt) - Date.parse(b.startsAt);
}

export interface BlocksEditorProps {
  fieldId: string;
  /** Blocks that have not ended yet, as the API lists them. */
  initialBlocks: Block[];
}

/** Closed periods of one court. All times are São Paulo time. */
export function BlocksEditor({ fieldId, initialBlocks }: BlocksEditorProps) {
  const router = useRouter();
  const [blocks, setBlocks] = useState(initialBlocks);
  const [date, setDate] = useState('');
  const [startMinute, setStartMinute] = useState(DEFAULT_START);
  const [endMinute, setEndMinute] = useState(DEFAULT_END);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  async function add() {
    setNotice(null);
    setErrors({});
    if (date === '') {
      setErrors({ date: DATE_MISSING });
      return;
    }

    const trimmed = reason.trim();
    const payload = {
      startsAt: toSaoPauloIso(date, startMinute),
      endsAt: toSaoPauloIso(date, endMinute),
      ...(trimmed ? { reason: trimmed } : {}),
    };
    const parsed = blockInputSchema.safeParse(payload);
    if (!parsed.success) {
      const found: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (isFormField(key) && found[key] === undefined) {
          found[key] = issue.message;
        }
      }
      setErrors(found);
      return;
    }

    setSaving(true);
    const result = await apiSend(
      'POST',
      `/owner/fields/${fieldId}/blocks`,
      parsed.data,
      blockSchema,
    );
    setSaving(false);

    if (!result.ok) {
      const found: FormErrors = {};
      for (const [key, messages] of Object.entries(result.fieldErrors)) {
        const first = messages[0];
        if (isFormField(key) && first !== undefined) found[key] = first;
      }
      setErrors(found);
      setNotice({ tone: 'error', text: result.message });
      return;
    }
    setBlocks((current) => [...current, result.data].sort(byStart));
    setReason('');
    setNotice({ tone: 'success', text: 'Bloqueio adicionado' });
    router.refresh();
  }

  async function remove(block: Block) {
    setNotice(null);
    setRemoving(true);
    const result = await apiSend('DELETE', `/owner/blocks/${block.id}`);
    setRemoving(false);
    if (!result.ok) {
      setNotice({ tone: 'error', text: result.message });
      return;
    }
    setBlocks((current) => current.filter((other) => other.id !== block.id));
    setConfirming(null);
    setNotice({ tone: 'success', text: 'Bloqueio excluído' });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {blocks.length === 0 ? (
        <p className="text-muted">Nenhum bloqueio futuro.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {blocks.map((block, index) => {
            const number = String(index + 1);
            return (
              <li
                key={block.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <span>
                  {formatBlockRange(block.startsAt, block.endsAt, block.reason)}
                </span>
                {confirming === block.id ? (
                  <span className="flex flex-wrap gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      loading={removing}
                      onClick={() => {
                        void remove(block);
                      }}
                    >
                      Confirmar exclusão
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={removing}
                      autoFocus
                      onClick={() => {
                        setConfirming(null);
                      }}
                    >
                      Cancelar
                    </Button>
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Excluir bloqueio ${number}`}
                    onClick={() => {
                      setConfirming(block.id);
                      setNotice(null);
                    }}
                  >
                    <span aria-hidden="true">Excluir</span>
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
        className="flex flex-col gap-4 border-t border-line pt-6"
      >
        <h3 className="font-semibold">Bloquear um período</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Data" error={errors.date}>
            <Input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
              }}
            />
          </Field>
          <Field label="Início" error={errors.startsAt}>
            <Select
              options={TIME_OPTIONS}
              value={String(startMinute)}
              onChange={(event) => {
                setStartMinute(Number(event.target.value));
              }}
            />
          </Field>
          <Field label="Fim" error={errors.endsAt}>
            <Select
              options={TIME_OPTIONS}
              value={String(endMinute)}
              onChange={(event) => {
                setEndMinute(Number(event.target.value));
              }}
            />
          </Field>
        </div>
        <Field label="Motivo" hint="Opcional." error={errors.reason}>
          <Input
            value={reason}
            maxLength={120}
            onChange={(event) => {
              setReason(event.target.value);
            }}
          />
        </Field>
        <Alert tone={notice?.tone ?? 'error'}>{notice?.text}</Alert>
        <Button type="submit" loading={saving} className="self-start">
          Bloquear período
        </Button>
      </form>
    </div>
  );
}
