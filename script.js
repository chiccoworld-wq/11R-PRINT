/* ============================================================
   11R Print — Interactive JavaScript
   Features: custom cursor · decrypt hover · scroll reveal ·
             counter animation · magnetic buttons · active nav
   ============================================================ */

(function () {
  'use strict';

  /* ==================== UTILS ==================== */
  const isMobile = () => window.innerWidth <= 720;

  /* ==================== CUSTOM CURSOR ==================== */
  const cursor      = document.getElementById('cursor');
  const cursorTrail = document.getElementById('cursor-trail');

  if (cursor && cursorTrail && !isMobile()) {
    let mx = 0, my = 0, tx = 0, ty = 0;

    document.addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      cursor.style.left = mx + 'px';
      cursor.style.top  = my + 'px';
    });

    (function animateTrail() {
      tx += (mx - tx) * 0.13;
      ty += (my - ty) * 0.13;
      cursorTrail.style.left = tx + 'px';
      cursorTrail.style.top  = ty + 'px';
      requestAnimationFrame(animateTrail);
    })();

    /* Enlarge cursor on interactive elements */
    document.querySelectorAll('a, button, .work-card, .service-card, input, textarea, .quality-item').forEach(el => {
      el.addEventListener('mouseenter', () => { cursor.classList.add('hovered'); cursorTrail.classList.add('hovered'); });
      el.addEventListener('mouseleave', () => { cursor.classList.remove('hovered'); cursorTrail.classList.remove('hovered'); });
    });
  }

  /* ==================== HEADER SCROLL ==================== */
  const header = document.getElementById('site-header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });
  }

  /* ==================== MOBILE NAV OVERLAY ==================== */
  const menuToggle   = document.getElementById('menu-toggle');
  const overlay      = document.getElementById('mobile-overlay');
  const overlayClose = document.getElementById('overlay-close');

  function openOverlay() {
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    menuToggle.setAttribute('aria-expanded', 'true');
    menuToggle.classList.add('open');
    document.body.style.overflow = 'hidden';
    overlayClose && overlayClose.focus();
  }

  function closeOverlay() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.classList.remove('open');
    document.body.style.overflow = '';
    menuToggle.focus();
  }

  if (menuToggle && overlay) {
    menuToggle.addEventListener('click', () => {
      overlay.classList.contains('open') ? closeOverlay() : openOverlay();
    });

    overlayClose && overlayClose.addEventListener('click', closeOverlay);

    overlay.querySelectorAll('.mobile-link, .mo-cta').forEach(link => {
      link.addEventListener('click', closeOverlay);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) closeOverlay();
    });
  }

  /* ==================== DECRYPT TEXT EFFECT ==================== */
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·';

  function decryptText(element, finalText) {
    let frame    = 0;
    const upper  = finalText.toUpperCase();
    const total  = upper.length;
    const FPS    = 24;
    const SPEED  = 0.6;
    let   iter   = 0;
    let   handle = null;

    handle = setInterval(() => {
      element.textContent = upper
        .split('')
        .map((ch, i) => {
          if (ch === ' ') return ' ';
          if (i < iter)  return upper[i];
          return CHARS[Math.floor(Math.random() * CHARS.length)];
        })
        .join('');

      iter += SPEED;
      if (iter >= total) {
        element.textContent = upper;
        clearInterval(handle);
      }
    }, 1000 / FPS);
  }

  document.querySelectorAll('[data-decrypt]').forEach(el => {
    const original = el.textContent.trim();
    el.addEventListener('mouseenter', () => decryptText(el, original));
    el.addEventListener('mouseleave', () => { el.textContent = original; });
  });

  /* ==================== SCROLL REVEAL ==================== */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -48px 0px' });

  document.querySelectorAll('.reveal-up').forEach(el => revealObserver.observe(el));


  /* ==================== MAGNETIC BUTTONS ==================== */
  if (!isMobile()) {
    document.querySelectorAll('.magnetic').forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width  / 2) * 0.28;
        const y = (e.clientY - r.top  - r.height / 2) * 0.28;
        btn.style.transform = `translate(${x}px, ${y}px)`;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transition = 'transform 0.4s ease';
        btn.style.transform  = '';
        setTimeout(() => { btn.style.transition = ''; }, 400);
      });
    });
  }

  /* ==================== ACTIVE NAV ==================== */
  const sections   = document.querySelectorAll('section[id]');
  const navAnchors = document.querySelectorAll('.nav-links a[href*="#"]');

  if (sections.length && navAnchors.length) {
    function updateNav() {
      const pos = window.scrollY + 90;
      sections.forEach(sec => {
        const top = sec.offsetTop;
        const bot = top + sec.offsetHeight;
        const id  = '#' + sec.getAttribute('id');
        navAnchors.forEach(a => {
          if (a.getAttribute('href').endsWith(id)) {
            a.classList.toggle('active', pos >= top && pos < bot);
          }
        });
      });
    }
    window.addEventListener('scroll', updateNav, { passive: true });
    updateNav();
  }

  /* ==================== HERO PARALLAX ==================== */
  const heroShirt  = document.querySelector('.hero-shirt');
  const offsetText = document.querySelector('.offset-text');

  if (heroShirt || offsetText) {
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (heroShirt) heroShirt.style.transform = `translateY(${y * 0.07}px)`;
      if (offsetText) offsetText.style.transform = `translateY(calc(-50% + ${y * 0.045}px))`;
    }, { passive: true });
  }

  /* ==================== VIDEO SCROLL SCRUB ====================
     Drives video.currentTime based on scroll progress through the
     video section — Apple-style scroll-to-play effect.            */
  const vid         = document.getElementById('section-video');
  const progressBar = document.getElementById('video-progress-bar');
  const scrollHint  = document.getElementById('video-scroll-hint');
  const vidSection  = document.getElementById('video');

  if (vid && vidSection) {
    vid.addEventListener('loadedmetadata', () => {
      let ticking = false;

      function scrubVideo() {
        const rect     = vidSection.getBoundingClientRect();
        const winH     = window.innerHeight;
        const secH     = vidSection.offsetHeight;

        /* 0 = section just entered viewport, 1 = section fully scrolled past */
        const progress = Math.min(Math.max(-rect.top / (secH - winH), 0), 1);

        const target = progress * vid.duration;
        if (isFinite(target) && Math.abs(vid.currentTime - target) > 0.05) {
          vid.currentTime = target;
        }

        if (progressBar) progressBar.style.width = (progress * 100) + '%';
        if (scrollHint)  scrollHint.classList.toggle('hidden', progress > 0.02);

        ticking = false;
      }

      window.addEventListener('scroll', () => {
        if (!ticking) { requestAnimationFrame(scrubVideo); ticking = true; }
      }, { passive: true });

      scrubVideo();
    });

    vid.addEventListener('error', () => {
      console.warn('11R video could not load:', vid.src);
    });
  }

})();
