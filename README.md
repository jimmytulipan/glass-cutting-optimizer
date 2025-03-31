# Optimalizátor Rezania Skla - Webová aplikácia

## Popis
Webová aplikácia na optimalizáciu rozloženia skiel na tabuli. Aplikácia počíta najefektívnejšie rozloženie s minimálnym odpadom a poskytuje možnosť cenovej kalkulácie.

## Funkcie
- Optimalizácia rozloženia skla na tabuli pre minimalizáciu odpadu
- Vizualizácia rozloženia
- Kalkulácia ceny podľa typu skla 
- Ukladanie histórie výpočtov
- Responzívny dizajn

## Požiadavky
- Python 3.8+
- Flask
- Flask-SQLAlchemy
- matplotlib
- numpy
- Moderný webový prehliadač

## Inštalácia a spustenie (lokálne)

1. Klonujte repozitár:
   ```
   git clone https://github.com/vas-username/glass-cutting-optimizer.git
   cd glass-cutting-optimizer
   ```

2. Inštalujte potrebné knižnice:
   ```
   pip install -r requirements.txt
   ```

3. Spustite aplikáciu:
   ```
   python app.py
   ```

4. Otvorte webový prehliadač a navštívte `http://localhost:5000`

## Nasadenie na Vercel

1. Pripravte svoj GitHub repozitár:
   - Vytvorte nový repozitár na GitHube
   - Nastavte origin a push:
     ```
     git remote add origin https://github.com/vas-username/glass-cutting-optimizer.git
     git push -u origin master
     ```

2. Nasadenie na Vercel:
   - Zaregistrujte sa na [Vercel](https://vercel.com)
   - Kliknite na "New Project"
   - Importujte svoj GitHub repozitár
   - V nastaveniach projektu nechajte všetko predvolené (Vercel automaticky rozpozná Flask aplikáciu)
   - Kliknite "Deploy"

3. Po nasadení:
   - Vercel vám poskytne URL vašej aplikácie (napr. `https://glass-cutting-optimizer.vercel.app`)
   - Aplikácia je teraz dostupná online pre všetkých užívateľov

## Použitie
1. Vyberte rozmer tabule (štandardný alebo vlastný)
2. Zadajte rozmery skiel v jednom z formátov:
   - Jeden rozmer: `100x50` alebo `83.5x92.2`
   - Viac rozmerov naraz: `100x50-200x30-80.5x90.2`
3. Kliknite na "Vypočítať Optimálne Rozloženie"
4. Prezrite si výsledky optimalizácie
5. Voliteľne vypočítajte cenu výbratím kategórie a typu skla

## Databáza
Aplikácia používa SQLite databázu na ukladanie:
- Kategórií skla
- Typov skla a ich cien
- Histórie výpočtov

Databáza sa automaticky vytvorí pri prvom spustení aplikácie.

## Príspevky a hlásenie chýb
Pre hlásenie chýb alebo navrhnutie vylepšení vytvorte problém (issue) alebo pull request. 