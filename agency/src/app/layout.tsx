import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import Shell from '@/components/Shell';

export const metadata: Metadata = {
  title: 'Cleexs Agencias · Visibilidad IA · Empliados',
  description:
    'Cleexs para agencias: monitoreá la presencia de tus clientes en respuestas de IA. Acceso restringido (especialista).',
  robots: { index: false, follow: false },
};

// Aplica el tema guardado antes de pintar (evita flash). Dark por defecto.
const themeScript = `try{var t=localStorage.getItem('cleexs-agency:theme');if(t==='light'){document.documentElement.classList.remove('dark')}}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
