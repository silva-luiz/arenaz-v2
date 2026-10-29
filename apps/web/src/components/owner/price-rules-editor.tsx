'use client';

import {
  MAX_PRICE_RULES,
  WEEKDAY_LABELS,
  priceRuleSchema,
  priceRulesInputSchema,
  type PriceRule,
} from '@arenaz/contracts';
import { Alert, Button, Field, Input, Select, cn } from '@arenaz/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { apiSend } from '@/lib/api-client';
import { MoneyInput } from './money-input';
import { TIME_OPTIONS } from './time-options';

const ADD_BUTTON = 'add-button';
const DEFAULT_START = 18 * 60;
const DEFAULT_END = 22 * 60;
const PRICE_MISSING = 'Informe o preço por hora';
const FIXES_NEEDED = 'Corrija as faixas destacadas.';

const rulesSchema = priceRuleSchema.array();

interface RowState {
  /** Stable React key; rows have no id until the server saves them. */
  key: string;
  weekdays: number[];
  startMinute: number;
  endMinute: number;
  price: number | null;
  label: string;
}

type Notice = { tone: 'error' | 'success'; text: string } | null;
type RowErrors = Record<number, string[]>;

function toRows(rules: PriceRule[]): RowState[] {
  return rules.map((rule) => ({
    // The rule id: the same on the server and in the browser (it ends up in
    // the markup), unlike a counter.
    key: rule.id,
    weekdays: rule.weekdays,
    startMinute: rule.startMinute,
    endMinute: rule.endMinute,
    price: rule.priceCentsPerHour,
    label: rule.label ?? '',
  }));
}

function addError(errors: RowErrors, row: number, message: string) {
  const list = errors[row] ?? [];
  if (!list.includes(message)) errors[row] = [...list, message];
}

/** "1" and "1.endMinute" both point at the second row. */
function rowOfKey(key: string): number | undefined {
  const index = Number(key.split('.')[0]);
  return Number.isInteger(index) && index >= 0 ? index : undefined;
}

export interface PriceRulesEditorProps {
  fieldId: string;
  initialRules: PriceRule[];
}

/**
 * Price ranges that override the base price: days, start/end every 30 minutes
 * and a price per hour. Saving replaces the whole list. Problems are shown on
 * the row they belong to; an overlap is reported on the later of the two rows.
 */
export function PriceRulesEditor({
  fieldId,
  initialRules,
}: PriceRulesEditorProps) {
  const router = useRouter();
  const [rows, setRows] = useState(() => toRows(initialRules));
  const [errors, setErrors] = useState<RowErrors>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [saving, setSaving] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const newRows = useRef(0);
  const addButton = useRef<HTMLButtonElement>(null);
  // Where the focus goes once the next render is committed: a row key, or
  // ADD_BUTTON.
  const pendingFocus = useRef<string | null>(null);

  // The button that was clicked is gone after removing a row, so the focus
  // moves to a neighbouring row's Remover, or to "+ Faixa" with no rows left.
  useEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    pendingFocus.current = null;
    if (target === ADD_BUTTON) {
      addButton.current?.focus();
      return;
    }
    form.current
      ?.querySelector<HTMLElement>(`[data-row-key="${target}"] [data-remove]`)
      ?.focus();
  });

  function edit(index: number, patch: Partial<RowState>) {
    setRows((current) =>
      current.map((row, at) => (at === index ? { ...row, ...patch } : row)),
    );
    setNotice(null);
    // The problems shown are about values that just changed.
    setErrors({});
  }

  function toggleDay(index: number, day: number) {
    const row = rows[index];
    if (!row) return;
    edit(index, {
      weekdays: row.weekdays.includes(day)
        ? row.weekdays.filter((other) => other !== day)
        : [...row.weekdays, day].sort((a, b) => a - b),
    });
  }

  function addRow() {
    setRows((current) => [
      ...current,
      {
        key: `new-${String(newRows.current++)}`,
        weekdays: [],
        startMinute: DEFAULT_START,
        endMinute: DEFAULT_END,
        price: null,
        label: '',
      },
    ]);
    setNotice(null);
    setErrors({});
  }

  function removeRow(index: number) {
    const neighbour = rows[index + 1] ?? rows[index - 1];
    pendingFocus.current = neighbour ? neighbour.key : ADD_BUTTON;
    setRows((current) => current.filter((_, at) => at !== index));
    setNotice(null);
    setErrors({});
  }

  async function save() {
    setNotice(null);
    setErrors({});

    // A row without a price is checked here: the schema's own message for a
    // missing number is not in Portuguese.
    const payload = rows.map((row) => ({
      weekdays: row.weekdays,
      startMinute: row.startMinute,
      endMinute: row.endMinute,
      priceCentsPerHour: row.price ?? 1,
      ...(row.label.trim() ? { label: row.label.trim() } : {}),
    }));

    const found: RowErrors = {};
    rows.forEach((row, index) => {
      if (row.price === null) addError(found, index, PRICE_MISSING);
    });
    const parsed = priceRulesInputSchema.safeParse(payload);
    if (!parsed.success) {
      let general: string | undefined;
      for (const issue of parsed.error.issues) {
        const index = issue.path[0];
        if (typeof index === 'number') addError(found, index, issue.message);
        else general ??= issue.message;
      }
      if (general !== undefined && Object.keys(found).length === 0) {
        setNotice({ tone: 'error', text: general });
        return;
      }
    }
    if (!parsed.success || Object.keys(found).length > 0) {
      setErrors(found);
      setNotice({ tone: 'error', text: FIXES_NEEDED });
      return;
    }

    setSaving(true);
    const result = await apiSend(
      'PUT',
      `/owner/fields/${fieldId}/price-rules`,
      parsed.data,
      rulesSchema,
    );
    setSaving(false);

    if (!result.ok) {
      const fromServer: RowErrors = {};
      for (const [key, messages] of Object.entries(result.fieldErrors)) {
        const index = rowOfKey(key);
        if (index === undefined) continue;
        for (const message of messages) addError(fromServer, index, message);
      }
      setErrors(fromServer);
      setNotice({ tone: 'error', text: result.message });
      return;
    }
    setRows(toRows(result.data));
    setNotice({ tone: 'success', text: 'Faixas salvas' });
    router.refresh();
  }

  return (
    <form
      ref={form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="flex flex-col gap-5"
    >
      {/* Nothing can change while the list is being saved. */}
      <fieldset disabled={saving} className="flex min-w-0 flex-col gap-5">
        {rows.length === 0 ? (
          <p className="text-muted">
            Nenhuma faixa de preço. O preço base vale o dia todo.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {rows.map((row, index) => {
              const number = index + 1;
              const rowErrors = errors[index];
              const errorId = `price-rule-${row.key}-error`;
              return (
                <fieldset
                  key={row.key}
                  data-row-key={row.key}
                  aria-describedby={rowErrors ? errorId : undefined}
                  className="flex flex-col gap-4 rounded-card border border-line p-4"
                >
                  <legend className="px-1 text-sm font-semibold">
                    {`Faixa ${String(number)}`}
                  </legend>
                  <div
                    role="group"
                    aria-label={`Dias da faixa ${String(number)}`}
                    className="flex flex-wrap gap-2"
                  >
                    {WEEKDAY_LABELS.map((name, day) => {
                      const pressed = row.weekdays.includes(day);
                      return (
                        <button
                          key={name}
                          type="button"
                          aria-label={name}
                          aria-pressed={pressed}
                          onClick={() => {
                            toggleDay(index, day);
                          }}
                          className={cn(
                            'h-10 min-w-12 rounded-button border px-3 text-sm font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none',
                            pressed
                              ? 'border-brand bg-brand text-white'
                              : 'border-line-control bg-bg text-ink hover:bg-surface',
                          )}
                        >
                          <span aria-hidden="true">{name.slice(0, 3)}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Início">
                      <Select
                        options={TIME_OPTIONS}
                        value={String(row.startMinute)}
                        onChange={(event) => {
                          edit(index, {
                            startMinute: Number(event.target.value),
                          });
                        }}
                      />
                    </Field>
                    <Field label="Fim">
                      <Select
                        options={TIME_OPTIONS}
                        value={String(row.endMinute)}
                        onChange={(event) => {
                          edit(index, {
                            endMinute: Number(event.target.value),
                          });
                        }}
                      />
                    </Field>
                    <Field label="Preço por hora">
                      <MoneyInput
                        value={row.price}
                        onChange={(price) => {
                          edit(index, { price });
                        }}
                      />
                    </Field>
                    <Field label="Rótulo">
                      <Input
                        value={row.label}
                        maxLength={40}
                        placeholder="Ex.: Noite"
                        onChange={(event) => {
                          edit(index, { label: event.target.value });
                        }}
                      />
                    </Field>
                  </div>
                  {rowErrors ? (
                    <div id={errorId} className="flex flex-col gap-1">
                      {rowErrors.map((message) => (
                        <p key={message} className="text-sm text-red-700">
                          {message}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    data-remove=""
                    aria-label={`Remover faixa ${String(number)}`}
                    onClick={() => {
                      removeRow(index);
                    }}
                  >
                    <span aria-hidden="true">Remover</span>
                  </Button>
                </fieldset>
              );
            })}
          </div>
        )}

        <Button
          ref={addButton}
          variant="secondary"
          className="self-start"
          disabled={rows.length >= MAX_PRICE_RULES}
          onClick={addRow}
        >
          + Faixa
        </Button>
      </fieldset>

      <Alert tone={notice?.tone ?? 'error'}>{notice?.text}</Alert>
      <Button type="submit" loading={saving} className="self-start">
        Salvar faixas
      </Button>
    </form>
  );
}
