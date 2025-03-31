// Konštanty pre API
const apiBaseUrl = '';

// Globálne premenné pre uloženie výsledkov optimalizácie
let optimizationResult = null;
let currentPriceData = null;

// Pomocné funkcie
function formatNumber(number, decimals = 2) {
    return parseFloat(number).toFixed(decimals);
}

// Funkcia pre zobrazenie alertov
function showAlert(message, type = 'info', duration = 3000) {
    const alertsContainer = document.querySelector('.alerts-container');
    if (!alertsContainer) {
        console.error('Alerts container not found!');
        return;
    }
    const alertElement = document.createElement('div');
    
    alertElement.className = `alert alert-${type} fade-in`;
    alertElement.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'danger' ? 'exclamation-circle' : 'info-circle'} me-2"></i>
            <div>${message}</div>
        </div>
    `;
    
    alertsContainer.appendChild(alertElement);
    
    // Automatické zatvorenie alertu po 5 sekundách
    setTimeout(() => {
        alertElement.style.opacity = '0';
        alertElement.style.transition = 'opacity 0.5s ease';
        
        setTimeout(() => {
            if (alertsContainer.contains(alertElement)) { // Extra kontrola
                alertsContainer.removeChild(alertElement);
            }
        }, 500);
    }, 5000);
}

// Funkcia pre pridanie do histórie
function addToHistory(title, description) {
    // Najprv skúsime načítať históriu pre modálne okno
    const historyModalContainer = document.querySelector('#historyModal .history-list-modal');
    const emptyHistoryModal = document.querySelector('#historyModal #emptyHistory');

    // Odstránime placeholder, ak existuje
    if (emptyHistoryModal) {
        emptyHistoryModal.remove();
    }
    
    if (historyModalContainer) {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item mb-3 p-2 border-bottom fade-in';
        historyItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <h6 class="mb-1">${title}</h6>
                    <p class="small text-muted mb-0">${description}</p>
                </div>
                <small class="text-muted">${new Date().toLocaleTimeString('sk-SK', { hour: '2-digit', minute:'2-digit' })}</small>
            </div>
        `;
        historyModalContainer.prepend(historyItem);
    } else {
        console.error("History container inside modal not found!");
    }
    
    // Uloženie do localStorage pre persistenciu
    saveHistoryToLocalStorage();
}

// Funkcia pre uloženie histórie do localStorage
function saveHistoryToLocalStorage() {
    const historyModalContainer = document.querySelector('#historyModal .history-list-modal');
    if (!historyModalContainer) return;

    const historyItems = historyModalContainer.querySelectorAll('.history-item');
    
    const history = Array.from(historyItems).map(item => {
        return {
            title: item.querySelector('h6').textContent,
            description: item.querySelector('p').textContent,
            time: item.querySelector('small').textContent
        };
    });
    
    localStorage.setItem('glassCalculatorHistory', JSON.stringify(history.slice(0, 15))); 
}

// Funkcia pre načítanie histórie z localStorage
function loadHistoryFromLocalStorage() {
    const historyJson = localStorage.getItem('glassCalculatorHistory');
    const historyModalContainer = document.querySelector('#historyModal .history-list-modal');
    const emptyHistoryModal = document.querySelector('#historyModal #emptyHistory');
    
    if (!historyModalContainer) return;

    if (historyJson) {
        const history = JSON.parse(historyJson);
        
        if (history.length > 0 && emptyHistoryModal) {
            emptyHistoryModal.remove();
        }
        
        // Vyčistenie pred načítaním
        historyModalContainer.innerHTML = ''; 
        if (history.length === 0) {
             historyModalContainer.innerHTML = '<div class="text-center text-muted py-5" id="emptyHistory">Zatiaľ žiadna história</div>';
        }

        history.forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item mb-3 p-2 border-bottom';
            historyItem.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h6 class="mb-1">${item.title}</h6>
                        <p class="small text-muted mb-0">${item.description}</p>
                    </div>
                    <small class="text-muted">${item.time}</small>
                </div>
            `;
            historyModalContainer.appendChild(historyItem);
        });
    } else if (emptyHistoryModal) {
        // Ak nie je história a placeholder existuje, necháme ho
    } else {
        // Ak nie je história a placeholder neexistuje, pridáme ho
        historyModalContainer.innerHTML = '<div class="text-center text-muted py-5" id="emptyHistory">Zatiaľ žiadna história</div>';
    }
}

// Funkcie pre správu témy
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    console.log('Téma zmenená na:', theme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark'; // Default na tmavú
    setTheme(savedTheme);
    // Tu by mohla byť logika pre prepínač témy, ak by existoval
}

// Funkcia pre správu tlačidla "späť hore"
function handleBackToTopButton() {
    const backToTopButton = document.getElementById("btn-back-to-top");
    if (!backToTopButton) return;

    window.onscroll = function() {
        if (document.body.scrollTop > 200 || document.documentElement.scrollTop > 200) {
            backToTopButton.classList.add('show');
        } else {
            backToTopButton.classList.remove('show');
        }
    };
    
    backToTopButton.addEventListener("click", function() {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    });
}

// Funkcia pre nový výpočet
function startNewCalculation() {
    // Vyčistenie formulárov
    document.getElementById('optimizeForm').reset();
    document.getElementById('priceForm').reset();
    document.getElementById('customSizeFields').classList.add('d-none');
    document.getElementById('stockSize').value = 'standard'; // Reset na štandardnú veľkosť
    
    // Skrytie výsledkov
    document.getElementById('resultContainer').classList.add('d-none');
    document.getElementById('priceResult').classList.add('d-none');
    
    // Reset globálnej premennej
    optimizationResult = null;
    currentPriceData = null;
    
    // Reset výberu kategórií a typov
    loadGlassCategories(); // Načítame kategórie a resetneme typy
    
    // Scroll na vrch
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    showAlert('Formuláre boli vyčistené. Môžete začať nový výpočet.', 'info');
}

// Inicializácia pri načítaní stránky
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM načítaný, inicializujem aplikáciu');
    
    // Načítanie uloženej témy
    loadTheme();
    
    // Inicializácia formulárov a tlačidiel
    initEventListeners();
    
    // Načítanie kategórií skla
    loadGlassCategories();
    
    // Načítanie histórie do modálneho okna
    loadHistoryFromLocalStorage();
    
    // Inicializácia tlačidla "späť hore"
    handleBackToTopButton();
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
    
    // Tlačidlo pre vymazanie histórie v MODÁLNOM okne
    const clearHistoryBtnModal = document.getElementById('clearHistoryBtnModal');
    if(clearHistoryBtnModal) {
        clearHistoryBtnModal.addEventListener('click', function() {
            if (confirm('Skutočne chcete vymazať históriu kalkulácií?')) {
                const historyModalContainer = document.querySelector('#historyModal .history-list-modal');
                if(historyModalContainer) {
                    historyModalContainer.innerHTML = 
                        '<div class="text-center text-muted py-5" id="emptyHistory">Zatiaľ žiadna história</div>';
                }
                localStorage.removeItem('glassCalculatorHistory');
                showAlert('História bola vymazaná.', 'success');
                // Prípadne zatvoriť modálne okno
                // const historyModal = bootstrap.Modal.getInstance(document.getElementById('historyModal'));
                // if (historyModal) historyModal.hide();
            }
        });
    }

    // Tlačidlo Nový výpočet
    const newCalculationBtn = document.getElementById('newCalculationBtn');
    if (newCalculationBtn) {
        newCalculationBtn.addEventListener('click', startNewCalculation);
    }

    // Tlačidlo Stiahnuť PDF
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', handleDownloadPdf);
    }
}

function handleOptimizeSubmit(event) {
    event.preventDefault();
    
    const dimensionsInput = document.getElementById('dimensions').value.trim();
    if (!dimensionsInput) {
        showAlert('Prosím, zadajte rozmery skiel.', 'warning');
        return;
    }
    
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
        stockWidth = 321;
        stockHeight = 225;
    }
    
    const resultContainer = document.getElementById('resultContainer');
    const optimizationResultDiv = document.getElementById('optimizationResult');
    optimizationResultDiv.innerHTML = '<div class="text-center p-3"><div class="spinner-border text-primary" role="status"></div><p class="mt-2 mb-0">Optimalizujem...</p></div>';
    resultContainer.classList.remove('d-none');
    document.getElementById('priceResult').classList.add('d-none'); // Skryjeme výsledok ceny
    
    fetch(`${apiBaseUrl}/api/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dimensions: dimensionsInput, stock_width: stockWidth, stock_height: stockHeight })
    })
    .then(response => {
        if (!response.ok) { throw new Error('Chyba pri komunikácii so serverom'); }
        return response.json();
    })
    .then(data => {
        if (!data.success || !data.sheets || data.sheets.length === 0) {
            showAlert('Nepodarilo sa nájsť optimálne rozloženie.', 'warning');
            resultContainer.classList.add('d-none');
            return;
        }
        optimizationResult = data;
        currentPriceData = null;
        displayOptimizationResults(data);
        resultContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        addToHistory('Optimalizácia', `Tabuľa: ${stockWidth}x${stockHeight}, Počet kusov: ${data.sheets[0].layout.length}`);
        showAlert('Optimalizácia dokončená.', 'success');
        // Aktivácia PDF tlačidla
        const downloadPdfBtn = document.getElementById('downloadPdfBtn');
        if (downloadPdfBtn) {
            downloadPdfBtn.disabled = false;
        }
    })
    .catch(error => {
        console.error('Chyba:', error);
        showAlert(`Nastala chyba pri optimalizácii: ${error.message}`, 'danger');
        resultContainer.classList.add('d-none');
    });
}

function displayOptimizationResults(data) {
    const optimizationResultDiv = document.getElementById('optimizationResult');
    const sheet = data.sheets[0]; 
    
    document.getElementById('totalArea').textContent = formatNumber(sheet.total_area);
    document.getElementById('wastePercentage').textContent = formatNumber(sheet.waste_percentage);
    
    // Odstránenie akéhokoľvek predošlého obsahu a vloženie nového SVG
    optimizationResultDiv.innerHTML = '';
    
    // Výpočet základných rozmerov pre SVG - necháme CSS riadiť výšku
    const containerWidth = optimizationResultDiv.offsetWidth || 600; 
    // const containerHeight = window.innerHeight * 0.6; // Odstránené, necháme CSS
    
    // Vytvorenie SVG elementu
    const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgElement.setAttribute('width', '100%');
    svgElement.setAttribute('height', '100%'); // Výška bude riadená CSS rodiča
    svgElement.setAttribute('viewBox', `0 0 ${sheet.stock_width} ${sheet.stock_height}`);
    svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svgElement.classList.add('layout-visualization');
    
    // Vytvorenie podkladu tabule
    const rectBackground = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rectBackground.setAttribute('x', '0');
    rectBackground.setAttribute('y', '0');
    rectBackground.setAttribute('width', sheet.stock_width);
    rectBackground.setAttribute('height', sheet.stock_height);
    rectBackground.setAttribute('fill', 'var(--sheet-layout-bg)');
    rectBackground.setAttribute('stroke', 'var(--border-color)');
    rectBackground.setAttribute('stroke-width', '0.5');
    svgElement.appendChild(rectBackground);
    
    // Farby pre jednotlivé panely
    const colors = ['#4a76fd', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6c757d'];
    
    // Vykreslenie jednotlivých panelov
    sheet.layout.forEach((panel, index) => {
        const color = colors[index % colors.length];
        const x = panel.x;
        const y = panel.y;
        const width = panel.width;
        const height = panel.height;
        
        // Vytvorenie panelu (obdĺžnika)
        const rectPanel = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rectPanel.setAttribute('x', x);
        rectPanel.setAttribute('y', y);
        rectPanel.setAttribute('width', width);
        rectPanel.setAttribute('height', height);
        rectPanel.setAttribute('fill', color);
        rectPanel.setAttribute('stroke', 'rgba(255,255,255,0.4)');
        rectPanel.setAttribute('stroke-width', '0.3');
        svgElement.appendChild(rectPanel);
        
        // Výpočet optimálnej veľkosti fontu - VÝRAZNÉ ZVÄČŠENIE
        const minDim = Math.min(width, height);
        let fontSize = minDim * 0.45; // Ešte väčší násobok
        // if (width * height < 200) fontSize *= 0.9; // Odstránené zjednodušenie
        fontSize = Math.max(fontSize, 7); // VÝRAZNE väčšia minimálna veľkosť
        fontSize = Math.min(fontSize, 20); // Väčšia maximálna veľkosť
        
        // Pridanie textu s rozmermi a OB RYSOM
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('x', x + width/2);
        textElement.setAttribute('y', y + height/2);
        textElement.setAttribute('dominant-baseline', 'middle');
        textElement.setAttribute('text-anchor', 'middle');
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('fill', 'white'); // Biela výplň
        textElement.setAttribute('stroke', 'black'); // Čierny obrys
        textElement.setAttribute('stroke-width', 0.3); // Hrúbka obrysu
        textElement.setAttribute('paint-order', 'stroke'); // Vykresliť najprv obrys
        textElement.setAttribute('style', 'font-weight: 600;'); // Odstránený filter
        textElement.textContent = `${panel.width}x${panel.height}${panel.rotated ? 'Ⓡ' : ''}`;
        svgElement.appendChild(textElement);
    });
    
    // Pridanie SVG do DOM
    optimizationResultDiv.appendChild(svgElement);
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
            categorySelect.innerHTML = '<option value="" disabled selected>Vyberte kategóriu...</option>';
            
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                categorySelect.appendChild(option);
            });
            document.getElementById('glassType').innerHTML = '<option value="" disabled selected>Najprv vyberte kategóriu...</option>';
        })
        .catch(error => {
            console.error('Chyba pri načítaní kategórií skla:', error);
            showAlert('Nepodarilo sa načítať kategórie skla.', 'danger');
        });
}

function handleCategoryChange() {
    const categoryId = document.getElementById('glassCategory').value;
    const typeSelect = document.getElementById('glassType');
    
    if (!categoryId) {
        typeSelect.innerHTML = '<option value="" disabled selected>Najprv vyberte kategóriu...</option>';
        return;
    }
    
    typeSelect.innerHTML = '<option value="" disabled selected>Načítavam typy...</option>';
    
    fetch(`${apiBaseUrl}/api/get-glass-types?categoryId=${categoryId}`)
        .then(response => response.json())
        .then(types => {
            typeSelect.innerHTML = '';
            if (types.length === 0) {
                 typeSelect.innerHTML = '<option value="" disabled selected>Žiadne typy v tejto kategórii</option>';
                 return;
            }
             typeSelect.innerHTML = '<option value="" disabled selected>Vyberte typ skla...</option>'; // Pridanie placeholderu
            
            types.forEach(type => {
                const option = document.createElement('option');
                option.value = type.id;
                option.textContent = `${type.name} (${type.price_per_m2}€/m²)`;
                option.dataset.name = type.name;
                typeSelect.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Chyba pri načítaní typov skla:', error);
            showAlert('Nepodarilo sa načítať typy skla.', 'danger');
            typeSelect.innerHTML = '<option value="" disabled selected>Chyba pri načítaní</option>';
        });
}

function handlePriceCalculation(event) {
    event.preventDefault();
    
    if (!optimizationResult || !optimizationResult.sheets || optimizationResult.sheets.length === 0) {
        showAlert('Najprv spustite úspešnú optimalizáciu rozloženia.', 'warning');
        return;
    }
    
    const totalArea = optimizationResult.sheets[0].total_area;
    const wastePercentage = optimizationResult.sheets[0].waste_percentage;
    
    const glassTypeSelect = document.getElementById('glassType');
    const selectedOption = glassTypeSelect.options[glassTypeSelect.selectedIndex];
    
    if (!selectedOption || selectedOption.disabled || !selectedOption.dataset.name) { // Kontrola aj na disabled placeholder
        showAlert('Prosím, vyberte platný typ skla.', 'warning');
        return;
    }
    const glassType = selectedOption.dataset.name;
    
    const priceResultDiv = document.getElementById('priceResult');
    priceResultDiv.classList.remove('d-none');
    // Vylepšený loading state
    priceResultDiv.innerHTML = `
        <div class="card mb-4">
            <div class="card-body text-center p-4">
                <div class="spinner-border text-success spinner-border-sm" role="status"></div>
                <span class="ms-2">Počítam cenu...</span>
            </div>
        </div>`;

    fetch(`${apiBaseUrl}/api/calculate-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ glassType: glassType, area: totalArea, wastePercentage: wastePercentage })
    })
    .then(response => {
        if (!response.ok) { throw new Error('Chyba pri komunikácii so serverom pri výpočte ceny'); }
        return response.json();
    })
    .then(data => {
        priceResultDiv.innerHTML = ''; 
        if (data.success && data.price) {
            priceResultDiv.innerHTML = `
                <div class="card mb-4 fade-in">
                    <div class="card-header">
                        <div class="d-flex justify-content-between align-items-center">
                            <h5 class="mb-0"><i class="fas fa-tag me-2"></i>Výsledok výpočtu ceny</h5>
                        </div>
                    </div>
                    <div class="card-body">
                        <h6 id="glassName" class="text-primary mb-3">-</h6>
                        <div class="price-item d-flex justify-content-between mb-2">
                            <div><i class="fas fa-check me-1"></i>Plocha skiel: <span id="area">0</span> m²</div>
                            <div><span id="areaPrice">0</span> €</div>
                        </div>
                        <div class="price-item d-flex justify-content-between mb-2">
                            <div><i class="fas fa-recycle me-1"></i>Odpad: <span id="wasteArea">0</span> m²</div>
                            <div><span id="wastePrice">0</span> €</div>
                        </div>
                        <hr class="my-2">
                        <div class="price-item d-flex justify-content-between total-price">
                            <div><i class="fas fa-wallet me-1"></i>Celková cena:</div>
                            <div><span id="totalPrice">0</span> €</div>
                        </div>
                    </div>
                </div>
            `;
            displayPriceCalculation(data.price);
            addToHistory('Výpočet ceny', `Typ: ${data.price.glass_name}, Cena: ${formatNumber((data.price.area_price || 0) + (data.price.waste_price || 0))}€`);
            showAlert('Cena bola úspešne vypočítaná.', 'success');
            priceResultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Uloženie cenových dát pre PDF
            currentPriceData = data.price;

        } else {
            showAlert('Nepodarilo sa vypočítať cenu. Skontrolujte, či ste vybrali typ skla.', 'warning');
            priceResultDiv.classList.add('d-none');
        }
    })
    .catch(error => {
        console.error('Chyba pri výpočte ceny:', error);
        showAlert(`Nastala chyba pri výpočte ceny: ${error.message}`, 'danger');
        priceResultDiv.classList.add('d-none');
        priceResultDiv.innerHTML = '';
    });
}

function displayPriceCalculation(data) {
    document.getElementById('glassName').textContent = data.glass_name || 'Neznáme sklo';
    document.getElementById('area').textContent = formatNumber(data.area || 0);
    document.getElementById('areaPrice').textContent = formatNumber(data.area_price || 0);
    document.getElementById('wasteArea').textContent = formatNumber(data.waste_area || 0);
    document.getElementById('wastePrice').textContent = formatNumber(data.waste_price || 0);
    
    const totalPrice = (data.area_price || 0) + (data.waste_price || 0);
    document.getElementById('totalPrice').textContent = formatNumber(totalPrice);
}

// Funkcia na stiahnutie PDF
function handleDownloadPdf() {
    if (!optimizationResult || !optimizationResult.sheets || optimizationResult.sheets.length === 0) {
        showAlert('Nie sú dostupné žiadne výsledky optimalizácie na generovanie PDF.', 'warning');
        return;
    }
    
    const sheetData = optimizationResult.sheets[0];
    const stockWidth = optimizationResult.stock_width; // Získanie z výsledku optimalizácie, ak je tam
    const stockHeight = optimizationResult.stock_height; // Alebo použiť hodnoty z formulára
    
    // Pripravenie dát pre API
    const pdfData = {
        sheet_data: {
            layout: sheetData.layout,
            stock_width: stockWidth || 321, // Fallback
            stock_height: stockHeight || 225, // Fallback
            total_area: sheetData.total_area,
            waste_percentage: sheetData.waste_percentage
        },
        price_data: currentPriceData // Použijeme uložené cenové dáta
    };

    const downloadBtn = document.getElementById('downloadPdfBtn');
    const originalBtnText = downloadBtn.innerHTML;
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Generujem...';

    fetch(`${apiBaseUrl}/api/generate-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pdfData)
    })
    .then(response => {
        if (!response.ok) {
            // Pokúsime sa získať chybovú správu z JSON odpovede
            return response.json().then(err => { 
                throw new Error(err.error || `Chyba servera: ${response.status}`); 
            }).catch(() => {
                 // Ak JSON nie je dostupný, vyhodíme všeobecnú chybu
                throw new Error(`Chyba servera pri generovaní PDF: ${response.status}`);
            });
        }
        return response.blob(); // Očakávame blob (binárne dáta)
    })
    .then(blob => {
        // Vytvorenie odkazu a spustenie stiahnutia
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'optimalizacia_rezu.pdf';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        showAlert('PDF súbor bol vygenerovaný.', 'success');
    })
    .catch(error => {
        console.error('Chyba pri generovaní PDF:', error);
        showAlert(`Nastala chyba pri generovaní PDF: ${error.message}`, 'danger');
    })
    .finally(() => {
        // Obnovenie tlačidla
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = originalBtnText;
    });
} 