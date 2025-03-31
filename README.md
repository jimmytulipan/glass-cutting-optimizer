# Rezací program a kalkulátor cien skla

Aplikácia na optimalizáciu rezania sklenených tabúľ a kalkuláciu cien pre sklárske firmy. Podporuje webové rozhranie aj Telegram bota.

## Funkcionalita

- Výpočet optimálneho rozloženia sklenených tabúľ na minimalizáciu odpadu
- Výber z preddefinovaných rozmerov tabúľ alebo zadanie vlastných rozmerov
- Kalkulácia ceny na základe typu skla a celkovej plochy
- Vizualizácia rozloženia rezov
- Generovanie PDF reportov
- História kalkulácií

## Inštalácia

1. Naklonujte repozitár
2. Vytvorte virtuálne prostredie a aktivujte ho:
```bash
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate
```
3. Nainštalujte závislosti:
```bash
pip install -r requirements.txt
```
4. Skopírujte `.env.example` na `.env` a upravte nastavenia:
```bash
cp .env.example .env
```
5. Ak chcete používať Telegram bota, nastavte `TELEGRAM_BOT_TOKEN` v `.env` súbore.

## Spustenie aplikácie

Aplikáciu je možné spustiť v troch režimoch:

### 1. Len webová aplikácia:
```bash
python combined_runner.py --web
```

### 2. Len Telegram bot:
```bash
python combined_runner.py --telegram
```

### 3. Obidva komponenty súčasne:
```bash
python combined_runner.py --both
```

Po spustení webovej aplikácie je rozhranie dostupné na adrese `http://localhost:5000`.

## Telegram Bot

Pre používanie Telegram bota:

1. Začnite konverzáciu s vaším botom pomocou príkazu `/start`
2. Vyberte rozmer tabule alebo zadajte vlastný
3. Zadajte rozmery sklenených tabúľ v požadovanom formáte
4. Získate vizualizáciu optimálneho rozloženia a súhrn
5. Potvrďte výpočet ceny a vyberte typ skla
6. Získate celkovú kalkuláciu ceny

## Štruktúra projektu

- `app.py` - webová aplikácia (Flask)
- `telegram_bot.py` - Telegram bot
- `shared_components.py` - zdieľané komponenty pre optimalizáciu a kalkuláciu
- `combined_runner.py` - nástroj na spustenie systému v rôznych módoch
- `templates/` - HTML šablóny pre webovú aplikáciu
- `static/` - statické súbory (CSS, JavaScript, obrázky)

## Licencia

Copyright © 2023 