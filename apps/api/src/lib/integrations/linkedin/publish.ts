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
  landingUrl?: string | null;
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
      'LinkedIn rechazó la publicación (403). Para Company Page Empliados necesitás Community Management API (w_organization_social) y rol admin en la Page.',
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
        'El token de LinkedIn expiró. Reconectá LinkedIn (Company Page Empliados) desde Growth.',
      );
    }
  }
}

function extractHttpUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(/https?:\/\/[^\s<>"']+/i);
  if (!m?.[0]) return null;
  return m[0].replace(/[.,;:)\]}]+$/g, '');
}

function buildCaption(params: {
  caption: string | null;
  plannerOutput: unknown;
  landingUrl?: string | null;
}): { text: string; landingUrl: string | null } {
  const plan = params.plannerOutput as
    | { headline?: string; cta?: string }
    | null
    | undefined;

  let text = params.caption?.trim() || '';
  if (!text) {
    const parts = [plan?.headline, plan?.cta].filter(
      (p): p is string => Boolean(p && String(p).trim()),
    );
    text = parts.length ? parts.join('\n\n') : 'Nuevo contenido';
  }

  const landingUrl =
    params.landingUrl?.trim() ||
    extractHttpUrl(params.caption) ||
    extractHttpUrl(text) ||
    null;

  if (landingUrl && !text.includes(landingUrl)) {
    const cta = plan?.cta?.trim() || 'Leer más';
    text = `${text}\n\n${cta}: ${landingUrl}`;
  }

  return { text: text.slice(0, 3000), landingUrl };
}

/** Images API (REST) → urn:li:image:* para Posts API con contentLandingPage. */
async function uploadOrganizationImage(params: {
  cfg: LinkedInIntegrationConfig;
  ownerUrn: string;
  bytes: Buffer;
}): Promise<string> {
  const initRes = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
    method: 'POST',
    headers: linkedInHeaders(params.cfg.accessToken),
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: params.ownerUrn,
      },
    }),
  });
  const initText = await initRes.text();
  if (!initRes.ok) throw mapLinkedInHttpError(initRes.status, initText);

  let initData: {
    value?: { uploadUrl?: string; image?: string };
  };
  try {
    initData = JSON.parse(initText) as { value?: { uploadUrl?: string; image?: string } };
  } catch {
    throw new Error('LinkedIn devolvió JSON inválido al inicializar upload de imagen');
  }

  const uploadUrl = initData.value?.uploadUrl;
  const imageUrn = initData.value?.image;
  if (!uploadUrl || !imageUrn) {
    throw new Error('LinkedIn no devolvió uploadUrl o image URN');
  }

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${params.cfg.accessToken}`,
      'Content-Type': 'image/png',
    },
    body: params.bytes,
  });
  if (!putRes.ok) {
    const text = await putRes.text().catch(() => '');
    throw mapLinkedInHttpError(putRes.status, text);
  }

  return imageUrn;
}

/**
 * Posts API: imagen clickeable vía contentLandingPage.
 * Al tocar la imagen / CTA, LinkedIn abre el artículo.
 */
async function createOrgImagePostWithLanding(params: {
  cfg: LinkedInIntegrationConfig;
  authorUrn: string;
  imageUrn: string;
  commentary: string;
  landingUrl: string;
  title?: string;
}): Promise<{ id: string }> {
  const res = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: linkedInHeaders(params.cfg.accessToken),
    body: JSON.stringify({
      author: params.authorUrn,
      commentary: params.commentary,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content: {
        media: {
          title: (params.title || 'Creative Cleexs').slice(0, 200),
          id: params.imageUrn,
        },
      },
      contentLandingPage: params.landingUrl,
      contentCallToActionLabel: 'LEARN_MORE',
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  });

  const text = await res.text();
  if (!res.ok) throw mapLinkedInHttpError(res.status, text);

  const headerId =
    res.headers.get('x-restli-id') ||
    res.headers.get('X-RestLi-Id') ||
    res.headers.get('location')?.split('/').pop();

  if (headerId) {
    const id = decodeURIComponent(headerId);
    return { id: id.startsWith('urn:') ? id : `urn:li:share:${id}` };
  }

  try {
    const data = JSON.parse(text) as { id?: string };
    if (data.id) return { id: data.id };
  } catch {
    // ignore
  }

  throw new Error('LinkedIn no devolvió id del post (Posts API)');
}

/** Fallback legacy ugcPosts (sin contentLandingPage nativo). */
async function createUgcImagePostFallback(params: {
  cfg: LinkedInIntegrationConfig;
  authorUrn: string;
  bytes: Buffer;
  caption: string;
  landingUrl: string | null;
  title?: string;
}): Promise<{ id: string }> {
  const resReg = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
    method: 'POST',
    headers: linkedInHeaders(params.cfg.accessToken),
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: params.authorUrn,
        serviceRelationships: [
          {
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent',
          },
        ],
      },
    }),
  });
  const regText = await resReg.text();
  if (!resReg.ok) throw mapLinkedInHttpError(resReg.status, regText);

  const regData = JSON.parse(regText) as {
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
  const mechanism =
    regData.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'];
  const uploadUrl = mechanism?.uploadUrl;
  const assetUrn = regData.value?.asset;
  if (!uploadUrl || !assetUrn) {
    throw new Error('LinkedIn no devolvió uploadUrl o asset URN (fallback)');
  }

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${params.cfg.accessToken}`,
      'Content-Type': 'image/png',
      ...(mechanism?.headers ?? {}),
    },
    body: params.bytes,
  });
  if (!putRes.ok) {
    throw mapLinkedInHttpError(putRes.status, await putRes.text().catch(() => ''));
  }

  const mediaItem: Record<string, unknown> = {
    status: 'READY',
    description: { text: params.caption.slice(0, 200) },
    media: assetUrn,
    title: { text: (params.title || 'Creative Cleexs').slice(0, 200) },
  };
  if (params.landingUrl) {
    mediaItem.originalUrl = params.landingUrl;
  }

  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: linkedInHeaders(params.cfg.accessToken),
    body: JSON.stringify({
      author: params.authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: params.caption.slice(0, 3000) },
          shareMediaCategory: 'IMAGE',
          media: [mediaItem],
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    }),
  });

  const text = await res.text();
  if (!res.ok) throw mapLinkedInHttpError(res.status, text);
  const data = JSON.parse(text) as { id?: string };
  if (!data.id) throw new Error('LinkedIn no devolvió id del post (ugcPosts)');
  return { id: data.id };
}

function postUrlFromExternalId(externalPostId: string): string | undefined {
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
      request: {
        select: {
          id: true,
          plannerOutput: true,
          status: true,
          publication: { select: { url: true } },
        },
      },
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
      'LinkedIn no está conectado. Conectá como admin de la Company Page Empliados desde Growth → Creativos.',
    );
  }

  await assertTokenUsable(cfg);

  const authorUrn = cfg.organizationUrn?.trim();
  if (!authorUrn) {
    throw new Error(
      'Falta la Company Page Empliados en la conexión. Pedí Community Management API en LinkedIn Developers, reconectá como SUPER ADMIN de Empliados y volvé a publicar.',
    );
  }
  if (!cfg.scopes?.includes('w_organization_social')) {
    throw new Error(
      'El token no tiene w_organization_social. Pedí Community Management API, desconectá y volvé a conectar LinkedIn.',
    );
  }

  const absolute = resolveAssetAbsolutePath(post.asset.filePath);
  let bytes: Buffer;
  try {
    bytes = await readFile(absolute);
  } catch {
    throw new Error('No se encontró el PNG del creative en disco');
  }

  const publicationUrl = post.request.publication?.url?.trim() || null;
  const { text: caption, landingUrl } = buildCaption({
    caption: post.caption,
    plannerOutput: post.request.plannerOutput,
    landingUrl: publicationUrl,
  });

  if (!landingUrl) {
    throw new Error(
      'El creative no tiene URL del artículo. Publicá el artículo primero o regenerá el creative con publication URL.',
    );
  }

  const title = (post.request.plannerOutput as { headline?: string } | null)?.headline;

  try {
    let created: { id: string };
    try {
      const imageUrn = await uploadOrganizationImage({ cfg, ownerUrn: authorUrn, bytes });
      created = await createOrgImagePostWithLanding({
        cfg,
        authorUrn,
        imageUrn,
        commentary: caption,
        landingUrl,
        title,
      });
    } catch (primaryErr) {
      console.warn(
        '[linkedin] Posts API con landing falló, uso ugcPosts fallback:',
        primaryErr instanceof Error ? primaryErr.message : primaryErr,
      );
      created = await createUgcImagePostFallback({
        cfg,
        authorUrn,
        bytes,
        caption,
        landingUrl,
        title,
      });
    }

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
      landingUrl,
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
