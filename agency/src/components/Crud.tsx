'use client';

import { useState, type ReactNode } from 'react';
import { Btn, Card, ConfigBadge, EmptyState, Field, GhostBtn, Icon, PageHeader, Select, Table, TextArea, TextInput } from './ui';
import { uid } from '@/lib/store';

export type CrudField<T> = {
  key: keyof T & string;
  label: string;
  type?: 'text' | 'textarea' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
};

export type CrudColumn<T> = { label: string; render: (item: T) => ReactNode };

export default function Crud<T extends { id: string }>({
  eyebrow,
  title,
  subtitle,
  items,
  onChange,
  fields,
  columns,
  blank,
  addLabel,
  emptyTitle,
  emptyBody,
  top,
  bottom,
  readonlyRows,
  idPrefix,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  items: T[];
  onChange: (items: T[]) => void;
  fields: CrudField<T>[];
  columns: CrudColumn<T>[];
  blank: Omit<T, 'id'>;
  addLabel: string;
  emptyTitle: string;
  emptyBody: string;
  top?: ReactNode;
  bottom?: ReactNode;
  /** filas fijas (p. ej. datos que vienen de Cleexs) que se muestran antes de las editables */
  readonlyRows?: ReactNode;
  idPrefix: string;
}) {
  const [editing, setEditing] = useState<T | null>(null);
  const [isNew, setIsNew] = useState(false);

  const startNew = () => {
    setEditing({ ...(blank as object), id: uid(idPrefix) } as T);
    setIsNew(true);
  };
  const save = () => {
    if (!editing) return;
    const missing = fields.some((f) => f.required && !String(editing[f.key] ?? '').trim());
    if (missing) return;
    onChange(isNew ? [...items, editing] : items.map((i) => (i.id === editing.id ? editing : i)));
    setEditing(null);
  };

  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        badge={<ConfigBadge />}
        actions={<Btn icon="add" onClick={startNew}>{addLabel}</Btn>}
      />
      {top}

      {editing && (
        <Card className="mb-6 border-accent-cyan/40">
          <div className="flex items-center justify-between mb-4">
            <div className="text-fg font-semibold text-sm">{isNew ? addLabel : 'Editar'}</div>
            <button type="button" onClick={() => setEditing(null)} className="text-dim hover:text-fg" aria-label="Cerrar">
              <Icon name="x" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((f) => {
              const val = String(editing[f.key] ?? '');
              const set = (v: string) => setEditing({ ...editing, [f.key]: v } as T);
              return (
                <div key={f.key} className={f.type === 'textarea' ? 'md:col-span-2' : ''}>
                  <Field label={`${f.label}${f.required ? ' *' : ''}`}>
                    {f.type === 'textarea' ? (
                      <TextArea value={val} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />
                    ) : f.type === 'select' ? (
                      <Select value={val} onChange={(e) => set(e.target.value)}>
                        {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </Select>
                    ) : (
                      <TextInput value={val} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />
                    )}
                  </Field>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 mt-4">
            <Btn onClick={save}>Guardar</Btn>
            <GhostBtn onClick={() => setEditing(null)}>Cancelar</GhostBtn>
          </div>
        </Card>
      )}

      <Card>
        {items.length === 0 && !readonlyRows ? (
          <EmptyState title={emptyTitle} body={emptyBody} action={<Btn icon="add" onClick={startNew}>{addLabel}</Btn>} />
        ) : (
          <Table head={[...columns.map((c) => c.label), { label: 'Acciones', right: true }]}>
            {readonlyRows}
            {items.map((item) => (
              <tr key={item.id} className="align-top">
                {columns.map((c) => (
                  <td key={c.label} className="py-3 pr-3">{c.render(item)}</td>
                ))}
                <td className="py-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    className="p-1.5 text-dim hover:text-accent-cyan"
                    title="Editar"
                    onClick={() => {
                      setEditing(item);
                      setIsNew(false);
                    }}
                  >
                    <Icon name="edit" className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    className="p-1.5 text-dim hover:text-red-400"
                    title="Eliminar"
                    onClick={() => {
                      if (confirm('¿Eliminar este registro?')) onChange(items.filter((i) => i.id !== item.id));
                    }}
                  >
                    <Icon name="trash" className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {bottom}
    </>
  );
}
