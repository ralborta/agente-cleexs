import { CentroShell } from '@/components/shell/centro-shell';

export function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <CentroShell workspaceName="Cleexs">
      <div className="rounded-2xl border border-hub-border bg-hub-card p-8 shadow-hub">
        <h2 className="text-2xl font-semibold text-white">{title}</h2>
        <p className="mt-3 max-w-2xl text-sm text-hub-muted">{description}</p>
      </div>
    </CentroShell>
  );
}
