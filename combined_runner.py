import argparse
import sys
import threading
import os
from flask import Flask

# Inicializácia zdieľanej databázy
from shared_components import initialize_database

def run_flask_app():
    """Spustí webovú Flask aplikáciu."""
    from app import app
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=False)
    
def run_telegram_bot():
    """Spustí Telegram bota."""
    from telegram_bot import GlassCuttingBot, TOKEN
    bot = GlassCuttingBot(TOKEN)
    try:
        print("Telegram bot spustený. Stlačte Ctrl+C pre ukončenie.")
        bot.run()
    except KeyboardInterrupt:
        print("Telegram bot zastavený.")

def main():
    parser = argparse.ArgumentParser(description='Spustí aplikáciu Rezací program v rôznych módoch.')
    parser.add_argument('--web', action='store_true', help='Spustí webovú aplikáciu')
    parser.add_argument('--telegram', action='store_true', help='Spustí Telegram bota')
    parser.add_argument('--both', action='store_true', help='Spustí súčasne webovú aplikáciu aj Telegram bota')
    
    args = parser.parse_args()
    
    # Ak nie sú zadané žiadne parametre, zobrazíme nápovedu
    if not (args.web or args.telegram or args.both):
        parser.print_help()
        sys.exit(0)
    
    # Inicializácia databázy pred spustením aplikácií
    print("Inicializácia databázy...")
    initialize_database()
    
    if args.both:
        print("Spúšťam obidva komponenty...")
        # Spustenie Telegram bota v samostatnom vlákne
        telegram_thread = threading.Thread(target=run_telegram_bot)
        telegram_thread.daemon = True
        telegram_thread.start()
        
        # Spustenie webovej aplikácie v hlavnom vlákne
        run_flask_app()
    elif args.web:
        print("Spúšťam webovú aplikáciu...")
        run_flask_app()
    elif args.telegram:
        print("Spúšťam Telegram bota...")
        run_telegram_bot()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nUkončujem aplikáciu...")
    except Exception as e:
        print(f"Nastala kritická chyba: {str(e)}")
    finally:
        print("Aplikácia ukončená.") 