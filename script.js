/* ============================================================
   11R Print — Interactive JavaScript
   Features: decrypt hover · scroll reveal ·
             counter animation · magnetic buttons · active nav
   ============================================================ */

(function () {
  'use strict';

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

/* ================================================================
   CUSTOM ORDER PAGE JS
   Only runs when .order-page body class is present
================================================================ */
if (document.querySelector('.order-page')) {
  initOrderPage();
}

function initOrderPage() {
  initUpload();
  initMockup();
  initPricing();
  initFormSync();
  initScrollSteps();
  initScrollReveal();
}

/* ---- 1. FILE UPLOAD ---- */
function initUpload() {
  const zone       = document.getElementById('upload-zone');
  const fileInput  = document.getElementById('file-input');
  const defState   = document.getElementById('upload-default');
  const doneState  = document.getElementById('upload-done');
  const previewArea= document.getElementById('upload-preview-area');
  const fileName   = document.getElementById('upload-file-name');
  const noImgMsg   = document.getElementById('upload-nonimage-msg');
  const removeBtn  = document.getElementById('upload-remove');
  const hidFilename= document.getElementById('hid-filename');
  const artworkImg = document.getElementById('artwork-img');
  const artworkPh  = document.getElementById('artwork-ph');
  const artNote    = document.getElementById('artwork-note-text');

  // Image-previewable types
  const previewable = ['image/png', 'image/jpeg', 'image/svg+xml'];

  function handleFile(file) {
    if (!file) return;

    const name = file.name;
    fileName.textContent = name;
    if (hidFilename) hidFilename.value = name;

    // Clear previous preview
    previewArea.innerHTML = '';
    noImgMsg.hidden = true;

    if (previewable.includes(file.type)) {
      // Show image thumbnail
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.alt = 'Uploaded design preview';
        previewArea.appendChild(img);

        // Mirror to mockup
        artworkImg.src = e.target.result;
        artworkImg.hidden = false;
        if (artworkPh) artworkPh.style.display = 'none';

        if (artNote) artNote.textContent =
          `Artwork file "${name}" uploaded. We'll use this for your order.`;
      };
      reader.readAsDataURL(file);
    } else {
      // Non-image: show file icon + name
      const icon = document.createElement('div');
      icon.className = 'upload-file-icon';
      icon.textContent = name.split('.').pop().toUpperCase();
      previewArea.appendChild(icon);
      noImgMsg.hidden = false;

      if (artNote) artNote.textContent =
        `File "${name}" noted. After submitting, we may contact you for the final artwork file.`;
    }

    defState.hidden = true;
    doneState.hidden = false;
  }

  // Click to browse
  zone.addEventListener('click', (e) => {
    if (e.target === removeBtn || removeBtn.contains(e.target)) return;
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  // Drag and drop
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
      fileInput.files = e.dataTransfer.files;
      handleFile(file);
    }
  });

  // Remove file
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.value = '';
    previewArea.innerHTML = '';
    fileName.textContent = '';
    noImgMsg.hidden = true;
    defState.hidden = false;
    doneState.hidden = true;
    if (hidFilename) hidFilename.value = '';
    // Reset mockup artwork
    artworkImg.src = '';
    artworkImg.hidden = true;
    if (artworkPh) artworkPh.style.display = '';
    if (artNote) artNote.textContent =
      'After submitting, we may contact you for the final artwork file if needed.';
  });
}

/* ---- 2. SHIRT MOCKUP ---- */
function initMockup() {
  const shirtPath     = document.getElementById('shirt-path');
  const colorBtns     = document.querySelectorAll('.swatch');
  const colorNameEl   = document.getElementById('selected-color-name');
  const locBtns       = document.querySelectorAll('.loc-btn');
  const locLabelChip  = document.getElementById('loc-label-chip');
  const sizeSlider    = document.getElementById('artwork-size');
  const sizeVal       = document.getElementById('size-val');
  const overlay       = document.getElementById('artwork-overlay');
  const artInner      = document.getElementById('artwork-inner');

  if (!shirtPath || !overlay) return;

  // Print location presets (% relative to .mockup-stage)
  // Adjust these values if you replace the shirt SVG with a photo mockup
  const LOCATIONS = {
    'left-chest': { top: '27%', left: '27%', width: '18%', label: 'Left Chest' },
    'full-front':  { top: '27%', left: '21%', width: '56%', label: 'Full Front' },
    'full-back':   { top: '27%', left: '21%', width: '56%', label: 'Full Back (viewing front)' },
    'sleeve':      { top: '23%', left: '10%', width: '19%', label: 'Sleeve' },
  };

  let offsetX = 0, offsetY = 0;
  let currentScale = 1;
  let currentLoc = 'left-chest';

  function applyLocation(loc) {
    const p = LOCATIONS[loc];
    overlay.style.top   = p.top;
    overlay.style.left  = p.left;
    overlay.style.width = p.width;
    if (locLabelChip) locLabelChip.textContent = p.label;
  }

  function applyTransform() {
    overlay.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${currentScale})`;
  }

  // Initial placement
  applyLocation(currentLoc);
  applyTransform();

  // Shirt color
  colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      colorBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      shirtPath.setAttribute('fill', btn.dataset.color);
      if (colorNameEl) colorNameEl.textContent = btn.dataset.name;
    });
  });

  // Print location
  locBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      locBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentLoc = btn.dataset.loc;
      offsetX = 0; offsetY = 0;
      applyLocation(currentLoc);
      applyTransform();
    });
  });

  // Size slider
  if (sizeSlider) {
    sizeSlider.addEventListener('input', () => {
      currentScale = sizeSlider.value / 100;
      if (sizeVal) sizeVal.textContent = sizeSlider.value + '%';
      applyTransform();
    });
  }

  // Position controls (5px per click)
  const STEP = 5;
  document.getElementById('pos-up')   ?.addEventListener('click', () => { offsetY -= STEP; applyTransform(); });
  document.getElementById('pos-down') ?.addEventListener('click', () => { offsetY += STEP; applyTransform(); });
  document.getElementById('pos-left') ?.addEventListener('click', () => { offsetX -= STEP; applyTransform(); });
  document.getElementById('pos-right')?.addEventListener('click', () => { offsetX += STEP; applyTransform(); });
  document.getElementById('pos-reset')?.addEventListener('click', () => {
    offsetX = 0; offsetY = 0;
    currentScale = 1;
    if (sizeSlider) { sizeSlider.value = 100; }
    if (sizeVal) sizeVal.textContent = '100%';
    applyLocation(currentLoc);
    applyTransform();
  });
}

/* ---- 3. LIVE PRICING ---- */
function initPricing() {
  const qtyEl      = document.getElementById('quantity');
  const typeEl     = document.getElementById('shirt-type');
  const inkEl      = document.getElementById('ink-colors');
  const locChecks  = document.querySelectorAll('#print-locations input[type="checkbox"]');

  if (!qtyEl) return;

  const SHIRT_PRICE = { basic:8, premium:12, 'long-sleeve':16, hoodie:28, polo:22, 'customer-supplied':0 };
  const SETUP_FEE   = { '1':35, '2':55, '3':75, '4':100 };
  const LOC_PRICE   = { 'Left Chest':4, 'Full Front':6, 'Full Back':7, 'Sleeve':4 };
  const QTY_DISC    = [
    { min:100, rate:.20, label:'20% qty discount' },
    { min:50,  rate:.15, label:'15% qty discount' },
    { min:24,  rate:.10, label:'10% qty discount' },
    { min:12,  rate:.05, label:'5% qty discount'  },
    { min:1,   rate:0,   label:'' },
  ];

  function fmt(n) { return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  function calc() {
    const qty        = Math.max(1, parseInt(qtyEl.value) || 1);
    const shirtPrice = SHIRT_PRICE[typeEl.value] ?? 8;
    const setupFee   = SETUP_FEE[inkEl.value]    ?? 75;

    // Sum selected location print costs
    let printPerShirt = 0;
    locChecks.forEach(cb => { if (cb.checked) printPerShirt += LOC_PRICE[cb.value] ?? 0; });

    const garmentTotal = qty * shirtPrice;
    const printTotal   = qty * printPerShirt;
    const subtotalRaw  = garmentTotal + printTotal;

    // Discount
    const disc = QTY_DISC.find(d => qty >= d.min) || QTY_DISC[QTY_DISC.length - 1];
    const discAmt = subtotalRaw * disc.rate;
    const subtotal = subtotalRaw - discAmt;
    const total    = subtotal + setupFee;
    const perShirt = qty > 0 ? total / qty : 0;

    // Update DOM
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('p-garment',  fmt(garmentTotal));
    set('p-print',    fmt(printTotal));
    set('p-subtotal', fmt(subtotal));
    set('p-setup',    fmt(setupFee));
    set('p-total',    fmt(total));
    set('p-per-shirt',fmt(perShirt));
    set('qty-badge',  qty + ' shirt' + (qty !== 1 ? 's' : ''));

    const discRow = document.getElementById('discount-row');
    if (discRow) {
      if (disc.rate > 0) {
        discRow.hidden = false;
        set('discount-lbl', disc.label);
        set('p-discount', '−' + fmt(discAmt));
      } else {
        discRow.hidden = true;
      }
    }

    // Update hidden Formspree field
    const hidTotal = document.getElementById('hid-total');
    if (hidTotal) hidTotal.value = fmt(total) + ' (est.)';
  }

  [qtyEl, typeEl, inkEl].forEach(el => el.addEventListener('input', calc));
  locChecks.forEach(cb => cb.addEventListener('change', calc));
  calc(); // run on load
}

/* ---- 4. FORM SYNC (Step 3 → Step 5) ---- */
function initFormSync() {
  // Pairs: [sourceId, targetId]
  const pairs = [
    ['contact-name',   'sub-name'],
    ['business-name',  'sub-business'],
    ['contact-email',  'sub-email'],
    ['contact-phone',  'sub-phone'],
    ['project-notes',  'sub-notes'],
  ];

  pairs.forEach(([srcId, tgtId]) => {
    const src = document.getElementById(srcId);
    const tgt = document.getElementById(tgtId);
    if (!src || !tgt) return;
    src.addEventListener('input', () => { tgt.value = src.value; });
  });

  // On submit: populate hidden order fields + build summary
  const form = document.getElementById('quote-submit-form');
  if (form) {
    form.addEventListener('submit', () => {
      const qtyEl   = document.getElementById('quantity');
      const typeEl  = document.getElementById('shirt-type');
      const colorEl = document.getElementById('shirt-color-order');
      const inkEl   = document.getElementById('ink-colors');
      const dlEl    = document.getElementById('deadline');
      const locs    = [...document.querySelectorAll('#print-locations input:checked')].map(c => c.value);

      const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
      set('hid-quantity',    qtyEl?.value || '');
      set('hid-shirt-type',  typeEl?.options[typeEl.selectedIndex]?.text || '');
      set('hid-shirt-color', colorEl?.value || '');
      set('hid-locations',   locs.join(', '));
      set('hid-ink-colors',  inkEl?.options[inkEl.selectedIndex]?.text || '');
      set('hid-deadline',    dlEl?.value || '');
    });
  }
}

/* ---- 5. ORDER SUMMARY (live update on scroll/input) ---- */
function buildSummary() {
  const rows = document.getElementById('summary-rows');
  if (!rows) return;

  const qty    = document.getElementById('quantity')?.value || '—';
  const type   = document.getElementById('shirt-type');
  const color  = document.getElementById('shirt-color-order')?.value || '—';
  const ink    = document.getElementById('ink-colors');
  const locs   = [...document.querySelectorAll('#print-locations input:checked')].map(c => c.value);
  const dl     = document.getElementById('deadline')?.value || '—';
  const total  = document.getElementById('p-total')?.textContent || '—';
  const per    = document.getElementById('p-per-shirt')?.textContent || '—';
  const fname  = document.getElementById('hid-filename')?.value || 'Not uploaded';

  const typeText = type?.options[type.selectedIndex]?.text.split(' (')[0] || '—';
  const inkText  = ink?.options[ink.selectedIndex]?.text.split(' (')[0] || '—';

  rows.innerHTML = [
    ['Quantity',       qty + ' shirts'],
    ['Shirt Type',     typeText],
    ['Shirt Color',    color],
    ['Print Locations',locs.length ? locs.join(', ') : '—'],
    ['Ink Colors',     inkText],
    ['Need By',        dl],
    ['Artwork File',   fname],
    ['Est. Total',     total, true],
    ['Est. Per Shirt', per],
  ].map(([label, val, highlight]) => `
    <div class="summary-row ${highlight ? 'total-highlight' : ''}">
      <span class="sum-label">${label}</span>
      <span class="sum-val">${val}</span>
    </div>
  `).join('');
}

/* ---- 6. SCROLL STEP ACTIVATION ---- */
function initScrollSteps() {
  const sections = document.querySelectorAll('[data-order-step]');
  const stepDots = document.querySelectorAll('.progress-step');

  // Build summary when user scrolls to Step 5
  const submitSection = document.getElementById('step-submit');

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const step = parseInt(entry.target.dataset.orderStep);
        stepDots.forEach(dot => {
          const n = parseInt(dot.dataset.step);
          dot.classList.toggle('active', n === step);
          dot.classList.toggle('done', n < step);
        });
        if (entry.target === submitSection) buildSummary();
      }
    });
  }, { threshold: 0.25 });

  sections.forEach(s => obs.observe(s));
}

/* ---- 7. SCROLL REVEAL ---- */
function initScrollReveal() {
  const els = document.querySelectorAll('.reveal');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach(el => obs.observe(el));
}
