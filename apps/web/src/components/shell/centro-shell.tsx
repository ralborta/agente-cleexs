import type { ReactNode } from 'react';
import { CentroSidebar } from './centro-sidebar';
import { CentroTopBar } from './centro-topbar';

type ShellProps = {
  workspaceName: string;
  agentsOnline?: number;
  pendingApprovals?: number;
  children: ReactNode;
};

export function CentroShell({
  workspaceName,
  agentsOnline = 1,
  pendingApprovals,
  children,
}: ShellProps) {
  return (
    <div className="flex min-h-screen bg-hub-bg">
      <CentroSidebar workspaceName={workspaceName} pendingApprovals={pendingApprovals} />
      <div className="flex min-w-0 flex-1 flex-col">
        <CentroTopBar agentsOnline={agentsOnline} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
