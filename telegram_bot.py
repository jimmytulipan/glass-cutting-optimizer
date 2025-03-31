import telebot
import logging
import time
import os
import traceback
from datetime import datetime

# Import zdieľaných komponentov
from shared_components import (
    GlassPanel, CuttingOptimizer, GlassCalculator, 
    parse_dimensions, validate_dimensions, initialize_database,
    logger, Base, engine, Session, GlassCategory, Glass, Calculation
)

# Konfigurácia pre Telegram bota
TOKEN = '7410948566:AAGkfgV9AD3Rt9EfTXrIvMHyhULgAR7Y21Q'  # Nahraďte svojím tokenom
STOCK_WIDTH = 321
STOCK_HEIGHT = 225

class GlassCuttingBot:
    def __init__(self, token: str):
        logger.info('Inicializácia GlassCuttingBot')
        self.bot = telebot.TeleBot(token)
        self.user_dimensions = {}
        self.optimizer = None
        self.user_states = {}
        self.calculator = GlassCalculator(Session(), self.user_states)
        
        try:
            self.bot.remove_webhook()
            time.sleep(0.5)
            logger.info('Webhook úspešne odstránený')
        except Exception as e:
            logger.warning(f'Chyba pri odstraňovaní webhoku: {e}')
            
        self.STATES = {
            'WAITING_FOR_DIMENSIONS': 1,
            'WAITING_FOR_GLASS_TYPE': 2,
            'WAITING_FOR_CONFIRMATION': 3
        }
        
        self.setup_handlers()
        logger.info('GlassCuttingBot inicializovaný')

    def setup_handlers(self):
        @self.bot.message_handler(commands=['start'])
        def start(message):
            markup = telebot.types.ReplyKeyboardMarkup(row_width=1, resize_keyboard=True)
            btn1 = telebot.types.KeyboardButton('321 x 225 cm')
            btn2 = telebot.types.KeyboardButton('160.5 x 255 cm')
            btn3 = telebot.types.KeyboardButton('Vlastné rozmery')
            markup.add(btn1, btn2, btn3)
            
            welcome_text = (
                "Vitajte v optimalizátore rezania a kalkulátore cien skla!\n\n"
                "Dostupné príkazy:\n"
                "/start - Spustí nový výpočet\n"
                "/help - Zobrazí návod na použitie\n"
                "/history - Zobrazí históriu kalkulácií\n"
                "/clear_history - Vymaže históriu kalkulácií\n\n"
                "Najprv si prosím vyberte rozmer tabule:"
            )
            self.bot.reply_to(message, welcome_text, reply_markup=markup)

        @self.bot.message_handler(func=lambda message: message.text in ['321 x 225 cm', '160.5 x 255 cm', 'Vlastné rozmery'])
        def handle_dimension_choice(message):
            if message.text == '321 x 225 cm':
                width, height = 321, 225
                self.setup_optimizer(message.chat.id, width, height)
            elif message.text == '160.5 x 255 cm':
                width, height = 160.5, 255
                self.setup_optimizer(message.chat.id, width, height)
            else:  # Vlastné rozmery
                self.bot.reply_to(
                    message, 
                    "Zadajte rozmery tabule v centimetroch v formáte: šírka x výška\n"
                    "Napríklad: 200x150"
                )
                self.user_states[message.chat.id] = 'waiting_for_custom_dimensions'

        @self.bot.message_handler(func=lambda message: 
            message.chat.id in self.user_states and 
            self.user_states[message.chat.id] == 'waiting_for_custom_dimensions')
        def handle_custom_dimensions(message):
            try:
                # Parsovanie rozmerov
                dimensions = message.text.replace(',', '.').replace(' ', '')
                match = re.match(r'(\d+\.?\d*)x(\d+\.?\d*)', dimensions.lower())
                
                if not match:
                    self.bot.reply_to(
                        message, 
                        "❌ Nesprávny formát! Zadajte rozmery v formáte: šírka x výška\n"
                        "Napríklad: 200x150"
                    )
                    return
                    
                width, height = map(float, match.groups())
                
                # Kontrola rozmerov
                if width <= 0 or height <= 0:
                    self.bot.reply_to(message, "❌ Rozmery musia byť väčšie ako 0!")
                    return
                    
                if width > 1000 or height > 1000:
                    self.bot.reply_to(message, "❌ Rozmery sú príliš veľké! Maximum je 1000x1000 cm")
                    return
                
                # Nastavenie optimizéra s vlastnými rozmermi
                self.setup_optimizer(message.chat.id, width, height)
                
            except Exception as e:
                self.bot.reply_to(message, "❌ Nastala chyba pri spracovaní rozmerov. Skúste znova.")
                logger.error(f"Chyba pri spracovaní vlastných rozmerov: {str(e)}")

        def setup_optimizer(self, chat_id: int, width: float, height: float):
            """Pomocná metóda pre nastavenie optimizéra"""
            self.user_dimensions[chat_id] = (width, height)
            self.optimizer = CuttingOptimizer(width, height)
            
            response_text = (
                f"✅ Vybrali ste rozmer: {width}x{height} cm\n\n"
                "Teraz zadajte rozmery skiel v jednom z formátov:\n"
                "1️⃣ Jeden rozmer: 100x50 alebo 83.5x92.2\n"
                "2️⃣ Viac rozmerov naraz: 100x50-200x30-80.5x90.2\n"
            )
            self.bot.reply_to(message, response_text)
            self.user_states[chat_id] = self.STATES['WAITING_FOR_DIMENSIONS']

        @self.bot.message_handler(func=lambda message: 
            message.chat.id in self.user_states and 
            self.user_states[message.chat.id] == self.STATES['WAITING_FOR_DIMENSIONS'])
        def handle_glass_dimensions(message):
            try:
                dimensions = self.parse_dimensions(message.text)
                if not dimensions:
                    self.bot.reply_to(message, "❌ Nesprávny formát rozmerov!")
                    return

                panels = []
                for width, height in dimensions:
                    if self.validate_dimensions(width, height, message.chat.id):
                        panels.append(GlassPanel(width, height, 4.0))

                if not panels:
                    self.bot.reply_to(message, "❌ Žiadne platné rozmery!")
                    return

                # Výpočet optimálneho rozloženia
                processing_msg = self.bot.reply_to(message, "🔄 Prebieha výpočet optimálneho rozloženia...")
                
                all_layouts = self.optimizer.optimize_multiple_sheets(panels)
                if not all_layouts:
                    self.bot.reply_to(message, "❌ Nepodarilo sa nájsť vhodné rozloženie.")
                    return

                # Výpočet total_waste pred jeho použitím
                total_waste = 0
                for sheet_index, (layout, waste) in enumerate(all_layouts, 1):
                    img_buf = self.optimizer.visualize(layout)
                    sheet_area = sum(width * height / 10000 for _, _, width, height, _ in layout)
                    waste_area = self.optimizer.calculate_waste_area(sheet_area)

                    caption = (
                        f"📋 Tabula #{sheet_index}\n"
                        f"📏 Plocha skiel: {sheet_area:.2f} m²\n"
                        f"🗑️ Odpad: {waste_area:.2f} m²\n"
                        f"📊 Využitie: {100-waste:.1f}%"
                    )
                    
                    self.bot.send_photo(message.chat.id, img_buf, caption=caption)
                    total_waste += waste

                # Uloženie výsledkov pre neskoršie použitie
                self.user_states[message.chat.id] = {
                    'layouts': all_layouts,
                    'total_area': sum(panel.width * panel.height / 10000 for panel in panels),
                    'panels': panels,
                    'total_waste': total_waste
                }

                # Výpočet priemerného odpadu
                if len(all_layouts) > 0:
                    average_waste = total_waste/len(all_layouts)
                else:
                    average_waste = 0

                # Zobrazenie súhrnných informácií s tlačidlami
                markup = telebot.types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
                btn_yes = telebot.types.KeyboardButton('Áno')
                btn_no = telebot.types.KeyboardButton('Nie') 
                markup.add(btn_yes, btn_no)

                summary = (
                    f"📊 Celkový súhrn:\n"
                    f"📦 Počet tabúľ: {len(all_layouts)}\n"
                    f"📏 Celková plocha skiel: {self.user_states[message.chat.id]['total_area']:.2f} m²\n"
                    f"🗑️ Priemerný odpad: {average_waste:.1f}%\n\n"
                    "Chcete pokračovať s výpočtom ceny?"
                )
                
                # Uložíme stav pred odoslaním správy
                self.user_states[message.chat.id] = {
                    'layouts': all_layouts,
                    'total_area': self.user_states[message.chat.id]['total_area'],
                    'panels': panels,
                    'total_waste': total_waste,
                    'state': self.STATES['WAITING_FOR_GLASS_TYPE']
                }
                
                self.bot.reply_to(message, summary, reply_markup=markup)

            except Exception as e:
                logger.error(f"Chyba pri spracovaní rozmerov: {str(e)}", exc_info=True)
                self.bot.reply_to(message, f"❌ Nastala chyba: {str(e)}")

        @self.bot.message_handler(func=lambda message: 
            message.chat.id in self.user_states and 
            isinstance(self.user_states[message.chat.id], dict) and
            self.user_states[message.chat.id].get('state') == self.STATES['WAITING_FOR_GLASS_TYPE'] and
            message.text == 'Áno')
        def handle_glass_type_selection(message):
            try:
                logger.info(f"Spracovávam odpoveď Áno od užívateľa {message.chat.id}")
                # Získanie kategórií skla z databázy
                session = Session()
                categories = session.query(GlassCategory).all()
                
                if not categories:
                    self.bot.reply_to(message, "❌ V databáze nie sú žiadne kategórie skla.")
                    return
                
                markup = telebot.types.InlineKeyboardMarkup()
                for category in categories:
                    callback_data = f"cat_{category.id}"
                    logger.info(f"Pridávam kategóriu: {category.name} s callback_data: {callback_data}")
                    markup.add(telebot.types.InlineKeyboardButton(
                        category.name,
                        callback_data=callback_data
                    ))
                
                # Odstránime klávesnicu s Áno/Nie
                remove_markup = telebot.types.ReplyKeyboardRemove()
                
                self.bot.reply_to(
                    message,
                    "Vyberte kategóriu skla:",
                    reply_markup=markup
                )
                
                # Aktualizujeme stav
                self.user_states[message.chat.id]['state'] = 'selecting_category'
                
            except Exception as e:
                logger.error(f"Chyba pri výbere kategórie skla: {str(e)}", exc_info=True)
                self.bot.reply_to(message, "❌ Nastala chyba pri výbere kategórie skla")
            finally:
                session.close()

        @self.bot.callback_query_handler(func=lambda call: call.data.startswith('cat_'))
        def handle_category_selection(call):
            category_id = int(call.data.split('_')[1])
            
            session = Session()
            glasses = session.query(Glass).filter_by(category_id=category_id).all()
            
            markup = telebot.types.InlineKeyboardMarkup()
            for glass in glasses:
                markup.add(telebot.types.InlineKeyboardButton(
                    f"{glass.name} ({glass.price_per_m2}€/m²)",
                    callback_data=f"glass_{glass.id}"
                ))
            
            self.bot.edit_message_text(
                "Vyberte typ skla:",
                call.message.chat.id,
                call.message.message_id,
                reply_markup=markup
            )

        @self.bot.callback_query_handler(func=lambda call: call.data.startswith('glass_'))
        def handle_glass_selection(call):
            try:
                session = Session()
                glass_id = int(call.data.split('_')[1])
                chat_id = call.message.chat.id
                
                logger.info(f"Spracovávam výber skla: glass_id={glass_id}, chat_id={chat_id}")
                
                if chat_id not in self.user_states:
                    logger.error(f"Chat ID {chat_id} nemá uložený stav")
                    self.bot.answer_callback_query(call.id, "❌ Chyba: Začnite znova príkazom /start")
                    return

                if not isinstance(self.user_states[chat_id], dict):
                    logger.error(f"Nesprávny formát user_states pre chat_id {chat_id}")
                    self.bot.answer_callback_query(call.id, "❌ Chyba: Začnite znova príkazom /start")
                    return

                if 'total_area' not in self.user_states[chat_id]:
                    logger.error(f"Chýba total_area pre chat_id {chat_id}")
                    self.bot.answer_callback_query(call.id, "❌ Chyba: Začnite znova príkazom /start")
                    return

                # Výpočet ceny
                total_area = self.user_states[chat_id]['total_area']
                logger.info(f"Počítam cenu pre plochu {total_area}m²")
                
                glass = session.query(Glass).get(glass_id)
                if not glass:
                    logger.error(f"Sklo s ID {glass_id} nebolo nájdené")
                    self.bot.answer_callback_query(call.id, "❌ Chyba: Sklo nebolo nájdené")
                    return

                price_calculation = self.calculator.get_glass_price(glass_id, total_area * 1000, 1000, chat_id)
                
                summary = (
                    f"💰 Cenová kalkulácia:\n\n"
                    f"Typ skla: {price_calculation['glass_name']}\n"
                    f"Plocha skiel: {price_calculation['area']:.2f} m² = {price_calculation['area_price']}€\n"
                    f"Plocha odpadu: {price_calculation['waste_area']:.2f} m² = {price_calculation['waste_price']}€\n"
                    f"Celková cena: {price_calculation['total_price']}€\n"
                )
                
                logger.info(f"Odosielam cenovú kalkuláciu pre chat_id {chat_id}")
                
                # Najprv potvrďte callback query
                self.bot.answer_callback_query(call.id)
                
                # Potom upravte správu
                self.bot.edit_message_text(
                    summary,
                    chat_id,
                    call.message.message_id
                )
                
                # Pridáme tlačidlo na generovanie PDF
                markup = telebot.types.InlineKeyboardMarkup()
                markup.add(telebot.types.InlineKeyboardButton(
                    "📄 Generovať PDF",
                    callback_data=f"pdf_{glass_id}"
                ))
                
                self.bot.send_message(
                    chat_id,
                    "Chcete vygenerovať PDF s výkresom a cenovou kalkuláciou?",
                    reply_markup=markup
                )
                
                # Uloženie kalkulácie do databázy
                try:
                    calculation = Calculation(
                        user_id=chat_id,
                        glass_id=glass_id,
                        width=total_area * 100,  # konverzia na cm²
                        height=100,
                        area=total_area,
                        waste_area=total_area * (self.user_states[chat_id].get('total_waste', 0) / 100),
                        total_price=price_calculation['total_price']
                    )
                    session.add(calculation)
                    session.commit()
                    logger.info(f"Kalkulácia uložená do databázy pre chat_id {chat_id}")
                except Exception as e:
                    logger.error(f"Chyba pri ukladaní kalkulácie: {str(e)}")
                    session.rollback()
                
            except Exception as e:
                logger.error(f"Kritická chyba pri spracovaní výberu skla: {str(e)}", exc_info=True)
                try:
                    self.bot.answer_callback_query(call.id, "❌ Nastala chyba pri výpočte")
                    self.bot.send_message(chat_id, "❌ Nastala chyba. Prosím, začnite znova príkazom /start")
                except:
                    pass
            finally:
                session.close()

        @self.bot.message_handler(func=lambda message: 
            message.chat.id in self.user_states and 
            self.user_states[message.chat.id] == self.STATES['WAITING_FOR_GLASS_TYPE'] and
            message.text in ['Nie'])
        def handle_no_price_calculation(message):
            self.user_states[message.chat.id] = self.STATES['WAITING_FOR_DIMENSIONS']
            markup = telebot.types.ReplyKeyboardMarkup(row_width=1, resize_keyboard=True)
            btn1 = telebot.types.KeyboardButton('321 x 225 cm')
            btn2 = telebot.types.KeyboardButton('160.5 x 255 cm')
            btn3 = telebot.types.KeyboardButton('Vlastné rozmery')
            markup.add(btn1, btn2, btn3)
            self.bot.reply_to(
                message,
                "✅ V poriadku. Pre novú kalkuláciu vyberte rozmer tabule:",
                reply_markup=markup
            )

        @self.bot.message_handler(commands=['help'])
        def help(message):
            help_text = (
                "📋 Návod na použitie:\n\n"
                "1⃣ /start - Spustí nový výpočet\n"
                "2️ Vyberte rozmer tabule\n"
                "3️⃣ Zadajte rozmery skiel:\n"
                "   • Jeden rozmer: 100x50\n"
                "   • Viac rozmerov: 100x50-200x30\n"
                "4️⃣ Potvrďte výpočet ceny\n"
                "5️⃣ Vyberte typ skla\n\n"
                "Ďalšie príkazy:\n"
                "/history - Zobrazí históriu kalkulácií\n"
                "/clear_history - Vymaze históriu kalkulácií\n\n"
                "❓ Pre ďalšiu pomoc kontaktujte administrátora"
            )
            self.bot.reply_to(message, help_text)

        @self.bot.message_handler(commands=['clear_history'])
        def clear_history(message):
            try:
                session = Session()
                session.query(Calculation).filter_by(user_id=message.chat.id).delete()
                session.commit()
                self.bot.reply_to(message, "✅ História kalkulácií bola vymazaná")
            except Exception as e:
                logger.error(f"Chyba pri mazaní histórie: {str(e)}")
                self.bot.reply_to(message, "❌ Nastala chyba pri mazaní histórie")

        @self.bot.message_handler(commands=['history'])
        def show_history(message):
            try:
                session = Session()
                calculations = session.query(Calculation).filter_by(user_id=message.chat.id).order_by(Calculation.created_at.desc()).limit(5).all()
                
                if not calculations:
                    self.bot.reply_to(message, "Zatiaľ nemáte žiadne kalkulácie")
                    return
                    
                history_text = "📋 Posledných 5 kalkulácií:\n\n"
                for calc in calculations:
                    glass = session.query(Glass).get(calc.glass_id)
                    history_text += (
                        f"🕒 {calc.created_at.strftime('%d.%m.%Y %H:%M')}\n"
                        f"📏 Plocha: {calc.area:.2f} m²\n"
                        f"🗑️ Odpad: {calc.waste_area:.2f} m²\n"
                        f"💰 Cena: {calc.total_price}€\n"
                        f"🪟 Typ: {glass.name}\n\n"
                    )
                    
                self.bot.reply_to(message, history_text)
            except Exception as e:
                logger.error(f"Chyba pri zobrazení histórie: {str(e)}")
                self.bot.reply_to(message, "❌ Nastala chyba pri načítaní histórie")

        @self.bot.callback_query_handler(func=lambda call: call.data.startswith('pdf_'))
        def handle_pdf_generation(call):
            # Implementácia v budúcnosti
            self.bot.answer_callback_query(call.id, "PDF generovanie je momentálne v príprave.")

    def parse_dimensions(self, text: str) -> List[Tuple[float, float]]:
        return parse_dimensions(text)

    def validate_dimensions(self, width: float, height: float, chat_id: int) -> bool:
        stock_width, stock_height = self.user_dimensions.get(chat_id, (STOCK_WIDTH, STOCK_HEIGHT))
        return validate_dimensions(width, height, stock_width, stock_height)

    def run(self):
        """Spustenie bota."""
        try:
            print("Bot bol spustený! Stlačte Ctrl+C pre ukončenie.")
            self.bot.infinity_polling(timeout=10, long_polling_timeout=5)
        except Exception as e:
            logger.error(f"Chyba pri behu bota: {str(e)}", exc_info=True)
            raise e

if __name__ == "__main__":
    try:
        # Inicializácia databázy
        initialize_database()
        
        print("=== Optimalizátor rezania a kalkulátor cien skla - Telegram Bot ===")
        print("Inicializujem systém...")
        
        # Spustenie bota
        cutting_bot = GlassCuttingBot(TOKEN)
        
        print("\nBot je úspešne spustený a čaká na správy!")
        print("Pre ukončenie stlačte Ctrl+C\n")
        
        cutting_bot.run()
    except KeyboardInterrupt:
        print("\nUkončujem bota...")
    except Exception as e:
        logger.critical(f"Kritická chyba: {str(e)}", exc_info=True)
        print(f"\nNastala chyba: {str(e)}")
    finally:
        print("\nProgram ukončený.") 