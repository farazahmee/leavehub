"""
Generate letter PDF
"""
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.enums import TA_LEFT


def generate_letter_pdf(
    employee_name: str,
    letter_type: str,
    title: str,
    content: str,
) -> bytes:
    """Generate PDF from letter content. Returns PDF as bytes."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=inch,
        leftMargin=inch,
        topMargin=inch,
        bottomMargin=inch,
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="LetterBody",
        parent=styles["Normal"],
        fontSize=11,
        leading=14,
        spaceAfter=6,
    ))
    flow = []

    # Optional title header only; no extra meta lines so PDF matches letter body closely
    if title:
        flow.append(Paragraph(f"<b>{title}</b>", styles["Title"]))
        flow.append(Spacer(1, 0.3 * inch))

    # Content - split by newlines, escape HTML
    content_safe = content.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    for line in content_safe.split("\n"):
        flow.append(Paragraph(line or "&nbsp;", styles["LetterBody"]))

    doc.build(flow)
    return buffer.getvalue()
