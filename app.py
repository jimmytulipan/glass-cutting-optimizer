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

# Trieda pre reprezentáciu skleného panelu
class GlassPanel:
    def __init__(self, width, height, thickness=4.0, rotated=False):
        self.width = width
        self.height = height
        self.thickness = thickness
        self.rotated = rotated
    
    def get_dimensions(self):
        return (self.height, self.width) if self.rotated else (self.width, self.height)
    
    def rotate(self):
        self.rotated = not self.rotated
        return self

# Kalkulátor pre výpočet ceny skla
class GlassCalculator:
    def __init__(self, glass, area_m2, waste_area_m2=0):
        self.glass = glass
        self.area_m2 = area_m2
        self.waste_area_m2 = waste_area_m2
    
    def calculate_price(self):
        area_price = self.area_m2 * self.glass.price_per_m2
        waste_price = self.waste_area_m2 * self.glass.price_per_m2 * 0.5  # 50% z ceny za odpad
        total_price = area_price + waste_price
        
        return {
            'glass_name': self.glass.name,
            'area_m2': self.area_m2,
            'area_price': area_price,
            'waste_area_m2': self.waste_area_m2,
            'waste_price': waste_price,
            'total_price': total_price
        }

# Trieda pre optimalizáciu rozloženia skla
class CuttingOptimizer:
    def __init__(self, stock_width, stock_height):
        self.stock_width = stock_width
        self.stock_height = stock_height
        self.min_gap = 0.2
        self.layouts = []
        logger.info(f'Inicializovaný CuttingOptimizer s rozmermi {stock_width}x{stock_height}')

    def optimize_multiple_sheets(self, panels):
        remaining_panels = panels.copy()
        all_layouts = []
        sheet_number = 1
        
        while remaining_panels:
            logger.info(f'Optimalizujem tabuľu #{sheet_number} s {len(remaining_panels)} panelmi')
            
            layout, waste = self.optimize(remaining_panels)
            
            if not layout:
                # Ak sa nepodarilo umiestniť všetky panely, skúsime jednotlivo
                successful_panels = []
                failed_panels = []
                
                for panel in remaining_panels:
                    test_layout, test_waste = self.optimize([panel])
                    if test_layout:
                        successful_panels.append(panel)
                    else:
                        failed_panels.append(panel)
                
                if successful_panels:
                    layout, waste = self.optimize(successful_panels)
                    all_layouts.append((layout, waste))
                    remaining_panels = failed_panels
                    sheet_number += 1
                else:
                    # Ak sa ani jeden panel nedá umiestniť
                    logger.error(f'Nepodarilo sa umiestniť panel')
                    break
            else:
                all_layouts.append((layout, waste))
                remaining_panels = []  # Všetky panely sa podarilo umiestniť
        
        self.layouts = all_layouts
        return all_layouts

    def optimize(self, panels):
        logger.info(f'Začiatok optimalizácie pre {len(panels)} panelov')
        best_layout = []
        best_waste = float('inf')
        start_time = time.time()
        MAX_TIME = 30  # maximálny čas optimalizácie v sekundách
        
        # Stratégie zoradenia panelov
        sorting_strategies = [
            lambda p: (-max(p.width, p.height)),  # Od najväčšieho rozmeru
            lambda p: (-p.width * p.height),      # Od najväčšej plochy
            lambda p: (-min(p.width, p.height)),  # Od najmenšieho rozmeru
            lambda p: (-(p.width + p.height)),    # Od najväčšieho obvodu
        ]
        
        # Obmedzenie počtu vzorcov rotácie pre veľké množstvo panelov
        if len(panels) > 8:
            rotation_patterns = [0]  # Bez rotácie
        elif len(panels) > 6:
            rotation_patterns = range(0, 2 ** len(panels), 4)  # Každý štvrtý vzor
        else:
            rotation_patterns = range(2 ** len(panels))  # Všetky možné rotácie
            
        # Rohy pre začiatok umiestnenia
        corners = ['bottom-left'] if len(panels) > 6 else ['bottom-left', 'bottom-right', 'top-left', 'top-right']
        
        # Vyskúšame rôzne stratégie
        for strategy_index, sort_key in enumerate(sorting_strategies):
            if time.time() - start_time > MAX_TIME:
                break
                
            for start_corner in corners:
                for rotation_pattern in rotation_patterns:
                    if time.time() - start_time > MAX_TIME:
                        break
                        
                    # Aplikujeme rotačný vzor
                    current_panels = panels.copy()
                    for i, panel in enumerate(current_panels):
                        if rotation_pattern & (1 << i):
                            panel.rotate()
                    
                    # Zoradíme panely podľa stratégie
                    sorted_panels = sorted(current_panels, key=sort_key)
                    layout = self._place_panels_enhanced(sorted_panels, start_corner)
                    
                    # Kontrolujeme a vyhodnocujeme rozloženie
                    if layout:
                        if self._check_overlap(layout):
                            continue
                            
                        waste = self._calculate_waste(layout)
                        if waste < best_waste:
                            best_waste = waste
                            best_layout = layout
                            
                            # Ak je odpad dostatočne malý, ukončíme
                            if waste < 15:
                                return best_layout, best_waste
        
        return best_layout, best_waste

    def calculate_total_area(self, panels):
        """Výpočet celkovej plochy všetkých panelov v m²."""
        return sum(panel.width * panel.height for panel in panels) / 10000

    def calculate_waste_area(self, total_panels_area):
        """Výpočet plochy odpadu ako rozdiel celkovej plochy tabule a využitej plochy."""
        stock_area = (self.stock_width * self.stock_height) / 10000
        return stock_area - total_panels_area

    def _calculate_waste(self, layout):
        """Výpočet percentuálneho odpadu pre dané rozloženie."""
        used_area = sum(width * height for _, _, width, height, _ in layout)
        total_area = self.stock_width * self.stock_height
        return ((total_area - used_area) / total_area) * 100

    def visualize(self, layout):
        """Vizualizácia rozloženia panelov na tabuli."""
        fig = plt.figure(figsize=(12, 8))
        ax = fig.add_subplot(111)
        
        # Kreslenie tabule
        ax.add_patch(plt.Rectangle((0, 0), self.stock_width, self.stock_height, 
                                 fill=False, color='black', linewidth=2))
        
        # Farby pre panely
        colors = ['lightblue', 'lightgreen', 'lightpink', 'lightyellow', 'lightcoral', 'lightcyan']
        
        # Kreslenie jednotlivých panelov
        for i, (x, y, w, h, rotated) in enumerate(layout):
            color = colors[i % len(colors)]
            ax.add_patch(plt.Rectangle((x, y), w, h, fill=True, color=color))
            ax.text(x + w/2, y + h/2, 
                   f'{w:.1f}x{h:.1f}\n{"(R)" if rotated else ""}',
                   horizontalalignment='center',
                   verticalalignment='center',
                   fontsize=8)
        
        # Nastavenie rozmerov a mriežky
        ax.set_xlim(-10, self.stock_width + 10)
        ax.set_ylim(-10, self.stock_height + 10)
        ax.set_aspect('equal')
        plt.title(f'Optimalizované rozloženie panelov\n{datetime.now().strftime("%Y-%m-%d %H:%M")}')
        plt.grid(True)
        
        # Konverzia na base64 pre web
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=300, bbox_inches='tight')
        buf.seek(0)
        
        plt.close(fig)
        
        return buf

    def _place_panels_enhanced(self, panels, start_corner):
        """Pokročilý algoritmus pre umiestňovanie panelov."""
        layout = []
        
        # Nastavenie počiatočného priestoru podľa rohu
        if start_corner == 'bottom-left':
            spaces = [(0, 0, self.stock_width, self.stock_height)]
        elif start_corner == 'bottom-right':
            spaces = [(self.stock_width, 0, -self.stock_width, self.stock_height)]
        elif start_corner == 'top-left':
            spaces = [(0, self.stock_height, self.stock_width, -self.stock_height)]
        else:  # top-right
            spaces = [(self.stock_width, self.stock_height, -self.stock_width, -self.stock_height)]

        # Umiestnenie každého panelu
        for i, panel in enumerate(panels):
            width, height = panel.get_dimensions()
            placed = False
            
            # Kontrola všetkých dostupných priestorov
            for space_index, (space_x, space_y, space_width, space_height) in enumerate(spaces):
                if width <= abs(space_width) and height <= abs(space_height):
                    # Výpočet súradníc umiestnenia
                    if start_corner == 'bottom-left':
                        x, y = space_x, space_y
                    elif start_corner == 'bottom-right':
                        x, y = space_x - width, space_y
                    elif start_corner == 'top-left':
                        x, y = space_x, space_y - height
                    else:  # top-right
                        x, y = space_x - width, space_y - height
                    
                    # Pridanie panelu do rozloženia
                    layout.append((x, y, width, height, panel.rotated))
                    placed = True
                    
                    # Rozdelenie zostávajúceho priestoru
                    new_spaces = []
                    if abs(space_width) - width > 0:
                        new_spaces.append((
                            x + (width if start_corner in ['bottom-left', 'top-left'] else -width),
                            space_y,
                            space_width - (width if start_corner in ['bottom-left', 'top-left'] else -width),
                            height
                        ))
                    if abs(space_height) - height > 0:
                        new_spaces.append((
                            space_x,
                            y + (height if start_corner in ['bottom-left', 'bottom-right'] else -height),
                            space_width,
                            space_height - (height if start_corner in ['bottom-left', 'bottom-right'] else -height)
                        ))
                    
                    # Aktualizácia dostupných priestorov
                    spaces = spaces[:space_index] + spaces[space_index+1:] + new_spaces
                    break
            
            # Ak sa panel nedal umiestniť, vrátime prázdne rozloženie
            if not placed:
                return []
        
        return layout

    def _check_overlap(self, layout):
        """Kontrola prekrývania panelov v rozložení."""
        for i, (x, y, w, h, rotated) in enumerate(layout):
            for j in range(i + 1, len(layout)):
                x2, y2, w2, h2, rotated2 = layout[j]
                
                # Kontrola prekrytia
                if not (x >= x2 + w2 or x + w <= x2 or y >= y2 + h2 or y + h <= y2):
                    return True
        
        return False
    
    def get_result_data(self):
        """Pripraví dáta pre odpoveď API."""
        results = {
            'total_sheets': len(self.layouts),
            'sheets': []
        }
        
        total_area = 0
        total_waste = 0
        
        for i, (layout, waste) in enumerate(self.layouts):
            # Výpočet plochy panelov pre túto tabuľu
            panel_area = sum(width * height / 10000 for _, _, width, height, _ in layout)
            total_area += panel_area
            total_waste += waste
            
            # Vytvorenie vizualizácie
            img_buf = self.visualize(layout)
            img_base64 = base64.b64encode(img_buf.getvalue()).decode('utf-8')
            
            sheet_data = {
                'layout_image': img_base64,
                'waste': waste,
                'area': panel_area,
            }
            
            results['sheets'].append(sheet_data)
        
        # Pridanie súhrnných údajov
        results['total_area'] = total_area
        if len(self.layouts) > 0:
            results['average_waste'] = total_waste / len(self.layouts)
        else:
            results['average_waste'] = 0
            
        return results

# Cesty API a webové stránky
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

@app.route('/optimize', methods=['POST'])
def optimize():
    """Endpoint pre optimalizáciu rozloženia skla."""
    try:
        data = request.json
        logger.info(f"Prijaté údaje pre optimalizáciu: {data}")
        
        # Získanie rozmerov tabule a prevedenie na float
        stock_width = float(data.get('stock_width', STOCK_WIDTH))
        stock_height = float(data.get('stock_height', STOCK_HEIGHT))
        
        logger.info(f"Rozmery tabule: {stock_width}x{stock_height}")
        
        if stock_width <= 0 or stock_height <= 0:
            logger.warning(f"Neplatné rozmery tabule: {stock_width}x{stock_height}")
            return jsonify({'error': 'Neplatné rozmery tabule'}), 400
        
        # Parsovanie vstupných rozmerov skla
        dimensions_text = data.get('dimensions', '')
        dimensions = parse_dimensions(dimensions_text)
        
        logger.info(f"Rozpoznané rozmery: {dimensions}")
        
        if not dimensions:
            logger.warning(f"Žiadne platné rozmery skla v: '{dimensions_text}'")
            return jsonify({'error': 'Zadajte platné rozmery skla'}), 400
        
        # Vytvorenie objektov GlassPanel zo zadaných rozmerov
        panels = []
        for width, height in dimensions:
            if width <= 0 or height <= 0:
                logger.warning(f"Ignorujem neplatné rozmery: {width}x{height}")
                continue
                
            if (width > stock_width and width > stock_height) or (height > stock_width and height > stock_height):
                logger.warning(f"Ignorujem príliš veľké rozmery: {width}x{height}")
                continue
                
            panels.append(GlassPanel(width=width, height=height, thickness=4.0))
        
        if not panels:
            logger.warning("Žiadne platné rozmery po filtrovaní")
            return jsonify({'error': 'Žiadne platné rozmery skla'}), 400
        
        logger.info(f"Začínam optimalizáciu {len(panels)} panelov")
        
        # Vytvorenie optimalizátora a výpočet optimálneho rozloženia
        optimizer = CuttingOptimizer(stock_width, stock_height)
        optimizer.optimize_multiple_sheets(panels)
        
        # Získanie výsledkov
        result = optimizer.get_result_data()
        logger.info(f"Optimalizácia dokončená s {len(result.get('sheets', []))} tabuľami")
        
        # Uloženie užívateľského ID do cookies pre históriu
        user_id = request.cookies.get('user_id')
        response = jsonify(result)
        if not user_id:
            user_id = str(uuid.uuid4())
            response.set_cookie('user_id', user_id, max_age=60*60*24*365)
        
        return response
            
    except Exception as e:
        logger.error(f"Chyba pri optimalizácii: {str(e)}", exc_info=True)
        return jsonify({'error': f'Nastala chyba: {str(e)}'}), 500

@app.route('/glass_categories', methods=['GET'])
def get_glass_categories():
    categories = GlassCategory.query.all()
    return jsonify([category.to_dict() for category in categories])

@app.route('/glass_types/<int:category_id>', methods=['GET'])
def get_glass_types(category_id):
    glasses = Glass.query.filter_by(category_id=category_id).all()
    return jsonify([glass.to_dict() for glass in glasses])

@app.route('/calculate_price', methods=['POST'])
def calculate_price():
    try:
        data = request.json
        
        # Získanie parametrov
        glass_id = data.get('glass_id')
        total_area_m2 = float(data.get('total_area_m2', 0))
        waste_area_m2 = float(data.get('waste_area_m2', 0))
        dimensions = data.get('dimensions', '')
        stock_width = float(data.get('stock_width', STOCK_WIDTH))
        stock_height = float(data.get('stock_height', STOCK_HEIGHT))
        
        # Kontrola vstupov
        if not glass_id:
            return jsonify({'error': 'Chýba ID skla.'}), 400
        
        glass = Glass.query.get(glass_id)
        if not glass:
            return jsonify({'error': 'Sklo nebolo nájdené.'}), 404
        
        # Výpočet ceny
        calculator = GlassCalculator(glass, total_area_m2, waste_area_m2)
        price_result = calculator.calculate_price()
        
        # Uloženie kalkulácie do histórie
        user_id = request.cookies.get('user_id')
        if not user_id:
            user_id = str(uuid.uuid4())
        
        calculation = Calculation(
            user_id=user_id,
            glass_id=glass_id,
            dimensions=dimensions,
            stock_width=stock_width,
            stock_height=stock_height,
            area_m2=total_area_m2,
            waste_area_m2=waste_area_m2,
            waste_percentage=(waste_area_m2 / total_area_m2 * 100) if total_area_m2 > 0 else 0,
            total_price=price_result['total_price']
        )
        
        db.session.add(calculation)
        db.session.commit()
        
        return jsonify(price_result)
    
    except Exception as e:
        logger.error(f"Chyba pri výpočte ceny: {str(e)}")
        return jsonify({'error': f'Nastala chyba: {str(e)}'}), 500

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
    app.run(debug=True, host='0.0.0.0', port=5000) 