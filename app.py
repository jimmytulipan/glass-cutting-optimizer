from flask import Flask, render_template, request, jsonify, send_from_directory, Response, make_response, send_file, session, redirect, url_for
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
import traceback
import time
import json
from reportlab.lib import colors

# Konfigurácia
STOCK_WIDTH = 321
STOCK_HEIGHT = 225
app = Flask(__name__, template_folder='templates')
app.secret_key = os.getenv('SECRET_KEY', 'my_secret_key_123')
app.config['PERMANENT_SESSION_LIFETIME'] = 86400  # 24 hodín

# Nastavenie logovania
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import zdieľaných komponentov
from shared_components import (
    GlassPanel, CuttingOptimizer, GlassCalculator, 
    parse_dimensions, validate_dimensions, initialize_database,
    logger, Base, engine, Session, GlassCategory, Glass, Calculation
)

# Inicializácia databázy
initialize_database()

@app.route('/')
def index():
    """Zobrazí hlavnú stránku aplikácie."""
    return render_template('index.html')

@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

@app.route('/api/optimize', methods=['POST'])
def optimize():
    """API endpoint pre optimalizáciu rozloženia skiel."""
    try:
        data = request.json
        logger.info(f"Prijaté dáta: {data}")
        
        # Kontrola vstupných údajov
        if not data or 'dimensions' not in data or 'stockSize' not in data:
            return jsonify({'error': 'Chýbajúce vstupné údaje'}), 400
            
        dimensions_text = data['dimensions']
        stock_width = float(data['stockSize']['width'])
        stock_height = float(data['stockSize']['height'])
        
        logger.info(f"Parametre: rozmery={dimensions_text}, tabula={stock_width}x{stock_height}")
        
        # Parsovanie rozmerov
        dimensions = parse_dimensions(dimensions_text)
        if not dimensions:
            return jsonify({'error': 'Neplatný formát rozmerov'}), 400
            
        # Kontrola rozmerov
        panels = []
        for width, height in dimensions:
            if validate_dimensions(width, height, stock_width, stock_height):
                panels.append(GlassPanel(width, height))
            else:
                logger.warning(f"Neplatný rozmer: {width}x{height}")
        
        if not panels:
            return jsonify({'error': 'Žiadne platné rozmery skiel'}), 400
            
        # Optimalizácia rozloženia
        optimizer = CuttingOptimizer(stock_width, stock_height)
        all_layouts = optimizer.optimize_multiple_sheets(panels)
        
        if not all_layouts:
            return jsonify({'error': 'Nepodarilo sa nájsť vhodné rozloženie'}), 400
            
        # Príprava výsledkov
        results = []
        total_waste = 0
        total_area = sum(panel.width * panel.height for panel in panels) / 10000  # v m²
        
        for i, (layout, waste) in enumerate(all_layouts):
            # Pre každú tabuľu vytvoríme výsledok
            sheet_results = {
                'sheet_number': i + 1,
                'waste_percentage': round(waste, 2),
                'stock_width': stock_width,
                'stock_height': stock_height,
                'panels': []
            }
            
            for x, y, width, height, panel_idx in layout:
                sheet_results['panels'].append({
                    'x': x,
                    'y': y,
                    'width': width,
                    'height': height,
                    'rotated': width != panels[panel_idx].width
                })
                
            results.append(sheet_results)
            total_waste += waste
            
        # Uloženie výsledkov do session pre použitie s PDF
        session['optimization_results'] = {
            'layouts': [[list(panel) for panel in layout] for layout, _ in all_layouts],
            'stock_size': {'width': stock_width, 'height': stock_height},
            'total_area': total_area,
            'total_waste': total_waste,
            'sheet_count': len(all_layouts),
            'dimensions': dimensions_text,
            'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        logger.info(f"Optimalizácia úspešná: {len(all_layouts)} tabúľ, odpad: {total_waste/len(all_layouts):.2f}%")
        
        return jsonify({
            'success': True,
            'results': results,
            'total_area': round(total_area, 2),
            'total_waste': round(total_waste / len(all_layouts), 2),
            'sheet_count': len(all_layouts)
        })
        
    except Exception as e:
        logger.exception(f"Chyba pri optimalizácii: {str(e)}")
        return jsonify({'error': f'Chyba pri optimalizácii: {str(e)}'}), 500

@app.route('/api/calculate-price', methods=['POST'])
def calculate_price():
    """API endpoint pre výpočet ceny."""
    try:
        data = request.json
        logger.info(f"Prijaté dáta pre výpočet ceny: {data}")
        
        # Kontrola vstupných údajov
        if not data or 'glass_id' not in data or 'area' not in data:
            return jsonify({'error': 'Chýbajúce vstupné údaje'}), 400
            
        glass_id = int(data['glass_id'])
        area = float(data['area'])
        waste_percentage = float(data.get('waste_percentage', 0))
        
        # Výpočet ceny
        calculator = GlassCalculator(Session())
        # Použijeme 1 ako náhradu za šírku a výšku, keďže máme už plochu
        width_placeholder = 100
        height_placeholder = area * 10000 / width_placeholder  # aby width * height / 10000 = area
        result = calculator.get_glass_price(glass_id, width_placeholder, height_placeholder)
        
        if 'error' in result:
            return jsonify({'error': result['error']}), 400
            
        # Uloženie výsledkov ceny do session pre použitie s PDF
        session['price_calculation'] = {
            'glass_name': result['glass_name'],
            'glass_id': glass_id,
            'area': area,
            'waste_area': result['waste_area'],
            'waste_percentage': waste_percentage,
            'area_price': result['area_price'],
            'waste_price': result['waste_price'],
            'total_price': result['area_price'] + result['waste_price'],
            'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        logger.info(f"Výpočet ceny úspešný: {result['glass_name']}, plocha: {area}m², cena: {result['area_price'] + result['waste_price']}€")
        
        return jsonify({
            'success': True,
            'price': result
        })
        
    except Exception as e:
        logger.exception(f"Chyba pri výpočte ceny: {str(e)}")
        return jsonify({'error': f'Chyba pri výpočte ceny: {str(e)}'}), 500

@app.route('/api/get-glass-categories', methods=['GET'])
def get_glass_categories():
    """API endpoint pre získanie kategórií skla."""
    try:
        calculator = GlassCalculator(Session())
        categories = calculator.get_glass_categories()
        
        return jsonify({
            'success': True,
            'categories': categories
        })
        
    except Exception as e:
        logger.exception(f"Chyba pri získavaní kategórií skla: {str(e)}")
        return jsonify({'error': f'Chyba pri získavaní kategórií skla: {str(e)}'}), 500

@app.route('/api/get-glass-types', methods=['GET'])
def get_glass_types():
    """API endpoint pre získanie typov skla pre kategóriu."""
    try:
        category_id = request.args.get('category_id')
        
        if not category_id:
            return jsonify({'error': 'Chýbajúce ID kategórie'}), 400
            
        calculator = GlassCalculator(Session())
        types = calculator.get_glass_types(int(category_id))
        
        return jsonify({
            'success': True,
            'types': types
        })
        
    except Exception as e:
        logger.exception(f"Chyba pri získavaní typov skla: {str(e)}")
        return jsonify({'error': f'Chyba pri získavaní typov skla: {str(e)}'}), 500

def draw_layout_to_buffer(layout, stock_width, stock_height, scale=1.0):
    """Pomocná funkcia pre kreslenie rozloženia do PDF."""
    buffer = io.BytesIO()
    
    # Určíme rozmery a mierku
    width_points = stock_width * scale
    height_points = stock_height * scale
    
    # Vytvoríme canvas
    c = canvas.Canvas(buffer, pagesize=(width_points + 2*cm, height_points + 4*cm))
    
    # Nakreslíme tabuľu
    c.setStrokeColor(colors.black)
    c.setFillColor(colors.white)
    c.rect(cm, cm, width_points, height_points, fill=1)
    
    # Farebné pozadie pre panely
    panel_colors = [
        colors.lightblue, colors.lightgreen, colors.pink, 
        colors.lightyellow, colors.lightcoral, colors.lightcyan,
        colors.lavender, colors.peachpuff
    ]
    
    # Nakreslíme panely
    for i, (x, y, width, height, _) in enumerate(layout):
        color = panel_colors[i % len(panel_colors)]
        
        # Nakreslíme panel
        c.setFillColor(color)
        c.setStrokeColor(colors.black)
        c.rect(x * scale + cm, y * scale + cm, width * scale, height * scale, fill=1)
        
        # Pridáme text s rozmermi
        c.setFillColor(colors.black)
        min_dim = min(width, height)
        font_size = min_dim * scale * 8  # Faktor pre čitateľnosť
        
        # Minimálna/maximálna veľkosť písma
        font_size = max(5, min(12, font_size))
        
        c.setFont("Helvetica", font_size)
        text = f"{width:.1f}x{height:.1f}"
        text_width = c.stringWidth(text, "Helvetica", font_size)
        text_x = x * scale + (width * scale - text_width) / 2 + cm
        text_y = y * scale + (height * scale) / 2 + cm
        
        c.drawString(text_x, text_y, text)
    
    # Ukončíme a vrátime buffer
    c.showPage()
    c.save()
    buffer.seek(0)
    
    return buffer

@app.route('/generate_pdf', methods=['POST'])
def generate_pdf():
    """API endpoint pre generovanie PDF reportu."""
    try:
        data = request.json
        logger.info(f"Generujem PDF zo zaslaných dát: {data}")
        
        # Získanie dát zo session ak nie sú zaslané priamo
        optimization = session.get('optimization_results')
        price = session.get('price_calculation')
        
        # Override session data s novými dátami
        if data:
            if 'stock_width' in data and 'stock_height' in data:
                if not optimization:
                    optimization = {}
                optimization['stock_size'] = {
                    'width': data['stock_width'], 
                    'height': data['stock_height']
                }
            if 'layout' in data:
                if not optimization:
                    optimization = {}
                optimization['layouts'] = [data['layout']]
            if 'waste_percentage' in data:
                if not optimization:
                    optimization = {}
                optimization['total_waste'] = data['waste_percentage']
            if 'total_area' in data:
                if not optimization:
                    optimization = {}
                optimization['total_area'] = data['total_area']
            if 'price_data' in data:
                price = data['price_data']
        
        if not optimization or not optimization.get('layouts'):
            return jsonify({'error': 'Chýbajú údaje o optimalizácii skla'}), 400
            
        # Vytvorenie PDF bufferu
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        
        # Hlavička PDF
        c.setFont("Helvetica-Bold", 18)
        c.drawCentredString(width/2, height - 2*cm, "Optimalizácia rezania skla")
        
        c.setFont("Helvetica", 12)
        
        # Základné informácie
        c.drawString(2*cm, height - 3*cm, f"Dátum: {datetime.now().strftime('%d.%m.%Y %H:%M')}")
        c.drawString(2*cm, height - 3.5*cm, f"Rozmery tabule: {optimization['stock_size']['width']}x{optimization['stock_size']['height']} cm")
        c.drawString(2*cm, height - 4*cm, f"Počet tabúľ: {optimization.get('sheet_count', len(optimization['layouts']))}")
        c.drawString(2*cm, height - 4.5*cm, f"Celková plocha: {optimization['total_area']:.2f} m²")
        
        sheet_count = optimization.get('sheet_count', len(optimization['layouts']))
        average_waste = optimization['total_waste'] / sheet_count if sheet_count > 0 else 0
        c.drawString(2*cm, height - 5*cm, f"Priemerný odpad: {average_waste:.1f}%")
        
        # Informácie o cenách
        if price:
            c.drawString(2*cm, height - 6*cm, f"Typ skla: {price['glass_name']}")
            area_price_per_m2 = price['area_price'] / price['area'] if price['area'] > 0 else 0
            c.drawString(2*cm, height - 6.5*cm, f"Cena za m²: {area_price_per_m2:.2f} €")
            c.drawString(2*cm, height - 7*cm, f"Cena za sklo: {price['area_price']:.2f} €")
            c.drawString(2*cm, height - 7.5*cm, f"Cena za odpad: {price['waste_price']:.2f} €")
            total_price = price['area_price'] + price['waste_price']
            c.drawString(2*cm, height - 8*cm, f"Celková cena: {total_price:.2f} €")
        
        # Pridáme kresby jednotlivých tabúľ na nové stránky
        for i, layout in enumerate(optimization['layouts']):
            c.showPage()
            c.setFont("Helvetica-Bold", 14)
            c.drawCentredString(width/2, height - 2*cm, f"Tabuľa #{i+1}")
            
            # Vypočítame mierku pre kresbu
            stock_width = optimization['stock_size']['width']
            stock_height = optimization['stock_size']['height']
            scale_x = (width - 4*cm) / stock_width
            scale_y = (height - 6*cm) / stock_height
            scale = min(scale_x, scale_y)
            
            # Vytvoríme a pridáme obrázok rozloženia
            layout_buffer = draw_layout_to_buffer(layout, stock_width, stock_height, scale=scale)
            
            # Vložíme obrázok tabule
            img_width = stock_width * scale + 2*cm
            img_height = stock_height * scale + 4*cm
            x_position = (width - img_width) / 2
            y_position = height - img_height - 2*cm
            
            c.setFont("Helvetica", 10)
            utilized_area = sum(panel[2] * panel[3] for panel in layout) / 10000
            waste_percentage = ((stock_width * stock_height / 10000) - utilized_area) / (stock_width * stock_height / 10000) * 100
            
            c.drawString(2*cm, y_position - 1*cm, f"Využitie tabule: {100-waste_percentage:.1f}%")
            c.drawString(2*cm, y_position - 1.5*cm, f"Plocha skiel: {utilized_area:.2f} m²")
            c.drawString(2*cm, y_position - 2*cm, f"Odpad: {(stock_width * stock_height / 10000) - utilized_area:.2f} m²")
        
        # Ukončíme a vrátime PDF
        c.save()
        buffer.seek(0)
        
        # Nastavíme správne hlavičky pre automatické stiahnutie súboru
        filename = f"rezaci_program_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        response = send_file(
            buffer,
            as_attachment=True,
            download_name=filename,
            mimetype='application/pdf'
        )
        
        # Cache control pre IE
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        
        return response
        
    except Exception as e:
        logger.exception(f"Chyba pri generovaní PDF: {str(e)}")
        return jsonify({'error': f'Chyba pri generovaní PDF: {str(e)}'}), 500

@app.route('/api/history', methods=['GET'])
def get_history():
    """API endpoint pre získanie histórie kalkulácií."""
    try:
        # Získanie user_id zo session
        user_id = session.get('user_id', None)
        if not user_id:
            # Pre webovú aplikáciu vytvoríme unikátne ID
            user_id = int(time.time())
            session['user_id'] = user_id
        
        # Získame históriu pre používateľa
        session_db = Session()
        calculations = session_db.query(Calculation).filter_by(user_id=user_id).order_by(
            Calculation.created_at.desc()
        ).limit(10).all()
        
        # Príprava výsledkov
        results = []
        for calc in calculations:
            glass = session_db.query(Glass).get(calc.glass_id)
            category = session_db.query(GlassCategory).get(glass.category_id)
            
            results.append({
                'id': calc.id,
                'date': calc.created_at.strftime("%d.%m.%Y %H:%M"),
                'glass_name': glass.name,
                'category_name': category.name,
                'area': round(calc.area, 2),
                'waste_area': round(calc.waste_area, 2),
                'total_price': round(calc.total_price, 2)
            })
        
        return jsonify({
            'success': True,
            'history': results
        })
        
    except Exception as e:
        logger.exception(f"Chyba pri získavaní histórie: {str(e)}")
        return jsonify({'error': f'Chyba pri získavaní histórie: {str(e)}'}), 500
    finally:
        session_db.close()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=True) 