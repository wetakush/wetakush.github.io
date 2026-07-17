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

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---- Matrix rain background ----
    const matrixCanvas = document.getElementById('matrixCanvas');
    if (matrixCanvas && !reducedMotion) {
        const ctx = matrixCanvas.getContext('2d');
        const chars = '01アイウエオカキクケコサシスセソ<>/{}[]#$%&*+=?;:~ХВ';
        const fontSize = 14;
        let columns = 0;
        let drops = [];
        let running = true;

        const resize = () => {
            matrixCanvas.width = window.innerWidth;
            matrixCanvas.height = window.innerHeight;
            columns = Math.floor(matrixCanvas.width / fontSize);
            drops = Array.from({ length: columns }, () => Math.floor(Math.random() * -50));
        };
        resize();
        window.addEventListener('resize', resize, { passive: true });

        let lastFrame = 0;
        const draw = (ts) => {
            if (!running) return;
            requestAnimationFrame(draw);
            if (ts - lastFrame < 55) return;
            lastFrame = ts;

            ctx.fillStyle = 'rgba(10, 10, 15, 0.12)';
            ctx.fillRect(0, 0, matrixCanvas.width, matrixCanvas.height);
            ctx.font = fontSize + 'px monospace';

            for (let i = 0; i < drops.length; i++) {
                const char = chars[Math.floor(Math.random() * chars.length)];
                ctx.fillStyle = Math.random() > 0.975 ? '#a7ffd9' : '#00e5a0';
                ctx.fillText(char, i * fontSize, drops[i] * fontSize);
                if (drops[i] * fontSize > matrixCanvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i]++;
            }
        };
        requestAnimationFrame(draw);

        document.addEventListener('visibilitychange', () => {
            const wasRunning = running;
            running = !document.hidden;
            if (running && !wasRunning) requestAnimationFrame(draw);
        });
    }

    // ---- Scroll progress bar ----
    const progressBar = document.getElementById('scrollProgress');
    if (progressBar) {
        window.addEventListener('scroll', () => {
            const max = document.documentElement.scrollHeight - window.innerHeight;
            progressBar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
        }, { passive: true });
    }

    // ---- Periodic glitch on hero title ----
    const glitchEl = document.querySelector('.glitch');
    if (glitchEl && !reducedMotion) {
        setInterval(() => {
            glitchEl.classList.add('glitching');
            setTimeout(() => glitchEl.classList.remove('glitching'), 400);
        }, 5000);
    }

    // ---- Interactive terminal ----
    const terminal = document.querySelector('.hero__terminal');
    const terminalBody = document.getElementById('terminalBody');
    const history = document.getElementById('terminalHistory');
    const inputLine = document.getElementById('terminalInputLine');
    const input = document.getElementById('terminalInput');
    const inputText = document.getElementById('terminalInputText');

    if (terminal && input) {
        const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const cmdHistory = [];
        let histIdx = -1;

        const print = (html, cls = '') => {
            const div = document.createElement('div');
            if (cls) div.className = cls;
            div.innerHTML = html;
            history.appendChild(div);
        };

        const scrollDown = () => { terminalBody.scrollTop = terminalBody.scrollHeight; };

        const commands = {
            help: () => print(
                '<span class="terminal__dim">доступные команды:</span>\n' +
                '  <span class="terminal__accent">whoami</span>     кто я\n' +
                '  <span class="terminal__accent">skills</span>     стек и навыки\n' +
                '  <span class="terminal__accent">contact</span>    как связаться\n' +
                '  <span class="terminal__accent">ls</span>         список файлов\n' +
                '  <span class="terminal__accent">cat</span> &lt;file&gt; показать файл\n' +
                '  <span class="terminal__accent">nmap</span>       просканировать этот сайт\n' +
                '  <span class="terminal__accent">hack</span>       ну ты понял(а)\n' +
                '  <span class="terminal__accent">clear</span>      очистить терминал'
            ),
            whoami: () => print('<span class="terminal__accent">вета</span> aka <span class="terminal__highlight">wetakush</span> — security researcher & developer'),
            skills: () => print('Python · C++ · C# · JS · Web Security · OSINT · Burp Suite · Linux\n<span class="terminal__dim">подробнее ниже, в секции 02 ↓</span>'),
            contact: () => print('telegram: <a href="https://t.me/noxad" target="_blank" rel="noopener">@noxad</a>\ngithub:   <a href="https://github.com/wetakush" target="_blank" rel="noopener">wetakush</a>\nbugbounty: <a href="https://bugbounty.bi.zone/profile/wetakush" target="_blank" rel="noopener">bi.zone/wetakush</a>'),
            ls: () => print('<span class="terminal__highlight">about.md</span>  <span class="terminal__highlight">skills.txt</span>  <span class="terminal__accent">flag.txt</span>  <span class="terminal__dim">.secrets/</span>'),
            sudo: () => print('<span class="terminal__err">[sudo] password for guest: </span>\nSorry, nice try ;) This incident will be reported.'),
            nmap: () => {
                print('Starting Nmap 7.94 ( https://nmap.org )');
                setTimeout(() => {
                    print(
                        'Nmap scan report for wetakush.github.io\n' +
                        'PORT    STATE SERVICE\n' +
                        '<span class="terminal__accent">443/tcp open  https</span>\n' +
                        '<span class="terminal__dim">1337/tcp open  skills</span>\n' +
                        'Nmap done: 1 IP address scanned. Host is <span class="terminal__accent">up</span>.'
                    );
                    scrollDown();
                }, 600);
            },
            hack: () => {
                const steps = [
                    '[*] initializing exploit framework...',
                    '[*] bypassing firewall... <span class="terminal__accent">OK</span>',
                    '[*] escalating privileges... <span class="terminal__accent">OK</span>',
                    '[*] downloading the mainframe...',
                    '<span class="terminal__err">[!] access denied.</span> Тут только легальный хакинг → <a href="https://bugbounty.bi.zone/profile/wetakush" target="_blank" rel="noopener">bug bounty</a>'
                ];
                steps.forEach((s, i) => setTimeout(() => { print(s); scrollDown(); }, i * 500));
            },
            clear: () => { history.innerHTML = ''; document.getElementById('heroOutput').style.display = 'none'; document.querySelector('.terminal__line:not(.terminal__input-line)').style.display = 'none'; },
            cat: (arg) => {
                if (arg === 'flag.txt') print('<span class="terminal__accent">flag{n1ce_try_but_th3_r3al_fl4g_is_ur_cur1os1ty}</span>');
                else if (arg === 'about.md') print('# вета\nЛомаю системы, чтобы делать их сильнее.');
                else if (arg === 'skills.txt') commands.skills();
                else if (arg === '.secrets' || arg === '.secrets/') print('<span class="terminal__err">cat: .secrets/: Permission denied</span>');
                else print(`<span class="terminal__err">cat: ${esc(arg || '')}: No such file or directory</span>`);
            }
        };

        const run = (raw) => {
            const line = raw.trim();
            print(`<span class="terminal__prompt">$</span><span style="color: var(--text)">${esc(line)}</span>`);
            if (line) {
                cmdHistory.push(line);
                histIdx = cmdHistory.length;
                const [cmd, ...args] = line.split(/\s+/);
                const fn = commands[cmd.toLowerCase()];
                if (fn) fn(args.join(' '));
                else print(`<span class="terminal__err">${esc(cmd)}: command not found</span> — попробуй <span class="terminal__accent">help</span>`);
            }
            scrollDown();
        };

        // reveal input line after the intro animation
        setTimeout(() => { inputLine.hidden = false; }, 2200);

        terminal.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;
            input.focus({ preventScroll: true });
        });

        input.addEventListener('input', () => { inputText.textContent = input.value; });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                run(input.value);
                input.value = '';
                inputText.textContent = '';
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (histIdx > 0) { histIdx--; input.value = cmdHistory[histIdx]; inputText.textContent = input.value; }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (histIdx < cmdHistory.length - 1) { histIdx++; input.value = cmdHistory[histIdx]; }
                else { histIdx = cmdHistory.length; input.value = ''; }
                inputText.textContent = input.value;
            }
        });
    }

    // ---- Cursor spotlight on cards ----
    document.querySelectorAll('.skill-card, .contact-card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            card.style.setProperty('--mx', (e.clientX - rect.left) + 'px');
            card.style.setProperty('--my', (e.clientY - rect.top) + 'px');
        }, { passive: true });
    });

    // ---- Konami code → CRT mode ----
    const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let konamiPos = 0;
    const showToast = (msg) => {
        let toast = document.querySelector('.toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => toast.classList.remove('show'), 2500);
    };

    document.addEventListener('keydown', (e) => {
        konamiPos = (e.key === konami[konamiPos]) ? konamiPos + 1 : (e.key === konami[0] ? 1 : 0);
        if (konamiPos === konami.length) {
            konamiPos = 0;
            const on = document.body.classList.toggle('crt-mode');
            showToast(on ? '> ACCESS GRANTED :: CRT MODE ENABLED' : '> CRT MODE DISABLED');
        }
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
