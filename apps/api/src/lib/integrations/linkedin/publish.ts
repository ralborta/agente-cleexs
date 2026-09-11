import { readFile } from 'fs/promises';
import { prisma } from '../../prisma';
import { resolveAssetAbsolutePath } from '../../agents/growth/creative/render';
import { resolveLinkedInAppConfig } from './config';
import {
  getLinkedInIntegrationConfig,
  upsertLinkedInIntegration,
} from './oauth';
import type { LinkedInIntegrationConfig } from './types';

export type LinkedInPublishResult = {
  postId: string;
  externalPostId: string;
  url?: string;
};

function linkedInHeaders(accessToken: string, extra?: Record<string, string>) {
  const config = resolveLinkedInAppConfig();
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'X-Restli-Protocol-Version': '2.0.0',
    ...(config?.apiVersion ? { 'LinkedIn-Version': config.apiVersion } : {}),
    ...extra,
  };
}

function mapLinkedInHttpError(status: number, bodyText: string): Error {
  if (status === 401) {
    return new Error(
      'Token de LinkedIn expirado o inválido. Reconectá LinkedIn desde Growth → Creativos.',
    );
  }
  if (status === 403) {
    return new Error(
      'LinkedIn rechazó la publicación (403). V1 publica en el perfil personal con Share on LinkedIn (w_member_social). Para Company Page necesitás Community Management API más adelante.',
    );
  }
  const snippet = bodyText.slice(0, 280);
  return new Error(`Error LinkedIn (${status}): ${snippet || 'sin detalle'}`);
}

async function assertTokenUsable(cfg: LinkedInIntegrationConfig) {
  if (cfg.expiresAt) {
    const expires = new Date(cfg.expiresAt).getTime();
    if (Number.isFinite(expires) && expires < Date.now() - 30_000) {
      throw new Error(
        'El token de LinkedIn expiró. Reconectá LinkedIn (perfil personal) desde Growth.',
      );
    }
  }
}

function buildCaption(params: {
  caption: string | null;
  plannerOutput: unknown;
}): string {
  if (params.caption?.trim()) return params.caption.trim();
  const plan = params.plannerOutput as
    | { headline?: string; cta?: string }
    | null
    | undefined;
  const parts = [plan?.headline, plan?.cta].filter(
    (p): p is string => Boolean(p && String(p).trim()),
  );
  if (parts.length) return parts.join('\n\n');
  return 'Nuevo contenido';
}

type RegisterUploadResponse = {
  value?: {
    asset?: string;
    uploadMechanism?: {
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'?: {
        uploadUrl?: string;
        headers?: Record<string, string>;
      };
    };
  };
};

async function registerImageUpload(
  cfg: LinkedInIntegrationConfig,
): Promise<{ assetUrn: string; uploadUrl: string; uploadHeaders: Record<string, string> }> {
  const res = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
    method: 'POST',
    headers: linkedInHeaders(cfg.accessToken),
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: cfg.personUrn,
        serviceRelationships: [
          {
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent',
          },
        ],
      },
    }),
  });

  const text = await res.text();
  if (!res.ok) throw mapLinkedInHttpError(res.status, text);

  let data: RegisterUploadResponse;
  try {
    data = JSON.parse(text) as RegisterUploadResponse;
  } catch {
    throw new Error('LinkedIn devolvió JSON inválido al registrar upload');
  }

  const mechanism =
    data.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'];
  const uploadUrl = mechanism?.uploadUrl;
  const assetUrn = data.value?.asset;
  if (!uploadUrl || !assetUrn) {
    throw new Error('LinkedIn no devolvió uploadUrl o asset URN');
  }

  return {
    assetUrn,
    uploadUrl,
    uploadHeaders: mechanism?.headers ?? {},
  };
}

async function putImageBinary(
  uploadUrl: string,
  uploadHeaders: Record<string, string>,
  bytes: Buffer,
  accessToken: string,
) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'image/png',
      ...uploadHeaders,
    },
    body: bytes,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw mapLinkedInHttpError(res.status, text);
  }
}

async function createUgcImagePost(params: {
  cfg: LinkedInIntegrationConfig;
  assetUrn: string;
  caption: string;
  title?: string;
}): Promise<{ id: string }> {
  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: linkedInHeaders(params.cfg.accessToken),
    body: JSON.stringify({
      author: params.cfg.personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: params.caption.slice(0, 3000) },
          shareMediaCategory: 'IMAGE',
          media: [
            {
              status: 'READY',
              description: { text: params.caption.slice(0, 200) },
              media: params.assetUrn,
              title: { text: (params.title || 'Creative Cleexs').slice(0, 200) },
            },
          ],
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    }),
  });

  const text = await res.text();
  if (!res.ok) throw mapLinkedInHttpError(res.status, text);

  let data: { id?: string };
  try {
    data = JSON.parse(text) as { id?: string };
  } catch {
    throw new Error('LinkedIn devolvió JSON inválido al crear ugcPost');
  }
  if (!data.id) {
    throw new Error('LinkedIn no devolvió id del post');
  }
  return { id: data.id };
}

function postUrlFromExternalId(externalPostId: string): string | undefined {
  // urn:li:share:123 or urn:li:ugcPost:123
  const match = externalPostId.match(/urn:li:(?:share|ugcPost):(\d+)/);
  if (!match?.[1]) return undefined;
  return `https://www.linkedin.com/feed/update/${externalPostId}`;
}

async function markLastError(workspaceId: string, message: string) {
  const cfg = await getLinkedInIntegrationConfig(workspaceId);
  if (!cfg) return;
  await upsertLinkedInIntegration(workspaceId, { ...cfg, lastError: message });
}

export async function publishDistributionPostToLinkedIn(
  workspaceId: string,
  postId: string,
): Promise<LinkedInPublishResult> {
  const post = await prisma.distributionPost.findFirst({
    where: { id: postId, workspaceId },
    include: {
      asset: true,
      request: { select: { id: true, plannerOutput: true, status: true } },
    },
  });
  if (!post) {
    throw new Error('DistributionPost no encontrado');
  }
  if (post.status !== 'draft' && post.status !== 'preview' && post.status !== 'failed') {
    throw new Error(
      post.status === 'published'
        ? 'Este post ya está publicado en LinkedIn'
        : `Estado del post inválido para publicar: ${post.status}`,
    );
  }

  const cfg = await getLinkedInIntegrationConfig(workspaceId);
  if (!cfg) {
    throw new Error(
      'LinkedIn no está conectado en este workspace. Conectá tu perfil personal desde Growth → Creativos.',
    );
  }

  await assertTokenUsable(cfg);

  const absolute = resolveAssetAbsolutePath(post.asset.filePath);
  let bytes: Buffer;
  try {
    bytes = await readFile(absolute);
  } catch {
    throw new Error('No se encontró el PNG del creative en disco');
  }

  const caption = buildCaption({
    caption: post.caption,
    plannerOutput: post.request.plannerOutput,
  });

  try {
    const { assetUrn, uploadUrl, uploadHeaders } = await registerImageUpload(cfg);
    await putImageBinary(uploadUrl, uploadHeaders, bytes, cfg.accessToken);
    const created = await createUgcImagePost({
      cfg,
      assetUrn,
      caption,
      title: (post.request.plannerOutput as { headline?: string } | null)?.headline,
    });

    const updated = await prisma.distributionPost.update({
      where: { id: post.id },
      data: {
        status: 'published',
        externalPostId: created.id,
        publishedAt: new Date(),
        caption,
      },
    });

    if (cfg.lastError) {
      await upsertLinkedInIntegration(workspaceId, { ...cfg, lastError: null });
    }

    return {
      postId: updated.id,
      externalPostId: created.id,
      url: postUrlFromExternalId(created.id),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al publicar en LinkedIn';
    await prisma.distributionPost
      .update({
        where: { id: post.id },
        data: { status: 'failed' },
      })
      .catch(() => undefined);
    await markLastError(workspaceId, message).catch(() => undefined);
    throw err instanceof Error ? err : new Error(message);
  }
}

export async function publishCreativeRequestToLinkedIn(
  workspaceId: string,
  requestId: string,
): Promise<LinkedInPublishResult> {
  const request = await prisma.creativeRequest.findFirst({
    where: { id: requestId, workspaceId },
    include: {
      posts: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!request) {
    throw new Error('Creative request no encontrado');
  }
  if (request.status !== 'approved') {
    throw new Error('Aprobá el creative antes de publicar en LinkedIn');
  }

  const post = request.posts[0];
  if (!post) {
    throw new Error(
      'No hay DistributionPost para este creative. Aprobá el preview primero.',
    );
  }

  return publishDistributionPostToLinkedIn(workspaceId, post.id);
}
