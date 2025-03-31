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
    document.getElementById('stockSize').value = 'standard'; 
    
    // Skrytie výsledkových sekcií
    document.getElementById('resultContainer').classList.add('d-none');
    document.getElementById('priceResult').classList.add('d-none');
    document.getElementById('priceCalculatorSection').classList.add('d-none'); // Skryť aj sekciu ceny
    
    // Vyčistenie vizualizácie a zobrazenie placeholderu
    const optimizationResultDiv = document.getElementById('optimizationResult');
    optimizationResultDiv.innerHTML = `
        <div class="placeholder-content text-center p-5 text-muted">
            <i class="fas fa-border-all fa-3x mb-3"></i>
            <p>Výsledky optimalizácie sa zobrazia tu.</p>
        </div>
    `;
    
    // Reset globálnych premenných
    currentOptimizationData = null;
    currentPriceData = null;
    
    // Reset tlačidiel
    const pdfBtn = document.getElementById('pdfButton');
    if(pdfBtn) pdfBtn.disabled = true;
    
    loadGlassCategories();
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showAlert('Formuláre boli vyčistené.', 'info');
}

// Nastavenie event listenerov po načítaní DOM
document.addEventListener('DOMContentLoaded', function() {
    // Získanie referencií na elementy formulára
    const glassSheetSelect = document.getElementById('glassSheet');
    const optimizeForm = document.getElementById('optimizeForm');
    const priceForm = document.getElementById('priceForm');
    const resetBtn = document.getElementById('resetBtn');
    const pdfButton = document.getElementById('pdfButton');
    const stockSizeSelect = document.getElementById('stockSize');
    const glassCategorySelect = document.getElementById('glassCategory');
    const backToTopButton = document.getElementById("btn-back-to-top");
    const clearHistoryBtnModal = document.getElementById('clearHistoryBtnModal');

    // Pridanie handlerov pre udalosti
    if(optimizeForm) optimizeForm.addEventListener('submit', handleOptimizeSubmit);
    if(priceForm) priceForm.addEventListener('submit', handlePriceCalculation);
    if(resetBtn) resetBtn.addEventListener('click', startNewCalculation);
    if(pdfButton) pdfButton.addEventListener('click', handleDownloadPdf);
    if(stockSizeSelect) stockSizeSelect.addEventListener('change', handleStockSizeChange);
    if(glassCategorySelect) glassCategorySelect.addEventListener('change', handleCategoryChange);
    if(clearHistoryBtnModal) clearHistoryBtnModal.addEventListener('click', clearHistory);
    if(backToTopButton) {
        window.onscroll = function() {
            if (document.body.scrollTop > 200 || document.documentElement.scrollTop > 200) {
                backToTopButton.classList.add('show');
            } else {
                backToTopButton.classList.remove('show');
            }
        };
        backToTopButton.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    }

    // Inicializácia
    startNewCalculation(); // Spustí sa ako prvé, resetne UI
    loadHistoryFromLocalStorage();
});

function clearHistory() {
     if (confirm('Skutočne chcete vymazať históriu kalkulácií?')) {
        const historyModalContainer = document.querySelector('#historyModal .history-list-modal');
        if(historyModalContainer) {
            historyModalContainer.innerHTML = 
                '<div class="text-center text-muted py-5" id="emptyHistory">Zatiaľ žiadna história</div>';
        }
        localStorage.removeItem('glassCalculatorHistory');
        showAlert('História bola vymazaná.', 'success');
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
    const priceCalculatorSection = document.getElementById('priceCalculatorSection');
    const pdfButton = document.getElementById('pdfButton');
    
    // Zobrazenie loading state vo vizualizácii
    optimizationResultDiv.innerHTML = `
        <div class="placeholder-content text-center p-5">
            <div class="spinner-border text-primary mb-3" role="status"></div>
            <p class="text-muted">Optimalizujem...</p>
        </div>
    `;
    resultContainer.classList.remove('d-none');
    priceCalculatorSection.classList.add('d-none'); // Skryť cenu počas novej optimalizácie
    document.getElementById('priceResult').classList.add('d-none'); 
    if(pdfButton) pdfButton.disabled = true; // Deaktivovať PDF tlačidlo
    
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
            priceCalculatorSection.classList.add('d-none');
            return;
        }
        currentOptimizationData = data;
        currentPriceData = null; // Reset ceny
        displayOptimizationResults(data);
        resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        addToHistory('Optimalizácia', `Tabuľa: ${stockWidth}x${stockHeight}, Kusov: ${data.sheets[0].layout.length}`);
        showAlert('Optimalizácia dokončená.', 'success');
        
        // Zobraziť sekciu pre výpočet ceny
        priceCalculatorSection.classList.remove('d-none');
        
        // Aktivovať PDF tlačidlo
        if (pdfButton) pdfButton.disabled = false;
    })
    .catch(error => {
        console.error('Chyba:', error);
        showAlert(`Nastala chyba pri optimalizácii: ${error.message}`, 'danger');
        resultContainer.classList.add('d-none');
        priceCalculatorSection.classList.add('d-none');
    });
}

function displayOptimizationResults(data) {
    const optimizationResultDiv = document.getElementById('optimizationResult');
    const sheet = data.sheets[0]; 
    
    // Aktualizácia súhrnu
    document.getElementById('totalArea').textContent = formatNumber(sheet.total_area);
    document.getElementById('wastePercentage').textContent = formatNumber(sheet.waste_percentage);
    
    optimizationResultDiv.innerHTML = ''; // Vyčistenie predchádzajúceho obsahu/placeholderu
    
    if (!sheet.layout || sheet.layout.length === 0) {
        optimizationResultDiv.innerHTML = `
            <div class="placeholder-content text-center p-5 text-muted">
                 <i class="fas fa-exclamation-triangle fa-3x mb-3 text-warning"></i>
                 <p>Neboli nájdené žiadne platné kusy na zobrazenie.</p>
            </div>
        `;
        return;
    }

    // --- Vytvorenie SVG --- 
    const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgElement.setAttribute('width', '100%');
    svgElement.setAttribute('height', '100%');
    
    // ViewBox na zobrazenie celej tabule
    const vbX = 0;
    const vbY = 0;
    const vbWidth = sheet.stock_width;
    const vbHeight = sheet.stock_height;
    svgElement.setAttribute('viewBox', `${vbX} ${vbY} ${vbWidth} ${vbHeight}`);
    svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svgElement.classList.add('layout-visualization');
    
    // Pridanie jemného pozadia (voliteľné)
    const backgroundRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    backgroundRect.setAttribute('x', vbX);
    backgroundRect.setAttribute('y', vbY);
    backgroundRect.setAttribute('width', vbWidth);
    backgroundRect.setAttribute('height', vbHeight);
    backgroundRect.setAttribute('fill', 'var(--sheet-layout-bg)'); // Použije farbu z CSS pre konzistenciu
    svgElement.appendChild(backgroundRect);

    // Farby a kreslenie panelov (rovnaké ako predtým)
    const colors = ['#58a6ff', '#3fb950', '#f85149', '#e7b416', '#56d3f1', '#7d8590']; // Aktualizované farby
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
        rectPanel.setAttribute('stroke', 'rgba(0,0,0,0.2)'); // Tmavší okraj pre lepší kontrast
        rectPanel.setAttribute('stroke-width', 0.4);
        svgElement.appendChild(rectPanel);
        
        // Text (rovnaký ako predtým)
        const minDim = Math.min(width, height);
        let fontSize = minDim * 0.40; // Mierne menšie pre hustejšie layouty
        fontSize = Math.max(fontSize, 6); 
        fontSize = Math.min(fontSize, 18); 
        
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('x', x + width/2);
        textElement.setAttribute('y', y + height/2);
        textElement.setAttribute('dominant-baseline', 'middle');
        textElement.setAttribute('text-anchor', 'middle');
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('fill', 'white');
        textElement.setAttribute('stroke', 'black');
        textElement.setAttribute('stroke-width', 0.25);
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
    
    if (!currentOptimizationData) {
        showAlert('Najprv spustite úspešnú optimalizáciu.', 'warning');
        return;
    }
    
    const glassTypeSelect = document.getElementById('glassType');
    const selectedOption = glassTypeSelect.options[glassTypeSelect.selectedIndex];
    if (!selectedOption || selectedOption.disabled || !selectedOption.value) {
        showAlert('Prosím, vyberte platný typ skla.', 'warning');
        return;
    }
    const glassType = selectedOption.dataset.name; // Získame názov z data atribútu
    const totalArea = currentOptimizationData.sheets[0].total_area;
    const wastePercentage = currentOptimizationData.sheets[0].waste_percentage;
    
    const priceResultDiv = document.getElementById('priceResult');
    priceResultDiv.classList.remove('d-none');
    // Zobrazenie loading state
    priceResultDiv.innerHTML = `
        <div class="card">
            <div class="card-header bg-success text-white">
                 <h5 class="mb-0"><i class="fas fa-calculator me-2"></i>Výpočet ceny</h5>
            </div>
            <div class="card-body text-center">
                <div class="spinner-border text-success spinner-border-sm" role="status"></div>
                <span class="ms-2 text-muted">Počítam...</span>
            </div>
        </div>
    `;

    // Fetch API call zostáva rovnaký
    fetch(`${apiBaseUrl}/api/calculate-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ glassType: glassType, area: totalArea, wastePercentage: wastePercentage })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.price) {
            // --- OPRAVA: Správne vloženie dát do dynamického HTML --- 
            const area = data.price.area || 0;
            const areaPrice = data.price.area_price || 0;
            const wasteArea = data.price.waste_area || 0;
            const wastePrice = data.price.waste_price || 0;
            const totalPrice = areaPrice + wastePrice;
            const glassName = data.price.glass_name || 'Neznáme sklo';

            priceResultDiv.innerHTML = `
                <div class="card fade-in">
                    <div class="card-header bg-success text-white">
                         <h5 class="mb-0"><i class="fas fa-tag me-2"></i>Výsledok výpočtu ceny</h5>
                    </div>
                    <div class="card-body">
                        <h6 class="mb-3 text-primary">${glassName}</h6>
                        <div class="price-item">
                            <div><i class="fas fa-check text-muted me-1"></i> Plocha skiel (${formatNumber(area)} m²):</div>
                            <div>${formatNumber(areaPrice)} €</div>
                        </div>
                        <div class="price-item">
                            <div><i class="fas fa-recycle text-muted me-1"></i> Odpad (${formatNumber(wasteArea)} m²):</div>
                            <div>${formatNumber(wastePrice)} €</div>
                        </div>
                        <div class="price-item total-price mt-3">
                            <div><i class="fas fa-wallet me-1"></i> Celková cena:</div>
                            <div>${formatNumber(totalPrice)} €</div>
                        </div>
                    </div>
                </div>
            `;
            // --------------------------------------------------------
            currentPriceData = data.price; // Uloženie pre PDF
            addToHistory('Výpočet ceny', `Typ: ${glassType}, Cena: ${formatNumber(totalPrice)} €`);
            showAlert('Cena vypočítaná.', 'success');
            priceResultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            showAlert(data.error || 'Nepodarilo sa vypočítať cenu.', 'warning');
            priceResultDiv.classList.add('d-none');
            priceResultDiv.innerHTML = '';
        }
    })
    .catch(error => {
        console.error('Chyba pri výpočte ceny:', error);
        showAlert(`Nastala chyba pri výpočte ceny: ${error.message}`, 'danger');
        priceResultDiv.classList.add('d-none');
        priceResultDiv.innerHTML = '';
    });
}

function handleDownloadPdf() {
    if (!currentOptimizationData) {
        showAlert('Pre stiahnutie PDF musíte najprv spustiť optimalizáciu', 'warning');
        return;
    }
    // ... (zvyšok funkcie zostáva rovnaký: príprava dát, fetch, spracovanie blob, ...) ...
    const pdfBtn = document.getElementById('pdfButton');
    pdfBtn.disabled = true;
    pdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generujem PDF...';
    
    const sheet_data = currentOptimizationData.sheets[0];
    const data = {
        stock_width: sheet_data.stock_width,
        stock_height: sheet_data.stock_height,
        layout: sheet_data.layout,
        waste_percentage: sheet_data.waste_percentage,
        total_area: sheet_data.total_area,
        // Môžeme pridať aj cenové dáta, ak sú dostupné
        price_data: currentPriceData 
    };

    fetch('/generate_pdf', { // Endpoint bol už upravený v predchádzajúcich krokoch
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
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
        // Získanie názvu súboru z hlavičky
        const contentDisposition = response.headers.get('content-disposition');
        let filename = `rezaci_program_report_${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`; // Default názov
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?(.+?)"?(?|$)/);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1];
            }
        }
        return response.blob().then(blob => ({ blob, filename }));
    })
    .then(({ blob, filename }) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename; 
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        pdfBtn.disabled = false;
        pdfBtn.innerHTML = '<i class="fas fa-file-pdf"></i> PDF';
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert(`Nastala chyba pri sťahovaní PDF: ${error.message}`, 'danger');
        pdfBtn.disabled = false;
        pdfBtn.innerHTML = '<i class="fas fa-file-pdf"></i> PDF';
    });
} 