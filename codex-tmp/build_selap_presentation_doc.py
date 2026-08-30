from __future__ import annotations

from pathlib import Path
from textwrap import wrap

from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
OUT_DOCX = ROOT / "docs" / "selap-final-presentation-content.docx"
ASSET_DIR = ROOT / "codex-tmp" / "selap-presentation-assets"
ASSET_DIR.mkdir(parents=True, exist_ok=True)


COLORS = {
    "navy": "#16324F",
    "blue": "#2E74B5",
    "sky": "#E8F2FB",
    "green": "#2E7D5B",
    "green_light": "#E9F6EF",
    "orange": "#C06A1B",
    "orange_light": "#FFF3E6",
    "purple": "#6D5BD0",
    "purple_light": "#F0EEFF",
    "red": "#B42318",
    "red_light": "#FDECEC",
    "gray": "#6B7280",
    "line": "#B8C2CC",
    "paper": "#FFFFFF",
    "soft": "#F6F8FB",
    "ink": "#172033",
}


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/calibrib.ttf" if bold else "C:/Windows/Fonts/calibri.ttf"),
        Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


FONT_TITLE = font(52, True)
FONT_SUBTITLE = font(34, True)
FONT_NODE = font(28, True)
FONT_TEXT = font(25)
FONT_SMALL = font(21)
FONT_TINY = font(18)


def text_size(draw: ImageDraw.ImageDraw, text: str, fnt) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=fnt)
    return box[2] - box[0], box[3] - box[1]


def wrap_for_width(draw: ImageDraw.ImageDraw, text: str, fnt, max_width: int) -> list[str]:
    words = text.split()
    if not words:
        return [""]
    lines: list[str] = []
    current: list[str] = []
    for word in words:
        probe = " ".join([*current, word])
        if text_size(draw, probe, fnt)[0] <= max_width or not current:
            current.append(word)
        else:
            lines.append(" ".join(current))
            current = [word]
    if current:
        lines.append(" ".join(current))
    return lines


def draw_wrapped_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    max_width: int,
    fnt,
    fill: str = COLORS["ink"],
    line_gap: int = 7,
    center: bool = False,
) -> int:
    x, y = xy
    lines = wrap_for_width(draw, text, fnt, max_width)
    line_heights = [text_size(draw, line, fnt)[1] for line in lines]
    for line, height in zip(lines, line_heights):
        width, _ = text_size(draw, line, fnt)
        draw.text((x + (max_width - width) / 2 if center else x, y), line, font=fnt, fill=fill)
        y += height + line_gap
    return y


def rounded_box(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    fill: str,
    outline: str = COLORS["line"],
    width: int = 3,
    radius: int = 22,
) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def node(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    title: str,
    body: str | None = None,
    fill: str = COLORS["soft"],
    outline: str = COLORS["line"],
    title_color: str = COLORS["navy"],
) -> None:
    rounded_box(draw, box, fill, outline, width=3)
    x1, y1, x2, y2 = box
    pad = 20
    title_bottom = draw_wrapped_text(
        draw,
        (x1 + pad, y1 + 18),
        title,
        x2 - x1 - 2 * pad,
        FONT_NODE,
        title_color,
        center=True,
    )
    if body:
        body_font = FONT_TINY if (y2 - y1) <= 135 else FONT_SMALL
        body_y = max(y1 + 72, title_bottom + 8)
        draw_wrapped_text(draw, (x1 + pad, body_y), body, x2 - x1 - 2 * pad, body_font, COLORS["ink"], center=True)


def arrow(
    draw: ImageDraw.ImageDraw,
    start: tuple[int, int],
    end: tuple[int, int],
    color: str = COLORS["gray"],
    width: int = 5,
) -> None:
    draw.line([start, end], fill=color, width=width)
    sx, sy = start
    ex, ey = end
    if abs(ex - sx) >= abs(ey - sy):
        direction = 1 if ex >= sx else -1
        points = [(ex, ey), (ex - direction * 18, ey - 11), (ex - direction * 18, ey + 11)]
    else:
        direction = 1 if ey >= sy else -1
        points = [(ex, ey), (ex - 11, ey - direction * 18), (ex + 11, ey - direction * 18)]
    draw.polygon(points, fill=color)


def canvas(title: str, subtitle: str | None = None, size: tuple[int, int] = (1900, 1180)):
    img = Image.new("RGB", size, hex_to_rgb(COLORS["paper"]))
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, size[0], 120), fill=hex_to_rgb("#F3F7FB"))
    draw.text((70, 34), title, font=FONT_TITLE, fill=COLORS["navy"])
    if subtitle:
        draw.text((72, 92), subtitle, font=FONT_TINY, fill=COLORS["gray"])
    return img, draw


def save(img: Image.Image, name: str) -> Path:
    path = ASSET_DIR / name
    img.save(path, "PNG")
    return path


def diagram_use_case() -> Path:
    img, draw = canvas("Use Case Model", "Actors and core SELAP workflows")
    lanes = [
        (
            "Administrator",
            COLORS["purple_light"],
            COLORS["purple"],
            205,
            [
                ("Auth + OTP", "Sign in securely"),
                ("Agent Approval", "Approve/reject staff"),
                ("Region Setup", "Assign service areas"),
                ("Manage Property", "Full inventory control"),
                ("Operations", "Staff and notifications"),
            ],
        ),
        (
            "Sales Agent",
            COLORS["orange_light"],
            COLORS["orange"],
            500,
            [
                ("Auth + OTP", "Approved account access"),
                ("Assigned Property", "Manage regional listings"),
                ("Lead Alerts", "Receive new_lead events"),
                ("Claim Lead", "Accept first to win"),
                ("Follow-up", "Update lead status"),
            ],
        ),
        (
            "Customer",
            COLORS["green_light"],
            COLORS["green"],
            795,
            [
                ("Auth + OTP", "Register and sign in"),
                ("Catalog", "Browse and filter"),
                ("Favorites", "Save properties"),
                ("Consultation", "Request agent support"),
                ("Notifications", "Lead accepted updates"),
            ],
        ),
    ]

    for actor, fill, outline, y, cases in lanes:
        rounded_box(draw, (85, y - 55, 1815, y + 185), "#FFFFFF", "#D8DEE8", width=2, radius=18)
        node(draw, (120, y, 405, y + 130), actor, None, fill, outline)
        x = 500
        for idx, (title, body) in enumerate(cases):
            node(draw, (x, y, x + 235, y + 130), title, body, COLORS["soft"], outline)
            if idx == 0:
                arrow(draw, (405, y + 65), (500, y + 65), outline, width=4)
            if idx < len(cases) - 1:
                arrow(draw, (x + 235, y + 65), (x + 285, y + 65), outline, width=4)
            x += 285

    legend_y = 1050
    draw.text((125, legend_y), "Reading guide:", font=FONT_SMALL, fill=COLORS["navy"])
    draw.text((285, legend_y), "Each lane shows the main workflows available to one role after authentication and RBAC checks.", font=FONT_SMALL, fill=COLORS["gray"])
    return save(img, "diagram-use-case.png")


def diagram_sprint_roadmap() -> Path:
    img, draw = canvas("Agile/Scrum Roadmap", "Four delivery increments from PA0")
    y = 345
    x0 = 120
    gap = 30
    width = 405
    height = 385
    sprints = [
        ("Sprint 1", "22 Jun - 4 Jul 2026", "Foundation + Auth", ["Requirements", "Figma/UI start", "NestJS + Next.js init", "JWT, OTP, RBAC"]),
        ("Sprint 2", "6 Jul - 18 Jul 2026", "Core Business", ["Property catalog", "CRUD management", "Admin approval", "Region assignment"]),
        ("Sprint 3", "20 Jul - 1 Aug 2026", "Real-time Layer", ["Favorites", "Notifications", "Socket.IO gateway", "Lead claiming"]),
        ("Sprint 4", "3 Aug - 15 Aug 2026", "QA + Delivery", ["Test plan", "Katalon scenarios", "Performance checks", "Deployment prep"]),
    ]
    fills = [COLORS["sky"], COLORS["green_light"], COLORS["orange_light"], COLORS["purple_light"]]
    outlines = [COLORS["blue"], COLORS["green"], COLORS["orange"], COLORS["purple"]]
    for i, (name, dates, theme, items) in enumerate(sprints):
        x = x0 + i * (width + gap)
        rounded_box(draw, (x, y, x + width, y + height), fills[i], outlines[i], width=4, radius=26)
        draw.text((x + 28, y + 30), name, font=FONT_SUBTITLE, fill=outlines[i])
        draw.text((x + 28, y + 78), dates, font=FONT_SMALL, fill=COLORS["gray"])
        draw_wrapped_text(draw, (x + 28, y + 122), theme, width - 56, FONT_NODE, COLORS["navy"])
        ty = y + 184
        for item in items:
            draw.ellipse((x + 30, ty + 8, x + 42, ty + 20), fill=hex_to_rgb(outlines[i]))
            ty = draw_wrapped_text(draw, (x + 58, ty), item, width - 88, FONT_SMALL, COLORS["ink"], line_gap=5) + 8
        if i < len(sprints) - 1:
            arrow(draw, (x + width + 4, y + height // 2), (x + width + gap - 6, y + height // 2), COLORS["gray"], width=4)
    node(draw, (500, 835, 1400, 1010), "Management Practices", "Jira for backlog and sprint tracking, GitHub for version control, sprint increments for reviewable progress.", COLORS["soft"], COLORS["line"])
    return save(img, "diagram-sprint-roadmap.png")


def diagram_architecture() -> Path:
    img, draw = canvas("System Architecture", "Modular Monolith with REST and Socket.IO")
    node(draw, (90, 250, 390, 390), "Users", "Admin, Sales Agent, Customer", COLORS["soft"], COLORS["navy"])
    node(draw, (90, 520, 390, 660), "Browser", "Next.js UI, role-based navigation", COLORS["sky"], COLORS["blue"])
    node(draw, (520, 210, 850, 360), "Next.js 15 Frontend", "Pages, components, API fetch client", COLORS["sky"], COLORS["blue"])
    node(draw, (520, 500, 850, 650), "Next API Routes", "Proxy layer and frontend fetch helpers", COLORS["soft"], COLORS["blue"])
    node(draw, (980, 180, 1320, 330), "NestJS REST Controllers", "Auth, Admin, Properties, Favorites, Notifications, Leads", COLORS["green_light"], COLORS["green"])
    node(draw, (980, 415, 1320, 585), "NestJS Services", "Business rules, permissions, transactions", COLORS["green_light"], COLORS["green"])
    node(draw, (980, 700, 1320, 865), "ClaimingGateway", "Socket.IO /claiming, region rooms, user rooms", COLORS["orange_light"], COLORS["orange"])
    node(draw, (1450, 210, 1770, 360), "Prisma ORM", "Typed data access and migrations", COLORS["purple_light"], COLORS["purple"])
    node(draw, (1450, 500, 1770, 650), "Supabase PostgreSQL", "Users, Properties, Regions, Leads, Notifications", COLORS["purple_light"], COLORS["purple"])
    node(draw, (1450, 790, 1770, 930), "SMTP + Uploads", "OTP email, reset code, property images", COLORS["soft"], COLORS["line"])

    arrow(draw, (390, 590), (520, 575), COLORS["blue"])
    arrow(draw, (850, 575), (980, 255), COLORS["green"])
    arrow(draw, (850, 575), (980, 500), COLORS["green"])
    arrow(draw, (390, 590), (980, 785), COLORS["orange"])
    arrow(draw, (1320, 500), (1450, 285), COLORS["purple"])
    arrow(draw, (1610, 360), (1610, 500), COLORS["purple"])
    arrow(draw, (1320, 785), (1450, 860), COLORS["gray"])
    arrow(draw, (390, 320), (520, 285), COLORS["blue"])
    draw.text((1010, 610), "Modules stay inside one deployable backend,", font=FONT_SMALL, fill=COLORS["gray"])
    draw.text((1010, 640), "but responsibilities are separated by domain.", font=FONT_SMALL, fill=COLORS["gray"])
    return save(img, "diagram-architecture.png")


def diagram_lead_sequence() -> Path:
    img, draw = canvas("Real-Time Lead Claiming", "First successful transaction wins the lead")

    steps = [
        ("1", "Customer request", "Submit consultation request", COLORS["sky"], COLORS["blue"]),
        ("2", "Lead created", "Store NEW lead and region", COLORS["green_light"], COLORS["green"]),
        ("3", "Regional broadcast", "Emit new_lead to region room", COLORS["orange_light"], COLORS["orange"]),
        ("4", "Agent race", "Eligible agents click Accept", COLORS["purple_light"], COLORS["purple"]),
        ("5", "DB transaction", "Only one claim succeeds", COLORS["green_light"], COLORS["green"]),
        ("6", "Realtime closure", "Winner, others, and customer notified", COLORS["sky"], COLORS["blue"]),
    ]

    y = 260
    x = 80
    w = 245
    h = 165
    for idx, (num, title, body, fill, outline) in enumerate(steps):
        rounded_box(draw, (x, y, x + w, y + h), fill, outline, width=4, radius=24)
        draw.ellipse((x + 18, y + 18, x + 62, y + 62), fill=hex_to_rgb(outline))
        draw_wrapped_text(draw, (x + 18, y + 23), num, 44, FONT_SMALL, "#FFFFFF", center=True)
        draw_wrapped_text(draw, (x + 78, y + 24), title, w - 105, FONT_NODE, outline)
        draw_wrapped_text(draw, (x + 22, y + 82), body, w - 44, FONT_SMALL, COLORS["ink"], center=True)
        if idx < len(steps) - 1:
            arrow(draw, (x + w + 8, y + h // 2), (x + w + 30, y + h // 2), COLORS["gray"], width=4)
        x += w + 40

    # Race detail.
    node(draw, (380, 585, 690, 735), "Agent A", "POST /leads/{id}/claim", COLORS["orange_light"], COLORS["orange"])
    node(draw, (380, 805, 690, 955), "Agent B", "POST /leads/{id}/claim", COLORS["orange_light"], COLORS["orange"])
    node(draw, (840, 690, 1180, 850), "Atomic Claim", "Transaction validates status NEW and creates LeadClaim.", COLORS["green_light"], COLORS["green"])
    node(draw, (1330, 585, 1640, 735), "Winner", "Contact info unlocked", COLORS["sky"], COLORS["blue"])
    node(draw, (1330, 805, 1640, 955), "Others", "Claim closed in UI", COLORS["soft"], COLORS["line"])
    arrow(draw, (690, 660), (840, 745), COLORS["orange"], width=4)
    arrow(draw, (690, 880), (840, 800), COLORS["orange"], width=4)
    arrow(draw, (1180, 740), (1330, 660), COLORS["green"], width=4)
    arrow(draw, (1180, 800), (1330, 880), COLORS["gray"], width=4)

    rounded_box(draw, (170, 1040, 1730, 1125), COLORS["green_light"], COLORS["green"], width=3, radius=18)
    draw_wrapped_text(draw, (210, 1063), "Database guarantee: LeadClaim.leadId is unique and the transaction only accepts leads still in NEW status.", 1480, FONT_SMALL, COLORS["green"], center=True)
    return save(img, "diagram-lead-sequence.png")


def diagram_database() -> Path:
    img, draw = canvas("Database Schema Overview", "Core entities implemented in Prisma/PostgreSQL", size=(1900, 1260))
    boxes = {
        "User": (110, 190, 390, 300),
        "AgentProfile": (500, 190, 780, 300),
        "AgentRegion": (890, 190, 1170, 300),
        "Region": (1280, 190, 1560, 300),
        "Property": (500, 470, 780, 580),
        "PropertyImage": (110, 470, 390, 580),
        "StatusHistory": (110, 710, 390, 820),
        "Favorite": (890, 470, 1170, 580),
        "Lead": (1280, 470, 1560, 580),
        "LeadClaim": (1280, 710, 1560, 820),
        "Notification": (890, 710, 1170, 820),
    }
    descriptions = {
        "User": "role, status, email, phone",
        "AgentProfile": "agent metadata",
        "AgentRegion": "agent-region map",
        "Region": "city, district, ward",
        "Property": "listing inventory",
        "PropertyImage": "image URLs",
        "StatusHistory": "status audit trail",
        "Favorite": "saved properties",
        "Lead": "consultation request",
        "LeadClaim": "one claim per lead",
        "Notification": "in-app messages",
    }
    fills = {
        "User": COLORS["sky"],
        "AgentProfile": COLORS["orange_light"],
        "AgentRegion": COLORS["orange_light"],
        "Region": COLORS["green_light"],
        "Property": COLORS["sky"],
        "PropertyImage": COLORS["soft"],
        "StatusHistory": COLORS["soft"],
        "Favorite": COLORS["purple_light"],
        "Lead": COLORS["green_light"],
        "LeadClaim": COLORS["green_light"],
        "Notification": COLORS["purple_light"],
    }
    outlines = {
        "User": COLORS["blue"],
        "AgentProfile": COLORS["orange"],
        "AgentRegion": COLORS["orange"],
        "Region": COLORS["green"],
        "Property": COLORS["blue"],
        "PropertyImage": COLORS["line"],
        "StatusHistory": COLORS["line"],
        "Favorite": COLORS["purple"],
        "Lead": COLORS["green"],
        "LeadClaim": COLORS["green"],
        "Notification": COLORS["purple"],
    }
    for name, box in boxes.items():
        node(draw, box, name, descriptions[name], fills[name], outlines[name])

    def center_right(name): 
        x1, y1, x2, y2 = boxes[name]
        return x2, (y1 + y2) // 2

    def center_left(name): 
        x1, y1, x2, y2 = boxes[name]
        return x1, (y1 + y2) // 2

    def center_bottom(name):
        x1, y1, x2, y2 = boxes[name]
        return (x1 + x2) // 2, y2

    def center_top(name):
        x1, y1, x2, y2 = boxes[name]
        return (x1 + x2) // 2, y1

    rels = [
        ("User", "AgentProfile", "1:1"),
        ("AgentProfile", "AgentRegion", "1:N"),
        ("AgentRegion", "Region", "N:1"),
        ("Region", "Property", "1:N"),
        ("Region", "Lead", "1:N"),
        ("Property", "PropertyImage", "1:N"),
        ("Property", "StatusHistory", "1:N"),
        ("User", "Favorite", "1:N"),
        ("Property", "Favorite", "1:N"),
        ("Property", "Lead", "1:N"),
        ("Lead", "LeadClaim", "1:1"),
        ("User", "Notification", "1:N"),
    ]
    connections = [
        (center_right("User"), center_left("AgentProfile"), "1:1"),
        (center_right("AgentProfile"), center_left("AgentRegion"), "1:N"),
        (center_right("AgentRegion"), center_left("Region"), "N:1"),
        (center_bottom("Region"), center_top("Lead"), "routes"),
        (center_bottom("Region"), center_top("Property"), "groups"),
        (center_left("Property"), center_right("PropertyImage"), "has"),
        (center_bottom("PropertyImage"), center_top("StatusHistory"), "audit"),
        (center_right("Property"), center_left("Favorite"), "saved"),
        (center_right("Favorite"), center_left("Lead"), "inquiry"),
        (center_bottom("Lead"), center_top("LeadClaim"), "unique claim"),
        (center_bottom("Favorite"), center_top("Notification"), "notifies"),
    ]
    for start, end, label in connections:
        arrow(draw, start, end, COLORS["gray"], width=4)
        mx, my = (start[0] + end[0]) // 2, (start[1] + end[1]) // 2
        draw.rounded_rectangle((mx - 62, my - 20, mx + 62, my + 10), radius=10, fill=hex_to_rgb("#FFFFFF"), outline=hex_to_rgb("#E2E8F0"))
        draw_wrapped_text(draw, (mx - 54, my - 17), label, 108, FONT_TINY, COLORS["gray"], line_gap=1, center=True)

    note = "Terminology: PA documents use Area and LeadRequest; the implementation uses Region and Lead."
    rounded_box(draw, (170, 980, 1730, 1100), COLORS["soft"], COLORS["line"], width=3, radius=18)
    draw_wrapped_text(draw, (210, 1017), note, 1480, FONT_SMALL, COLORS["navy"], center=True)
    return save(img, "diagram-database.png")


def diagram_testing_pyramid() -> Path:
    img, draw = canvas("Testing Strategy", "QA pyramid and high-risk validation areas")
    cx = 950
    levels = [
        ("E2E / UI", "15% - Katalon, Playwright/Cypress", "#F0EEFF", COLORS["purple"], 335),
        ("Integration / API", "25% - Jest, Supertest, Prisma test DB", "#E9F6EF", COLORS["green"], 500),
        ("Unit Tests", "60% - Services, guards, DTOs, utilities", "#E8F2FB", COLORS["blue"], 665),
    ]
    widths = [650, 980, 1310]
    for i, (title, body, fill, outline, y) in enumerate(levels):
        w = widths[i]
        h = 135
        pts = [(cx - w // 2, y + h), (cx + w // 2, y + h), (cx + w // 2 - 85, y), (cx - w // 2 + 85, y)]
        draw.polygon(pts, fill=hex_to_rgb(fill), outline=hex_to_rgb(outline))
        draw.line(pts + [pts[0]], fill=outline, width=4)
        draw_wrapped_text(draw, (cx - w // 2 + 130, y + 26), title, w - 260, FONT_NODE, outline, center=True)
        draw_wrapped_text(draw, (cx - w // 2 + 120, y + 76), body, w - 240, FONT_SMALL, COLORS["ink"], center=True)

    node(draw, (170, 860, 820, 1045), "PA3 planned coverage", "130 test cases across Auth, Admin/Region, Property, Favorites, and Lead Management.", COLORS["soft"], COLORS["line"])
    node(draw, (1080, 860, 1730, 1045), "Critical risk focus", "Concurrent lead claiming, RBAC restrictions, property consistency, and real-time notification latency.", COLORS["soft"], COLORS["line"])
    return save(img, "diagram-testing-pyramid.png")


def diagram_assets() -> dict[str, Path]:
    return {
        "use_case": diagram_use_case(),
        "roadmap": diagram_sprint_roadmap(),
        "architecture": diagram_architecture(),
        "lead_sequence": diagram_lead_sequence(),
        "database": diagram_database(),
        "testing": diagram_testing_pyramid(),
    }


def set_cell_shading(cell, fill: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill.lstrip("#"))


def set_cell_borders(cell, color: str = "D8DEE8") -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = tc_pr.first_child_found_in("w:tcBorders")
    if borders is None:
        borders = OxmlElement("w:tcBorders")
        tc_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = "w:" + edge
        element = borders.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), "6")
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), color)


def set_cell_margins(cell, top=80, start=120, bottom=80, end=120) -> None:
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for m, v in {"top": top, "start": start, "bottom": bottom, "end": end}.items():
        node_el = tc_mar.find(qn(f"w:{m}"))
        if node_el is None:
            node_el = OxmlElement(f"w:{m}")
            tc_mar.append(node_el)
        node_el.set(qn("w:w"), str(v))
        node_el.set(qn("w:type"), "dxa")


def set_table_width(table, widths: list[float]) -> None:
    table.autofit = False
    for row in table.rows:
        for idx, width in enumerate(widths):
            cell = row.cells[idx]
            cell.width = Inches(width)
            tc_pr = cell._tc.get_or_add_tcPr()
            tc_w = tc_pr.find(qn("w:tcW"))
            if tc_w is None:
                tc_w = OxmlElement("w:tcW")
                tc_pr.append(tc_w)
            tc_w.set(qn("w:w"), str(int(width * 1440)))
            tc_w.set(qn("w:type"), "dxa")


def format_table(table, widths: list[float]) -> None:
    set_table_width(table, widths)
    for r_idx, row in enumerate(table.rows):
        for cell in row.cells:
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            set_cell_margins(cell)
            set_cell_borders(cell)
            if r_idx == 0:
                set_cell_shading(cell, COLORS["sky"])
                for p in cell.paragraphs:
                    for run in p.runs:
                        run.bold = True
                        run.font.color.rgb = RGBColor(22, 50, 79)
            else:
                set_cell_shading(cell, COLORS["paper"])
            for p in cell.paragraphs:
                p.paragraph_format.space_after = Pt(2)
                p.paragraph_format.line_spacing = 1.1
                for run in p.runs:
                    run.font.name = "Calibri"
                    run.font.size = Pt(9.5)


def add_table(doc: Document, headers: list[str], rows: list[list[str]], widths: list[float]) -> None:
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    for i, header in enumerate(headers):
        table.rows[0].cells[i].text = header
    for row_values in rows:
        row = table.add_row()
        for i, value in enumerate(row_values):
            row.cells[i].text = value
    format_table(table, widths)
    doc.add_paragraph()


def add_bullets(doc: Document, items: list[str]) -> None:
    for item in items:
        p = doc.add_paragraph(style="List Bullet")
        p.paragraph_format.left_indent = Inches(0.375)
        p.paragraph_format.first_line_indent = Inches(-0.188)
        p.paragraph_format.space_after = Pt(4)
        run = p.add_run(item)
        run.font.name = "Calibri"
        run.font.size = Pt(10.5)


def add_note(doc: Document, label: str, text: str, fill: str = "F6F8FB") -> None:
    table = doc.add_table(rows=1, cols=1)
    cell = table.cell(0, 0)
    cell.text = ""
    set_cell_shading(cell, fill)
    set_cell_borders(cell, "D8DEE8")
    set_cell_margins(cell, top=120, bottom=120, start=160, end=160)
    p = cell.paragraphs[0]
    r = p.add_run(label + ": ")
    r.bold = True
    r.font.color.rgb = RGBColor(22, 50, 79)
    r.font.size = Pt(10)
    r2 = p.add_run(text)
    r2.font.size = Pt(10)
    p.paragraph_format.space_after = Pt(0)
    doc.add_paragraph()


def add_picture(doc: Document, path: Path, caption: str) -> None:
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run()
    run.add_picture(str(path), width=Inches(6.35))
    cap = doc.add_paragraph(caption)
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap.style = "Caption"


def add_slide(doc: Document, title: str, bullets: list[str], note: str | None = None, image: Path | None = None) -> None:
    h = doc.add_heading(title, level=1)
    h.paragraph_format.keep_with_next = True
    if image:
        add_picture(doc, image, title.replace("Slide", "Figure"))
    if bullets:
        add_bullets(doc, bullets)
    if note:
        add_note(doc, "Speaker note", note)


def setup_document() -> Document:
    doc = Document()
    section = doc.sections[0]
    section.orientation = WD_ORIENT.PORTRAIT
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(0.75)
    section.bottom_margin = Inches(0.75)
    section.left_margin = Inches(0.85)
    section.right_margin = Inches(0.85)
    section.header_distance = Inches(0.492)
    section.footer_distance = Inches(0.492)

    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = RGBColor(23, 32, 51)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.18

    for level, size, color, before, after in [
        (1, 16, "2E74B5", 14, 7),
        (2, 13, "2E74B5", 10, 5),
        (3, 12, "1F4D78", 8, 4),
    ]:
        style = styles[f"Heading {level}"]
        style.font.name = "Calibri"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor.from_string(color)
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.keep_with_next = True

    caption = styles["Caption"]
    caption.font.name = "Calibri"
    caption.font.size = Pt(9)
    caption.font.italic = True
    caption.font.color.rgb = RGBColor(87, 99, 117)
    caption.paragraph_format.space_after = Pt(8)

    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = footer.add_run("SELAP Final Presentation Content")
    run.font.size = Pt(8)
    run.font.color.rgb = RGBColor(107, 114, 128)
    return doc


def add_cover(doc: Document) -> None:
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(90)
    run = p.add_run("SELAP")
    run.bold = True
    run.font.size = Pt(34)
    run.font.color.rgb = RGBColor(22, 50, 79)

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("Final Presentation Content")
    run.bold = True
    run.font.size = Pt(22)
    run.font.color.rgb = RGBColor(46, 116, 181)

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("Centralized real estate management with real-time lead claiming")
    run.font.size = Pt(12)
    run.font.color.rgb = RGBColor(87, 99, 117)

    add_note(
        doc,
        "Source basis",
        "Prepared from PA0, PA1, PA2, PA3 and verified against the current Next.js/NestJS/Prisma implementation. PA4 is not present in the workspace, so Katalon PASS screenshots remain placeholders.",
        "F3F7FB",
    )
    doc.add_page_break()


def build_doc() -> None:
    assets = diagram_assets()
    doc = setup_document()
    add_cover(doc)

    add_slide(
        doc,
        "Slide 1. Problem Statement",
        [
            "Real estate SMEs still manage inventory, customers, and transaction status through scattered files and chat channels.",
            "Property status is not synchronized in real time, creating duplicated consultations and outdated customer information.",
            "Manual lead distribution is opaque and easily causes internal disputes between Sales Agents.",
            "Managers lack structured regional assignment and local performance visibility.",
        ],
        "Position the problem as an operations and coordination issue, not merely a listing website issue.",
    )

    add_slide(
        doc,
        "Slide 2. Product Positioning",
        [
            "SELAP is a centralized real estate management web platform for properties, users, regions, favorites, leads, and notifications.",
            "Centralized repository: one trusted source for inventory and customer interaction data.",
            "Real-time lead sharing: Socket.IO broadcasts consultation requests to eligible agents.",
            "Regional partitioning: agents receive and manage leads/properties only in assigned service regions.",
            "Positioning statement: SELAP helps real estate teams reduce fragmented data, prevent lead disputes, and respond faster to customers.",
        ],
    )

    doc.add_heading("Slide 3. Target Users And Value Proposition", level=1)
    add_table(
        doc,
        ["User", "Main Goals", "SELAP Value"],
        [
            ["Administrator", "Approve agents, assign regions, manage staff and properties", "Operational control over users, regions, and listings"],
            ["Sales Agent", "Manage listings, receive new leads, claim customers quickly", "Fair access to relevant leads and protected contact data after claiming"],
            ["Customer", "Browse properties, save favorites, request consultation", "Faster property discovery and direct connection to an available agent"],
        ],
        [1.35, 2.45, 2.7],
    )

    doc.add_heading("Slide 4. Project Management And Team Structure", level=1)
    add_table(
        doc,
        ["Member", "Primary Role", "Key Responsibilities"],
        [
            ["Cao Hai Vy", "Project Lead / Business Analyst", "Sprint planning, requirement analysis, coordination, backend support"],
            ["Nguyen Lam Thao Trang", "Backend Developer / QA Tester", "Backend APIs, test planning, functional and integration testing"],
            ["Nguyen Thanh Nguyen", "Frontend Developer / Database Designer", "Next.js UI, schema design, data relationships, frontend integration"],
            ["Huynh Mai Tram", "Frontend Developer / UI/UX Support", "UI screens, user flows, responsive layout, usability refinement"],
        ],
        [1.55, 1.75, 3.2],
    )
    add_note(doc, "Speaker note", "Roles show primary ownership; the team also supported each other across analysis, design, implementation, and testing.")

    add_slide(
        doc,
        "Slide 5. Agile/Scrum Workflow",
        [],
        image=assets["roadmap"],
    )

    add_slide(
        doc,
        "Slide 6. Software Requirements: Use Case Model",
        [
            "Core PA1 use cases: Sign Up, Sign In, Password Recovery, Browse/Filter Properties, Favorites, Request Consultation, Property CRUD, Real-time Lead Notifications, Claim Lead, Approve Agent Account, Receive Notifications.",
        ],
        image=assets["use_case"],
    )

    add_slide(
        doc,
        "Slide 7. Core Functional Requirements",
        [
            "Authentication: unique email/phone registration, 4-digit OTP email verification, phone-password-role login.",
            "RBAC and account status: JWT-protected APIs; Sales Agents start as PENDING and require Admin approval.",
            "Property management: Admins manage all properties; Sales Agents manage only assigned-region properties.",
            "Public catalog: search and filter by keyword, location, type, price, area, and status.",
            "Favorites and notifications: saved properties, property status alerts, lead accepted alerts.",
            "Real-time lead claiming: eligible agents receive regional consultation requests and compete through the Accept action.",
        ],
    )

    add_slide(
        doc,
        "Slide 8. Non-Functional Requirements",
        [
            "Performance target: core API responses below 500 ms under normal conditions.",
            "Real-time target: lead and notification delivery within 1 second, including the 100 concurrent user test scenario.",
            "Security: JWT access tokens, role checks, account status validation, email verification, and secure password hashing.",
            "Data consistency: one lead can only be claimed once under simultaneous Accept actions.",
            "Maintainability: modular monolithic NestJS backend separated into domain modules.",
            "Portability: suitable for Vercel, Render/Railway, and Supabase PostgreSQL deployment.",
        ],
    )
    add_note(doc, "Implementation note", "The current backend uses Node.js scrypt password hashing. If the rubric expects bcrypt, present it as secure password hashing with scrypt in the current implementation.", "FFF3E6")

    add_slide(
        doc,
        "Slide 9. Architecture: Modular Monolithic System",
        [
            "Frontend: Next.js pages for login, registration, catalog, detail, favorites, notifications, property management, pending agents, staff directory, and lead inbox.",
            "Backend: NestJS modular monolith with REST controllers and Socket.IO ClaimingGateway.",
            "Persistence: Prisma ORM maps application models to PostgreSQL.",
            "Real-time layer: WebSocket rooms segment messages by user and region.",
        ],
        image=assets["architecture"],
    )

    add_slide(
        doc,
        "Slide 10. Design Highlight: Real-Time Lead Claiming",
        [
            "Sales Agents join region rooms such as region_{regionId}; Customers join user rooms such as user_{userId}.",
            "The first successful claim changes a lead from NEW to CLAIMED and creates a unique LeadClaim.",
            "Other agents immediately receive lead_claimed so the UI can close the claim action.",
            "Customer contact information remains hidden until a Sales Agent successfully claims the lead.",
        ],
        image=assets["lead_sequence"],
    )

    add_slide(
        doc,
        "Slide 11. Database Schema Overview",
        [
            "Main entities: User, AgentProfile, Region, AgentRegion, Property, PropertyImage, PropertyStatusHistory, Favorite, Lead, LeadClaim, Notification.",
            "LeadClaim.leadId is unique, which supports the one-claim-per-lead rule.",
            "Terminology note: PA documents sometimes use Area and LeadRequest; the implementation names them Region and Lead.",
        ],
        image=assets["database"],
    )

    add_slide(
        doc,
        "Slide 12. Implementation Evidence",
        [
            "Authentication: registration, email verification, login, password recovery, reset token, and /auth/me.",
            "Admin: pending Sales Agent approval, rejection, region assignment, staff directory.",
            "Property: public listing, detail view, management view, image upload, filtering, status history, favorite-status notifications.",
            "Lead: create consultation request, view available leads, claim lead, view assigned leads, update lead status.",
            "Realtime: Socket.IO /claiming namespace, JWT-authenticated connections, region rooms, user rooms, new_lead, lead_claimed, and lead_accepted events.",
        ],
    )

    doc.add_heading("Slide 13. Testing Strategy And QA Pyramid", level=1)
    add_picture(doc, assets["testing"], "Figure 13. Testing Strategy And QA Pyramid")
    add_table(
        doc,
        ["Test Level", "Allocation", "Purpose", "Tools"],
        [
            ["Unit Testing", "60%", "Validate services, guards, DTOs, utilities, and business rules", "Jest"],
            ["Integration/API Testing", "25%", "Validate module interaction, Prisma database behavior, REST endpoints, and lead-claim consistency", "Jest, Supertest, Prisma test DB, Postman/Bruno"],
            ["E2E/UI Testing", "15%", "Validate critical browser journeys across frontend, backend, and database", "Katalon Studio, Playwright/Cypress"],
            ["Performance Testing", "Targeted", "Validate API latency, WebSocket latency, and concurrent lead claiming", "k6, Locust, scripted Socket.IO/API clients"],
        ],
        [1.25, 0.9, 2.9, 1.45],
    )

    doc.add_heading("Slide 14. Automation Testing With Katalon Studio", level=1)
    add_table(
        doc,
        ["Scenario", "Business Risk Covered", "Evidence"],
        [
            ["Customer registration and OTP/email verification", "Customer onboarding and identity verification", "Insert Katalon PASS screenshot"],
            ["Sales Agent registration and Admin approval with region assignment", "Unauthorized access prevention and regional routing", "Insert Katalon PASS screenshot"],
            ["Property creation and catalog filtering", "Inventory publishing and property discovery", "Insert Katalon PASS screenshot"],
            ["Consultation request and real-time lead claiming conflict", "SELAP core USP: first successful agent claims the lead", "Insert Katalon PASS screenshot"],
        ],
        [2.35, 2.65, 1.5],
    )
    add_note(doc, "Presenter note", "PA4 is not present in the workspace. Replace these placeholders with actual Katalon pass images and update the exact pass count after PA4 or screenshots are added.", "FDECEC")

    add_slide(
        doc,
        "Slide 15. Test Results And System Stability",
        [
            "Requirement/test design completion: 130 planned test cases documented in PA3.",
            "Detailed scenario coverage: 12 high-risk test specifications documented.",
            "Current repository smoke test: backend Jest smoke test passed, 1 test suite and 1 test case.",
            "Release quality gate: no unresolved Critical or High severity defects.",
            "API quality gate: core response time below 500 ms under normal conditions.",
            "Realtime quality gate: lead claiming and WebSocket notifications below 1 second under 100 concurrent users.",
            "Consistency gate: concurrent lead claiming records only one successful LeadClaim per lead.",
        ],
    )

    add_slide(
        doc,
        "Slide 16. Closing Message",
        [
            "SELAP is not just a property listing website; it is an internal operating platform for real estate teams.",
            "The system connects property data, users, regional assignments, customer requests, and real-time lead ownership in one workflow.",
            "The strongest product value is transparent, low-latency lead claiming with database-level consistency.",
            "Future improvements: analytics dashboards, commission calculation, production cloud storage for images, and expanded automated regression coverage.",
        ],
    )

    doc.save(OUT_DOCX)


if __name__ == "__main__":
    build_doc()
    print(OUT_DOCX)
