// Konštanty pre API
const apiBaseUrl = '';

// Globálne premenné pre uloženie výsledkov optimalizácie
let optimizationResult = null;

// Pomocné funkcie
function formatNumber(number, decimals = 2) {
    return parseFloat(number).toFixed(decimals);
}

// Funkcia pre zobrazenie alertov
function showAlert(message, type = 'info') {
    const alertsContainer = document.getElementById('alerts');
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
            alertsContainer.removeChild(alertElement);
        }, 500);
    }, 5000);
}

// Funkcia pre získanie YouTube prepisu
function fetchYoutubeTranscript() {
    const youtubeUrl = document.getElementById('youtubeUrl').value.trim();
    
    if (!youtubeUrl) {
        showAlert('Zadajte URL YouTube videa', 'warning');
        return;
    }
    
    // Overenie, či URL je platné YouTube video
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/(watch\?v=|embed\/|v\/|shorts\/)?([a-zA-Z0-9_-]{11})(\S*)?$/;
    const match = youtubeUrl.match(youtubeRegex);
    
    if (!match) {
        showAlert('Neplatné YouTube URL', 'danger');
        return;
    }
    
    const videoId = match[5];
    
    // Zobraziť načítavanie
    showAlert('Prebieha získavanie prepisu...', 'info');
    
    // Namiesto reálneho volania API (keďže nemáme backendovú podporu)
    // Len zobrazíme ukážkovú správu o tom, čo by sa malo stať
    setTimeout(() => {
        showAlert('Funkcia získania YouTube prepisu nie je momentálne dostupná', 'warning');
    }, 2000);
    
    // Pridanie do histórie
    addToHistory(`YouTube: ${videoId}`, 'Požiadavka na prepis YouTube videa');
}

// Funkcia pre pridanie do histórie
function addToHistory(title, description) {
    const historyContainer = document.getElementById('historyContainer');
    const emptyHistory = document.getElementById('emptyHistory');
    
    if (emptyHistory) {
        emptyHistory.remove();
    }
    
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item mb-3 p-2 border-bottom';
    historyItem.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
            <div>
                <h6 class="mb-1">${title}</h6>
                <p class="small text-muted mb-0">${description}</p>
            </div>
            <small class="text-muted">${new Date().toLocaleTimeString()}</small>
        </div>
    `;
    
    historyContainer.prepend(historyItem);
    
    // Uloženie do localStorage pre persistenciu
    saveHistoryToLocalStorage();
}

// Funkcia pre uloženie histórie do localStorage
function saveHistoryToLocalStorage() {
    const historyContainer = document.getElementById('historyContainer');
    const historyItems = historyContainer.querySelectorAll('.history-item');
    
    const history = Array.from(historyItems).map(item => {
        return {
            title: item.querySelector('h6').textContent,
            description: item.querySelector('p').textContent,
            time: item.querySelector('small').textContent
        };
    });
    
    localStorage.setItem('glassCalculatorHistory', JSON.stringify(history));
}

// Funkcia pre načítanie histórie z localStorage
function loadHistoryFromLocalStorage() {
    const historyJson = localStorage.getItem('glassCalculatorHistory');
    
    if (historyJson) {
        const history = JSON.parse(historyJson);
        const historyContainer = document.getElementById('historyContainer');
        const emptyHistory = document.getElementById('emptyHistory');
        
        if (history.length > 0 && emptyHistory) {
            emptyHistory.remove();
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
            
            historyContainer.appendChild(historyItem);
        });
    }
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
    
    // Načítanie histórie
    loadHistoryFromLocalStorage();
});

function initEventListeners() {
    // Tlačidlo pre získanie YouTube prepisu
    const fetchTranscriptBtn = document.getElementById('fetchTranscriptBtn');
    if (fetchTranscriptBtn) {
        fetchTranscriptBtn.addEventListener('click', fetchYoutubeTranscript);
    }
    
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
            const historyContainer = document.getElementById('historyContainer');
            historyContainer.innerHTML = 
                '<div class="text-center text-muted py-3" id="emptyHistory">Zatiaľ žiadna história</div>';
            
            localStorage.removeItem('glassCalculatorHistory');
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
        
        // Pridanie do histórie
        addToHistory('Optimalizácia skla', `Rozmery tabule: ${stockWidth}x${stockHeight} cm`);
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
            <rect x="0" y="0" width="${321 * scale}" height="${225 * scale}" fill="none" stroke="white" stroke-width="2" />
    `;
    
    // Farby pre panely
    const colors = ['#4a76fd', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6c757d'];
    
    // Pridanie jednotlivých panelov
    sheet.layout.forEach((panel, index) => {
        const color = colors[index % colors.length];
        const x = panel.x * scale;
        const y = panel.y * scale;
        const width = panel.width * scale;
        const height = panel.height * scale;
        
        svgContent += `
            <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${color}" stroke="rgba(255,255,255,0.5)" stroke-width="1" />
            <text x="${x + width/2}" y="${y + height/2}" dominant-baseline="middle" text-anchor="middle" font-size="10" fill="white">
                ${panel.width}x${panel.height}${panel.rotated ? ' (R)' : ''}
            </text>
        `;
    });
    
    svgContent += `</svg>`;
    resultContainer.innerHTML = svgContent;
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
            
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                categorySelect.appendChild(option);
            });
            
            // Po načítaní kategórií načítame typy skla pre prvú kategóriu
            if (categories.length > 0) {
                handleCategoryChange();
            }
        })
        .catch(error => {
            console.error('Chyba pri načítaní kategórií skla:', error);
            showAlert('Nepodarilo sa načítať kategórie skla.', 'danger');
        });
}

function handleCategoryChange() {
    const categoryId = document.getElementById('glassCategory').value;
    
    fetch(`${apiBaseUrl}/api/get-glass-types?categoryId=${categoryId}`)
        .then(response => response.json())
        .then(types => {
            const typeSelect = document.getElementById('glassType');
            typeSelect.innerHTML = '';
            
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
        });
}

function handlePriceCalculation(event) {
    event.preventDefault();
    
    // Kontrola, či máme výsledky optimalizácie
    if (!optimizationResult || !optimizationResult.sheets) {
        showAlert('Najprv spustite optimalizáciu rozloženia.', 'warning');
        return;
    }
    
    // Získanie údajov z výsledkov optimalizácie
    const totalArea = optimizationResult.sheets[0].total_area;
    const wastePercentage = optimizationResult.sheets[0].waste_percentage;
    
    console.log(`Počítam cenu pre plochu ${totalArea} m² s odpadom ${wastePercentage}%`);
    
    // Získanie vybraného typu skla
    const glassTypeSelect = document.getElementById('glassType');
    const glassType = glassTypeSelect.options[glassTypeSelect.selectedIndex].dataset.name;
    
    // Odoslanie požiadavky na výpočet ceny
    fetch(`${apiBaseUrl}/api/calculate-price`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            glassType: glassType,
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
        console.log('Prijaté dáta výpočtu ceny:', data);
        
        // Zobrazenie výsledkov
        if (data.success && data.price) {
            displayPriceCalculation(data.price);
            
            // Pridanie do histórie
            addToHistory('Výpočet ceny', `Typ skla: ${data.price.glass_name}`);
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
    document.getElementById('priceResult').classList.remove('d-none');
    
    // Nastavenie hodnôt
    document.getElementById('glassName').textContent = data.glass_name || 'Neznáme sklo';
    document.getElementById('area').textContent = formatNumber(data.area || 0);
    document.getElementById('areaPrice').textContent = formatNumber(data.area_price || 0);
    document.getElementById('wasteArea').textContent = formatNumber(data.waste_area || 0);
    document.getElementById('wastePrice').textContent = formatNumber(data.waste_price || 0);
    
    // Výpočet celkovej ceny
    const totalPrice = (data.area_price || 0) + (data.waste_price || 0);
    document.getElementById('totalPrice').textContent = formatNumber(totalPrice);
    
    // Posunieme sa na výsledky
    document.getElementById('priceResult').scrollIntoView({ behavior: 'smooth' });
} 