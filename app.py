import os
import io
import re
import base64
import uuid
import logging
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Použitie Agg backendu pre serverové prostredie
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
import time
from dataclasses import dataclass
from typing import List, Tuple, Dict

# Konfigurácia
STOCK_WIDTH = 321  # cm
STOCK_HEIGHT = 225  # cm

# Zistenie cesty k databáze (pre Vercel aj lokálny vývoj)
if os.environ.get('VERCEL_ENV') == 'production':
    # Vercel prostredie - použijeme tmp priečinok, ktorý je zapisovateľný
    DB_PATH = '/tmp/glass_database.db'
else:
    # Lokálne prostredie
    DB_PATH = os.path.abspath('glass_database.db')

# Inicializácia Flask aplikácie
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{DB_PATH}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'devkey12345')

# Nastavenie logovania
logging.basicConfig(level=logging.INFO,
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Inicializácia databázy
db = SQLAlchemy(app)

# Databázové modely
class GlassCategory(db.Model):
    __tablename__ = 'glass_categories'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    glasses = relationship("Glass", back_populates="category")
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name
        }

class Glass(db.Model):
    __tablename__ = 'glasses'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    price_per_m2 = Column(Float, nullable=False)
    category_id = Column(Integer, ForeignKey('glass_categories.id'), nullable=False)
    category = relationship("GlassCategory", back_populates="glasses")
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'price_per_m2': self.price_per_m2,
            'category_id': self.category_id,
            'category_name': self.category.name if self.category else None
        }

class Calculation(db.Model):
    __tablename__ = 'calculations'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(100), nullable=False)
    glass_id = Column(Integer, ForeignKey('glasses.id'), nullable=False)
    dimensions = Column(Text, nullable=False)
    stock_width = Column(Float, nullable=False)
    stock_height = Column(Float, nullable=False)
    area_m2 = Column(Float, nullable=False)
    waste_area_m2 = Column(Float, nullable=False)
    waste_percentage = Column(Float, nullable=False)
    total_price = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    glass = relationship("Glass")
    
    def to_dict(self):
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat(),
            'glass_name': self.glass.name if self.glass else 'Neznáme sklo',
            'dimensions': self.dimensions,
            'stock_dimensions': f"{self.stock_width}x{self.stock_height}",
            'area_m2': self.area_m2,
            'waste_area_m2': self.waste_area_m2,
            'waste_percentage': self.waste_percentage,
            'total_price': self.total_price
        }

# Vytvorenie tabuliek pred prvým requestom
@app.before_request
def create_tables():
    # Pre prvé spustenie vytvoríme tabuľky a ukážkové dáta
    with app.app_context():
        db.create_all()
        # Kontrola či existujú kategórie, ak nie, vytvoríme ukážkové dáta
        if GlassCategory.query.count() == 0:
            create_sample_data()

# Vytvorenie ukážkových dát
def create_sample_data():
    # Kategórie skla
    categories = [
        GlassCategory(name="Čiré sklo"),
        GlassCategory(name="Farebné sklo"),
        GlassCategory(name="Bezpečnostné sklo"),
        GlassCategory(name="Izolačné sklo")
    ]
    
    for category in categories:
        db.session.add(category)
    
    db.session.commit()
    
    # Typy skla
    glasses = [
        Glass(name="Čiré 3mm", price_per_m2=15.0, category_id=1),
        Glass(name="Čiré 4mm", price_per_m2=18.0, category_id=1),
        Glass(name="Čiré 6mm", price_per_m2=24.0, category_id=1),
        Glass(name="Zelené 4mm", price_per_m2=22.0, category_id=2),
        Glass(name="Modré 4mm", price_per_m2=22.0, category_id=2),
        Glass(name="Bronzové 4mm", price_per_m2=23.0, category_id=2),
        Glass(name="Kalené 6mm", price_per_m2=45.0, category_id=3),
        Glass(name="Kalené 8mm", price_per_m2=60.0, category_id=3),
        Glass(name="Vrstvené 3.3.1", price_per_m2=35.0, category_id=3),
        Glass(name="Dvojsklo 4-16-4", price_per_m2=50.0, category_id=4),
        Glass(name="Trojsklo 4-12-4-12-4", price_per_m2=80.0, category_id=4)
    ]
    
    for glass in glasses:
        db.session.add(glass)
    
    db.session.commit()
    
    logger.info("Ukážkové dáta boli úspešne vytvorené")

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

# Cesty API a webové stránky
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

@app.route('/history', methods=['GET'])
def get_history():
    user_id = request.cookies.get('user_id')
    if not user_id:
        return jsonify([])
    
    calculations = Calculation.query.filter_by(user_id=user_id).order_by(Calculation.timestamp.desc()).limit(20).all()
    return jsonify([calc.to_dict() for calc in calculations])

@app.route('/clear_history', methods=['POST'])
def clear_history():
    try:
        user_id = request.cookies.get('user_id')
        if not user_id:
            return jsonify({'message': 'Žiadna história.'}), 200
        
        Calculation.query.filter_by(user_id=user_id).delete()
        db.session.commit()
        
        return jsonify({'message': 'História bola úspešne vymazaná.'})
    
    except Exception as e:
        logger.error(f"Chyba pri vymazávaní histórie: {str(e)}")
        db.session.rollback()
        return jsonify({'error': f'Nastala chyba: {str(e)}'}), 500

# Pomocné funkcie
def parse_dimensions(dimensions_string):
    """Parsovanie rozmerov skiel z reťazca v tvare "100x50-200x30-80.5x90.2"."""
    if not dimensions_string:
        return []
    
    # Rozdelenie reťazca na jednotlivé rozmery
    dimensions_list = dimensions_string.replace(' ', '').split('-')
    panels = []
    
    logger.info(f"Parsovanie rozmerov: {dimensions_string} -> {dimensions_list}")
    
    for dimension in dimensions_list:
        # Pre každý rozmer skúsime vytvoriť panel
        match = re.match(r'(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)', dimension.strip())
        if match:
            width = float(match.group(1))
            height = float(match.group(2))
            
            logger.info(f"Rozpoznaný rozmer: {width}x{height}")
            
            if width > 0 and height > 0:
                panels.append((width, height))
        else:
            logger.warning(f"Nerozpoznaný formát rozmeru: {dimension}")
    
    return panels

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 5000))) 