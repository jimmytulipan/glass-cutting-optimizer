from flask import Flask, render_template, request, jsonify, send_from_directory, Response, make_response
import numpy as np
import os
import logging
from datetime import datetime
from dataclasses import dataclass
from typing import List, Tuple, Dict
import io
from reportlab.lib.pagesizes import A4, letter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.lib.units import cm
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')

# Konfigurácia
STOCK_WIDTH = 321
STOCK_HEIGHT = 225
app = Flask(__name__, template_folder='templates')

# Nastavenie logovania
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class GlassPanel:
    width: float
    height: float
    thickness: float
    rotated: bool = False
    
    def get_dimensions(self) -> Tuple[float, float]:
        return (self.height, self.width) if self.rotated else (self.width, self.height)
    
    def rotate(self):
        self.rotated = not self.rotated
        return self

class GlassCalculator:
    def calculate_price(self, glass_type: str, area: float, waste_percentage: float) -> Dict:
        # Simulácia ceny za kategórie skla
        base_prices = {
            "float": 15.0,
            "planibel": 20.0,
            "connex": 30.0,
            "default": 25.0
        }
        
        # Výber základnej ceny alebo predvolenej hodnoty
        price_per_m2 = base_prices.get(glass_type.lower(), base_prices["default"])
        
        # Výpočet ceny za plochu
        waste_area = area * (waste_percentage / 100.0)
        area_price = area * price_per_m2
        waste_price = waste_area * price_per_m2
        
        return {
            'glass_name': glass_type,
            'area': round(area, 2),
            'area_price': round(area_price, 2),
            'waste_area': round(waste_area, 2),
            'waste_price': round(waste_price, 2),
            'total_price': round(area_price + waste_price, 2)
        }

class CuttingOptimizer:
    def __init__(self, stock_width: float = STOCK_WIDTH, stock_height: float = STOCK_HEIGHT):
        self.stock_width = stock_width
        self.stock_height = stock_height
        self.min_gap = 0.2
    
    def optimize(self, panels: List[GlassPanel]) -> Tuple[List[Dict], float]:
        # Jednoduchá implementácia prvý vhodný algoritmus
        sorted_panels = sorted(panels, key=lambda p: p.width * p.height, reverse=True)
        layout = []
        
        # Začiatočný bod (0,0) na ľavom dolnom rohu
        spaces = [(0, 0, self.stock_width, self.stock_height)]
        
        for panel in sorted_panels:
            width, height = panel.get_dimensions()
            placed = False
            
            for space_index, (space_x, space_y, space_width, space_height) in enumerate(spaces):
                if width <= space_width and height <= space_height:
                    # Umiestnenie panelu
                    layout.append({
                        'x': space_x,
                        'y': space_y,
                        'width': width,
                        'height': height,
                        'rotated': panel.rotated
                    })
                    placed = True
                    
                    # Vytvorenie nových priestorov po umiestnení
                    new_spaces = []
                    if space_width - width > 0:
                        new_spaces.append((
                            space_x + width,
                            space_y,
                            space_width - width,
                            height
                        ))
                    if space_height - height > 0:
                        new_spaces.append((
                            space_x,
                            space_y + height,
                            space_width,
                            space_height - height
                        ))
                    
                    spaces = spaces[:space_index] + spaces[space_index+1:] + new_spaces
                    break
            
            if not placed:
                # Skúsime otočiť panel
                panel.rotate()
                width, height = panel.get_dimensions()
                
                for space_index, (space_x, space_y, space_width, space_height) in enumerate(spaces):
                    if width <= space_width and height <= space_height:
                        # Umiestnenie otočeného panelu
                        layout.append({
                            'x': space_x,
                            'y': space_y,
                            'width': width,
                            'height': height,
                            'rotated': panel.rotated
                        })
                        placed = True
                        
                        # Vytvorenie nových priestorov po umiestnení
                        new_spaces = []
                        if space_width - width > 0:
                            new_spaces.append((
                                space_x + width,
                                space_y,
                                space_width - width,
                                height
                            ))
                        if space_height - height > 0:
                            new_spaces.append((
                                space_x,
                                space_y + height,
                                space_width,
                                space_height - height
                            ))
                        
                        spaces = spaces[:space_index] + spaces[space_index+1:] + new_spaces
                        break
        
        # Výpočet využitia a odpadu
        total_panels_area = sum(p.width * p.height for p in panels) / 10000  # v m²
        stock_area = (self.stock_width * self.stock_height) / 10000  # v m²
        waste_percentage = ((stock_area - total_panels_area) / stock_area) * 100 if stock_area > 0 else 0
        
        return layout, waste_percentage

    def calculate_total_area(self, panels: List[GlassPanel]) -> float:
        return sum(panel.width * panel.height for panel in panels) / 10000  # v m²

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

@app.route('/api/optimize', methods=['POST'])
def optimize():
    try:
        data = request.json
        dimensions = data.get('dimensions', '')
        stock_width = float(data.get('stock_width', STOCK_WIDTH))
        stock_height = float(data.get('stock_height', STOCK_HEIGHT))
        
        # Parsovanie rozmerov skla
        panels = []
        for dim in dimensions.split('-'):
            parts = dim.split('x')
            if len(parts) == 2:
                try:
                    width, height = float(parts[0].strip()), float(parts[1].strip())
                    panels.append(GlassPanel(width, height, 4.0))
                except ValueError:
                    continue
        
        if not panels:
            return jsonify({'error': 'Neplatné rozmery skla'}), 400
        
        # Optimalizácia rozloženia
        optimizer = CuttingOptimizer(stock_width, stock_height)
        layout, waste_percentage = optimizer.optimize(panels)
        total_area = optimizer.calculate_total_area(panels)
        
        return jsonify({
            'success': True,
            'sheets': [{
                'layout': layout,
                'waste_percentage': round(waste_percentage, 2),
                'total_area': round(total_area, 2)
            }]
        })
    except Exception as e:
        logger.error(f"Chyba pri optimalizácii: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/calculate-price', methods=['POST'])
def calculate_price():
    try:
        data = request.json
        glass_type = data.get('glassType', 'default')
        area = float(data.get('area', 0))
        waste_percentage = float(data.get('wastePercentage', 0))
        
        calculator = GlassCalculator()
        price_result = calculator.calculate_price(glass_type, area, waste_percentage)
        
        return jsonify({
            'success': True,
            'price': price_result
        })
    except Exception as e:
        logger.error(f"Chyba pri výpočte ceny: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/get-glass-categories', methods=['GET'])
def get_glass_categories():
    # Simulácia kategórií skla
    categories = [
        {'id': 1, 'name': 'FLOAT'},
        {'id': 2, 'name': 'PLANIBEL'},
        {'id': 3, 'name': 'CONNEX'},
        {'id': 4, 'name': 'LACOBEL'}
    ]
    return jsonify(categories)

@app.route('/api/get-glass-types', methods=['GET'])
def get_glass_types():
    category_id = request.args.get('categoryId', '1')
    
    # Simulácia typov skla podľa kategórie
    glass_types = {
        '1': [
            {'id': 1, 'name': '2 mm Float', 'price_per_m2': 11.67},
            {'id': 2, 'name': '3 mm Float', 'price_per_m2': 6.41},
            {'id': 3, 'name': '4 mm Float', 'price_per_m2': 7.74}
        ],
        '2': [
            {'id': 4, 'name': '3 mm Planibel bronz', 'price_per_m2': 8.25},
            {'id': 5, 'name': '4 mm Planibel bronz', 'price_per_m2': 15.20}
        ],
        '3': [
            {'id': 6, 'name': '33.1 číre', 'price_per_m2': 19.35},
            {'id': 7, 'name': '44.1 číre', 'price_per_m2': 23.32}
        ],
        '4': [
            {'id': 8, 'name': '4mm Lacobel čierny', 'price_per_m2': 19.64},
            {'id': 9, 'name': '4mm Lacobel biely', 'price_per_m2': 25.33}
        ]
    }
    
    return jsonify(glass_types.get(category_id, []))

def draw_layout_to_buffer(stock_width, stock_height, layout, colors):
    """Vykreslí layout do bufferu v pamäti pre PDF."""
    
    # Výpočet hraníc pre zoom - najprv zistíme rozsah použitej plochy
    if not layout:
        return None  # Ak nie sú žiadne panely, vrátime None
    
    min_x, min_y = stock_width, stock_height
    max_x, max_y = 0, 0
    
    for panel in layout:
        x, y = panel['x'], panel['y']
        w, h = panel['width'], panel['height']
        min_x = min(min_x, x)
        min_y = min(min_y, y)
        max_x = max(max_x, x + w)
        max_y = max(max_y, y + h)
    
    # Pridanie paddingu okolo použitej plochy (5% z rozmerov)
    padding_x = (max_x - min_x) * 0.05
    padding_y = (max_y - min_y) * 0.05
    
    # Výsledné hranice s paddingom
    min_x = max(0, min_x - padding_x)
    min_y = max(0, min_y - padding_y)
    max_x = min(stock_width, max_x + padding_x)
    max_y = min(stock_height, max_y + padding_y)
    
    # Rozmery pre vykreslenie
    plot_width = max_x - min_x
    plot_height = max_y - min_y
    
    # Prispôsobenie veľkosti obrázku pre export do PDF
    fig_width_cm = 20  # Šírka obrázku v cm
    scale = fig_width_cm / plot_width  # Mierka založená na šírke zobrazenej plochy
    fig_height_cm = plot_height * scale
    
    fig = plt.figure(figsize=(fig_width_cm / 2.54, fig_height_cm / 2.54))  # Veľkosť v palcoch
    ax = fig.add_subplot(111)
    
    # Vykreslenie tabule - len zobrazenej časti
    ax.add_patch(plt.Rectangle((min_x, min_y), plot_width, plot_height, 
                               fill=True, facecolor='#DDDDDD', edgecolor='black', linewidth=1))
    
    # Vykreslenie panelov - s prihliadnutím na zoom
    for i, panel in enumerate(layout):
        x, y, w, h, rotated = panel['x'], panel['y'], panel['width'], panel['height'], panel['rotated']
        color = colors[i % len(colors)]
        ax.add_patch(plt.Rectangle((x, y), w, h, fill=True, color=color, alpha=0.8))
        
        # Prispôsobenie veľkosti fontu pre PDF - vylepšené pre zoom
        min_dim = min(w, h)
        # Väčšia veľkosť fontu vďaka zoomu
        font_size = min_dim * scale * 20  # Ešte výraznejšie zvýšený násobok
        font_size = max(font_size, 8)  # Vyššia minimálna veľkosť písma
        font_size = min(font_size, 22)  # Vyššia maximálna veľkosť písma
        
        # Text s obrysom pre lepšiu čitateľnosť
        text_str = f'{w:.1f}x{h:.1f}{"Ⓡ" if rotated else ""}'
        text = ax.text(x + w/2, y + h/2, text_str,
                       horizontalalignment='center',
                       verticalalignment='center',
                       fontsize=font_size,
                       color='white',
                       fontweight='bold')
        # Pridanie obrysu pomocou matplotlib PathEffects
        import matplotlib.patheffects as path_effects
        text.set_path_effects([
            path_effects.Stroke(linewidth=1.0, foreground='black'),  # Silnejší obrys
            path_effects.Normal()
        ])
    
    # Nastavenie rozsahu osí pre zoom
    ax.set_xlim(min_x - padding_x/2, max_x + padding_x/2)
    ax.set_ylim(min_y - padding_y/2, max_y + padding_y/2)
    ax.set_aspect('equal')
    plt.title(f'Rozrezanie tabule {stock_width}x{stock_height} cm', fontsize=11, weight='bold')
    plt.axis('off')  # Skrytie osí
    plt.tight_layout(pad=0.2)  # Menší okraj
    
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=200)  # Vyššie DPI pre lepšie PDF
    buf.seek(0)
    plt.close(fig)  # Uzavretie figúry
    
    return buf

@app.route('/generate_pdf', methods=['POST'])
def generate_pdf():
    """Generuje PDF report na základe dát zaslaných z frontendu."""
    try:
        # Získanie dát z JSON requestu
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Neboli poskytnuté žiadne dáta.'}), 400
        
        # Validácia požadovaných polí
        required_fields = ['stock_width', 'stock_height', 'layout', 'waste_percentage', 'total_area']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Chýbajú povinné údaje pre generovanie PDF.'}), 400
        
        # Príprava dát pre PDF
        stock_width = data['stock_width']
        stock_height = data['stock_height']
        layout = data['layout']
        waste_percentage = data['waste_percentage']
        total_area = data['total_area']
        
        # Aktuálny dátum a čas pre lepšiu identifikáciu súboru
        now = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"rezaci_program_report_{now}.pdf"
        
        # Farby pre jednotlivé panely (rovnaké ako vo frondente)
        colors = ['#4a76fd', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6c757d']
        
        # Generovanie vizualizácie do bufferu
        buf = draw_layout_to_buffer(stock_width, stock_height, layout, colors)
        if buf is None:
            return jsonify({'error': 'Nepodarilo sa vygenerovať vizualizáciu.'}), 500
        
        # Založenie PDF dokumentu
        pdf_buffer = io.BytesIO()
        c = canvas.Canvas(pdf_buffer, pagesize=letter)
        width, height = letter
        
        # Hlavička dokumentu
        c.setFont("Helvetica-Bold", 16)
        c.drawString(72, height - 72, "Optimalizácia rezania skla")
        
        c.setFont("Helvetica", 12)
        c.drawString(72, height - 100, f"Dátum: {datetime.now().strftime('%d.%m.%Y %H:%M')}")
        c.drawString(72, height - 120, f"Tabuľa: {stock_width} x {stock_height} cm")
        
        # Informácie o výsledkoch
        c.setFont("Helvetica-Bold", 12)
        c.drawString(72, height - 150, "Výsledky optimalizácie:")
        
        c.setFont("Helvetica", 12)
        c.drawString(72, height - 170, f"Celková plocha: {total_area:.2f} m²")
        c.drawString(72, height - 190, f"Odpad: {waste_percentage:.2f}%")
        
        # Pridanie vizualizácie
        img = ImageReader(buf)
        img_width = width - 144  # 2 palce od okrajov
        aspect_ratio = stock_height / stock_width
        img_height = img_width * aspect_ratio
        
        # Umiestnenie obrázka na stred stránky
        x_pos = (width - img_width) / 2
        y_pos = height - 220 - img_height  # 220 bodov od vrchu plus výška obrázka
        
        c.drawImage(img, x_pos, y_pos, width=img_width, height=img_height)
        
        # Päta dokumentu
        c.setFont("Helvetica-Oblique", 10)
        c.drawString(72, 72, "Vygenerované pomocou aplikácie Rezací program")
        
        # Dokončenie PDF
        c.save()
        pdf_buffer.seek(0)
        
        # Vrátenie PDF ako odpoveď s hlavičkami proti cachovaniu
        response = make_response(pdf_buffer.getvalue())
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        # Hlavičky proti cachovaniu
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        
        # Pridanie náhodného query parametra pre zabránenie cachovania na strane klienta/browsera
        response.headers['Content-Disposition'] = f'attachment; filename="{filename}?nocache={now}"'
        
        return response
        
    except Exception as e:
        # Logovanie pre debug
        print(f"Chyba pri generovaní PDF: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': f'Nepodarilo sa vygenerovať PDF: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=False) 