// Konštanty pre API
const apiBaseUrl = '';

// Globálne premenné pre uloženie výsledkov optimalizácie
let optimizationResult = null;

// Pomocné funkcie
function formatNumber(number, decimals = 2) {
    return parseFloat(number).toFixed(decimals);
}

// Funkcie pre správu témy
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // Aktualizácia stavu prepínačov podľa témy (desktop aj mobilná verzia)
    const themeSwitchDesktop = document.getElementById('themeSwitch');
    const themeSwitchMobile = document.getElementById('themeSwitchMobile');
    
    if (themeSwitchDesktop) {
        themeSwitchDesktop.checked = theme === 'dark';
    }
    
    if (themeSwitchMobile) {
        themeSwitchMobile.checked = theme === 'dark';
    }
    
    console.log('Téma zmenená na:', theme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
}

// Funkcia pre správu tlačidla "späť hore"
function handleBackToTopButton() {
    const backToTopButton = document.getElementById("btn-back-to-top");
    
    if (!backToTopButton) return;
    
    // Štýly pre tlačidlo
    backToTopButton.style.position = "fixed";
    backToTopButton.style.bottom = "20px";
    backToTopButton.style.right = "20px";
    backToTopButton.style.height = "40px";
    backToTopButton.style.width = "40px";
    backToTopButton.style.display = "none";
    backToTopButton.style.zIndex = "99";
    backToTopButton.style.padding = "0";
    backToTopButton.style.borderRadius = "50%";
    backToTopButton.style.boxShadow = "0 4px 10px rgba(0,0,0,0.2)";
    
    // Zobraziť tlačidlo po scrollovaní
    window.onscroll = function() {
        if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
            backToTopButton.style.display = "block";
        } else {
            backToTopButton.style.display = "none";
        }
    };
    
    // Scrollovať hore po kliknutí
    backToTopButton.addEventListener("click", function() {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    });
}

// Inicializácia pri načítaní stránky
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM načítaný, inicializujem aplikáciu');
    
    // Načítanie uloženej témy
    loadTheme();
    
    // Prepínač tém - desktop
    const themeSwitch = document.getElementById('themeSwitch');
    if (themeSwitch) {
        themeSwitch.addEventListener('change', function() {
            console.log('Prepínač témy desktop kliknutý, aktuálny stav:', this.checked);
            const newTheme = this.checked ? 'dark' : 'light';
            setTheme(newTheme);
        });
    } else {
        console.error('Prepínač témy desktop nebol nájdený!');
    }
    
    // Prepínač tém - mobilný
    const themeSwitchMobile = document.getElementById('themeSwitchMobile');
    if (themeSwitchMobile) {
        themeSwitchMobile.addEventListener('change', function() {
            console.log('Prepínač témy mobilný kliknutý, aktuálny stav:', this.checked);
            const newTheme = this.checked ? 'dark' : 'light';
            setTheme(newTheme);
        });
    }
    
    // Inicializácia tlačidla "späť hore"
    handleBackToTopButton();
    
    // Inicializácia formulárov a tlačidiel
    initEventListeners();
    
    // Načítanie kategórií skla
    loadGlassCategories();
});

function initEventListeners() {
    // Formulár pre optimalizáciu
    document.getElementById('optimizeForm').addEventListener('submit', handleOptimizeSubmit);
    
    // Formulár pre výpočet ceny
    document.getElementById('priceForm').addEventListener('submit', handlePriceCalculation);
    
    // Zmena typu rozmeru tabule
    document.getElementById('stockSize').addEventListener('change', handleStockSizeChange);
    
    // Zmena kategórie skla
    document.getElementById('glassCategory').addEventListener('change', handleCategoryChange);
    
    // Tlačidlo pre vymazanie histórie
    document.getElementById('clearHistory').addEventListener('click', function() {
        if (confirm('Skutočne chcete vymazať históriu kalkulácií?')) {
            localStorage.removeItem('glassCalculations');
            document.getElementById('historyContainer').innerHTML = 
                '<div class="text-center text-muted py-3" id="emptyHistory">Zatiaľ nemáte žiadne kalkulácie</div>';
        }
    });
}

function handleOptimizeSubmit(event) {
    event.preventDefault();
    
    // Získanie zadaných rozmerov skla
    const dimensionsInput = document.getElementById('dimensions').value.trim();
    if (!dimensionsInput) {
        showAlert('Prosím, zadajte rozmery skiel.', 'danger');
        return;
    }
    
    // Získanie rozmerov tabule
    let stockWidth, stockHeight;
    const stockSizeSelect = document.getElementById('stockSize');
    if (stockSizeSelect.value === 'custom') {
        stockWidth = parseFloat(document.getElementById('customWidth').value);
        stockHeight = parseFloat(document.getElementById('customHeight').value);
        if (isNaN(stockWidth) || isNaN(stockHeight) || stockWidth <= 0 || stockHeight <= 0) {
            showAlert('Zadajte platné vlastné rozmery tabule.', 'danger');
            return;
        }
    } else {
        // Štandardný rozmer
        stockWidth = 321;
        stockHeight = 225;
    }
    
    // Zobrazenie načítavania
    document.getElementById('optimizationResult').innerHTML = '<div class="text-center"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Prebieha výpočet optimálneho rozloženia...</p></div>';
    document.getElementById('resultContainer').classList.remove('d-none');
    
    // Odoslanie požiadavky na server
    fetch(`${apiBaseUrl}/api/optimize`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            dimensions: dimensionsInput,
            stock_width: stockWidth,
            stock_height: stockHeight
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Chyba pri komunikácii so serverom');
        }
        return response.json();
    })
    .then(data => {
        console.log('Prijaté dáta z API:', data);
        
        // Kontrola, či máme platné výsledky
        if (!data.success || !data.sheets || data.sheets.length === 0) {
            showAlert('Nepodarilo sa nájsť optimálne rozloženie.', 'warning');
            document.getElementById('resultContainer').classList.add('d-none');
            return;
        }
        
        // Uloženie výsledkov pre neskoršie použitie
        optimizationResult = data;
        
        // Zobrazenie výsledkov
        displayOptimizationResults(data);
        
        // Posunieme sa na výsledky
        document.getElementById('resultContainer').scrollIntoView({ behavior: 'smooth' });
    })
    .catch(error => {
        console.error('Chyba:', error);
        showAlert(`Nastala chyba: ${error.message}`, 'danger');
        document.getElementById('resultContainer').classList.add('d-none');
    });
}

function displayOptimizationResults(data) {
    const resultContainer = document.getElementById('optimizationResult');
    const sheet = data.sheets[0]; // Berieme prvú tabuľu
    
    // Aktualizácia súhrnu
    document.getElementById('totalArea').textContent = formatNumber(sheet.total_area);
    document.getElementById('wastePercentage').textContent = formatNumber(sheet.waste_percentage);
    
    // Zobrazenie rozloženia
    let svgWidth = 600;
    let svgHeight = 420;
    let scale = Math.min(svgWidth / 321, svgHeight / 225);
    
    let svgContent = `
        <svg width="${svgWidth}" height="${svgHeight}" class="layout-visualization">
            <rect x="0" y="0" width="${321 * scale}" height="${225 * scale}" fill="none" stroke="black" stroke-width="2" />
    `;
    
    // Farby pre panely
    const colors = ['#a6d8e2', '#c4e0b2', '#f8cbad', '#ffe699', '#b4c6e7', '#d9d9d9'];
    
    // Pridanie jednotlivých panelov
    sheet.layout.forEach((panel, index) => {
        const color = colors[index % colors.length];
        const x = panel.x * scale;
        const y = panel.y * scale;
        const width = panel.width * scale;
        const height = panel.height * scale;
        
        svgContent += `
            <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${color}" stroke="white" stroke-width="1" />
            <text x="${x + width/2}" y="${y + height/2}" dominant-baseline="middle" text-anchor="middle" font-size="10">
                ${panel.width}x${panel.height}${panel.rotated ? ' (R)' : ''}
            </text>
        `;
    });
    
    svgContent += '</svg>';
    resultContainer.innerHTML = svgContent;
    
    // Uloženie kalkulácie do histórie
    saveCalculationToHistory(data);
}

function handlePriceCalculation(event) {
    event.preventDefault();
    
    if (!optimizationResult) {
        showAlert('Najprv je potrebné vykonať optimalizáciu rozloženia.', 'warning');
        return;
    }
    
    // Získanie vybraného typu skla
    const glassSelect = document.getElementById('glassType');
    const glassType = glassSelect.options[glassSelect.selectedIndex].text;
    const glassId = glassSelect.value;
    
    // Získanie celkovej plochy a odpadu z optimalizácie
    const sheet = optimizationResult.sheets[0];
    const totalArea = sheet.total_area;
    const wastePercentage = sheet.waste_percentage;
    
    console.log('Údaje pre výpočet ceny:', {
        glassType: glassType,
        area: totalArea,
        wastePercentage: wastePercentage
    });
    
    // Odoslanie požiadavky na server
    fetch(`${apiBaseUrl}/api/calculate-price`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            glassType: glassType,
            glassId: glassId,
            area: totalArea,
            wastePercentage: wastePercentage
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Chyba pri komunikácii so serverom');
        }
        return response.json();
    })
    .then(data => {
        console.log('Prijaté dáta z API (cena):', data);
        
        if (data.success && data.price) {
            displayPriceCalculation(data.price);
        } else {
            showAlert('Nepodarilo sa vypočítať cenu.', 'warning');
        }
    })
    .catch(error => {
        console.error('Chyba:', error);
        showAlert(`Nastala chyba: ${error.message}`, 'danger');
    });
}

function displayPriceCalculation(data) {
    // Zobrazenie výsledku výpočtu ceny
    document.getElementById('priceResult').classList.remove('d-none');
    
    // Nastavenie základných údajov
    const glassName = data.glass_name || '-';
    const area = data.area || 0;
    const areaPrice = data.area_price || 0;
    const wasteArea = data.waste_area || 0;
    const wastePrice = data.waste_price || 0;
    
    // Výpočet celkovej ceny
    const totalPrice = areaPrice + wastePrice;
    
    // Logovanie pre účely ladenia
    console.log('Cena za sklo:', {
        glassName: glassName,
        area: area,
        areaPrice: areaPrice,
        wasteArea: wasteArea,
        wastePrice: wastePrice,
        totalPrice: totalPrice
    });
    
    // Nastavenie hodnôt do elementov
    document.getElementById('glassName').textContent = glassName;
    document.getElementById('area').textContent = formatNumber(area);
    document.getElementById('areaPrice').textContent = formatNumber(areaPrice);
    document.getElementById('wasteArea').textContent = formatNumber(wasteArea);
    document.getElementById('wastePrice').textContent = formatNumber(wastePrice);
    document.getElementById('totalPrice').textContent = formatNumber(totalPrice);
    
    // Posunieme sa na výsledky
    document.getElementById('priceResult').scrollIntoView({ behavior: 'smooth' });
    
    // Uloženie kalkulácie do histórie
    updateCalculationWithPrice(data);
}

function handleStockSizeChange() {
    const stockSizeSelect = document.getElementById('stockSize');
    const customSizeFields = document.getElementById('customSizeFields');
    
    if (stockSizeSelect.value === 'custom') {
        customSizeFields.classList.remove('d-none');
    } else {
        customSizeFields.classList.add('d-none');
    }
}

function loadGlassCategories() {
    fetch(`${apiBaseUrl}/api/get-glass-categories`)
        .then(response => response.json())
        .then(categories => {
            const categorySelect = document.getElementById('glassCategory');
            categorySelect.innerHTML = '';
            
            if (categories.length > 0) {
                categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category.id;
                    option.textContent = category.name;
                    categorySelect.appendChild(option);
                });
                
                // Načítame typy skla pre prvú kategóriu
                handleCategoryChange();
            } else {
                categorySelect.innerHTML = '<option value="">Žiadne kategórie skla</option>';
            }
        })
        .catch(error => {
            console.error('Chyba pri načítaní kategórií skla:', error);
            document.getElementById('glassCategory').innerHTML = '<option value="">Chyba pri načítaní</option>';
        });
}

function handleCategoryChange() {
    const categorySelect = document.getElementById('glassCategory');
    const categoryId = categorySelect.value;
    
    if (!categoryId) return;
    
    fetch(`${apiBaseUrl}/api/get-glass-types?categoryId=${categoryId}`)
        .then(response => response.json())
        .then(types => {
            const typeSelect = document.getElementById('glassType');
            typeSelect.innerHTML = '';
            
            if (types.length > 0) {
                types.forEach(type => {
                    const option = document.createElement('option');
                    option.value = type.id;
                    option.textContent = `${type.name} (${formatNumber(type.price_per_m2)} €/m²)`;
                    typeSelect.appendChild(option);
                });
            } else {
                typeSelect.innerHTML = '<option value="">Žiadne typy skla</option>';
            }
        })
        .catch(error => {
            console.error('Chyba pri načítaní typov skla:', error);
            document.getElementById('glassType').innerHTML = '<option value="">Chyba pri načítaní</option>';
        });
}

function saveCalculationToHistory(data) {
    // Získanie existujúcej histórie z localStorage
    let history = JSON.parse(localStorage.getItem('glassCalculations') || '[]');
    
    // Pridanie novej kalkulácie
    const newCalculation = {
        id: Date.now(),
        date: new Date().toISOString(),
        dimensions: document.getElementById('dimensions').value,
        totalArea: data.sheets[0].total_area,
        wastePercentage: data.sheets[0].waste_percentage,
        stockWidth: document.getElementById('stockSize').value === 'custom' 
            ? parseFloat(document.getElementById('customWidth').value) 
            : 321,
        stockHeight: document.getElementById('stockSize').value === 'custom' 
            ? parseFloat(document.getElementById('customHeight').value) 
            : 225,
    };
    
    // Pridanie na začiatok poľa (najnovšie záznamy budú prvé)
    history.unshift(newCalculation);
    
    // Obmedzenie dĺžky histórie
    if (history.length > 10) {
        history = history.slice(0, 10);
    }
    
    // Uloženie späť do localStorage
    localStorage.setItem('glassCalculations', JSON.stringify(history));
    
    // Aktualizácia zobrazenia histórie
    displayHistory();
}

function updateCalculationWithPrice(priceData) {
    // Získanie existujúcej histórie z localStorage
    let history = JSON.parse(localStorage.getItem('glassCalculations') || '[]');
    
    if (history.length > 0) {
        // Aktualizácia najnovšej kalkulácie
        history[0].glassName = priceData.glass_name;
        history[0].areaPrice = priceData.area_price;
        history[0].wastePrice = priceData.waste_price;
        history[0].totalPrice = priceData.area_price + priceData.waste_price;
        
        // Uloženie späť do localStorage
        localStorage.setItem('glassCalculations', JSON.stringify(history));
        
        // Aktualizácia zobrazenia histórie
        displayHistory();
    }
}

function displayHistory() {
    const historyContainer = document.getElementById('historyContainer');
    const history = JSON.parse(localStorage.getItem('glassCalculations') || '[]');
    
    if (history.length === 0) {
        historyContainer.innerHTML = '<div class="text-center text-muted py-3" id="emptyHistory">Zatiaľ nemáte žiadne kalkulácie</div>';
        return;
    }
    
    let htmlContent = '';
    history.forEach(calc => {
        // Formátovanie dátumu
        const date = new Date(calc.date);
        const formattedDate = `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()} ${date.getHours()}:${(date.getMinutes() < 10 ? '0' : '') + date.getMinutes()}`;
        
        // Vytvorenie záznamu
        htmlContent += `<div class="history-item mb-3 p-2 border-bottom">`;
        htmlContent += `<div class="small text-muted">${formattedDate}</div>`;
        htmlContent += `<div>Rozmery: ${calc.dimensions}</div>`;
        htmlContent += `<div>Tabuľa: ${calc.stockWidth}x${calc.stockHeight} cm</div>`;
        htmlContent += `<div>Plocha: ${formatNumber(calc.totalArea)} m², Odpad: ${formatNumber(calc.wastePercentage)}%</div>`;
        
        // Ak máme údaje o cene
        if (calc.glassName) {
            htmlContent += `<div class="mt-1"><strong>${calc.glassName}</strong></div>`;
            htmlContent += `<div>Cena: ${formatNumber(calc.totalPrice)} €</div>`;
        }
        
        htmlContent += `</div>`;
    });
    
    historyContainer.innerHTML = htmlContent;
}

function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Vloženie na začiatok stránky
    const container = document.querySelector('.container');
    container.insertBefore(alertDiv, container.firstChild);
    
    // Automatické skrytie po 5 sekundách
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => alertDiv.remove(), 300);
    }, 5000);
} 