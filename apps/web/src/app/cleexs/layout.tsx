'use client';

import { AuthGate } from '@/components/auth/auth-gate';

export default function CleexsLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
