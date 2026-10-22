/** Los 7 agentes de Cleexs Marketing (producto standalone). */
export const MKT_AGENTS = [
  { key: 'estrategia', slug: 'marketing', name: 'Planificador de campañas', origin: 'Agente de Estrategia de Marketing', route: '/marketing/estrategia', description: 'Propone campañas en base a tus servicios y productos: te pide objetivo y público, y obtiene solo las oportunidades, la demanda y el contenido que ya tenés.' },
  { key: 'email', slug: 'marketing-email', name: 'Email Marketing', origin: 'Agente de Email Marketing', route: '/marketing/email', description: 'Crea campañas personalizadas de novedades, ofertas, seguimiento y reactivación. Deja borradores aprobables; el envío se habilita con el dominio del cliente.' },
  { key: 'contenidos', slug: 'teo', name: 'Contenidos', origin: 'Agente de Noticias y Contenidos', route: '/marketing/contenidos', description: 'Genera y publica noticias, artículos y contenidos para la web y redes sociales a partir de novedades reales.' },
  { key: 'ofertas', slug: 'marketing-offers', name: 'Promociones', origin: 'Agente de Ofertas y Promociones', route: '/marketing/ofertas', description: 'Crea y publica promociones adaptadas a cada canal, controlando precio, condiciones y vigencia.' },
  { key: 'visibilidad', slug: 'rankear', name: 'Rankear', origin: 'Agente de Posicionamiento y Visibilidad', route: '/marketing/visibilidad', description: 'Monitorea la presencia de la marca en IA y Google, compara competidores y propone mejoras. Es el radar que alimenta a los demás agentes.' },
  { key: 'difusion', slug: 'growth', name: 'Menciones', origin: 'Agente de Difusión y Alianzas', route: '/marketing/difusion', description: 'Identifica medios, blogs y directorios donde posicionar la marca y prepara propuestas de contacto.' },
  { key: 'resultados', slug: 'marketing-analytics', name: 'Analítica', origin: 'Agente de Análisis de Resultados', route: '/marketing/resultados', description: 'Mide el desempeño de las acciones de marketing y recomienda ajustes para mejorar los resultados.' },
] as const;


export function offerDerivedStatus(offer: { status: string; endsAt: Date | null }, now = new Date()): string {
  if ((offer.status === 'approved' || offer.status === 'active') && offer.endsAt && offer.endsAt < now) return 'expired';
  return offer.status;
}

export function buildEmailDraft(input: {
  workspaceName: string;
  campaignTitle: string;
  objective: string;
  audience?: string | null;
  offer?: { title: string; description: string; priceText?: string | null; discountText?: string | null; terms?: string | null; endsAt?: Date | null } | null;
}) {
  const offerLines = input.offer
    ? [
        '',
        `Oferta vigente: ${input.offer.title}`,
        input.offer.description,
        input.offer.priceText ? `Precio: ${input.offer.priceText}` : '',
        input.offer.discountText ? `Beneficio: ${input.offer.discountText}` : '',
        input.offer.endsAt ? `Vigente hasta el ${input.offer.endsAt.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}.` : '',
        input.offer.terms ? `Condiciones: ${input.offer.terms}` : '',
      ].filter(Boolean)
    : [];
  return {
    segment: input.audience?.trim() || 'Clientes y contactos interesados',
    subject: input.offer ? `${input.campaignTitle} — ${input.offer.discountText ?? input.offer.title}` : input.campaignTitle,
    preheader: input.objective.slice(0, 120),
    body: [
      'Hola,',
      '',
      `Desde ${input.workspaceName} queremos compartirte: ${input.campaignTitle}.`,
      '',
      input.objective,
      ...offerLines,
      '',
      'Si te interesa, respondé este correo y te ayudamos personalmente.',
      '',
      `— Equipo de ${input.workspaceName}`,
    ].join('\n'),
    ctaText: input.offer ? 'Quiero aprovecharlo' : 'Ver más',
    ctaUrl: null as string | null,
    source: 'template' as const,
  };
}

export function campaignFromOpportunity(opp: { keyword: string; cluster: string; stage: string; intentLabel?: string | null; scoreReason?: string | null }) {
  const stageLabel = opp.stage === 'bofu' ? 'decisión de compra' : opp.stage === 'mofu' ? 'evaluación' : 'descubrimiento';
  return {
    title: `Campaña: ${opp.keyword}`,
    objective:
      `Mejorar la visibilidad de la marca en consultas de ${stageLabel} sobre "${opp.keyword}" (cluster ${opp.cluster}).` +
      (opp.intentLabel ? ` Intención detectada: ${opp.intentLabel}.` : '') +
      (opp.scoreReason ? ` Motivo: ${opp.scoreReason}` : ''),
    audience: `Personas en etapa de ${stageLabel} interesadas en ${opp.cluster}`,
  };
}

/** Objetivos que el Planificador le pide a la empresa. */
export const CAMPAIGN_GOALS = [
  { key: 'visibilidad', label: 'Ser más visible en IA y Google' },
  { key: 'consultas', label: 'Conseguir más consultas' },
  { key: 'ventas', label: 'Vender más' },
  { key: 'lanzamiento', label: 'Lanzar un servicio o producto' },
  { key: 'reactivacion', label: 'Reactivar clientes dormidos' },
  { key: 'autoridad', label: 'Posicionarme como referente' },
] as const;

export type ProposalInput = {
  product: { name: string; kind: string; description: string; priceText?: string | null; audience?: string | null };
  goalLabel: string;
  goalKey: string;
  askedAudience?: string | null;
  askedNotes?: string | null;
  obtained: {
    opportunities: Array<{ keyword: string; cluster: string; stage: string; monthlySearches?: number | null; opportunityScore?: number | null }>;
    questions: Array<{ question: string; cluster: string }>;
    piecesCount: number;
    publicationsCount: number;
  };
};

/**
 * Arma la propuesta del Planificador:
 * - base: el servicio/producto elegido
 * - datos que pide: objetivo, público (si no viene, sale del producto)
 * - datos que obtiene: oportunidades de Rankear, preguntas reales y contenido existente
 */
export function buildCampaignProposal(input: ProposalInput) {
  const top = input.obtained.opportunities[0];
  const audience = input.askedAudience?.trim() || input.product?.audience || 'Clientes actuales y potenciales interesados';
  const obtainedSummary = [
    top ? `Rankear detectó demanda en "${top.keyword}"${top.monthlySearches ? ` (${top.monthlySearches.toLocaleString('es-AR')} búsquedas/mes)` : ''}` : 'Rankear todavía no detectó una oportunidad dominante para este tema',
    input.obtained.questions.length > 0 ? `${input.obtained.questions.length} preguntas reales de usuarios para responder` : null,
    `Ya existen ${input.obtained.piecesCount} piezas de contenido (${input.obtained.publicationsCount} publicadas) para apoyarse`,
  ].filter(Boolean).join('. ');

  const title = top
    ? `${input.product.name}: ${top.keyword}`
    : `Campaña de ${input.product.name}`;

  const objective = [
    `${input.goalLabel} con ${input.product.name} (${input.product.kind === 'producto' ? 'producto' : 'servicio'}).`,
    input.product.description,
    `Público: ${audience}.`,
    `Datos que el sistema ya obtuvo: ${obtainedSummary}.`,
    input.askedNotes?.trim() ? `Indicaciones de la empresa: ${input.askedNotes.trim()}` : null,
    top ? `Acción sugerida: Contenidos crea la pieza sobre "${top.keyword}"${input.product.priceText ? `, Promociones suma la oferta vigente (${input.product.priceText})` : ''} y Email Marketing la adapta al segmento.` : 'Acción sugerida: Contenidos crea la primera pieza y Email Marketing prepara la secuencia.',
  ].filter(Boolean).join(' ');

  return {
    title,
    objective,
    audience,
    brief: {
      product: input.product,
      goal: { key: input.goalKey, label: input.goalLabel },
      asked: { audience: input.askedAudience ?? null, notes: input.askedNotes ?? null },
      obtained: {
        opportunities: input.obtained.opportunities.slice(0, 5),
        questions: input.obtained.questions.slice(0, 5),
        piecesCount: input.obtained.piecesCount,
        publicationsCount: input.obtained.publicationsCount,
      },
    },
  };
}
