from flask import Flask, render_template, request, jsonify, send_from_directory, Response
import numpy as np
import os
import logging
from datetime import datetime
from dataclasses import dataclass
from typing import List, Tuple, Dict
import io
from reportlab.lib.pagesizes import A4
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
    
    # Prispôsobenie veľkosti obrázku pre lepšie proporcie v PDF
    fig_width_cm = 18
    scale = fig_width_cm / stock_width
    fig_height_cm = stock_height * scale
    
    fig = plt.figure(figsize=(fig_width_cm / 2.54, fig_height_cm / 2.54)) # Veľkosť v palcoch
    ax = fig.add_subplot(111)
    
    # Vykreslenie tabule
    ax.add_patch(plt.Rectangle((0, 0), stock_width, stock_height, 
                             fill=False, color='black', linewidth=1))
    
    # Vykreslenie panelov
    for i, panel in enumerate(layout):
        x, y, w, h, rotated = panel['x'], panel['y'], panel['width'], panel['height'], panel['rotated']
        color = colors[i % len(colors)]
        ax.add_patch(plt.Rectangle((x, y), w, h, fill=True, color=color, alpha=0.7))
        
        # Prispôsobenie veľkosti fontu pre PDF
        min_dim = min(w, h)
        font_size = min_dim * scale * 6 # Prispôsobená veľkosť fontu
        font_size = max(font_size, 4) # Minimálna veľkosť
        font_size = min(font_size, 10) # Maximálna veľkosť
        
        ax.text(x + w/2, y + h/2, 
               f'{w:.1f}x{h:.1f}{" (R)" if rotated else ""}', # Jednoduchší text pre PDF
               horizontalalignment='center',
               verticalalignment='center',
               fontsize=font_size,
               color='black') # Čierny text pre lepšiu viditeľnosť
    
    ax.set_xlim(-5, stock_width + 5)
    ax.set_ylim(-5, stock_height + 5)
    ax.set_aspect('equal')
    plt.title(f'Rozloženie na tabuli {stock_width}x{stock_height} cm', fontsize=10)
    plt.axis('off') # Skrytie osí
    plt.tight_layout(pad=0.5)
    
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=150) # Nižšie DPI pre PDF
    buf.seek(0)
    plt.close(fig) # Uzavretie figúry
    
    return buf

@app.route('/api/generate-pdf', methods=['POST'])
def generate_pdf():
    try:
        data = request.json
        sheet_data = data.get('sheet_data')
        price_data = data.get('price_data')

        if not sheet_data:
            return jsonify({'error': 'Chýbajú dáta o rozložení pre PDF.'}), 400
        
        layout = sheet_data.get('layout')
        stock_width = sheet_data.get('stock_width', STOCK_WIDTH)
        stock_height = sheet_data.get('stock_height', STOCK_HEIGHT)
        total_area = sheet_data.get('total_area')
        waste_percentage = sheet_data.get('waste_percentage')

        if not layout:
             return jsonify({'error': 'Chýbajú dáta o layoute v sheet_data.'}), 400

        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4 # Rozmery A4 v bodoch

        # Nastavenie písma (ak je dostupný, inak default)
        try:
            c.setFont("Helvetica", 10)
        except:
            logger.warning("Font Helvetica nebol nájdený, používa sa predvolený.")
            # Môžete tu nastaviť iný dostupný font

        # Hlavička
        c.setFont("Helvetica-Bold", 16)
        c.drawString(2*cm, height - 2*cm, "Optimalizácia Rezania Skla")
        c.setFont("Helvetica", 10)
        c.drawString(2*cm, height - 2.7*cm, f"Dátum: {datetime.now().strftime('%d.%m.%Y %H:%M')}")
        c.line(2*cm, height - 3*cm, width - 2*cm, height - 3*cm)

        y_position = height - 4*cm
        
        # Súhrn optimalizácie
        c.setFont("Helvetica-Bold", 12)
        c.drawString(2*cm, y_position, "Súhrn optimalizácie:")
        y_position -= 0.7*cm
        c.setFont("Helvetica", 10)
        c.drawString(2.5*cm, y_position, f"Rozmer tabule: {stock_width} x {stock_height} cm")
        y_position -= 0.5*cm
        c.drawString(2.5*cm, y_position, f"Celková plocha skiel: {total_area:.2f} m²")
        y_position -= 0.5*cm
        c.drawString(2.5*cm, y_position, f"Odpad: {waste_percentage:.1f}%")
        y_position -= 1*cm

        # Vykreslenie vizualizácie
        colors = ['#4a76fd', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6c757d']
        img_buffer = draw_layout_to_buffer(stock_width, stock_height, layout, colors)
        img_reader = ImageReader(img_buffer)
        
        # Prispôsobenie veľkosti obrázka na stránke
        img_width_on_page = width - 4*cm # Šírka obrázku
        img_height_on_page = img_width_on_page * (stock_height / stock_width) # Výška podľa pomeru strán
        
        # Kontrola, či sa zmestí na zvyšok stránky
        if y_position - img_height_on_page < 2*cm:
            c.showPage() # Nová strana, ak sa nezmestí
            y_position = height - 2*cm
            c.setFont("Helvetica", 10) # Znova nastaviť font po showPage
        
        c.drawImage(img_reader, 2*cm, y_position - img_height_on_page, width=img_width_on_page, height=img_height_on_page)
        y_position -= (img_height_on_page + 1*cm)

        # Cenová kalkulácia (ak sú dáta)
        if price_data:
            if y_position < 8*cm:
                 c.showPage() # Nová strana pre cenu
                 y_position = height - 2*cm
                 c.setFont("Helvetica", 10) 
                 
            c.setFont("Helvetica-Bold", 12)
            c.drawString(2*cm, y_position, "Cenová kalkulácia:")
            y_position -= 0.7*cm
            c.setFont("Helvetica", 10)
            c.drawString(2.5*cm, y_position, f"Typ skla: {price_data.get('glass_name', 'Neznáme')}")
            y_position -= 0.5*cm
            c.drawString(2.5*cm, y_position, f"Plocha skiel: {price_data.get('area', 0):.2f} m² = {price_data.get('area_price', 0):.2f} €")
            y_position -= 0.5*cm
            c.drawString(2.5*cm, y_position, f"Odpad: {price_data.get('waste_area', 0):.2f} m² = {price_data.get('waste_price', 0):.2f} €")
            y_position -= 0.7*cm
            c.setFont("Helvetica-Bold", 11)
            total_p = price_data.get('area_price', 0) + price_data.get('waste_price', 0)
            c.drawString(2.5*cm, y_position, f"Celková cena: {total_p:.2f} €")
        
        # Uloženie PDF
        c.save()
        buffer.seek(0)

        return Response(buffer, mimetype='application/pdf', headers={'Content-Disposition': 'attachment;filename=optimalizacia_rezu.pdf'})

    except Exception as e:
        logger.error(f"Chyba pri generovaní PDF: {str(e)}", exc_info=True)
        return jsonify({'error': f'Nastala chyba pri generovaní PDF: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=False) 