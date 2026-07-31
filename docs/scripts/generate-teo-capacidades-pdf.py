#!/usr/bin/env python3
"""Genera docs/teo-capacidades-disponibles.pdf — resumen comercial de Teo."""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "teo-capacidades-disponibles.pdf"

styles = getSampleStyleSheet()
TITLE = ParagraphStyle(
    "TitleCustom",
    parent=styles["Title"],
    fontSize=22,
    textColor=colors.HexColor("#1e3a8a"),
    spaceAfter=6,
    alignment=TA_CENTER,
)
SUB = ParagraphStyle(
    "SubCustom",
    parent=styles["Normal"],
    fontSize=10,
    textColor=colors.HexColor("#64748b"),
    alignment=TA_CENTER,
    spaceAfter=14,
)
H2 = ParagraphStyle(
    "H2Custom",
    parent=styles["Heading2"],
    fontSize=12,
    textColor=colors.HexColor("#1e40af"),
    spaceBefore=10,
    spaceAfter=6,
)
BODY = ParagraphStyle(
    "BodyCustom",
    parent=styles["Normal"],
    fontSize=9.5,
    leading=13,
    textColor=colors.HexColor("#334155"),
)
BULLET = ParagraphStyle(
    "BulletCustom",
    parent=BODY,
    leftIndent=12,
    bulletIndent=0,
    spaceAfter=3,
)
FOOT = ParagraphStyle(
    "FootCustom",
    parent=styles["Normal"],
    fontSize=8,
    textColor=colors.HexColor("#94a3b8"),
    alignment=TA_CENTER,
)


def bullet(text: str):
    return Paragraph(f"• {text}", BULLET)


def build_pdf():
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=1.6 * cm,
        bottomMargin=1.4 * cm,
        title="Teo — Capacidades disponibles",
        author="Cleexs",
    )

    story = []

    story.append(Paragraph("Teo — Agente de contenido Cleexs", TITLE))
    story.append(
        Paragraph(
            "Resumen de funcionalidades disponibles · Piloto Cleexs · Julio 2026",
            SUB,
        )
    )
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e2e8f0")))
    story.append(Spacer(1, 10))

    story.append(
        Paragraph(
            "<b>Teo</b> es el primer agente de la plataforma Agentes Cleexs. Produce contenido "
            "SEO/AEO de forma autónoma, lo deja listo para revisión y lo publica en WordPress cuando "
            "se aprueba. El backoffice sirve principalmente para medir resultados.",
            BODY,
        )
    )
    story.append(Spacer(1, 8))

    urls = [
        ["Backoffice", "https://agente-cleexs.nivel41.com"],
        ["Blog publicado", "https://cleexs.net/articulos/"],
    ]
    t = Table(urls, colWidths=[3.2 * cm, 12.5 * cm])
    t.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#64748b")),
                ("TEXTCOLOR", (1, 0), (1, -1), colors.HexColor("#2563eb")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(t)
    story.append(Spacer(1, 6))

    # --- Qué hace Teo solo ---
    story.append(Paragraph("Qué hace Teo de forma autónoma", H2))
    for item in [
        "Planifica qué pieza crear (estratega con temas configurados + métricas Google).",
        "Investiga el tema, redacta con IA y aplica SEO on-page (título, meta, schema, slug).",
        "Genera HTML con plantilla Cleexs (.cleexs-article) y sección de interlinks del ecosistema.",
        "Deja la pieza en cola de aprobación o publica directo si autoPublish está activo.",
        "Scheduler interno: revisa cada ~60 min (misiones, sync métricas, refrescador).",
    ]:
        story.append(bullet(item))

    # --- Tipos de contenido ---
    story.append(Paragraph("Tipos de pieza soportados", H2))
    types = [
        ["Pilar", "Guía larga PRO — ancla del ecosistema"],
        ["FAQ", "Preguntas frecuentes optimizadas para IA y Google"],
        ["Checklist", "Lista accionable paso a paso"],
        ["Comparativa", "Tablas y análisis comparativo"],
        ["How-to", "Tutorial práctico"],
    ]
    tt = Table([["Tipo", "Descripción"]] + types, colWidths=[3 * cm, 13 * cm])
    tt.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eff6ff")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1e40af")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(tt)

    # --- Backoffice ---
    story.append(Paragraph("Backoffice (Centro de Gestión)", H2))
    screens = [
        "Centro — KPIs: piezas publicadas, impresiones GSC, aprobaciones pendientes, radar de refresco.",
        "Resultados — Tráfico GA4, impresiones/clicks GSC, top artículos, fuentes IA.",
        "Publicaciones — Piezas publicadas y ecosistema de contenido (cluster pilar + satélites).",
        "Actividad — Feed en tiempo real de lo que hace Teo.",
        "Aprobaciones — Preview, edición de título/contenido, aprobar o rechazar → publica en WP.",
        "Monitor — Misiones (manual / autónoma / refresco), lanzar misión o escaneo.",
        "Config Teo — Temas, tono, frecuencia, brand kit, autoPublish vs aprobación humana.",
        "Integraciones — WordPress, Google, autonomía, checklist Rank Math, tick manual.",
    ]
    for s in screens:
        story.append(bullet(s))

    # --- Integraciones ---
    story.append(Paragraph("Integraciones activas", H2))
    for item in [
        "WordPress (cleexs.net) — REST API, categoría Artículos, /articulos/, borrador o publish.",
        "Rank Math SEO — meta título, description y focus keyword vía mu-plugin REST.",
        "Google Search Console — impresiones, clicks y oportunidades por URL.",
        "Google Analytics 4 — sesiones y tráfico por página del blog.",
    ]:
        story.append(bullet(item))

    # --- Refrescador ---
    story.append(Paragraph("Refrescador inteligente", H2))
    for item in [
        "Detecta artículos con impresiones pero sin clicks o con caída de rendimiento.",
        "Marca piezas como «a refrescar» y puede lanzar misión de actualización automática.",
        "Radar en Centro con motivo, última misión y botón reintentar si falló.",
    ]:
        story.append(bullet(item))

    # --- Ecosistema ---
    story.append(Paragraph("Ecosistema de contenido", H2))
    for item in [
        "Cluster piloto: «Visibilidad AEO / SEO» (pilar + satélites FAQ, checklist, comparativa, how-to).",
        "Interlinks automáticos entre piezas del mismo ecosistema al publicar.",
        "Estratega prioriza tipos de pieza faltantes en el cluster.",
    ]:
        story.append(bullet(item))

    # --- Pipeline interno ---
    story.append(Paragraph("Pipeline interno de Teo (por misión)", H2))
    pipeline = "Estratega → Researcher → Escritor (LLM) → Albañil SEO → Publicador"
    story.append(Paragraph(pipeline, BODY))

    # --- Estado ---
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e2e8f0")))
    story.append(Spacer(1, 6))
    story.append(Paragraph("Estado del piloto Cleexs", H2))
    story.append(
        Paragraph(
            "Avance estimado del piloto: <b>~90%</b>. WordPress + Rank Math verificados. "
            "Autonomía y métricas en producción. Pendiente menor: endurecer seguridad, "
            "cambio de contraseña demo y pulir duplicados en refresco.",
            BODY,
        )
    )

    story.append(Spacer(1, 12))
    story.append(
        Paragraph(
            "Plataforma Agentes Cleexs · Teo v1 · Documento generado automáticamente",
            FOOT,
        )
    )

    doc.build(story)
    print(f"PDF generado: {OUT}")


if __name__ == "__main__":
    build_pdf()
