import type { Metadata } from 'next';
import { PLATFORM_NAME } from '@/lib/branding';
import './globals.css';

export const metadata: Metadata = {
  title: PLATFORM_NAME,
  description: 'Plataforma multiagente de contenido SEO/AEO',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
