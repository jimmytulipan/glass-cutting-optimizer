from flask import Flask, render_template, request, jsonify, send_from_directory
import numpy as np
import os
import logging
from datetime import datetime
from dataclasses import dataclass
from typing import List, Tuple, Dict

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

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 5000))) 