/** Los 7 agentes de Cleexs Marketing (producto standalone). */
export const MKT_AGENTS = [
  { key: 'estrategia', slug: 'marketing', name: 'Planificador de campañas', origin: 'Estrategia de Marketing', route: '/marketing/estrategia', description: 'Propone campañas y organiza el calendario de acciones según los objetivos de la empresa.' },
  { key: 'email', slug: 'marketing-email', name: 'Campañas de email', origin: 'Email Marketing', route: '/marketing/email', description: 'Crea campañas personalizadas de novedades, ofertas, seguimiento y reactivación. Deja borradores aprobables; el envío se habilita con el dominio del cliente.' },
  { key: 'contenidos', slug: 'teo', name: 'Noticias y contenidos', origin: 'Noticias y Contenidos', route: '/marketing/contenidos', description: 'Genera y publica noticias, artículos y contenidos para la web y redes sociales a partir de novedades reales.' },
  { key: 'ofertas', slug: 'marketing-offers', name: 'Ofertas y promociones', origin: 'Ofertas y Promociones', route: '/marketing/ofertas', description: 'Crea y publica promociones adaptadas a cada canal, controlando precio, condiciones y vigencia.' },
  { key: 'visibilidad', slug: 'discovery', name: 'Visibilidad en IA y Google', origin: 'Posicionamiento y Visibilidad', route: '/marketing/visibilidad', description: 'Monitorea la presencia de la marca en IA y Google, compara competidores y propone mejoras. Es el radar que alimenta a los demás agentes.' },
  { key: 'difusion', slug: 'growth', name: 'Oportunidades de difusión', origin: 'Difusión y Alianzas', route: '/marketing/difusion', description: 'Identifica medios, blogs y directorios donde posicionar la marca y prepara propuestas de contacto.' },
  { key: 'resultados', slug: 'marketing-analytics', name: 'Resultados y mejoras', origin: 'Análisis de Resultados', route: '/marketing/resultados', description: 'Mide el desempeño de las acciones de marketing y recomienda ajustes para mejorar los resultados.' },
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
