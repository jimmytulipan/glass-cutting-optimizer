document.addEventListener('DOMContentLoaded', function() {
    
    // Zmena pozadia hlavičky pri skrolovaní
    const header = document.querySelector('.main-header');
    const scrollWatcher = () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    };
    
    window.addEventListener('scroll', scrollWatcher);
    
    // Plynulé skrolovanie pri kliknutí na navigačné odkazy
    const navLinks = document.querySelectorAll('a[href^="#"]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            
            // Ignoruj prázdne odkazy a odkazy, ktoré nemajú # na začiatku
            if (targetId === '#' || targetId === '') return;
            
            e.preventDefault();
            
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                // Vypočítaj pozíciu s odsadením pre header
                const headerOffset = 80;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                
                // Plynulé skrolovanie
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
                
                // Zatvor mobilné menu ak je otvorené
                if (mobileMenu.classList.contains('active')) {
                    mobileMenu.classList.remove('active');
                }
            }
        });
    });
    
    // Mobilné menu
    const burgerMenu = document.querySelector('.burger-menu');
    const mobileMenu = document.querySelector('.mobile-menu');
    
    if (burgerMenu && mobileMenu) {
        burgerMenu.addEventListener('click', function() {
            if (mobileMenu.style.display === 'block') {
                mobileMenu.style.display = 'none';
                burgerMenu.innerHTML = '☰';
            } else {
                mobileMenu.style.display = 'block';
                burgerMenu.innerHTML = '✕';
            }
        });
    }
    
    // Interaktívne animácie pri scrollovaní
    const animateOnScroll = function() {
        const elements = document.querySelectorAll('.benefit-item, .feature-item, .price-card, .testimonial');
        
        elements.forEach(element => {
            const elementPosition = element.getBoundingClientRect().top;
            const screenPosition = window.innerHeight / 1.2;
            
            if (elementPosition < screenPosition) {
                element.classList.add('animated');
            }
        });
    };
    
    window.addEventListener('scroll', animateOnScroll);
    
    // Inicializácia pri načítaní stránky
    scrollWatcher();
    animateOnScroll();
    
    // Nastavenie výšky pre video container
    const videoContainer = document.querySelector('.video-container');
    if (videoContainer) {
        const ratio = 16 / 9;
        const width = videoContainer.clientWidth;
        videoContainer.style.height = `${width / ratio}px`;
        
        // Aktualizovať výšku pri zmene veľkosti okna
        window.addEventListener('resize', function() {
            const width = videoContainer.clientWidth;
            videoContainer.style.height = `${width / ratio}px`;
        });
    }
}); 