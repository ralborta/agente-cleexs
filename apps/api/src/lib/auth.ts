import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  workspaceId: string;
  workspaceSlug: string;
};

export type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  workspaceId: string;
  workspaceSlug: string;
};

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET no configurado');
  }
  return secret;
}

export async function authenticateUser(email: string, password: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: { workspace: { select: { slug: true } } },
  });

  if (!user) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    workspaceId: user.workspaceId,
    workspaceSlug: user.workspace.slug,
  };
}

export function signAuthToken(user: AuthUser): string {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    workspaceId: user.workspaceId,
    workspaceSlug: user.workspaceSlug,
  };

  return jwt.sign(payload, jwtSecret(), { expiresIn: '7d' });
}

export function verifyAuthToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, jwtSecret()) as JwtPayload;
  } catch {
    return null;
  }
}

export function extractBearerToken(header?: string): string | null {
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

export function isPublicApiPath(pathname: string): boolean {
  if (pathname === '/health') return true;
  if (pathname.startsWith('/api/auth/login')) return true;
  if (pathname.startsWith('/api/webhooks/')) return true;
  if (pathname.startsWith('/api/cron/')) return true;
  return false;
}
