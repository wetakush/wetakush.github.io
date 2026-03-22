// ============================================
// wetakush — Bio Page Scripts
// ============================================

document.addEventListener('DOMContentLoaded', () => {

    // ---- Intersection Observer for fade-in animations ----
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe all sections, skill cards, and other animated elements
    document.querySelectorAll('.section, .skill-card, .contact-card, .stat, .about__card, .security__methodology').forEach(el => {
        el.classList.add('fade-in');
        observer.observe(el);
    });

    // ---- Terminal typing effect ----
    const heroOutput = document.getElementById('heroOutput');
    if (heroOutput) {
        heroOutput.style.opacity = '0';
        setTimeout(() => {
            heroOutput.style.transition = 'opacity 0.5s ease';
            heroOutput.style.opacity = '1';
        }, 1500);
    }

    // ---- Smooth scroll for nav links ----
    document.querySelectorAll('.nav__link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.querySelector(link.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // ---- Nav background on scroll ----
    const nav = document.querySelector('.nav');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.scrollY;

        if (currentScroll > 100) {
            nav.style.borderBottomColor = 'rgba(30, 30, 46, 0.8)';
            nav.style.background = 'rgba(10, 10, 15, 0.95)';
        } else {
            nav.style.borderBottomColor = '';
            nav.style.background = '';
        }

        lastScroll = currentScroll;
    }, { passive: true });

    // ---- Active nav link highlight ----
    const sections = document.querySelectorAll('.section');
    const navLinks = document.querySelectorAll('.nav__link');

    const updateActiveLink = () => {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 150;
            if (window.scrollY >= sectionTop) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.style.color = '';
            if (link.getAttribute('href') === `#${current}`) {
                link.style.color = 'var(--accent)';
            }
        });
    };

    window.addEventListener('scroll', updateActiveLink, { passive: true });

    // ---- Parallax for background glows ----
    const glows = document.querySelectorAll('.bg-glow');
    window.addEventListener('mousemove', (e) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;

        glows.forEach((glow, i) => {
            const factor = (i + 1) * 15;
            glow.style.transform = `translate(${x * factor}px, ${y * factor}px)`;
        });
    }, { passive: true });

    // ---- Skill card tilt effect ----
    document.querySelectorAll('.skill-card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;

            card.style.transform = `translateY(-4px) perspective(600px) rotateX(${y * -5}deg) rotateY(${x * 5}deg)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    });

    // ---- Console easter egg ----
    console.log(
        '%c[wetakush] %cSecurity Researcher & Developer',
        'color: #00e5a0; font-weight: bold; font-size: 14px;',
        'color: #6b6b80; font-size: 14px;'
    );
    console.log(
        '%cIf you\'re reading this, we should talk. t.me/noxad',
        'color: #00b8d4; font-size: 12px;'
    );
});
