/* ════════════════════════════════════════════════════════════════
   MyLPRO | app.js
   JavaScript vanilla, sin dependencias. Un solo "ticker" (requestAnimationFrame)
   mueve todo lo que depende del scroll, para evitar listeners de scroll por modulo.

   Indice
    1. Utilidades y estado
    2. Ticker + scroll suave (lerp)
    3. Medidas (cache de posiciones)
    4. Loader
    5. Texto: split de titulares y reveal
    6. Header, menu movil y navegacion
    7. Hero: rotador, particulas, tilt 3D
    8. Marquee cinetico
    9. Declaracion con scroll scrub
   10. Galeria horizontal fijada
   11. Linea de tiempo, parallax, contadores
   12. Interacciones: spotlight, magnetico, ripple, acordeones
   13. Formulario a WhatsApp
   14. Arranque
   ════════════════════════════════════════════════════════════════ */
(() => {
    'use strict';

    /* ───────────── 1. UTILIDADES Y ESTADO ───────────── */
    const WA_NUMBER = '525632093910'; // +52 56 3209 3910 (formato internacional para wa.me)

    const root = document.documentElement;
    const $ = (s, c = document) => c.querySelector(s);
    const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
    const run = (name, fn) => {
        try { fn(); } catch (err) { console.error('[MyLPRO] ' + name, err); }
    };

    const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mqFine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const mqDesktop = window.matchMedia('(min-width: 1024px)');

    const S = {
        reduce: mqReduce.matches,
        fine: mqFine.matches,
        y: window.scrollY,
        vy: 0,
        vh: window.innerHeight,
        vw: window.innerWidth
    };

    // Activa los estados iniciales de animacion SOLO cuando el JS esta corriendo
    root.classList.add('fx');
    root.classList.add('is-locked');
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);

    const absTop = (el) => el.getBoundingClientRect().top + window.scrollY;

    /* ───────────── 2. TICKER + SCROLL SUAVE ───────────── */
    const tickers = [];
    const addTick = (fn) => tickers.push(fn);

    const scroller = (() => {
        const st = { target: window.scrollY, cur: window.scrollY, applied: window.scrollY, locked: true };
        const canSmooth = () => !S.reduce && S.fine;
        const maxY = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

        window.addEventListener('wheel', (e) => {
            if (!canSmooth() || st.locked || e.ctrlKey || e.defaultPrevented) return;
            if (e.target.closest && e.target.closest('textarea, [data-native-scroll]')) return;
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
            e.preventDefault();
            let dy = e.deltaY;
            if (e.deltaMode === 1) dy *= 34;
            else if (e.deltaMode === 2) dy *= window.innerHeight;
            st.target = clamp(st.target + dy, 0, maxY());
        }, { passive: false });

        return {
            step(dt) {
                const sy = window.scrollY;
                if (!canSmooth() || st.locked) {
                    st.target = st.cur = st.applied = sy;
                    return sy;
                }
                // Si el scroll cambio por teclado, barra o ancla, nos sincronizamos
                if (Math.abs(sy - st.applied) > 2) st.target = st.cur = st.applied = sy;
                const diff = st.target - st.cur;
                if (Math.abs(diff) > 0.08) {
                    st.cur += diff * (1 - Math.pow(1 - 0.085, dt / 16.667));
                    window.scrollTo(0, st.cur);
                    st.applied = window.scrollY;
                } else if (diff !== 0) {
                    st.cur = st.target;
                    window.scrollTo(0, st.cur);
                    st.applied = window.scrollY;
                }
                return window.scrollY;
            },
            to(y) {
                const t = clamp(y, 0, maxY());
                if (canSmooth() && !st.locked) st.target = t;
                else window.scrollTo({ top: t, behavior: S.reduce ? 'auto' : 'smooth' });
            },
            lock(v) { st.locked = v; if (!v) st.target = st.cur = st.applied = window.scrollY; }
        };
    })();

    let lastT = performance.now();
    const frame = (now) => {
        const dt = Math.min(64, now - lastT);
        lastT = now;
        const prev = S.y;
        S.y = scroller.step(dt);
        S.vy = lerp(S.vy, S.y - prev, 0.2);
        for (let i = 0; i < tickers.length; i++) tickers[i](now, dt);
        requestAnimationFrame(frame);
    };

    /* ───────────── 3. MEDIDAS ───────────── */
    const measurers = [];
    const onMeasure = (fn) => { measurers.push(fn); run('measure', fn); };
    const measureAll = () => measurers.forEach((fn) => run('measure', fn));
    let measureRaf = 0;
    const scheduleMeasure = () => {
        cancelAnimationFrame(measureRaf);
        measureRaf = requestAnimationFrame(measureAll);
    };

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            S.vh = window.innerHeight;
            S.vw = window.innerWidth;
            measureAll();
        }, 120);
    });
    window.addEventListener('load', scheduleMeasure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleMeasure);
    if ('ResizeObserver' in window) new ResizeObserver(scheduleMeasure).observe(document.body);
    const onMq = () => { S.reduce = mqReduce.matches; S.fine = mqFine.matches; scheduleMeasure(); };
    [mqReduce, mqFine, mqDesktop].forEach((mq) => (mq.addEventListener ? mq.addEventListener('change', onMq) : mq.addListener(onMq)));

    /* ───────────── 4. LOADER ───────────── */
    const loadedCbs = [];
    const onLoaded = (fn) => loadedCbs.push(fn);
    let isLoaded = false;
    const markLoaded = () => {
        if (isLoaded) return;
        isLoaded = true;
        root.classList.add('is-loaded');
        loadedCbs.forEach((fn) => run('loaded', fn));
    };

    function initLoader() {
        const loader = $('#loader');
        const pctEl = $('#loader-pct');
        if (!loader) { root.classList.remove('is-locked'); scroller.lock(false); markLoaded(); return; }

        const MIN = S.reduce ? 500 : 2700;
        const start = performance.now();
        let pageReady = document.readyState === 'complete';
        let fontsOk = !(document.fonts && document.fonts.ready);
        const logo = $('.logo-card img');
        let logoOk = !logo || logo.complete;
        let doneAt = null;
        let leaving = false;

        window.addEventListener('load', () => { pageReady = true; }, { once: true });
        if (!fontsOk) document.fonts.ready.then(() => { fontsOk = true; });
        if (!logoOk) {
            logo.addEventListener('load', () => { logoOk = true; }, { once: true });
            logo.addEventListener('error', () => { logoOk = true; }, { once: true });
        }

        const leave = () => {
            if (leaving) return;
            leaving = true;
            loader.classList.add('is-leaving');
            setTimeout(markLoaded, S.reduce ? 0 : 520);
            setTimeout(() => {
                loader.classList.add('is-done');
                root.classList.remove('is-locked');
                scroller.lock(false);
                scheduleMeasure();
            }, S.reduce ? 60 : 1700);
        };

        const tick = (now) => {
            if (leaving) return;
            const t = now - start;
            let p;
            if (doneAt === null) {
                p = easeOut(clamp(t / MIN, 0, 1)) * 92;
                if (t >= MIN && pageReady && fontsOk && logoOk) doneAt = now;
            }
            if (doneAt !== null) p = lerp(92, 100, clamp((now - doneAt) / 500, 0, 1));
            loader.style.setProperty('--p', p.toFixed(2));
            pctEl.textContent = Math.round(p);
            if (doneAt !== null && now - doneAt >= 700) { leave(); return; }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        setTimeout(leave, 9000); // seguro: nunca dejamos la pagina atascada
    }

    /* ───────────── 5. TEXTO: SPLIT + REVEAL ───────────── */
    function splitWords(el) {
        let idx = 0;
        const label = el.textContent.replace(/\s+/g, ' ').trim();
        const walk = (node, inGold) => {
            Array.from(node.childNodes).forEach((child) => {
                if (child.nodeType === 3) {
                    const frag = document.createDocumentFragment();
                    child.textContent.split(/(\s+)/).forEach((part) => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                        const w = document.createElement('span');
                        w.className = 'w';
                        w.setAttribute('aria-hidden', 'true');
                        const wi = document.createElement('span');
                        wi.className = 'wi' + (inGold ? ' gold' : '');
                        wi.style.setProperty('--i', idx++);
                        wi.textContent = part;
                        w.appendChild(wi);
                        frag.appendChild(w);
                    });
                    child.replaceWith(frag);
                } else if (child.nodeType === 1 && child.tagName !== 'BR') {
                    const gold = child.classList.contains('gold');
                    if (gold) child.classList.replace('gold', 'gold-wrap');
                    walk(child, inGold || gold);
                }
            });
        };
        walk(el, false);
        el.setAttribute('aria-label', label);
        el.classList.add('is-split');
    }

    function initText() {
        $$('[data-split]').forEach(splitWords);

        $$('[data-stagger]').forEach((box) => {
            Array.from(box.children).forEach((child, i) => child.style.setProperty('--i', i));
        });

        if (!('IntersectionObserver' in window)) {
            $$('[data-reveal], [data-split], [data-stagger] > *').forEach((el) => el.classList.add('in'));
            return;
        }

        // Los hijos que entran juntos se escalonan por el orden de llegada
        const io = new IntersectionObserver((entries) => {
            let n = 0;
            entries.forEach((en) => {
                if (!en.isIntersecting) return;
                const el = en.target;
                if (el.parentElement && el.parentElement.hasAttribute('data-stagger')) el.style.setProperty('--i', n++);
                el.classList.add('in');
                io.unobserve(el);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

        $$('[data-reveal], [data-split]:not([data-split="load"]), [data-stagger] > *').forEach((el) => io.observe(el));

        onLoaded(() => {
            const h1 = $('[data-split="load"]');
            if (h1) h1.classList.add('in');
        });
    }

    /* ───────────── 6. HEADER, MENU, NAVEGACION ───────────── */
    function initHeader() {
        const header = $('#site-header');
        const burger = $('#burger');
        const menu = $('#menu');
        const bar = $('.scroll-progress span');
        let scrolled = false;
        let hidden = false;
        let lastY = 0;
        let acc = 0;
        let menuOpen = false;
        let maxY = 1;

        onMeasure(() => { maxY = Math.max(1, document.documentElement.scrollHeight - S.vh); });

        addTick(() => {
            const y = S.y;
            if (bar) bar.style.transform = 'scaleX(' + clamp(y / maxY, 0, 1).toFixed(4) + ')';
            const s = y > 24;
            if (s !== scrolled) { scrolled = s; header.classList.toggle('is-scrolled', s); }
            // Oculta al bajar, muestra al subir
            const d = y - lastY;
            lastY = y;
            acc = Math.sign(d) === Math.sign(acc) ? acc + d : d;
            let h = hidden;
            if (menuOpen || y < 520) h = false;
            else if (acc > 28) h = true;
            else if (acc < -14) h = false;
            if (h !== hidden) { hidden = h; header.classList.toggle('is-hidden', h); }
        });

        const focusables = () => [burger, ...$$('a, button', menu)].filter((el) => el.offsetParent !== null || el === burger);
        const setMenu = (open) => {
            menuOpen = open;
            root.classList.toggle('menu-open', open);
            root.classList.toggle('is-locked', open);
            scroller.lock(open);
            burger.setAttribute('aria-expanded', String(open));
            burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
            menu.setAttribute('aria-hidden', String(!open));
            if (open) setTimeout(() => { const first = $('a', menu); if (first) first.focus({ preventScroll: true }); }, 450);
        };
        burger.addEventListener('click', () => setMenu(!menuOpen));
        document.addEventListener('keydown', (e) => {
            if (!menuOpen) return;
            if (e.key === 'Escape') { setMenu(false); burger.focus(); }
            if (e.key === 'Tab') {
                const f = focusables();
                const first = f[0];
                const last = f[f.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        });
        mqDesktop.addEventListener && mqDesktop.addEventListener('change', () => { if (menuOpen && window.innerWidth >= 960) setMenu(false); });

        // Anclas con scroll suave
        document.addEventListener('click', (e) => {
            const a = e.target.closest('a[href^="#"]');
            if (!a) return;
            const id = a.getAttribute('href');
            if (id.length < 2) return;
            const target = document.getElementById(id.slice(1));
            if (!target) return;
            e.preventDefault();
            if (menuOpen) setMenu(false);
            requestAnimationFrame(() => scroller.to(id === '#inicio' ? 0 : absTop(target)));
            history.replaceState(null, '', id);
        });

        // Link activo segun la seccion visible
        const links = $$('.nav a');
        if ('IntersectionObserver' in window && links.length) {
            const map = new Map(links.map((l) => [l.getAttribute('href').slice(1), l]));
            const spy = new IntersectionObserver((entries) => {
                entries.forEach((en) => {
                    if (!en.isIntersecting) return;
                    links.forEach((l) => l.classList.remove('is-current'));
                    const l = map.get(en.target.id);
                    if (l) l.classList.add('is-current');
                });
            }, { rootMargin: '-45% 0px -50% 0px' });
            map.forEach((_, id) => { const s = document.getElementById(id); if (s) spy.observe(s); });
        }
    }

    /* ───────────── 7. HERO ───────────── */
    function initHero() {
        const hero = $('#inicio');
        if (!hero) return;

        // 7.1 Rotador de servicios
        const rot = $('[data-rotator]');
        if (rot && !S.reduce) {
            const items = $$('span', rot);
            let i = 0;
            setInterval(() => {
                if (document.hidden || !isLoaded) return;
                const prev = items[i];
                i = (i + 1) % items.length;
                const next = items[i];
                prev.classList.remove('is-on');
                prev.classList.add('is-off');
                next.classList.add('is-on');
                setTimeout(() => {
                    prev.style.transition = 'none';
                    prev.classList.remove('is-off');
                    void prev.offsetWidth;
                    prev.style.transition = '';
                }, 900);
            }, 2600);
        }

        // 7.2 Particulas: burbujas de agua + destellos dorados
        const canvas = $('#fx');
        const ctx = canvas && canvas.getContext('2d');
        const mouse = { x: -999, y: -999, active: false };
        let w = 0, h = 0, dpr = 1, parts = [], heroVisible = true;

        const make = (initial) => {
            const gold = Math.random() < 0.3;
            return {
                gold,
                x: Math.random() * w,
                y: initial ? Math.random() * h : h + 20 + Math.random() * 120,
                r: gold ? 0.9 + Math.random() * 1.6 : 2 + Math.random() * 8,
                vy: gold ? 0.1 + Math.random() * 0.3 : 0.25 + Math.random() * 0.8,
                sway: 0.4 + Math.random() * 1.2,
                ph: Math.random() * 6.28,
                tw: 0.8 + Math.random() * 2,
                a: 0.3 + Math.random() * 0.6
            };
        };
        const sizeCanvas = () => {
            if (!canvas) return;
            dpr = Math.min(window.devicePixelRatio || 1, 1.75);
            w = canvas.clientWidth;
            h = canvas.clientHeight;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const count = Math.round(clamp((w * h) / 15000, 22, 80));
            parts = Array.from({ length: count }, () => make(true));
        };

        const draw = (now, dt) => {
            ctx.clearRect(0, 0, w, h);
            const k = dt / 16.667;
            for (const p of parts) {
                if (!S.reduce) {
                    p.y -= p.vy * k;
                    p.x += Math.sin(now * 0.0009 * p.sway + p.ph) * 0.35 * k;
                    if (mouse.active) {
                        const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
                        if (d2 < 16900) {
                            const d = Math.sqrt(d2) || 1, f = (130 - d) / 130;
                            p.x += (dx / d) * f * 2.4;
                            p.y += (dy / d) * f * 2.4;
                        }
                    }
                    if (p.y < -30) Object.assign(p, make(false));
                    if (p.x < -20) p.x = w + 20;
                    else if (p.x > w + 20) p.x = -20;
                }
                if (p.gold) {
                    const a = p.a * (0.45 + 0.55 * Math.sin(now * 0.002 * p.tw + p.ph));
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.fillStyle = 'rgba(247,201,72,' + (a * 0.22).toFixed(3) + ')';
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, 6.283); ctx.fill();
                    ctx.fillStyle = 'rgba(255,236,170,' + a.toFixed(3) + ')';
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
                    ctx.globalCompositeOperation = 'source-over';
                } else {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.r, 0, 6.283);
                    ctx.fillStyle = 'rgba(120,185,255,' + (p.a * 0.1).toFixed(3) + ')';
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(170,215,255,' + (p.a * 0.55).toFixed(3) + ')';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, Math.max(0.6, p.r * 0.26), 0, 6.283);
                    ctx.fillStyle = 'rgba(255,255,255,' + (p.a * 0.7).toFixed(3) + ')';
                    ctx.fill();
                }
            }
        };

        if (canvas && ctx) {
            onMeasure(sizeCanvas);
            if ('IntersectionObserver' in window) {
                new IntersectionObserver((en) => { heroVisible = en[0].isIntersecting; }).observe(hero);
            }
            addTick((now, dt) => { if (heroVisible && !document.hidden) draw(now, dt); });
        }

        // 7.3 Tilt 3D del logo + parallax de chips + parallax de scroll
        const visual = $('.hero__visual');
        const card = $('[data-tilt]');
        const inner = $('.hero__inner');
        const bg = $('.hero__bg');
        const T = { tx: 0, ty: 0, x: 0, y: 0, glare: 0 };

        hero.addEventListener('pointermove', (e) => {
            if (!S.fine || S.reduce) return;
            const r = visual.getBoundingClientRect();
            T.tx = clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2 + 200), -1, 1);
            T.ty = clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2 + 200), -1, 1);
            T.glare = 1;
            const hr = hero.getBoundingClientRect();
            mouse.x = e.clientX - hr.left;
            mouse.y = e.clientY - hr.top;
            mouse.active = true;
        });
        hero.addEventListener('pointerleave', () => { T.tx = T.ty = 0; T.glare = 0; mouse.active = false; });

        addTick((now) => {
            if (S.reduce || !card) return;
            if (!S.fine) { // en tactil: balanceo suave automatico
                T.tx = Math.sin(now * 0.0006) * 0.55;
                T.ty = Math.cos(now * 0.0005) * 0.4;
            }
            T.x = lerp(T.x, T.tx, 0.07);
            T.y = lerp(T.y, T.ty, 0.07);
            card.style.setProperty('--rx', (-T.y * 7).toFixed(2) + 'deg');
            card.style.setProperty('--ry', (T.x * 9).toFixed(2) + 'deg');
            card.style.setProperty('--gx', ((T.x + 1) * 50).toFixed(1) + '%');
            card.style.setProperty('--gy', ((T.y + 1) * 50).toFixed(1) + '%');
            card.style.setProperty('--go', S.fine ? T.glare : 0.5);
            visual.style.setProperty('--px', T.x.toFixed(3));
            visual.style.setProperty('--py', T.y.toFixed(3));
        });

        // Parallax al salir del hero
        let lastPy = -1;
        addTick(() => {
            if (S.reduce || S.y > S.vh * 1.2) return;
            const y = Math.round(S.y);
            if (y === lastPy) return;
            lastPy = y;
            inner.style.transform = 'translate3d(0,' + (y * 0.1).toFixed(1) + 'px,0)';
            inner.style.opacity = clamp(1 - y / (S.vh * 0.95), 0, 1).toFixed(3);
            bg.style.transform = 'translate3d(0,' + (y * 0.28).toFixed(1) + 'px,0)';
        });
    }

    /* ───────────── 8. MARQUEE CINETICO ───────────── */
    function initMarquee() {
        const track = $('[data-marquee]');
        if (!track || S.reduce) return;
        const set = track.firstElementChild;
        let x = 0, w = 0, dir = 1, visible = true;
        onMeasure(() => { w = set.getBoundingClientRect().width; });
        if ('IntersectionObserver' in window) {
            new IntersectionObserver((en) => { visible = en[0].isIntersecting; }, { rootMargin: '100px' }).observe(track.parentElement);
        }
        addTick((now, dt) => {
            if (!visible || !w) return;
            if (S.vy > 2) dir = 1;
            else if (S.vy < -2) dir = -1;
            x -= 0.055 * dt * dir + clamp(S.vy, -90, 90) * 0.12;
            if (x <= -w) x += w;
            else if (x > 0) x -= w;
            track.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
        });
    }

    /* ───────────── 9. DECLARACION (SCROLL SCRUB) ───────────── */
    function initStatement() {
        const el = $('[data-scrub]');
        if (!el) return;
        const words = [];
        const label = el.textContent.replace(/\s+/g, ' ').trim();
        const walk = (node, em) => {
            Array.from(node.childNodes).forEach((child) => {
                if (child.nodeType === 3) {
                    const frag = document.createDocumentFragment();
                    child.textContent.split(/(\s+)/).forEach((part) => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                        const s = document.createElement('span');
                        s.className = 'sw' + (em ? ' sw--em' : '');
                        s.setAttribute('aria-hidden', 'true');
                        s.textContent = part;
                        frag.appendChild(s);
                        words.push(s);
                    });
                    child.replaceWith(frag);
                } else if (child.nodeType === 1) {
                    walk(child, em || child.tagName === 'B');
                }
            });
        };
        walk(el, false);
        el.setAttribute('aria-label', label);

        let top = 0, hgt = 0, lit = -1;
        onMeasure(() => { top = absTop(el); hgt = el.offsetHeight; });
        addTick(() => {
            if (S.y + S.vh < top - 40 || S.y > top + hgt + 40) return;
            const p = clamp((S.y + S.vh * 0.84 - top) / (hgt + S.vh * 0.2), 0, 1);
            const n = S.reduce ? words.length : Math.round(p * words.length * 1.1);
            if (n === lit) return;
            lit = n;
            for (let i = 0; i < words.length; i++) words[i].classList.toggle('is-lit', i < n);
        });
    }

    /* ───────────── 10. GALERIA HORIZONTAL FIJADA ───────────── */
    function initPan() {
        const pan = $('[data-pan]');
        if (!pan) return;
        const track = $('.pan__track', pan);
        let pinned = false, travel = 0, top = 0, lastP = -1;

        const measure = () => {
            const on = mqDesktop.matches && !S.reduce;
            if (on !== pinned) {
                pinned = on;
                pan.classList.toggle('is-pinned', on);
                requestAnimationFrame(measure); // el layout cambia al activar el modo fijado
            }
            if (!pinned) {
                if (pan.style.height) pan.style.height = '';
                track.style.transform = '';
                pan.style.removeProperty('--p');
                lastP = -1;
                return;
            }
            travel = Math.max(0, track.offsetWidth - S.vw);
            const hpx = Math.round(travel + S.vh) + 'px';
            if (pan.style.height !== hpx) pan.style.height = hpx;
            top = absTop(pan);
        };
        onMeasure(measure);

        addTick(() => {
            if (!pinned || S.y + S.vh < top - 50 || S.y > top + travel + S.vh + 50) return;
            const p = clamp((S.y - top) / Math.max(1, travel), 0, 1);
            if (Math.abs(p - lastP) < 0.0001) return;
            lastP = p;
            track.style.transform = 'translate3d(' + (-p * travel).toFixed(2) + 'px,0,0)';
            pan.style.setProperty('--p', p.toFixed(4));
        });
    }

    /* ───────────── 11. TIMELINE, PARALLAX, CONTADORES ───────────── */
    function initTimeline() {
        const tl = $('[data-timeline]');
        if (!tl) return;
        const rail = $('.timeline__rail', tl);
        const items = $$('.tl', tl);
        let top = 0, hgt = 1, fr = [], lastP = -1, states = [];
        onMeasure(() => {
            top = absTop(rail);
            hgt = rail.offsetHeight || 1;
            fr = items.map((it) => (absTop($('.tl__node', it)) + 28 - top) / hgt);
        });
        addTick(() => {
            if (S.y + S.vh < top - 100 || S.y > top + hgt + S.vh) return;
            const y = S.y + S.vh * 0.6;
            const p = clamp((y - top) / hgt, 0, 1);
            if (Math.abs(p - lastP) > 0.0005) { lastP = p; tl.style.setProperty('--tp', p.toFixed(4)); }
            items.forEach((it, i) => {
                const on = y >= top + fr[i] * hgt;
                if (states[i] !== on) { states[i] = on; it.classList.toggle('is-on', on); }
            });
        });
    }

    function initParallax() {
        if (S.reduce) return;
        const list = $$('[data-parallax]').map((el) => ({ el, speed: parseFloat(el.dataset.parallax) || 0.1, top: 0, h: 0 }));
        if (!list.length) return;
        onMeasure(() => list.forEach((it) => { const p = it.el.parentElement; it.top = absTop(p); it.h = p.offsetHeight; }));
        addTick(() => {
            list.forEach((it) => {
                const c = S.y + S.vh / 2 - (it.top + it.h / 2);
                if (Math.abs(c) > it.h / 2 + S.vh) return;
                it.el.style.transform = 'translate3d(0,' + (-c * it.speed).toFixed(1) + 'px,0)';
            });
        });
    }

    function initCounters() {
        const els = $$('[data-count]');
        if (!els.length) return;
        const animate = (el) => {
            const to = parseFloat(el.dataset.to) || 0;
            if (S.reduce) { el.textContent = to; return; }
            const t0 = performance.now();
            const dur = 1800;
            const step = (now) => {
                const k = clamp((now - t0) / dur, 0, 1);
                el.textContent = Math.round(to * easeOutExpo(k));
                if (k < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        };
        if (!('IntersectionObserver' in window)) { els.forEach(animate); return; }
        const io = new IntersectionObserver((entries) => {
            entries.forEach((en) => { if (en.isIntersecting) { animate(en.target); io.unobserve(en.target); } });
        }, { threshold: 0.6 });
        els.forEach((el) => io.observe(el));
    }

    /* ───────────── 12. INTERACCIONES ───────────── */
    function initInteractions() {
        // Spotlight en tarjetas
        let spotRaf = 0;
        document.addEventListener('pointermove', (e) => {
            const el = e.target.closest && e.target.closest('[data-spot]');
            if (!el) return;
            cancelAnimationFrame(spotRaf);
            spotRaf = requestAnimationFrame(() => {
                const r = el.getBoundingClientRect();
                el.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px');
                el.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
            });
        });

        // Botones magneticos
        if (S.fine && !S.reduce) {
            $$('[data-magnetic]').forEach((el) => {
                el.addEventListener('pointermove', (e) => {
                    const r = el.getBoundingClientRect();
                    const dx = (e.clientX - (r.left + r.width / 2)) * 0.22;
                    const dy = (e.clientY - (r.top + r.height / 2)) * 0.32;
                    el.style.translate = dx.toFixed(1) + 'px ' + dy.toFixed(1) + 'px';
                });
                el.addEventListener('pointerleave', () => { el.style.translate = ''; });
            });
        }

        // Ripple de agua al hacer click
        document.addEventListener('pointerdown', (e) => {
            const btn = e.target.closest && e.target.closest('.btn');
            if (!btn || S.reduce) return;
            const r = btn.getBoundingClientRect();
            const d = Math.max(r.width, r.height) * 2;
            const s = document.createElement('span');
            s.className = 'ripple';
            s.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (e.clientX - r.left - d / 2) + 'px;top:' + (e.clientY - r.top - d / 2) + 'px';
            btn.appendChild(s);
            setTimeout(() => s.remove(), 850);
        });

        // Brillo que sigue al cursor
        const glow = $('.cursor-glow');
        if (glow && S.fine && !S.reduce) {
            let gx = -999, gy = -999, cx = -999, cy = -999;
            window.addEventListener('pointermove', (e) => { gx = e.clientX; gy = e.clientY; glow.classList.add('is-on'); }, { passive: true });
            document.addEventListener('pointerleave', () => glow.classList.remove('is-on'));
            addTick(() => {
                cx = lerp(cx, gx, 0.1);
                cy = lerp(cy, gy, 0.1);
                glow.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
            });
        }

        // Acordeon de sectores
        const acc = $('[data-acc]');
        if (acc) {
            const items = $$('.acc__item', acc);
            const activate = (it) => items.forEach((x) => x.classList.toggle('is-active', x === it));
            items.forEach((it) => {
                it.addEventListener('click', () => activate(it));
                it.addEventListener('focus', () => activate(it));
                it.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && mqDesktop.matches) activate(it); });
            });
        }

        // FAQ
        const faq = $('[data-faq]');
        if (faq) {
            faq.addEventListener('click', (e) => {
                const btn = e.target.closest('.faq__q');
                if (!btn) return;
                const item = btn.closest('.faq__item');
                const open = !item.classList.contains('is-open');
                $$('.faq__item', faq).forEach((x) => {
                    x.classList.remove('is-open');
                    $('.faq__q', x).setAttribute('aria-expanded', 'false');
                });
                if (open) { item.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); }
            });
        }

        // Imagenes que no cargan: se oculta la imagen y queda el degradado de marca
        $$('img').forEach((img) => img.addEventListener('error', () => { img.style.opacity = '0'; }));

        // Tooltip del boton flotante, una sola vez
        const wa = $('.wa-float');
        if (wa) onLoaded(() => {
            setTimeout(() => {
                wa.classList.add('is-tip');
                setTimeout(() => wa.classList.remove('is-tip'), 4800);
            }, 7000);
        });

        const year = $('#year');
        if (year) year.textContent = new Date().getFullYear();
    }

    /* ───────────── 13. FORMULARIO A WHATSAPP ───────────── */
    function initForm() {
        const form = $('#wa-form');
        if (!form) return;
        const status = $('#form-status');
        const f = {
            name: $('#f-name'), phone: $('#f-phone'), service: $('#f-service'),
            type: $('#f-type'), msg: $('#f-msg')
        };
        const setErr = (input, text) => {
            const err = $('#' + input.id + '-err');
            input.setAttribute('aria-invalid', text ? 'true' : 'false');
            if (err) err.textContent = text || '';
        };
        [f.name, f.phone, f.service].forEach((input) => {
            input.addEventListener('input', () => setErr(input, ''));
            input.addEventListener('change', () => setErr(input, ''));
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = f.name.value.trim();
            const phone = f.phone.value.trim();
            const service = f.service.value;
            let firstBad = null;

            if (name.length < 2) { setErr(f.name, 'Escribe tu nombre para continuar.'); firstBad = firstBad || f.name; }
            if (phone && phone.replace(/\D/g, '').length < 8) { setErr(f.phone, 'Revisa tu teléfono, parece incompleto.'); firstBad = firstBad || f.phone; }
            if (!service) { setErr(f.service, 'Elige el servicio que necesitas.'); firstBad = firstBad || f.service; }
            if (firstBad) { firstBad.focus(); status.textContent = ''; return; }

            const lines = ['Hola MyLPRO, soy ' + name + '.', 'Quiero cotizar: ' + service + '.'];
            if (f.type.value) lines.push('Tipo de propiedad: ' + f.type.value + '.');
            if (f.msg.value.trim()) lines.push('Detalles: ' + f.msg.value.trim());
            if (phone) lines.push('Mi teléfono: ' + phone);
            const url = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(lines.join('\n'));

            form.classList.add('is-sending');
            status.textContent = 'Abriendo WhatsApp con tu solicitud...';
            const win = window.open(url, '_blank');
            if (win) { try { win.opener = null; } catch (err) { /* sin acceso, no pasa nada */ } }
            else { window.location.href = url; return; }

            setTimeout(() => {
                form.classList.remove('is-sending');
                status.textContent = '';
                const a = document.createElement('a');
                a.href = url; a.target = '_blank'; a.rel = 'noopener';
                a.textContent = 'Abrir WhatsApp de nuevo';
                status.append('Listo. Si no se abrió, ', a, '.');
                form.reset();
            }, 1400);
        });
    }

    /* ───────────── 14. ARRANQUE ───────────── */
    run('loader', initLoader);
    run('text', initText);
    run('header', initHeader);
    run('hero', initHero);
    run('marquee', initMarquee);
    run('statement', initStatement);
    run('pan', initPan);
    run('timeline', initTimeline);
    run('parallax', initParallax);
    run('counters', initCounters);
    run('interactions', initInteractions);
    run('form', initForm);

    onLoaded(() => {
        if (location.hash.length > 1) {
            const t = document.getElementById(decodeURIComponent(location.hash.slice(1)));
            if (t) setTimeout(() => scroller.to(absTop(t)), 700);
        }
    });

    requestAnimationFrame((t) => { lastT = t; requestAnimationFrame(frame); });
})();
