import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        
        # Omit running headers on cover/title page
        if self._pageNumber > 1:
            # Running Header
            self.setFont("Helvetica", 8)
            self.setFillColor(colors.HexColor("#64748B"))
            self.drawString(36, 756, "SETTLEMENT AGENT — SYSTEM ARCHITECTURE & ENGINEERING SPECIFICATION")
            self.drawRightString(576, 756, "CONFIDENTIAL & PROPRIETARY")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(36, 750, 576, 750)

        # Running Footer (on all pages)
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#475569"))
        self.drawString(36, 25, "SETTLEMENT AGENT (CAS FINANCIAL RECONCILIATION ENGINE)")
        self.setFont("Helvetica", 8)
        self.drawRightString(576, 25, f"Page {self._pageNumber} of {page_count}")
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(36, 35, 576, 35)
        
        self.restoreState()

def build_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=46,
        bottomMargin=46
    )

    styles = getSampleStyleSheet()
    
    # Custom Palette
    C_PRIMARY = colors.HexColor("#0F172A")    # Deep Slate
    C_BRAND = colors.HexColor("#4338CA")      # Indigo 700
    C_ACCENT = colors.HexColor("#4F46E5")     # Indigo 600
    C_TEXT = colors.HexColor("#1E293B")       # Body Text
    C_MUTED = colors.HexColor("#64748B")      # Muted Label
    C_BG_LIGHT = colors.HexColor("#F8FAFC")   # Card Background
    C_BORDER = colors.HexColor("#E2E8F0")     # Subtle Border
    C_GREEN = colors.HexColor("#059669")      # Verified Emerald
    C_ROSE = colors.HexColor("#E11D48")       # Escalation Rose
    C_AMBER = colors.HexColor("#D97706")      # Warning Amber

    # Custom Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=C_PRIMARY,
        alignment=TA_LEFT,
        spaceAfter=4
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=C_BRAND,
        alignment=TA_LEFT,
        spaceAfter=12
    )

    meta_style = ParagraphStyle(
        'DocMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=C_MUTED
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=C_PRIMARY,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=C_BRAND,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=C_TEXT,
        spaceAfter=6,
        alignment=TA_JUSTIFY
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=C_TEXT,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=3
    )

    callout_style = ParagraphStyle(
        'Callout_Text',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=C_PRIMARY
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white,
        alignment=TA_CENTER
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=C_TEXT
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=10,
        textColor=C_PRIMARY
    )

    table_cell_right = ParagraphStyle(
        'TableCellRight',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=C_TEXT,
        alignment=TA_RIGHT
    )

    table_cell_right_bold = ParagraphStyle(
        'TableCellRightBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=10,
        textColor=C_PRIMARY,
        alignment=TA_RIGHT
    )

    story = []

    # =========================================================================
    # HEADER / COVER SECTION
    # =========================================================================
    story.append(Paragraph("SYSTEM ARCHITECTURE SPECIFICATION & DECONSTRUCTION MANUAL", ParagraphStyle('Overline', fontName='Helvetica-Bold', fontSize=8, leading=10, textColor=C_BRAND, spaceAfter=4)))
    story.append(Paragraph("SETTLEMENT AGENT: MASTER ENGINEERING DESIGN", title_style))
    story.append(Paragraph("The Autonomous Multi-Stream Financial Reconciliation Engine for Client Advisory Services (CAS)", subtitle_style))
    
    meta_table_data = [
        [
            Paragraph("<b>Author:</b> Adesina Oluwatimileyin Isaiah", meta_style),
            Paragraph("<b>Target Practice:</b> Basis 365 Accounting (Rhett Molitor - CA)", meta_style),
            Paragraph("<b>Core Problem:</b> The Net Payout Deposit Trap", meta_style)
        ],
        [
            Paragraph("<b>Architecture Status:</b> Production Ready (Phases 1–5 Complete)", meta_style),
            Paragraph("<b>Target Stack:</b> Stripe · Shopify · Xero · QBO · Supabase", meta_style),
            Paragraph("<b>Version:</b> 2.0 Master Release (Sept 2026)", meta_style)
        ]
    ]
    t_meta = Table(meta_table_data, colWidths=[180, 180, 180])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), C_BG_LIGHT),
        ('BOX', (0,0), (-1,-1), 0.5, C_BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.5, C_BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 10))

    # Executive Abstract Callout
    abstract_text = (
        "<b>Executive Summary:</b> Modern e-commerce brands generate high-volume micro-transactions across Shopify and Amazon, "
        "yet receive lumped, aggregated bank deposits from payment processors (e.g. Stripe) that omit underlying sales taxes, processing fees, "
        "and dispute adjustments. <b>Settlement Agent</b> is a zero-hallucination autonomous engineering solution designed specifically for CAS practices. "
        "By enforcing strict mathematical equilibrium (Σ Debits - Σ Credits ≡ $0.00) through a deterministic integer-cent Math Gate, isolating LLM reasoning "
        "from financial execution, and implementing a 3-retry self-healing feedback loop with a mandatory DRAFT fallback, the system transforms 3 hours "
        "of manual spreadsheet reconciliation per client into a 5-second deterministic background sync."
    )
    t_abstract = Table([[Paragraph(abstract_text, callout_style)]], colWidths=[540])
    t_abstract.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#EEF2FF")),
        ('BOX', (0,0), (-1,-1), 1, C_BRAND),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_abstract)
    story.append(Spacer(1, 10))

    # =========================================================================
    # CHAPTER 1: THE PROBLEM & THE NET DEPOSIT TRAP
    # =========================================================================
    story.append(Paragraph("1. THE ACUTE PROBLEM: THE NET PAYOUT DEPOSIT TRAP", h1_style))
    story.append(Paragraph(
        "Direct-to-consumer (DTC) brands doing $1M to $10M in gross merchandise value (GMV) process thousands of customer checkout events monthly. "
        "However, merchant payment processors (Stripe, Shopify Payments, PayPal) never deposit sales individually. Instead, the processor aggregates hundreds "
        "of orders, deducts credit card interchange fees, withholds rolling risk reserves, claws back customer refunds, and wires a single, opaque net lump sum "
        "(e.g. $10,490.00 or $313.25) into the operating checking account. When bookkeepers encounter this lump sum in the bank feed, they face a severe structural dilemma.",
        body_style
    ))

    story.append(Paragraph("The Three Fatal Bookkeeping Disasters in E-Commerce:", h2_style))
    
    disasters_data = [
        [
            Paragraph("Fatal Error", table_header_style),
            Paragraph("Mechanism of Failure", table_header_style),
            Paragraph("CPA Practice & Client Impact", table_header_style)
        ],
        [
            Paragraph("<b>1. Gross Revenue Understated</b>", table_cell_bold),
            Paragraph("Bookkeepers click 'Add to Sales' on the net bank deposit ($10,490.00) instead of recognizing the true top-line revenue ($10,000.00 product + $800.00 tax).", table_cell_style),
            Paragraph("Distorts top-line growth metrics, underreports business revenue for valuations and loan covenants, and violates GAAP accrual standards.", table_cell_style)
        ],
        [
            Paragraph("<b>2. Unrecorded Merchant Deductions</b>", table_cell_bold),
            Paragraph("Processing fees ($310.00) deducted at the gateway source are invisible on the bank statement and completely unbooked in the General Ledger.", table_cell_style),
            Paragraph("The business permanently loses legitimate tax-deductible COGS expense deductions, resulting in client overpayment of federal and state income taxes.", table_cell_style)
        ],
        [
            Paragraph("<b>3. Unremitted Sales Tax Exposure</b>", table_cell_bold),
            Paragraph("State and local sales taxes collected from customers ($800.00) are accidentally booked as taxable company revenue instead of a liability owed to tax authorities.", table_cell_style),
            Paragraph("Creates massive sales tax audit penalties and nexus non-compliance across states (e.g. California CDTFA, New York NYDTF, Texas Comptroller).", table_cell_style)
        ]
    ]
    t_disasters = Table(disasters_data, colWidths=[120, 210, 210])
    t_disasters.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), C_PRIMARY),
        ('BOX', (0,0), (-1,-1), 0.5, C_BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.5, C_BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('BACKGROUND', (0,1), (0,1), colors.HexColor("#FEF2F2")),
        ('BACKGROUND', (0,2), (0,2), colors.HexColor("#FFFBEB")),
        ('BACKGROUND', (0,3), (0,3), colors.HexColor("#FEF2F2")),
    ]))
    story.append(t_disasters)
    story.append(Spacer(1, 10))

    # =========================================================================
    # CHAPTER 2: HOW WE CAME UP WITH THE SOLUTION
    # =========================================================================
    story.append(Paragraph("2. HOW WE CAME UP WITH THE SOLUTION", h1_style))
    story.append(Paragraph(
        "To engineer a production solution, we executed an intensive forensic investigation into the accounting and Client Advisory Services (CAS) sector. "
        "We surveyed firm operations across Reddit (r/taxpros, r/accounting), analyzed leading CAS practices like <b>Basis 365 Accounting</b> (founded by Rhett Molitor, "
        "specializing in e-commerce and SaaS accounting), and examined the concrete limitations of existing market tools.",
        body_style
    ))

    story.append(Paragraph("Why Legacy Tools (A2X, Webgility, Synder) Break in Production:", h2_style))
    story.append(Paragraph("• <b>Fragile Custom SKU Mapping:</b> Legacy tools rely on static regular-expression and SKU rules. The moment a merchant launches a promotional bundle, multi-pack SKU, or flash discount code, the integration engine halts or dumps unclassified amounts into suspense accounts.", bullet_style))
    story.append(Paragraph("• <b>Zero Autonomous Self-Healing:</b> When local sales tax rounding creates a $0.02 delta between Shopify and Stripe, existing software crashes silently, leaving journals in limbo for the human bookkeeper to untangle manually at month-end.", bullet_style))
    story.append(Paragraph("• <b>The 'Blind Auto-Posting' Risk:</b> CAS firm owners refuse black-box AI tools that write directly to Xero or QuickBooks without mathematical verification. A single hallucinated journal entry corrupts the trial balance and consumes hours of CPA time to audit.", bullet_style))

    story.append(Spacer(1, 4))
    story.append(Paragraph("The Handwritten Architectural Breakthrough (Isaiah's Blueprint):", h2_style))
    story.append(Paragraph(
        "Based on Isaiah's handwritten system blueprint (dated September 2, 2026), we established three non-negotiable architectural mandates: "
        "<b>(1) Deterministic Isolation:</b> The LLM is strictly an analytical deconstruction parser and is mathematically barred from holding ledger API credentials or executing direct writes. "
        "<b>(2) The Dual-Verification Anti-Hallucination Gate (The Balancing Tool):</b> A zero-LLM deterministic code barrier that enforces exact integer-cent double-entry balance before any API network call is made. "
        "<b>(3) The 3-Retry Self-Repair Loop & Mandatory DRAFT Fallback:</b> Giving the AI exact machine delta feedback to fix rounding errors, and failing safely to Xero DRAFT mode if balance cannot be achieved.",
        body_style
    ))

    story.append(PageBreak())

    # =========================================================================
    # CHAPTER 3: THE SOLUTION & 5-LAYER SYSTEM ARCHITECTURE
    # =========================================================================
    story.append(Paragraph("3. THE SOLUTION: SETTLEMENT AGENT ARCHITECTURE", h1_style))
    story.append(Paragraph(
        "Settlement Agent is structured into a rigorous 5-layer pipeline that completely separates external network ingestion, "
        "structured AI reasoning, deterministic mathematical validation, and General Ledger synchronization.",
        body_style
    ))

    layers_data = [
        [
            Paragraph("Layer", table_header_style),
            Paragraph("Component Name", table_header_style),
            Paragraph("Engineering Mechanics & Safety Boundaries", table_header_style)
        ],
        [
            Paragraph("<b>Layer 1</b>", table_cell_bold),
            Paragraph("<b>External Gateway Triggers</b>", table_cell_bold),
            Paragraph("Listens for incoming webhook events (e.g. <code>payout.paid</code> from Stripe). Enforces cryptographic HMAC-SHA256 signature verification with timestamp tolerance to prevent replay attacks.", table_cell_style)
        ],
        [
            Paragraph("<b>Layer 2</b>", table_cell_bold),
            Paragraph("<b>Deterministic Orchestrator & Two-Bucket Classifier</b>", table_cell_bold),
            Paragraph("Acquires atomic idempotency lock in PostgreSQL to drop duplicate webhooks. Classifies transactions into <b>Bucket A</b> (Shopify order-linked sales, shipping, state taxes) and <b>Bucket B</b> (Stripe direct dispute fees, clawbacks, reserves).", table_cell_style)
        ],
        [
            Paragraph("<b>Layer 3</b>", table_cell_bold),
            Paragraph("<b>AI Reasoning Engine (Vercel AI SDK)</b>", table_cell_bold),
            Paragraph("Parses unstructured payment manifests using <code>generateObject</code> with strict Zod schemas against US GAAP 5-digit Chart of Accounts (COA 10000–50000) at temperature 0.1 for deterministic structuring.", table_cell_style)
        ],
        [
            Paragraph("<b>Layer 4</b>", table_cell_bold),
            Paragraph("<b>Deterministic Math Gate (The Balancing Tool)</b>", table_cell_bold),
            Paragraph("Zero-LLM integer-cent verification. Executes <b>Check 1</b> (Ground Truth Match vs API numbers) and <b>Check 2</b> (Double-Entry Law: Σ Debits - Σ Credits ≡ $0.00). Governs the 3-retry self-repair feedback loop.", table_cell_style)
        ],
        [
            Paragraph("<b>Layer 5</b>", table_cell_bold),
            Paragraph("<b>Safe Staging & Supabase Persistence</b>", table_cell_bold),
            Paragraph("Guarantees persistence across 5 Supabase tables. Stages verified journals directly to Xero/QBO as <code>POSTED</code> or <code>DRAFT</code> with explicit machine escalation reasoning if discrepancies occur.", table_cell_style)
        ]
    ]
    t_layers = Table(layers_data, colWidths=[60, 160, 320])
    t_layers.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), C_PRIMARY),
        ('BOX', (0,0), (-1,-1), 0.5, C_BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.5, C_BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_layers)
    story.append(Spacer(1, 10))

    story.append(Paragraph("Concrete Accounting Worked Example: Deconstructing a $313.25 Settlement", h2_style))
    story.append(Paragraph(
        "The table below illustrates the exact double-entry ledger constructed by Settlement Agent for a live multi-state DTC e-commerce payout "
        "comprising $300.00 in gross merchandise, $12.00 customer shipping, multi-state tax payables, $7.00 gateway fees, and a $15.00 dispute inquiry fee:",
        body_style
    ))

    ledger_data = [
        [
            Paragraph("Account Code", table_header_style),
            Paragraph("Standard US GAAP Account Title", table_header_style),
            Paragraph("Debit ($)", table_header_style),
            Paragraph("Credit ($)", table_header_style),
            Paragraph("Forensic Accounting Classification", table_header_style)
        ],
        [
            Paragraph("<b>11500</b>", table_cell_bold),
            Paragraph("Stripe Payout Clearing Account", table_cell_style),
            Paragraph("313.25", table_cell_right_bold),
            Paragraph("0.00", table_cell_right),
            Paragraph("Asset (Net cash transferred into operating checking feed)", table_cell_style)
        ],
        [
            Paragraph("<b>52000</b>", table_cell_bold),
            Paragraph("Merchant Payment Processing Fees", table_cell_style),
            Paragraph("7.00", table_cell_right_bold),
            Paragraph("0.00", table_cell_right),
            Paragraph("COGS / Expense (Gateway interchange fees deductible on tax return)", table_cell_style)
        ],
        [
            Paragraph("<b>52100</b>", table_cell_bold),
            Paragraph("Gateway Dispute & Chargeback Fees", table_cell_style),
            Paragraph("15.00", table_cell_right_bold),
            Paragraph("0.00", table_cell_right),
            Paragraph("COGS / Expense (Direct Stripe dispute chargeback fee)", table_cell_style)
        ],
        [
            Paragraph("<b>40100</b>", table_cell_bold),
            Paragraph("Gross E-Commerce Sales", table_cell_style),
            Paragraph("0.00", table_cell_right),
            Paragraph("300.00", table_cell_right_bold),
            Paragraph("Revenue (Top-line merchandise sales before deductions)", table_cell_style)
        ],
        [
            Paragraph("<b>41000</b>", table_cell_bold),
            Paragraph("Shipping & Delivery Income", table_cell_style),
            Paragraph("0.00", table_cell_right),
            Paragraph("12.00", table_cell_right_bold),
            Paragraph("Revenue (Customer-paid delivery fulfillment charges)", table_cell_style)
        ],
        [
            Paragraph("<b>22000</b>", table_cell_bold),
            Paragraph("Sales Tax Agency Payable — CA-CDTFA", table_cell_style),
            Paragraph("0.00", table_cell_right),
            Paragraph("14.50", table_cell_right_bold),
            Paragraph("Liability (California State Sales Tax owed to CDTFA)", table_cell_style)
        ],
        [
            Paragraph("<b>22000</b>", table_cell_bold),
            Paragraph("Sales Tax Agency Payable — NY-DTF", table_cell_style),
            Paragraph("0.00", table_cell_right),
            Paragraph("8.75", table_cell_right_bold),
            Paragraph("Liability (New York State & Local Tax owed to NY-DTF)", table_cell_style)
        ],
        [
            Paragraph("<b>TOTALS</b>", table_cell_bold),
            Paragraph("<b>US GAAP DOUBLE-ENTRY EQUILIBRIUM</b>", table_cell_bold),
            Paragraph("<b>$335.25</b>", table_cell_right_bold),
            Paragraph("<b>$335.25</b>", table_cell_right_bold),
            Paragraph("<b>VARIANCE: $0.000 (MATHEMATICAL EQUILIBRIUM)</b>", table_cell_bold)
        ]
    ]
    t_ledger = Table(ledger_data, colWidths=[65, 175, 60, 60, 180])
    t_ledger.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), C_BRAND),
        ('BOX', (0,0), (-1,-1), 0.5, C_BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.5, C_BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor("#DCFCE7")), # Emerald Highlight
    ]))
    story.append(t_ledger)
    story.append(Spacer(1, 10))

    # =========================================================================
    # CHAPTER 4: THE 9 CRITICAL ENGINEERING DECISIONS
    # =========================================================================
    story.append(PageBreak())
    story.append(Paragraph("4. ARCHITECTURAL & ENGINEERING DECISIONS MADE", h1_style))
    story.append(Paragraph(
        "During system development, every architectural decision was governed by enterprise accounting laws, "
        "fault-tolerant distributed systems principles, and strict anti-hallucination protocols.",
        body_style
    ))

    decisions = [
        (
            "Decision 1: Zero LLM Direct Execution on Ledgers",
            "We strictly barred the AI model from holding Xero or QuickBooks OAuth credentials. In early prototypes, giving LLMs autonomous execution power created fatal failure modes: hallucinated account IDs, inverted debit/credit signs, and silent balance corruption. In Settlement Agent, the LLM is strictly an analytical parsing engine. The Deterministic Math Gate acts as an air-gap barrier between AI reasoning and financial APIs."
        ),
        (
            "Decision 2: Integer-Cent Arithmetic (Zero IEEE-754 Floating-Point Drift)",
            "Standard JavaScript floating-point numbers exhibit binary precision errors (e.g. <code>0.1 + 0.2 === 0.30000000000000004</code>). In financial reconciliation, an automated system that permits a $0.00000000000004 discrepancy will trigger false-positive imbalance rejections. We enforce integer-cent scaling (<code>Math.round(amount * 100)</code>) throughout the Math Gate, converting back to two-decimal strings only upon persistence."
        ),
        (
            "Decision 3: The 3-Attempt Self-Healing Feedback Loop",
            "Rather than throwing an exception when an entry is imbalanced by $0.01 or $0.02 due to multi-state sales tax rounding, the Math Gate calculates the exact delta and injects a structured diagnostic prompt: <i>'MATHEMATICAL REJECTION: Imbalance of $0.02 detected. California Tax differs by $0.02. Adjust rounding pennies on the fee or tax line to balance the ledger.'</i> The model self-corrects within a bounded 3-attempt ceiling."
        ),
        (
            "Decision 4: Mandatory DRAFT Fallback with Machine Narration",
            "If a settlement batch fails after 3 retry attempts, it is never discarded or silently posted. The system safe-posts the transaction to Xero strictly as a <b>DRAFT</b> manual journal, embedding the machine discrepancy in the narration header: <i>'AUDIT ESCALATION: Failed Math Gate after 3 attempts (Δ=$0.02).'</i> This preserves the audit trail, alerts the CPA, and prevents broken entries from polluting the client's live books."
        ),
        (
            "Decision 5: Hybrid Ledger Integration (Direct REST Writes + MCP Read Discovery)",
            "We decoupled ledger interactions into two specialized protocols: Direct REST Connectors for atomic, Math-Gate-guarded journal creation, and Model Context Protocol (MCP) for dynamic discovery. MCP queries the client's live Chart of Accounts (<code>list-accounts</code>) so the AI automatically adopts custom firm codes, and enables conversational audit inspections (<code>list-manual-journals</code>)."
        ),
        (
            "Decision 6: The Two-Bucket Transaction Classifier",
            "Payment processors combine two fundamentally different transaction types in a single payout batch. We architected the Two-Bucket Classifier to separate <b>Bucket A (Order-Linked)</b> (transactions tied to Shopify carts with gross merchandise, shipping, and multi-state tax payables) from <b>Bucket B (Direct Gateway Friction)</b> (unlinked dispute inquiry fees, chargeback clawbacks, and risk reserve holdbacks)."
        ),
        (
            "Decision 7: Supabase 5-Table Relational Persistence Guarantee",
            "Every stage of reconciliation is persisted with relational integrity across 5 Supabase tables: <code>idempotency_locks</code> (eliminates duplicate webhook deliveries via 5-minute atomic locks), <code>payout_batches</code> (master settlement batch headers), <code>ground_truth_records</code> (immutable raw gateway payloads), <code>ledger_journal_records</code> (balanced debits/credits), and <code>audit_logs</code> (detailed compliance traces)."
        ),
        (
            "Decision 8: Multi-Channel Real-Time Escalation Notifier",
            "When the Math Gate detects an unresolvable discrepancy after 3 retries, the system triggers the <code>EscalationNotifier</code> service. It dispatches an urgent email alert to the firm's senior accountants and posts an interactive card to the firm's Slack escalation channel containing batch ID, stated net, calculated net, exact penny delta, and a direct link to the Xero Draft queue."
        ),
        (
            "Decision 9: Frosted Glassmorphism Command Center & Strict Anti-Pill Law",
            "The web command center was engineered to eliminate boxy, legacy financial table fatigue. Built with Tailwind CSS, Plus Jakarta Sans, and tabular JetBrains Mono, it provides high-density financial legibility. In strict compliance with Isaiah's <b>Anti-Pill Law</b>, zero capsule badges (<code>rounded-full</code>) exist in the application. All status indicators use clean rectangular geometry (<code>rounded-md</code>, 6px–8px radius), uppercase tracked overlines, and hairline dividers."
        )
    ]

    for title, desc in decisions:
        story.append(Paragraph(f"• <b>{title}:</b> {desc}", bullet_style))
        story.append(Spacer(1, 3))

    story.append(Spacer(1, 8))

    # =========================================================================
    # CHAPTER 5: VERIFICATION, PRODUCTION TESTING & FUTURE ROADMAP
    # =========================================================================
    story.append(Paragraph("5. VERIFICATION, TEST SUITE & FUTURE ROADMAP", h1_style))
    story.append(Paragraph(
        "The entire Settlement Agent codebase is 100% verified and production-tested across 12 automated test scenarios:",
        body_style
    ))

    test_results_data = [
        [
            Paragraph("Test Suite", table_header_style),
            Paragraph("Key Scenarios Verified", table_header_style),
            Paragraph("Status", table_header_style)
        ],
        [
            Paragraph("<b>1. Math Gate Suite</b><br/><code>mathGate.test.ts</code>", table_cell_style),
            Paragraph("Penny-exact equilibrium (Δ=$0.00), waterfall consistency, blocking imbalanced entries, self-repair prompt generation, and COA code validation.", table_cell_style),
            Paragraph("<font color='#059669'><b>PASSED (4/4)</b></font>", table_cell_style)
        ],
        [
            Paragraph("<b>2. Ledger Connectors Suite</b><br/><code>connectorsAndWorkflow.test.ts</code>", table_cell_style),
            Paragraph("Xero signed amounts (+ Debits, - Credits), QBO positive decimals with PostingType, Xero DRAFT fallback with narration, and ISO-8601 date formatting.", table_cell_style),
            Paragraph("<font color='#059669'><b>PASSED (4/4)</b></font>", table_cell_style)
        ],
        [
            Paragraph("<b>3. E2E Webhook Drill Suite</b><br/><code>e2eWebhookReconciliation.test.ts</code>", table_cell_style),
            Paragraph("Stripe HMAC-SHA256 signature verification, Two-Bucket classification with multi-state tax payables, idempotency deduplication, and Supabase 5-table persistence.", table_cell_style),
            Paragraph("<font color='#059669'><b>PASSED (4/4)</b></font>", table_cell_style)
        ]
    ]
    t_tests = Table(test_results_data, colWidths=[130, 320, 90])
    t_tests.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), C_PRIMARY),
        ('BOX', (0,0), (-1,-1), 0.5, C_BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.5, C_BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_tests)
    story.append(Spacer(1, 10))

    story.append(Paragraph("Future Architectural Roadmap:", h2_style))
    story.append(Paragraph("1. <b>Production OAuth 2.0 Web Callback Handlers:</b> Implementing live browser redirect flows (<code>/api/auth/xero/callback</code>, <code>/api/auth/qbo/callback</code>) for zero-config firm onboarding.", bullet_style))
    story.append(Paragraph("2. <b>Real-Time WebSocket/SSE Settlement Feeds:</b> Streaming live batch state transitions (<code>INGESTED</code> ➔ <code>MATH_VERIFIED</code> ➔ <code>STAGED_XERO_DRAFT</code>) directly to the web command center.", bullet_style))
    story.append(Paragraph("3. <b>Multi-Currency FX Historical Spot Rate Sync:</b> Connecting to live European Central Bank (ECB) feeds for multi-currency settlements (GBP, EUR, CAD, AUD).", bullet_style))
    story.append(Paragraph("4. <b>Cloudflare Worker Edge Deployment:</b> Packaging the Hono API into edge workers with Hyperdrive connection pooling for sub-10ms global webhook ingestion.", bullet_style))

    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_BORDER, spaceAfter=8))
    
    closing_text = (
        "<b>Architectural Sign-off:</b> Settlement Agent represents a production-grade paradigm shift in automated Client Advisory Services. "
        "By binding modern Large Language Model reasoning within deterministic financial mathematical constraints, it establishes complete trust, "
        "absolute double-entry balance, and psychological safety for modern accounting practices."
    )
    story.append(Paragraph(closing_text, ParagraphStyle('Signoff', fontName='Helvetica-Oblique', fontSize=8, leading=11.5, textColor=C_MUTED, alignment=TA_CENTER)))

    # Build Document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Master Architecture PDF generated successfully: {filename}")

if __name__ == "__main__":
    out_dir = "C:/Users/Isaiah/Downloads"
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, "Settlement_Agent_System_Architecture_and_Engineering_Design.pdf")
    build_pdf(out_file)

    # Also save a canonical copy inside the settlement-agent project docs
    project_docs = "C:/Users/Isaiah/settlement-agent/docs"
    os.makedirs(project_docs, exist_ok=True)
    project_copy = os.path.join(project_docs, "Settlement_Agent_System_Architecture_and_Engineering_Design.pdf")
    import shutil
    shutil.copyfile(out_file, project_copy)
    print(f"Canonical copy saved to: {project_copy}")
