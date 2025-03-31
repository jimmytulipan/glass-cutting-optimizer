// Konštanty pre API
const apiBaseUrl = '';

// Globálne premenné
let currentOptimizationData = null; // Pre uloženie výsledkov poslednej optimalizácie
let currentPriceData = null; // Globálna premenná pre uloženie cenových údajov

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
    currentOptimizationData = null;
    currentPriceData = null;
    
    // Reset výberu kategórií a typov
    loadGlassCategories(); // Načítame kategórie a resetneme typy
    
    // Scroll na vrch
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    showAlert('Formuláre boli vyčistené. Môžete začať nový výpočet.', 'info');
}

// Nastavenie event listenerov po načítaní DOM
document.addEventListener('DOMContentLoaded', function() {
    // Získanie referencií na elementy formulára
    const glassSheetSelect = document.getElementById('glassSheet');
    const optimizeForm = document.getElementById('optimizeForm');
    const priceForm = document.getElementById('priceForm');
    const resetBtn = document.getElementById('resetBtn');
    const pdfButton = document.getElementById('pdfButton'); // Aktualizované ID tlačidla

    // Pridanie handlerov pre udalosti
    optimizeForm.addEventListener('submit', handleOptimizeSubmit);
    priceForm.addEventListener('submit', handlePriceCalculation);
    resetBtn.addEventListener('click', startNewCalculation);
    pdfButton.addEventListener('click', handleDownloadPdf); // Pre tlačidlo PDF

    // Inicializácia
    startNewCalculation();
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
        currentOptimizationData = data;
        currentPriceData = null;
        displayOptimizationResults(data);
        resultContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        addToHistory('Optimalizácia', `Tabuľa: ${stockWidth}x${stockHeight}, Počet kusov: ${data.sheets[0].layout.length}`);
        showAlert('Optimalizácia dokončená.', 'success');
        // Aktivácia PDF tlačidla
        const pdfButton = document.getElementById('pdfButton');
        if (pdfButton) {
            pdfButton.disabled = false;
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
    
    optimizationResultDiv.innerHTML = '';
    
    if (!sheet.layout || sheet.layout.length === 0) {
        optimizationResultDiv.innerHTML = '<div class="text-center p-3 text-muted">Žiadne kusy na zobrazenie.</div>';
        return;
    }

    // --- Určujeme hranice rozvrhnutých kusov ---
    let minX = sheet.stock_width, minY = sheet.stock_height, maxX = 0, maxY = 0;
    sheet.layout.forEach(panel => {
        minX = Math.min(minX, panel.x);
        minY = Math.min(minY, panel.y);
        maxX = Math.max(maxX, panel.x + panel.width);
        maxY = Math.max(maxY, panel.y + panel.height);
    });

    // Rozmery používanej časti
    const usedWidth = maxX - minX;
    const usedHeight = maxY - minY;
    
    // Vypočítame pomer strán používanej časti
    const usedAspectRatio = usedWidth / usedHeight;
    
    // Získame rozmery kontajnera - namiesto výpočtu stačí jeden rozmer, druhý sa prispôsobí pomeru strán
    const containerWidth = optimizationResultDiv.offsetWidth;
    const containerHeight = optimizationResultDiv.offsetHeight;
    
    // Určenie aktuálneho pomeru strán kontajnera
    const containerAspectRatio = containerWidth / containerHeight;
    
    // Vytvorenie SVG elementu
    const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgElement.setAttribute('width', '100%');
    svgElement.setAttribute('height', '100%');
    
    // Nastavenie viewBox pre plné využitie priestoru
    // Rozhodneme, ako nastaviť viewBox na základe porovnania pomerov strán
    let vbX, vbY, vbWidth, vbHeight;
    
    // Zabezpečíme, aby obsah vyplnil celú šírku a nemal prebytočné okraje
    vbX = Math.max(0, minX);
    vbY = Math.max(0, minY);
    vbWidth = usedWidth;
    vbHeight = usedHeight;
    
    // Pridanie paddingu (zmenšené pre lepšie vyplnenie okienka)
    const paddingPercentage = 0.01; // Zmenšený padding z 5% na 1%
    const paddingX = usedWidth * paddingPercentage;
    const paddingY = usedHeight * paddingPercentage;
    
    vbX -= paddingX;
    vbY -= paddingY;
    vbWidth += 2 * paddingX;
    vbHeight += 2 * paddingY;
    
    // Nastavíme SVG viewBox
    svgElement.setAttribute('viewBox', `${vbX} ${vbY} ${vbWidth} ${vbHeight}`);
    
    // Zabezpečí, že obsah vyplní celý kontajner
    svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svgElement.classList.add('layout-visualization');
    
    // Farby pre jednotlivé panely
    const colors = ['#4a76fd', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6c757d'];
    
    // Vykreslenie jednotlivých panelov
    sheet.layout.forEach((panel, index) => {
        const color = colors[index % colors.length];
        const x = panel.x;
        const y = panel.y;
        const width = panel.width;
        const height = panel.height;
        
        const rectPanel = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rectPanel.setAttribute('x', x);
        rectPanel.setAttribute('y', y);
        rectPanel.setAttribute('width', width);
        rectPanel.setAttribute('height', height);
        rectPanel.setAttribute('fill', color);
        rectPanel.setAttribute('stroke', 'rgba(255,255,255,0.4)');
        rectPanel.setAttribute('stroke-width', 0.3 * Math.sqrt(vbWidth / sheet.stock_width));
        svgElement.appendChild(rectPanel);
        
        // Výpočet veľkosti fontu
        const minDim = Math.min(width, height);
        let fontSize = minDim * 0.45;
        fontSize = Math.max(fontSize, 7);
        fontSize = Math.min(fontSize, 20);
        
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('x', x + width/2);
        textElement.setAttribute('y', y + height/2);
        textElement.setAttribute('dominant-baseline', 'middle');
        textElement.setAttribute('text-anchor', 'middle');
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('fill', 'white');
        textElement.setAttribute('stroke', 'black');
        const strokeWidth = 0.3 * Math.sqrt(vbWidth / sheet.stock_width);
        textElement.setAttribute('stroke-width', Math.max(strokeWidth, 0.1));
        textElement.setAttribute('paint-order', 'stroke');
        textElement.setAttribute('style', 'font-weight: 600;');
        textElement.textContent = `${panel.width}x${panel.height}${panel.rotated ? 'Ⓡ' : ''}`;
        svgElement.appendChild(textElement);
    });
    
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
    
    if (!currentOptimizationData || !currentOptimizationData.sheets || currentOptimizationData.sheets.length === 0) {
        showAlert('Najprv spustite úspešnú optimalizáciu rozloženia.', 'warning');
        return;
    }
    
    const totalArea = currentOptimizationData.sheets[0].total_area;
    const wastePercentage = currentOptimizationData.sheets[0].waste_percentage;
    
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
    if (!currentOptimizationData) {
        showAlert('error', 'Pre stiahnutie PDF musíte najprv spustiť optimalizáciu');
        return;
    }
    
    const pdfBtn = document.getElementById('pdfButton');
    pdfBtn.disabled = true;
    pdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generujem PDF...';
    
    const sheet_data = currentOptimizationData.sheets[0];
    
    // Príprava dát pre PDF
    const data = {
        stock_width: sheet_data.stock_width,
        stock_height: sheet_data.stock_height,
        layout: sheet_data.layout,
        waste_percentage: sheet_data.waste_percentage,
        total_area: sheet_data.total_area,
        timestamp: new Date().getTime() // Pridanie časovej pečiatky pre zabránenie cachovania
    };
    
    // Odoslanie dát na backend a spracovanie odpovede ako binárneho PDF
    fetch('/generate_pdf', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // Pridanie hlavičiek proti cachovaniu
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.error || 'Nastala chyba pri generovaní PDF');
            });
        }
        return response.blob();
    })
    .then(blob => {
        // Vytvorenie dočasného URL pre stiahnutie PDF
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        
        // Generovanie unikátneho názvu súboru s časovou značkou
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `rezaci_program_report_${timestamp}.pdf`;
        
        // Iniciovanie stiahnutia
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Obnovenie tlačidla
        pdfBtn.disabled = false;
        pdfBtn.innerHTML = '<i class="fas fa-file-pdf"></i> PDF';
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('error', error.message || 'Nastala chyba pri generovaní PDF');
        
        // Obnovenie tlačidla
        pdfBtn.disabled = false;
        pdfBtn.innerHTML = '<i class="fas fa-file-pdf"></i> PDF';
    });
} 