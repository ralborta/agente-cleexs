'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Eye, FileText, Save } from 'lucide-react';
import {
  buttonPrimaryClassName,
  buttonSecondaryClassName,
  inputClassName,
} from '@/components/config/settings-section';
import {
  approvePiece,
  rejectPiece,
  updateApprovalPiece,
  pieceAuthorName,
  type Approval,
} from '@/lib/api-client';
import { TEO_AUTHOR_NAME } from '@/lib/branding';

type Props = {
  item: Approval;
  acting: boolean;
  onActing: (id: string | null) => void;
  onUpdated: (piece: Approval['piece']) => void;
  onDone: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

export function ApprovalReviewCard({
  item,
  acting,
  onActing,
  onUpdated,
  onDone,
  onError,
  onSuccess,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<'preview' | 'edit'>('preview');
  const [title, setTitle] = useState(item.piece.title);
  const [excerpt, setExcerpt] = useState(item.piece.content?.excerpt ?? '');
  const [markdown, setMarkdown] = useState(item.piece.content?.markdown ?? '');
  const [previewHtml, setPreviewHtml] = useState(item.piece.content?.html ?? '');
  const [publishLive, setPublishLive] = useState(true);
  const [reviewNotes, setReviewNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setExpanded(false);
    setTab('preview');
    setTitle(item.piece.title);
    setExcerpt(item.piece.content?.excerpt ?? '');
    setMarkdown(item.piece.content?.markdown ?? '');
    setPreviewHtml(item.piece.content?.html ?? '');
    setDirty(false);
    setReviewNotes('');
  }, [item.id, item.piece]);

  function openReview(nextTab: 'preview' | 'edit') {
    setTab(nextTab);
    setExpanded(true);
  }

  async function handleSave() {
    setSaving(true);
    onError('');
    try {
      const res = await updateApprovalPiece(item.id, { title, excerpt, markdown });
      const content = res.piece.content as Approval['piece']['content'];
      setPreviewHtml(content?.html ?? '');
      onUpdated({ ...item.piece, title: res.piece.title, content });
      setDirty(false);
      onSuccess('Borrador actualizado. Revisá el preview antes de publicar.');
      setTab('preview');
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    if (dirty) {
      onError('Guardá los cambios antes de aprobar.');
      return;
    }
    onActing(item.id);
    onError('');
    try {
      const wpStatus = publishLive ? 'publish' : 'draft';
      const res = await approvePiece(item.id, wpStatus, reviewNotes);
      onSuccess(
        wpStatus === 'publish'
          ? `Publicado en cleexs.net (${res.wordpress.status}): ${res.wordpress.url}`
          : `Borrador en WordPress (${res.wordpress.status}): ${res.wordpress.url}`,
      );
      onDone();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Error al aprobar');
    } finally {
      onActing(null);
    }
  }

  async function handleReject() {
    onActing(item.id);
    onError('');
    try {
      await rejectPiece(item.id, reviewNotes);
      onDone();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Error al rechazar');
    } finally {
      onActing(null);
    }
  }

  const busy = acting || saving;
  const pieceExcerpt = item.piece.content?.excerpt ?? 'Sin extracto';

  return (
    <article className="rounded-2xl border border-hub-border bg-hub-card p-6 shadow-hub">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <span className="text-xs font-medium uppercase tracking-wide text-cleexs-blue">
            {item.piece.type}
          </span>
          <h3 className="mt-1 text-lg font-semibold text-white">{item.piece.title}</h3>
          <p className="mt-1 text-xs text-hub-muted">
            Por {pieceAuthorName(item.piece, TEO_AUTHOR_NAME)}
          </p>
          {!expanded ? (
            <p className="mt-2 line-clamp-2 text-sm text-hub-muted">{pieceExcerpt}</p>
          ) : null}
        </div>
        {!expanded ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleApprove}
              className="rounded-xl bg-cleexs-blue px-4 py-2 text-sm font-semibold text-white hover:bg-cleexs-blue-dark disabled:opacity-50"
            >
              {acting ? 'Publicando…' : publishLive ? 'Aprobar y publicar' : 'Aprobar borrador'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleReject}
              className="rounded-xl border border-hub-border px-4 py-2 text-sm text-slate-300 hover:bg-hub-border/30 disabled:opacity-50"
            >
              Rechazar
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        {!expanded ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => openReview('preview')}
            className="inline-flex items-center gap-2 text-sm font-medium text-cleexs-blue hover:text-blue-200"
          >
            <Eye className="h-4 w-4" />
            Ver preview y editar
            <ChevronDown className="h-4 w-4" />
          </button>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setTab('preview')}
                  className={`rounded-xl px-3 py-2 text-sm ${tab === 'preview' ? 'bg-cleexs-blue/20 text-white' : 'border border-hub-border text-slate-300'}`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Eye className="h-4 w-4" /> Preview
                  </span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setTab('edit')}
                  className={`rounded-xl px-3 py-2 text-sm ${tab === 'edit' ? 'bg-cleexs-blue/20 text-white' : 'border border-hub-border text-slate-300'}`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <FileText className="h-4 w-4" /> Editar
                  </span>
                </button>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setExpanded(false)}
                className="inline-flex items-center gap-1.5 text-sm text-hub-muted hover:text-white"
              >
                <ChevronUp className="h-4 w-4" />
                Cerrar
              </button>
            </div>

            {tab === 'preview' ? (
              <div className="overflow-hidden rounded-xl border border-hub-border bg-white">
                {previewHtml ? (
                  <iframe
                    title={`Preview ${item.piece.title}`}
                    srcDoc={previewHtml}
                    className="h-[min(520px,70vh)] w-full border-0 bg-white"
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <p className="p-6 text-sm text-slate-500">Sin HTML de preview.</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-200">Título</label>
                  <input
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setDirty(true);
                    }}
                    className={`${inputClassName} mt-2`}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-200">Extracto / lead</label>
                  <textarea
                    value={excerpt}
                    onChange={(e) => {
                      setExcerpt(e.target.value);
                      setDirty(true);
                    }}
                    rows={3}
                    className={`${inputClassName} mt-2 resize-y`}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-200">Contenido (Markdown)</label>
                  <textarea
                    value={markdown}
                    onChange={(e) => {
                      setMarkdown(e.target.value);
                      setDirty(true);
                    }}
                    rows={14}
                    className={`${inputClassName} mt-2 resize-y font-mono text-xs`}
                  />
                </div>
                <button
                  type="button"
                  disabled={busy || !dirty}
                  onClick={handleSave}
                  className={buttonSecondaryClassName}
                >
                  <span className="inline-flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    {saving ? 'Guardando…' : 'Guardar borrador'}
                  </span>
                </button>
              </div>
            )}

            <div className="space-y-4 border-t border-hub-border/70 pt-5">
              <div>
                <label className="text-sm font-medium text-slate-200">
                  Comentarios de revisión (opcional)
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={2}
                  placeholder="Notas internas al aprobar o rechazar…"
                  className={`${inputClassName} mt-2 resize-y text-sm`}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={publishLive}
                    onChange={(e) => setPublishLive(e.target.checked)}
                    className="h-4 w-4 rounded border-hub-border bg-[#0b1220] text-cleexs-blue"
                  />
                  Publicar en vivo en cleexs.net/articulos/
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleApprove}
                    className={buttonPrimaryClassName}
                  >
                    {acting ? 'Publicando…' : publishLive ? 'Aprobar y publicar' : 'Aprobar como borrador WP'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleReject}
                    className="rounded-xl border border-hub-border px-4 py-2 text-sm text-slate-300 hover:bg-hub-border/30 disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
