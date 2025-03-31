// Konštanty pre API
const apiBaseUrl = '';

// Globálne premenné pre uloženie výsledkov optimalizácie
let optimizationResult = null;

// Pomocné funkcie
function formatNumber(number, decimals = 2) {
    // Kontrola, či vstup je číslo
    if (isNaN(parseFloat(number))) {
        return "0.00";
    }
    
    // Prevod na číslo a formátovanie
    const parsedNumber = parseFloat(number);
    
    // Obmedzenie na maximálne 4 desatinné miesta pre zobrazenie
    const maxDecimals = Math.min(decimals, 4);
    
    return parsedNumber.toFixed(maxDecimals);
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
    
    // Formulár optimalizácie
    document.getElementById('optimizeForm').addEventListener('submit', handleOptimizeSubmit);
    
    // Formulár výpočtu ceny
    document.getElementById('priceForm').addEventListener('submit', handlePriceCalculation);
    
    // Prepínač vlastnej veľkosti
    document.getElementById('stockSize').addEventListener('change', handleStockSizeChange);
    
    // Výber kategórie skla
    document.getElementById('glassCategory').addEventListener('change', handleGlassCategoryChange);
    
    // Modálne okná
    document.getElementById('showHistoryBtn').addEventListener('click', showHistory);
    document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);
    document.getElementById('helpBtn').addEventListener('click', showHelp);
    
    // Automatické zatváranie navbaru po kliknutí na odkaz na mobilných zariadeniach
    const navLinks = document.querySelectorAll('.navbar-nav .nav-link');
    const navbarCollapse = document.querySelector('.navbar-collapse');
    const bootstrapNavbar = new bootstrap.Collapse(navbarCollapse, {toggle: false});
    
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth < 992 && navbarCollapse.classList.contains('show')) {
                bootstrapNavbar.toggle();
            }
        });
    });
    
    // Načítanie kategórií skla
    loadGlassCategories();
});

// Event handlery
async function handleOptimizeSubmit(event) {
    event.preventDefault();
    console.log('Začínam výpočet optimalizácie...');
    
    const dimensionsText = document.getElementById('dimensions').value.trim();
    
    if (!dimensionsText) {
        showAlert('danger', 'Zadajte aspoň jeden rozmer skla!');
        return;
    }
    
    // Zozbieranie údajov o tabuli
    let stockWidth, stockHeight;
    const stockSizeSelect = document.getElementById('stockSize');
    const stockSize = stockSizeSelect.value;
    
    console.log('Vybraná veľkosť tabule:', stockSize);
    
    if (stockSize === 'custom') {
        stockWidth = parseFloat(document.getElementById('customWidth').value);
        stockHeight = parseFloat(document.getElementById('customHeight').value);
        
        console.log('Vlastné rozmery tabule:', stockWidth, 'x', stockHeight);
        
        if (isNaN(stockWidth) || isNaN(stockHeight) || stockWidth <= 0 || stockHeight <= 0) {
            showAlert('danger', 'Zadajte platné rozmery tabule!');
            return;
        }
    } else {
        const dimensions = stockSize.split('x');
        stockWidth = parseFloat(dimensions[0]);
        stockHeight = parseFloat(dimensions[1]);
    }
    
    // Zobrazenie načítania
    document.getElementById('resultSection').classList.add('d-none');
    showAlert('info', 'Prebieha výpočet optimálneho rozloženia...', true);
    
    // Príprava údajov pre požiadavku
    const requestData = {
        stock_width: stockWidth,
        stock_height: stockHeight,
        dimensions: dimensionsText
    };
    
    console.log('Odosielam požiadavku na optimalizáciu:', requestData);
    
    try {
        // Odoslanie požiadavky na API
        const response = await fetch(`${apiBaseUrl}/optimize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        console.log('Server odpovedal so statusom:', response.status);
        
        const data = await response.json();
        console.log('Získané dáta z API:', data);
        
        if (!response.ok) {
            throw new Error(data.error || 'Nepodarilo sa získať odpoveď zo servera');
        }
        
        // Odstránenie načítavacieho indikátora
        removeAlert();
        
        if (data.error) {
            showAlert('danger', data.error);
            return;
        }
        
        // Kontrola dát
        if (!data.sheets || !Array.isArray(data.sheets) || data.sheets.length === 0) {
            showAlert('danger', 'Server vrátil neplatné dáta pre optimalizáciu');
            console.error('Neplatné dáta:', data);
            return;
        }
        
        // Uloženie výsledkov
        optimizationResult = data;
        
        // Zobrazenie výsledkov
        displayOptimizationResults(data);
        
        // Scrollovanie k výsledkom
        document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error('Chyba pri výpočte:', error);
        showAlert('danger', 'Nastala chyba pri výpočte: ' + error.message);
        removeAlert();
    }
}

async function handlePriceCalculation(event) {
    event.preventDefault();
    
    const glassTypeSelect = document.getElementById('glassType');
    const glassId = glassTypeSelect.value;
    
    if (!glassId) {
        showAlert('danger', 'Vyberte typ skla!');
        return;
    }
    
    if (!optimizationResult) {
        showAlert('danger', 'Najprv vykonajte výpočet optimalizácie!');
        return;
    }
    
    // Zabezpečíme, že máme správne hodnoty celkovej plochy a odpadu
    let totalArea = optimizationResult.total_area;
    let wastePercentage = optimizationResult.average_waste;
    
    // Kontrola a výpočet hodnôt, ak chýbajú
    if ((!totalArea || isNaN(totalArea) || totalArea <= 0) && optimizationResult.sheets && optimizationResult.sheets.length > 0) {
        totalArea = optimizationResult.sheets.reduce((sum, sheet) => sum + parseFloat(sheet.area || 0), 0);
        console.log('Vypočítaná celková plocha:', totalArea);
    }
    
    if ((!wastePercentage || isNaN(wastePercentage)) && optimizationResult.sheets && optimizationResult.sheets.length > 0) {
        const totalWaste = optimizationResult.sheets.reduce((sum, sheet) => sum + parseFloat(sheet.waste || 0), 0);
        wastePercentage = totalWaste / optimizationResult.sheets.length;
        console.log('Vypočítaný priemerný odpad:', wastePercentage);
    }
    
    // Nastavenie hodnôt do optimizationResult pre ďalšie použitie
    optimizationResult.total_area = totalArea;
    optimizationResult.average_waste = wastePercentage;
    
    console.log('Údaje pre výpočet ceny:', {
        glass_id: glassId,
        total_area: totalArea,
        waste_percentage: wastePercentage
    });
    
    try {
        const response = await fetch(`${apiBaseUrl}/calculate_price`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                glass_id: glassId,
                total_area: totalArea,
                waste_percentage: wastePercentage
            })
        });
        
        if (!response.ok) {
            throw new Error('Nepodarilo sa získať odpoveď zo servera');
        }
        
        const data = await response.json();
        
        if (data.error) {
            showAlert('danger', data.error);
            return;
        }
        
        // Zobrazenie výsledkov
        displayPriceCalculation(data);
        
    } catch (error) {
        console.error('Chyba:', error);
        showAlert('danger', 'Nastala chyba pri výpočte ceny: ' + error.message);
    }
}

function handleStockSizeChange() {
    const customSizeFields = document.querySelectorAll('.custom-size');
    if (this.value === 'custom') {
        customSizeFields.forEach(field => field.classList.remove('d-none'));
    } else {
        customSizeFields.forEach(field => field.classList.add('d-none'));
    }
}

async function handleGlassCategoryChange() {
    const categoryId = this.value;
    const glassTypeSelect = document.getElementById('glassType');
    const calculatePriceBtn = document.getElementById('calculatePriceBtn');
    
    if (!categoryId) {
        glassTypeSelect.innerHTML = '<option value="">-- Najprv vyberte kategóriu --</option>';
        glassTypeSelect.disabled = true;
        calculatePriceBtn.disabled = true;
        return;
    }
    
    try {
        const response = await fetch(`${apiBaseUrl}/glass_types/${categoryId}`);
        
        if (!response.ok) {
            throw new Error('Nepodarilo sa získať typy skla');
        }
        
        const data = await response.json();
        
        glassTypeSelect.innerHTML = '<option value="">-- Vyberte typ skla --</option>';
        
        data.forEach(glass => {
            const option = document.createElement('option');
            option.value = glass.id;
            option.textContent = `${glass.name} (${glass.price_per_m2}€/m²)`;
            glassTypeSelect.appendChild(option);
        });
        
        glassTypeSelect.disabled = false;
        calculatePriceBtn.disabled = false;
        
    } catch (error) {
        console.error('Chyba:', error);
        showAlert('danger', 'Nastala chyba pri načítaní typov skla: ' + error.message);
    }
}

// API funkcie
async function loadGlassCategories() {
    try {
        const response = await fetch(`${apiBaseUrl}/glass_categories`);
        
        if (!response.ok) {
            throw new Error('Nepodarilo sa získať kategórie skla');
        }
        
        const data = await response.json();
        const categorySelect = document.getElementById('glassCategory');
        
        data.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            categorySelect.appendChild(option);
        });
        
    } catch (error) {
        console.error('Chyba:', error);
        showAlert('danger', 'Nastala chyba pri načítaní kategórií skla: ' + error.message);
    }
}

async function showHistory() {
    const historyModal = new bootstrap.Modal(document.getElementById('historyModal'));
    historyModal.show();
    
    const historyContent = document.getElementById('historyContent');
    historyContent.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Načítavam...</span>
            </div>
        </div>
    `;
    
    try {
        const response = await fetch(`${apiBaseUrl}/history`);
        
        if (!response.ok) {
            throw new Error('Nepodarilo sa získať históriu');
        }
        
        const data = await response.json();
        
        if (data.length === 0) {
            historyContent.innerHTML = `
                <div class="history-empty">
                    <i class="fas fa-info-circle me-2"></i>Zatiaľ nemáte žiadne kalkulácie
                </div>
            `;
            return;
        }
        
        let html = `
            <table class="table table-striped history-table">
                <thead>
                    <tr>
                        <th>Dátum</th>
                        <th>Typ skla</th>
                        <th>Plocha (m²)</th>
                        <th>Odpad (%)</th>
                        <th>Cena (€)</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        data.forEach(item => {
            const date = new Date(item.created_at);
            const formattedDate = `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()} ${date.getHours()}:${date.getMinutes()}`;
            
            html += `
                <tr>
                    <td>${formattedDate}</td>
                    <td>${item.glass_name}</td>
                    <td>${formatNumber(item.area)}</td>
                    <td>${formatNumber(item.waste_area / item.area * 100)}%</td>
                    <td>${formatNumber(item.total_price)}</td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
            </table>
        `;
        
        historyContent.innerHTML = html;
        
    } catch (error) {
        console.error('Chyba:', error);
        historyContent.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>Nastala chyba pri načítaní histórie: ${error.message}
            </div>
        `;
    }
}

async function clearHistory() {
    if (!confirm('Naozaj chcete vymazať celú históriu kalkulácií?')) {
        return;
    }
    
    try {
        const response = await fetch(`${apiBaseUrl}/clear_history`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error('Nepodarilo sa vymazať históriu');
        }
        
        showAlert('success', 'História kalkulácií bola úspešne vymazaná.');
        
        // Aktualizácia zobrazenia histórie
        showHistory();
        
    } catch (error) {
        console.error('Chyba:', error);
        showAlert('danger', 'Nastala chyba pri mazaní histórie: ' + error.message);
    }
}

function showHelp() {
    const helpModal = new bootstrap.Modal(document.getElementById('helpModal'));
    helpModal.show();
}

// Funkcie pre zobrazenie výsledkov
function displayOptimizationResults(data) {
    const resultSection = document.getElementById('resultSection');
    resultSection.classList.remove('d-none');
    
    console.log('Prijaté dáta z optimalizácie:', data);
    
    // Kontrola či údaje existujú, inak ich vypočítame z dostupných dát
    let totalSheets = data.total_sheets || (data.sheets ? data.sheets.length : 0);
    let totalArea = parseFloat(data.total_area) || 0;
    let averageWaste = parseFloat(data.average_waste) || 0;
    
    // Ak total_area chýba, vypočítame ho z dát
    if (!totalArea && data.sheets && data.sheets.length > 0) {
        totalArea = data.sheets.reduce((sum, sheet) => {
            return sum + (parseFloat(sheet.area) || 0);
        }, 0);
    }
    
    // Ak average_waste chýba, vypočítame ho z dát
    if (!averageWaste && data.sheets && data.sheets.length > 0) {
        const totalWaste = data.sheets.reduce((sum, sheet) => {
            return sum + (parseFloat(sheet.waste) || 0);
        }, 0);
        averageWaste = totalWaste / data.sheets.length;
    }
    
    console.log('Spracované súhrnné údaje:', {
        totalSheets: totalSheets,
        totalArea: totalArea,
        averageWaste: averageWaste
    });
    
    // Zobrazenie súhrnných informácií
    document.getElementById('totalSheets').textContent = totalSheets;
    document.getElementById('totalArea').textContent = formatNumber(totalArea);
    document.getElementById('averageWaste').textContent = `${formatNumber(averageWaste)}%`;
    
    // Zapamätanie hodnôt pre výpočet ceny
    optimizationResult = {
        ...data,
        total_area: totalArea,
        average_waste: averageWaste
    };
    
    // Zobrazenie detailných informácií o tabuliach
    const sheetResults = document.getElementById('sheetResults');
    sheetResults.innerHTML = '';
    
    if (data.sheets && data.sheets.length > 0) {
        data.sheets.forEach((sheet, index) => {
            console.log(`Tabuľa #${index + 1}:`, sheet);
            
            const layoutContainer = document.createElement('div');
            layoutContainer.className = 'sheet-layout';
            
            const sheetArea = parseFloat(sheet.area) || 0;
            const sheetWaste = parseFloat(sheet.waste) || 0;
            
            layoutContainer.innerHTML = `
                <h5>Tabuľa #${index + 1}</h5>
                <div class="row">
                    <div class="col-md-6">
                        <p><strong>Plocha skiel:</strong> ${formatNumber(sheetArea)} m²</p>
                        <p><strong>Využitie:</strong> ${formatNumber(100 - sheetWaste)}%</p>
                        <p class="waste-info"><strong>Odpad:</strong> ${formatNumber(sheetWaste)}%</p>
                    </div>
                    <div class="col-md-6 text-center">
                        <img src="data:image/png;base64,${sheet.layout_image}" class="layout-image" alt="Rozloženie tabuľe ${index + 1}">
                    </div>
                </div>
            `;
            
            sheetResults.appendChild(layoutContainer);
        });
    } else {
        sheetResults.innerHTML = '<div class="alert alert-info">Žiadne výsledky optimalizácie</div>';
    }
    
    // Povolenie tlačidla pre výpočet ceny
    document.getElementById('calculatePriceBtn').disabled = false;
    
    // Skryť výsledok ceny ak sa znova prepočítava
    document.getElementById('priceResult').classList.add('d-none');
}

function displayPriceCalculation(data) {
    const priceResult = document.getElementById('priceResult');
    priceResult.classList.remove('d-none');
    
    // Kontrola údajov a príprava na zobrazenie
    const glassName = data.glass_name || "Neuvedený";
    const area = parseFloat(data.area) || 0;
    const areaPrice = parseFloat(data.area_price) || 0;
    const wasteArea = parseFloat(data.waste_area) || 0;
    const wastePrice = parseFloat(data.waste_price) || 0;
    
    // Výpočet celkovej ceny
    const totalPrice = areaPrice + wastePrice;
    
    console.log('Zobrazenie cenovej kalkulácie:', {
        glass_name: glassName,
        area: area,
        area_price: areaPrice,
        waste_area: wasteArea,
        waste_price: wastePrice,
        total_price: totalPrice
    });
    
    // Nastavenie hodnôt do HTML
    document.getElementById('resultGlassName').textContent = glassName;
    document.getElementById('resultArea').textContent = formatNumber(area);
    document.getElementById('resultAreaPrice').textContent = formatNumber(areaPrice);
    document.getElementById('resultWasteArea').textContent = formatNumber(wasteArea);
    document.getElementById('resultWastePrice').textContent = formatNumber(wastePrice);
    document.getElementById('resultTotalPrice').textContent = formatNumber(totalPrice);
    
    // Scrollovanie na výsledok ceny
    priceResult.scrollIntoView({ behavior: 'smooth' });
}

// Pomocné funkcie pre UI
function showAlert(type, message, persistent = false) {
    // Odstránenie existujúcich upozornení
    if (!persistent) {
        removeAlert();
    }
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show mt-3`;
    alertDiv.id = 'alertMessage';
    alertDiv.role = 'alert';
    
    const iconClass = type === 'danger' ? 'fa-exclamation-triangle' :
                      type === 'success' ? 'fa-check-circle' :
                      type === 'info' ? 'fa-info-circle' : 'fa-bell';
    
    alertDiv.innerHTML = `
        <i class="fas ${iconClass} me-2"></i>${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    document.querySelector('.container').insertAdjacentElement('afterbegin', alertDiv);
    
    if (!persistent) {
        setTimeout(removeAlert, 5000);
    }
}

function removeAlert() {
    const alert = document.getElementById('alertMessage');
    if (alert) {
        alert.remove();
    }
} 