import os
import re
import logging
import io
import numpy as np
import matplotlib.pyplot as plt
from datetime import datetime
from typing import List, Tuple, Dict, Any, Optional
from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from dotenv import load_dotenv

# Načítanie .env súboru ak existuje
load_dotenv()

# Konfigurácia loggeru
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('glass_optimizer')

# Databázová konfigurácia
Base = declarative_base()
db_path = os.getenv('DB_PATH', 'glass_calculator.db')
engine = create_engine(f'sqlite:///{db_path}')
Session = sessionmaker(bind=engine)

class GlassCategory(Base):
    __tablename__ = 'glass_categories'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(String(255))
    glasses = relationship("Glass", back_populates="category")
    
    def __repr__(self):
        return f"<GlassCategory(id={self.id}, name='{self.name}')>"

class Glass(Base):
    __tablename__ = 'glasses'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    thickness = Column(Float, nullable=False)
    price_per_m2 = Column(Float, nullable=False)
    waste_multiplier = Column(Float, default=0.4)
    category_id = Column(Integer, ForeignKey('glass_categories.id'), nullable=False)
    category = relationship("GlassCategory", back_populates="glasses")
    calculations = relationship("Calculation", back_populates="glass")
    
    def __repr__(self):
        return f"<Glass(id={self.id}, name='{self.name}', price={self.price_per_m2})>"

class Calculation(Base):
    __tablename__ = 'calculations'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)  # ID užívateľa alebo chatu
    glass_id = Column(Integer, ForeignKey('glasses.id'), nullable=False)
    width = Column(Float, nullable=False)  # v cm
    height = Column(Float, nullable=False)  # v cm
    area = Column(Float, nullable=False)  # v m²
    waste_area = Column(Float, nullable=False)  # v m²
    total_price = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    glass = relationship("Glass", back_populates="calculations")
    
    def __repr__(self):
        return f"<Calculation(id={self.id}, area={self.area}, price={self.total_price})>"

class GlassPanel:
    def __init__(self, width: float, height: float, thickness: float = 4.0):
        # Vždy ukladáme širšiu stranu ako šírku
        if width < height:
            width, height = height, width
        self.width = float(width)
        self.height = float(height)
        self.thickness = float(thickness)
        self.area = (width * height) / 10000  # v m²
    
    def __repr__(self):
        return f"GlassPanel({self.width}x{self.height})"

class CuttingOptimizer:
    """Trieda na optimalizáciu rezania sklenených tabúľ."""
    
    def __init__(self, stock_width: float, stock_height: float):
        self.stock_width = float(stock_width)
        self.stock_height = float(stock_height)
        logger.info(f"Inicializovaný CuttingOptimizer s tabuľou {stock_width}x{stock_height} cm")
    
    def optimize(self, panels: List[GlassPanel]) -> Tuple[List[Tuple[float, float, float, float, int]], float]:
        """
        Optimalizuje rozloženie panelov na tabuli.
        
        Args:
            panels: Zoznam panelov na umiestnenie
        
        Returns:
            Tuple obsahujúci zoznam umiestnených panelov (x, y, šírka, výška, index) a percento odpadu
        """
        # Zoradíme panely podľa plochy od najväčšieho
        sorted_panels = sorted(
            enumerate(panels), 
            key=lambda x: x[1].width * x[1].height, 
            reverse=True
        )
        
        # Vytvoríme prázdny priestor tabule
        spaces = [(0, 0, self.stock_width, self.stock_height)]
        placed_panels = []
        
        for idx, panel in sorted_panels:
            placed = False
            best_space_idx = -1
            best_space_area = float('inf')
            
            # Skúšame obidve orientácie panelu
            orientations = [(panel.width, panel.height), (panel.height, panel.width)]
            best_orientation = orientations[0]
            
            for i, (x, y, w, h) in enumerate(spaces):
                for pw, ph in orientations:
                    # Skontrolujeme či sa panel zmestí do priestoru
                    if pw <= w and ph <= h:
                        space_area = w * h
                        if space_area < best_space_area:
                            best_space_idx = i
                            best_space_area = space_area
                            best_orientation = (pw, ph)
                            placed = True
                        break  # Našli sme vhodnú orientáciu, môžeme prejsť na ďalší priestor
            
            if placed:
                # Umiestnime panel do najlepšieho priestoru
                x, y, w, h = spaces[best_space_idx]
                pw, ph = best_orientation
                placed_panels.append((x, y, pw, ph, idx))
                
                # Odstránime použitý priestor
                spaces.pop(best_space_idx)
                
                # Vytvoríme nové priestory vzniknuté rezaním
                # Priestor napravo od panelu
                if x + pw < x + w:
                    spaces.append((x + pw, y, w - pw, ph))
                
                # Priestor pod panelom
                if y + ph < y + h:
                    spaces.append((x, y + ph, w, h - ph))
                
                # Zoradíme priestory podľa plochy vzostupne
                spaces.sort(key=lambda s: s[2] * s[3])
        
        # Vypočítame percento odpadu
        total_panel_area = sum(p.width * p.height for p in panels)
        utilized_area = sum(w * h for _, _, w, h, _ in placed_panels)
        waste_area = (self.stock_width * self.stock_height) - utilized_area
        waste_percentage = (waste_area / (self.stock_width * self.stock_height)) * 100
        
        # Pokiaľ neboli umiestnené všetky panely, vrátime None
        if len(placed_panels) < len(panels):
            logger.warning(f"Nebolo možné umiestniť všetky panely. Umiestnených: {len(placed_panels)}/{len(panels)}")
            return None, None
        
        logger.info(f"Optimalizácia úspešná. Odpad: {waste_percentage:.2f}%")
        return placed_panels, waste_percentage
    
    def optimize_multiple_sheets(self, panels: List[GlassPanel]) -> List[Tuple[List[Tuple[float, float, float, float, int]], float]]:
        """
        Rozdelí panely na viacero tabúl, ak sa nezmestia na jednu.
        
        Args:
            panels: Zoznam panelov na umiestnenie
        
        Returns:
            Zoznam dvojíc (umiestnené panely, odpad) pre každú tabuľu
        """
        sheets = []
        remaining_panels = panels.copy()
        
        while remaining_panels:
            layout, waste = self.optimize(remaining_panels)
            
            if layout is None:
                # Nemôžeme umiestniť všetky panely, skúsime menšiu skupinu
                if len(remaining_panels) <= 1:
                    # Nie je možné ďalej deliť
                    logger.error(f"Nie je možné umiestniť panel {remaining_panels[0]}")
                    return sheets if sheets else None
                
                # Zoradíme zvyšné panely podľa veľkosti a skúsime bez najväčšieho
                remaining_panels.sort(key=lambda p: p.width * p.height, reverse=True)
                problematic_panel = remaining_panels.pop(0)
                
                # Skúsime panel otočiť
                if problematic_panel.width != problematic_panel.height:
                    flipped_panel = GlassPanel(
                        problematic_panel.height, 
                        problematic_panel.width, 
                        problematic_panel.thickness
                    )
                    # Vložíme otočený panel na začiatok
                    remaining_panels.insert(0, flipped_panel)
                    continue
                
                # Ak sa ani otočený panel nezmestí
                logger.error(f"Panel {problematic_panel} sa nezmestí ani po otočení")
                return sheets if sheets else None
            
            # Odoberieme umiestnené panely zo zoznamu
            placed_indices = set(idx for _, _, _, _, idx in layout)
            remaining_panels = [p for i, p in enumerate(remaining_panels) if i not in placed_indices]
            
            sheets.append((layout, waste))
        
        return sheets
    
    def visualize(self, layout: List[Tuple[float, float, float, float, int]]) -> io.BytesIO:
        """
        Vytvorí vizualizáciu rozloženia panelov a vráti ju ako PNG obrázok v buferi.
        
        Args:
            layout: Rozloženie panelov (x, y, šírka, výška, index)
        
        Returns:
            BytesIO objekt obsahujúci PNG obrázok
        """
        plt.figure(figsize=(10, 10))
        ax = plt.gca()
        
        # Nakreslíme tabuľu
        rect = plt.Rectangle((0, 0), self.stock_width, self.stock_height, 
                             linewidth=2, edgecolor='black', facecolor='white')
        ax.add_patch(rect)
        
        # Farby pre panely
        colors = plt.cm.tab10.colors
        
        # Nakreslíme panely
        for i, (x, y, w, h, idx) in enumerate(layout):
            color = colors[i % len(colors)]
            rect = plt.Rectangle((x, y), w, h, linewidth=1, 
                                 edgecolor='black', facecolor=color, alpha=0.7)
            ax.add_patch(rect)
            
            # Pridáme text s rozmermi
            plt.text(x + w/2, y + h/2, f"{w:.1f}x{h:.1f}", 
                     ha='center', va='center', fontsize=8, color='black',
                     bbox=dict(facecolor='white', alpha=0.7, boxstyle='round,pad=0.2'))
        
        # Nastavíme limity a pomer strán
        plt.xlim(0, self.stock_width)
        plt.ylim(0, self.stock_height)
        ax.set_aspect('equal')
        plt.axis('off')
        
        # Uložíme obrázok do bufferu
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
        buf.seek(0)
        plt.close()
        
        return buf
    
    def calculate_waste_area(self, utilized_area: float) -> float:
        """Vypočíta plochu odpadu v m²."""
        total_area = (self.stock_width * self.stock_height) / 10000  # v m²
        return total_area - utilized_area

class GlassCalculator:
    """Trieda na kalkuláciu cien skla."""
    
    def __init__(self, session, user_states=None):
        self.session = session
        self.user_states = user_states if user_states else {}
        logger.info("Inicializovaný GlassCalculator")
    
    def get_glass_categories(self) -> List[Dict[str, Any]]:
        """Vráti zoznam kategórií skla."""
        categories = self.session.query(GlassCategory).all()
        return [{'id': c.id, 'name': c.name, 'description': c.description} for c in categories]
    
    def get_glass_types(self, category_id: int) -> List[Dict[str, Any]]:
        """Vráti zoznam typov skla pre danú kategóriu."""
        glasses = self.session.query(Glass).filter_by(category_id=category_id).all()
        return [{
            'id': g.id, 
            'name': g.name, 
            'thickness': g.thickness,
            'price_per_m2': g.price_per_m2,
            'waste_multiplier': g.waste_multiplier
        } for g in glasses]
    
    def get_glass_price(
        self, glass_id: int, width: float, height: float, user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Vypočíta cenu skla na základe typu, rozmerov a odpadu.
        
        Args:
            glass_id: ID typu skla
            width: Šírka skiel v cm
            height: Výška skiel v cm
            user_id: Voliteľný ID užívateľa pre sledovanie stavov
        
        Returns:
            Slovník s informáciami o cene
        """
        # Načítame typ skla
        glass = self.session.query(Glass).get(glass_id)
        if not glass:
            logger.error(f"Neexistujúci typ skla: {glass_id}")
            return {'error': 'Neplatný typ skla'}
        
        # Vypočítame základnú plochu v m²
        area = (width * height) / 10000
        
        # Ak máme k dispozícii stav užívateľa, použijeme odpad z optimalizácie
        waste_percentage = 0
        if user_id is not None and self.user_states and user_id in self.user_states:
            if isinstance(self.user_states[user_id], dict) and 'total_waste' in self.user_states[user_id]:
                waste_percentage = self.user_states[user_id]['total_waste']
            
        # Vypočítame odpadovú plochu
        waste_area = area * (waste_percentage / 100)
        
        # Vypočítame ceny
        area_price = round(area * glass.price_per_m2, 2)
        waste_price = round(waste_area * glass.price_per_m2 * glass.waste_multiplier, 2)
        total_price = round(area_price + waste_price, 2)
        
        logger.info(f"Cena vypočítaná: typ={glass.name}, area={area}m², waste={waste_area}m², total={total_price}€")
        
        return {
            'glass_id': glass.id,
            'glass_name': glass.name,
            'thickness': glass.thickness,
            'area': area,
            'waste_area': waste_area,
            'waste_percentage': waste_percentage,
            'area_price': area_price,
            'waste_price': waste_price,
            'total_price': total_price
        }

def initialize_database():
    """Inicializuje databázu a vytvorí základné údaje, ak ešte neexistujú."""
    Base.metadata.create_all(engine)
    
    session = Session()
    if session.query(GlassCategory).count() == 0:
        logger.info("Vytváram základné dáta v databáze")
        
        # Základné kategórie
        cat1 = GlassCategory(name="Float", description="Obyčajné číre sklo")
        cat2 = GlassCategory(name="Ornamentné", description="Dekoratívne sklo s vzormi")
        cat3 = GlassCategory(name="Bezpečnostné", description="Tvrdené/laminované sklo pre zvýšenú bezpečnosť")
        
        session.add_all([cat1, cat2, cat3])
        session.commit()
        
        # Základné typy skla
        glasses = [
            Glass(name="Číre 4mm", thickness=4, price_per_m2=20, waste_multiplier=0.4, category_id=cat1.id),
            Glass(name="Číre 6mm", thickness=6, price_per_m2=25, waste_multiplier=0.4, category_id=cat1.id),
            Glass(name="Číre 8mm", thickness=8, price_per_m2=30, waste_multiplier=0.5, category_id=cat1.id),
            Glass(name="Číre 10mm", thickness=10, price_per_m2=40, waste_multiplier=0.5, category_id=cat1.id),
            
            Glass(name="Krizet 4mm", thickness=4, price_per_m2=25, waste_multiplier=0.4, category_id=cat2.id),
            Glass(name="Činčila 4mm", thickness=4, price_per_m2=25, waste_multiplier=0.4, category_id=cat2.id),
            Glass(name="Delta 4mm", thickness=4, price_per_m2=28, waste_multiplier=0.4, category_id=cat2.id),
            
            Glass(name="Tvrdené 4mm", thickness=4, price_per_m2=35, waste_multiplier=0.6, category_id=cat3.id),
            Glass(name="Tvrdené 6mm", thickness=6, price_per_m2=45, waste_multiplier=0.6, category_id=cat3.id),
            Glass(name="Laminované 3.3.1", thickness=6, price_per_m2=40, waste_multiplier=0.6, category_id=cat3.id),
        ]
        
        session.add_all(glasses)
        session.commit()
        logger.info(f"Vytvorených {len(glasses)} typov skla v {session.query(GlassCategory).count()} kategóriách")
    
    session.close()

def parse_dimensions(text: str) -> List[Tuple[float, float]]:
    """
    Parsuje rozmery skiel zo vstupného textu.
    
    Args:
        text: Vstupný text v formáte "100x50-200x30-80.5x90.2"
        
    Returns:
        Zoznam dvojíc (šírka, výška)
    """
    text = text.replace(',', '.').replace(' ', '')
    
    # Hľadáme všetky dvojice čísel oddelené "x"
    dimensions = []
    for part in text.lower().split('-'):
        match = re.match(r'(\d+\.?\d*)x(\d+\.?\d*)', part)
        if match:
            width, height = map(float, match.groups())
            dimensions.append((width, height))
    
    return dimensions

def validate_dimensions(width: float, height: float, stock_width: float, stock_height: float) -> bool:
    """
    Kontroluje, či sú rozmery skla platné a či sa zmestia na tabuľu.
    
    Args:
        width: Šírka skla
        height: Výška skla
        stock_width: Šírka tabule
        stock_height: Výška tabule
        
    Returns:
        True ak sú rozmery platné, inak False
    """
    # Kontrola platných rozmerov
    if width <= 0 or height <= 0:
        return False
    
    # Kontrola či sa zmestí na tabuľu
    return (width <= stock_width and height <= stock_height) or (width <= stock_height and height <= stock_width) 