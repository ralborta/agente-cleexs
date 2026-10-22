import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cleexs Agencias · Visibilidad IA',
  description:
    'Cleexs para agencias: monitoreá la presencia de tus clientes en respuestas de IA con prompts controlados por la agencia.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
