#!/usr/bin/env python3
"""
Test render: generates HTML preview from template_modal.html + sample_data.json.
Open the output HTML in browser, then print to PDF (or use Puppeteer via Node).

Usage: python3 execution/test_render_modal.py
"""
import json
import re
import os
import base64
from pathlib import Path
from jinja2 import Environment, FileSystemLoader

BASE_DIR = Path(__file__).parent
TEMPLATES_DIR = BASE_DIR / "templates"
OUTPUT_DIR = BASE_DIR.parent / "output"


def format_number(value):
    try:
        return f"{int(value):,}".replace(",", ".")
    except (ValueError, TypeError):
        return value


def round_filter(value, precision=1):
    try:
        return round(float(value), precision)
    except (ValueError, TypeError):
        return value


def title_case(value):
    try:
        s = re.sub(r'([A-Z])', r' \1', str(value))
        return s.strip().title()
    except Exception:
        return value


def format_chart_value(val):
    """Abbreviate large numbers for chart labels to prevent overlap."""
    if val >= 1e9:
        return f"Rp{val/1e9:.1f}M"
    elif val >= 1e6:
        return f"Rp{val/1e6:.0f}jt"
    else:
        return f"Rp{val:,.0f}".replace(",", ".")


def embed_fonts(css_content):
    """Strip CDN @import and embed local woff2 fonts as base64 for offline rendering."""
    fonts_dir = BASE_DIR / "assets" / "fonts"
    font_map = [
        ("Inter-Regular.woff2", "Inter", 400, "normal"),
        ("Inter-SemiBold.woff2", "Inter", 600, "normal"),
        ("Inter-Bold.woff2", "Inter", 700, "normal"),
        ("Inter-Black.woff2", "Inter", 900, "normal"),
        ("Montserrat-Regular.woff2", "Montserrat", 400, "normal"),
        ("Montserrat-SemiBold.woff2", "Montserrat", 600, "normal"),
        ("Montserrat-Bold.woff2", "Montserrat", 700, "normal"),
        ("Montserrat-Black.woff2", "Montserrat", 900, "normal"),
    ]

    font_css = "/* Embedded Fonts */\n"
    for filename, family, weight, style in font_map:
        font_path = fonts_dir / filename
        if font_path.exists():
            with open(font_path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode()
            font_css += (
                f"@font-face {{\n"
                f"  font-family: '{family}';\n"
                f"  font-weight: {weight};\n"
                f"  font-style: {style};\n"
                f"  src: url('data:font/woff2;base64,{b64}') format('woff2');\n"
                f"}}\n"
            )

    css_content = re.sub(r"@import url\([^)]+\);\s*", "", css_content)
    return font_css + css_content


def calculate_chart_data(global_revenue):
    cd = global_revenue.get("chartData", {})
    labels = cd.get("labels", [])
    revenue_data = cd.get("revenueData", [])
    ads_data = cd.get("adsSpentData", [])

    width, height = 1000, 400
    pad = {"top": 60, "right": 30, "bottom": 40, "left": 60}
    cw = width - pad["left"] - pad["right"]
    ch = height - pad["top"] - pad["bottom"]
    max_val = max(max(revenue_data, default=0), max(ads_data, default=0)) * 1.2 or 1

    grids = []
    for i in range(6):
        y = height - pad["bottom"] - (i * ch / 5)
        val = (max_val / 5) * i
        if val >= 1e9:
            label = f"Rp{val/1e9:.1f}M"
        elif val >= 1e6:
            label = f"Rp{val/1e6:.0f}jt"
        else:
            label = f"Rp{val:,.0f}".replace(",", ".")
        grids.append({
            "x1": pad["left"], "y1": y,
            "x2": width - pad["right"], "y2": y,
            "text_x": pad["left"] - 10, "text_y": y + 4,
            "label": label,
        })

    bar_count = len(labels) or 1
    bar_width = (cw / bar_count) * 0.6

    def get_x(i):
        return pad["left"] + (i * (cw / bar_count)) + ((cw / bar_count) - bar_width) / 2

    def get_y(v):
        return height - pad["bottom"] - (v / max_val) * ch

    bars = []
    for i, v in enumerate(revenue_data):
        x = get_x(i)
        y = get_y(v)
        bars.append({
            "x": x, "y": y, "width": bar_width, "height": height - pad["bottom"] - y,
            "value_label": format_chart_value(v),
            "label_x": x + bar_width / 2, "label_y": y - 5,
        })

    points = []
    polyline_parts = []
    for i, v in enumerate(ads_data):
        x = get_x(i) + bar_width / 2
        y = get_y(v)
        points.append({
            "x": x, "y": y,
            "value_label": format_chart_value(v),
            "label_y": y - 10,
        })
        polyline_parts.append(f"{x},{y}")

    x_axis = []
    for i, lbl in enumerate(labels):
        x_axis.append({"x": get_x(i) + bar_width / 2, "y": height - pad["bottom"] + 20, "label": lbl})

    return {
        "width": width, "height": height,
        "grids": grids, "bars": bars,
        "polyline_points": " ".join(polyline_parts),
        "points": points, "x_axis": x_axis,
    }


def main():
    # Load data
    with open(BASE_DIR / "sample_data.json", "r") as f:
        data = json.load(f)

    # Calculate chart SVG data
    if "globalRevenue" in data:
        data["chart_svg_data"] = calculate_chart_data(data["globalRevenue"])

    # Read CSS + embed fonts for offline rendering
    with open(TEMPLATES_DIR / "styles_atria.css", "r") as f:
        data["cssContent"] = embed_fonts(f.read())

    # Setup Jinja2
    env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)))
    env.filters["format_number"] = format_number
    env.filters["round"] = round_filter
    env.filters["title_case"] = title_case

    template = env.get_template("template_modal.html")
    html = template.render(**data)

    # Output
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    html_path = OUTPUT_DIR / "test_modal_preview.html"
    with open(html_path, "w") as f:
        f.write(html)

    print(f"HTML preview saved: {html_path}")
    print("Open this file in a browser to preview. Then use Puppeteer to generate PDF.")


if __name__ == "__main__":
    main()
