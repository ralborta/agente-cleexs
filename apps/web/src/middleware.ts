import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Traefik manda x-forwarded-host pero a veces no el Origin.
 * Next 14 trata eso como Server Action y crashea (workers undefined).
 */
export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || request.headers.get('host')?.split(',')[0]?.trim();
  const proto =
    request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
    (host?.includes('localhost') ? 'http' : 'https');

  if (origin || !host) {
    return NextResponse.next();
  }

  const headers = new Headers(request.headers);
  headers.set('origin', `${proto}://${host}`);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
