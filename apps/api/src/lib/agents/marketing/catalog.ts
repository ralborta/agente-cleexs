/**
 * Catálogo de los 7 agentes de Cleexs Marketing.
 * No son 7 sistemas aislados: es un loop detectar → crear → publicar → medir.
 * Cada agente mapea a una capacidad real (existente o nueva en v1).
 */
export type MarketingAgentDef = {
  key: string;
  slug: string;
  name: string;
  shortName: string;
  description: string;
  /** existing = ya opera en la plataforma · new = creado en esta v1 · shared = función compartida */
  mode: 'existing' | 'new' | 'shared';
  hrefSuffix: string;
};

export const MARKETING_AGENTS: MarketingAgentDef[] = [
  {
    key: 'planner',
    slug: 'marketing',
    name: 'Planificador de campañas',
    shortName: 'Estrategia de marketing',
    description:
      'Analiza objetivos, público y oportunidades detectadas. Propone campañas y organiza el calendario de los demás agentes.',
    mode: 'new',
    hrefSuffix: 'marketing',
  },
  {
    key: 'email',
    slug: 'marketing-email',
    name: 'Campañas de email',
    shortName: 'Email marketing',
    description:
      'Segmenta contactos y redacta secuencias de novedades, ofertas, seguimiento y reactivación. En v1 deja borradores aprobables: el envío real requiere el dominio del cliente conectado.',
    mode: 'new',
    hrefSuffix: 'marketing',
  },
  {
    key: 'content',
    slug: 'teo',
    name: 'Noticias y contenidos',
    shortName: 'Noticias y contenidos',
    description:
      'Convierte novedades reales de la empresa y del sector en artículos y publicaciones, adaptados a la web y los canales conectados.',
    mode: 'existing',
    hrefSuffix: 'publicaciones',
  },
  {
    key: 'offers',
    slug: 'marketing-offers',
    name: 'Ofertas y promociones',
    shortName: 'Ofertas y promociones',
    description:
      'Prepara promociones a partir de precio, condiciones y vigencia aprobados. Una noticia comunica; una oferta busca una acción comercial con vencimiento.',
    mode: 'new',
    hrefSuffix: 'marketing',
  },
  {
    key: 'visibility',
    slug: 'discovery',
    name: 'Visibilidad en IA y Google',
    shortName: 'Posicionamiento y visibilidad',
    description:
      'Monitorea apariciones, recomendaciones y competidores en IA y Google (por separado) y detecta las oportunidades que alimentan al Planificador.',
    mode: 'existing',
    hrefSuffix: 'monitor',
  },
  {
    key: 'outreach',
    slug: 'growth',
    name: 'Oportunidades de difusión',
    shortName: 'Difusión y alianzas',
    description:
      'Identifica medios, blogs, directorios y conversaciones donde posicionar la marca y prepara propuestas de contacto con seguimiento.',
    mode: 'existing',
    hrefSuffix: 'growth',
  },
  {
    key: 'analytics',
    slug: 'marketing-analytics',
    name: 'Resultados y mejoras',
    shortName: 'Análisis de resultados',
    description:
      'Reúne el desempeño de campañas y contenidos y recomienda qué repetir, ajustar o detener según los objetivos.',
    mode: 'shared',
    hrefSuffix: 'resultados',
  },
];

export function offerDerivedStatus(
  offer: { status: string; endsAt: Date | null },
  now = new Date(),
): string {
  if ((offer.status === 'approved' || offer.status === 'active') && offer.endsAt && offer.endsAt < now) {
    return 'expired';
  }
  return offer.status;
}

/** Genera el borrador de email de una campaña (determinístico, sin envío). */
export function buildEmailDraft(input: {
  workspaceName: string;
  campaignTitle: string;
  objective: string;
  audience?: string | null;
  offer?: { title: string; description: string; priceText?: string | null; discountText?: string | null; terms?: string | null; endsAt?: Date | null } | null;
}) {
  const segment = input.audience?.trim() || 'Clientes y contactos interesados';
  const offerBlock = input.offer
    ? [
        '',
        `Oferta vigente: ${input.offer.title}`,
        input.offer.description,
        input.offer.priceText ? `Precio: ${input.offer.priceText}` : null,
        input.offer.discountText ? `Beneficio: ${input.offer.discountText}` : null,
        input.offer.endsAt
          ? `Vigente hasta el ${input.offer.endsAt.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}.`
          : null,
        input.offer.terms ? `Condiciones: ${input.offer.terms}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  return {
    segment,
    subject: input.offer
      ? `${input.campaignTitle} — ${input.offer.discountText ?? input.offer.title}`
      : input.campaignTitle,
    preheader: input.objective.slice(0, 120),
    body: [
      `Hola,`,
      '',
      `Desde ${input.workspaceName} queremos compartirte: ${input.campaignTitle}.`,
      '',
      input.objective,
      offerBlock,
      '',
      'Si te interesa, respondé este correo y te ayudamos personalmente.',
      '',
      `— Equipo de ${input.workspaceName}`,
    ]
      .filter((line) => line !== null)
      .join('\n'),
    ctaText: input.offer ? 'Quiero aprovecharlo' : 'Ver más',
    ctaUrl: null as string | null,
    source: 'template' as const,
  };
}

/** Brief de campaña a partir de una oportunidad de keyword detectada. */
export function campaignFromOpportunity(opp: {
  keyword: string;
  cluster: string;
  stage: string;
  intentLabel?: string | null;
  scoreReason?: string | null;
}) {
  const stageLabel =
    opp.stage === 'bofu' ? 'decisión de compra' : opp.stage === 'mofu' ? 'evaluación' : 'descubrimiento';
  return {
    title: `Campaña: ${opp.keyword}`,
    objective:
      `Mejorar la visibilidad de la marca en consultas de ${stageLabel} sobre "${opp.keyword}" (cluster ${opp.cluster}).` +
      (opp.intentLabel ? ` Intención detectada: ${opp.intentLabel}.` : '') +
      (opp.scoreReason ? ` Motivo: ${opp.scoreReason}` : ''),
    audience: `Personas en etapa de ${stageLabel} interesadas en ${opp.cluster}`,
  };
}
