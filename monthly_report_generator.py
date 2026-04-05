import modal
from modal import App, Image, Volume, web_endpoint
import json
import base64
import requests
from pathlib import Path
from jinja2 import Environment, FileSystemLoader

# Define the Modal App
app = App("monthly-report-generator")

# Define Persistence Volume
volume = Volume.from_name("report-output", create_if_missing=True)

import fastapi

# Define Image with dependencies
image = (
    Image.debian_slim()
    # Install fastapi and uvicorn explicitly
    .pip_install("fastapi", "uvicorn", "jinja2", "playwright", "requests")
    .run_commands("playwright install-deps", "playwright install chromium")
    .add_local_dir("execution/templates", "/root/templates")
)

@app.function(image=image, volumes={"/root/output": volume}, timeout=300)
async def generate_pdf(data: dict):
    from playwright.async_api import async_playwright
    
    # 1. HELPER: Image to Base64
    def get_image_base64(url):
        if not url: return None
        try:
            if url.startswith('data:'): return url
            if not url.startswith('http'): 
                print(f"Skipping non-http image: {url}")
                return None
            
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                b64 = base64.b64encode(response.content).decode('utf-8')
                mime = response.headers.get('Content-Type', 'image/jpeg')
                return f"data:{mime};base64,{b64}"
        except Exception as e:
            print(f"Error fetching image {url}: {e}")
        return None

    # 2. HELPER: Process Image Arrays
    async def process_images(img_list):
        if not img_list or not isinstance(img_list, list): return []
        processed = []
        for img in img_list:
            b64 = get_image_base64(img)
            if b64: processed.append(b64)
            else: processed.append(img) # Keep original if fail
        return processed

    # 3. HELPER: Chart Logic (Replicating JS math)
    def calculate_chart_data(global_revenue):
        chart_data = global_revenue.get('chartData', {})
        labels = chart_data.get('labels', [])
        revenue_data = chart_data.get('revenueData', [])
        ads_data = chart_data.get('adsSpentData', [])

        width = 1000
        height = 400
        padding = {'top': 60, 'right': 30, 'bottom': 40, 'left': 60}
        
        chart_width = width - padding['left'] - padding['right']
        chart_height = height - padding['top'] - padding['bottom']
        
        max_rev = max(revenue_data) if revenue_data else 0
        max_ads = max(ads_data) if ads_data else 0
        max_val = max(max_rev, max_ads) * 1.2
        if max_val == 0: max_val = 1
        
        # Grid Lines
        grids = []
        for i in range(6):
            y = height - padding['bottom'] - (i * chart_height / 5)
            val = (max_val / 5) * i
            
            # Format currency short
            label = ""
            if val >= 1_000_000_000: label = f"Rp{val/1_000_000_000:.1f}M"
            elif val >= 1_000_000: label = f"Rp{val/1_000_000:.0f}jt"
            else: label = f"Rp{val:,.0f}".replace(',', '.')
            
            grids.append({
                'x1': padding['left'], 'y1': y,
                'x2': width - padding['right'], 'y2': y,
                'text_x': padding['left'] - 10, 'text_y': y + 4,
                'label': label
            })
            
        # Bars
        bars = []
        bar_count = len(labels) if labels else 1
        bar_width = (chart_width / bar_count) * 0.6
        
        def get_bar_x(index):
            return padding['left'] + (index * (chart_width / bar_count)) + ((chart_width / bar_count) - bar_width) / 2
            
        def get_y(value):
            return height - padding['bottom'] - (value / max_val) * chart_height

        for i, val in enumerate(revenue_data):
            x = get_bar_x(i)
            y = get_y(val)
            h = height - padding['bottom'] - y
            bars.append({
                'x': x, 'y': y, 'width': bar_width, 'height': h,
                'value_label': f"Rp{val:,.0f}".replace(',', '.'),
                'label_x': x + bar_width/2, 'label_y': y - 5
            })
            
        # Line Points
        points = []
        polyline_points = []
        for i, val in enumerate(ads_data):
            x = get_bar_x(i) + bar_width/2
            y = get_y(val)
            points.append({
                'x': x, 'y': y,
                'value_label': f"Rp{val:,.0f}".replace(',', '.'),
                'label_y': y - 10
            })
            polyline_points.append(f"{x},{y}")
            
        # X Axis
        x_axis = []
        for i, label in enumerate(labels):
            x = get_bar_x(i) + bar_width/2
            y = height - padding['bottom'] + 20
            x_axis.append({'x': x, 'y': y, 'label': label})
            
        return {
            'width': width, 'height': height,
            'grids': grids, 'bars': bars,
            'polyline_points': " ".join(polyline_points),
            'points': points,
            'x_axis': x_axis
        }

    # 4. PREPARE DATA
    # Convert logo
    if data.get('logoUrl'):
        data['logoUrl'] = get_image_base64(data['logoUrl'])
        
    # Convert screenshot arrays
    if 'operationalScreenshots' in data:
        data['operationalScreenshots'] = await process_images(data['operationalScreenshots'])
    if 'promotionScreenshots' in data:
        data['promotionScreenshots'] = await process_images(data['promotionScreenshots'])
        
    # Convert Top Product images
    if 'topProducts' in data:
        for p in data['topProducts']:
            if p.get('image'): p['image'] = get_image_base64(p['image'])
            
    # Convert CPAS Best Campaign images
    if 'cpas_data' in data and data['cpas_data'] and 'best_campaigns' in data['cpas_data']:
        bc = data['cpas_data']['best_campaigns']
        # NV Images
        if 'nv' in bc and 'images' in bc['nv']:
            bc['nv']['images'] = await process_images(bc['nv']['images'])
        # RM Images
        if 'rm' in bc and 'images' in bc['rm']:
            bc['rm']['images'] = await process_images(bc['rm']['images'])
                
    # Calculate Chart Data
    if 'globalRevenue' in data:
        # Filter months where BOTH revenue and ads spent are 0 (mirrors execution/generator.js:344-374)
        gr = data['globalRevenue']
        if isinstance(gr, dict) and isinstance(gr.get('chartData'), dict):
            cd = gr['chartData']
            labels = cd.get('labels') or []
            rev_arr = cd.get('revenueData') or []
            ads_arr = cd.get('adsSpentData') or []
            if isinstance(labels, list) and isinstance(rev_arr, list) and isinstance(ads_arr, list):
                f_labels, f_rev, f_ads = [], [], []
                for i, label in enumerate(labels):
                    r = rev_arr[i] if i < len(rev_arr) else 0
                    a = ads_arr[i] if i < len(ads_arr) else 0
                    if (r or 0) > 0 or (a or 0) > 0:
                        f_labels.append(label)
                        f_rev.append(r or 0)
                        f_ads.append(a or 0)
                cd['labels'] = f_labels
                cd['revenueData'] = f_rev
                cd['adsSpentData'] = f_ads
        data['chart_svg_data'] = calculate_chart_data(data['globalRevenue'])
        
    # Read CSS
    with open("/root/templates/styles_atria.css", "r") as f:
        data['cssContent'] = f.read()

    # 5. RENDER HTML
    env = Environment(loader=FileSystemLoader("/root/templates"))
    
    # Custom filters
    def format_number(value):
        try:
            return f"{value:,.0f}".replace(",", ".")
        except:
            return value

    def round_filter(value, precision=1):
        try:
            return round(float(value), precision)
        except:
            return value

    def title_case(value):
        try:
            import re
            # Split camelCase
            s1 = re.sub('(.)([A-Z][a-z]+)', r'\1 \2', str(value))
            return s1.title()
        except:
            return value

    env.filters['format_number'] = format_number
    env.filters['round'] = round_filter
    env.filters['title_case'] = title_case
    
    template = env.get_template("template_modal.html")
    html_content = template.render(**data)
    
    # 6. PRINT PDF using Playwright
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.set_content(html_content)
        
        pdf_bytes = await page.pdf(
            format="A4",
            print_background=True,
            margin={"top": "0mm", "right": "0mm", "bottom": "0mm", "left": "0mm"}
        )
        await browser.close()
        
    # 7. SAVE TO VOLUME
    filename = f"Report_{data.get('brandName', 'Brand')}_{data.get('reportMonth', 'Month')}.pdf".replace(" ", "_")
    output_path = f"/root/output/{filename}"
    
    # Write to volume
    with open(output_path, "wb") as f:
        f.write(pdf_bytes)
    volume.commit() # Persist changes
    
    return filename, output_path

@app.function(volumes={"/root/output": volume})
@modal.web_endpoint(method="GET")
def download(filename: str):
    from fastapi.responses import FileResponse, Response
    import re

    # Sanitize filename to prevent path traversal
    safe_filename = Path(filename).name
    if not safe_filename or safe_filename in ('.', '..') or not re.match(r'^[\w\-. ]+\.pdf$', safe_filename):
        return Response(status_code=400, content="Invalid filename")

    file_path = Path("/root/output") / safe_filename
    # Ensure resolved path is still within output directory
    if not str(file_path.resolve()).startswith("/root/output"):
        return Response(status_code=403, content="Access denied")

    if file_path.exists():
        with open(file_path, "rb") as f:
            content = f.read()

        return Response(
            content=content,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={safe_filename}"}
        )
    else:
        return Response(status_code=404, content="File not found")

@app.function(volumes={"/root/output": volume})
@modal.web_endpoint(method="POST")
async def webhook(data: dict):
    # Trigger generation
    filename, _ = await generate_pdf.remote.aio(data)
    
    # Construct download URL
    # Note: In Modal, we need to know our own URL structure.
    # Usually it is https://<username>--<app-name>-download.modal.run/?filename=...
    # We will return a relative hint or try to construct it if passed in headers (hard in async).
    
    return {
        "success": True,
        "message": "PDF Generated Successfully",
        "filename": filename,
        "download_instruction": f"Please GET the /download endpoint with ?filename={filename}"
    }
