# Optimalizátor Rezania Skla - Webová aplikácia

Webová aplikácia pre optimalizáciu rezania tabúľ skla a kalkuláciu cien. Aplikácia umožňuje užívateľom zadať potrebné rozmery skiel, optimalizovať ich rozloženie na štandardných tabuliach skla a vypočítať celkovú cenu na základe vybraného typu skla.

## Funkcie

- Optimalizácia rozloženia skiel na tabuli s minimalizáciou odpadu
- Vizualizácia optimálneho rozloženia s farebným odlíšením jednotlivých kusov
- Výpočet ceny na základe vybraného typu skla
- Ukladanie histórie kalkulácií
- Responzívny dizajn pre použitie na počítači aj na mobilných zariadeniach

## Požiadavky

- Python 3.7 alebo novší
- Flask
- Flask-SQLAlchemy
- matplotlib
- numpy
- Internetový prehliadač s podporou HTML5 a JavaScript

## Inštalácia

1. Naklonujte alebo stiahnite tento repozitár

2. Nainštalujte požadované knižnice:
   ```
   pip install -r requirements.txt
   ```

3. Spustite aplikáciu:
   ```
   python app.py
   ```

4. Otvorte webový prehliadač a prejdite na adresu:
   ```
   http://localhost:5000
   ```

## Použitie

1. Vyberte rozmer tabule skla alebo zadajte vlastné rozmery
2. Zadajte potrebné rozmery skiel v cm (formát: šírka×výška)
   - Jeden rozmer: 100x50
   - Viacero rozmerov: 100x50-200x30-80.5x90.2
3. Kliknite na tlačidlo "Vypočítať optimálne rozloženie"
4. Po zobrazení výsledkov optimalizácie vyberte kategóriu a typ skla
5. Kliknite na "Vypočítať cenu" pre zobrazenie cenovej kalkulácie

## Databáza

Aplikácia používa SQLite databázu pre ukladanie:
- Kategórií skla
- Typov skla a ich cien
- Histórie kalkulácií

Pri prvom spustení sa automaticky vytvorí databáza s ukážkovými dátami.

## Príspevky a nahlasovanie chýb

Ak nájdete chybu alebo máte návrh na vylepšenie, vytvorte issue alebo pull request. 