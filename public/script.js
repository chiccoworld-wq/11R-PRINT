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
  function isMobile() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 1024;
  }

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
     Desktop: drives video.currentTime via scroll (Apple-style).
     Mobile:  iOS ignores preload and blocks scrubbing without gesture,
              so we fall back to muted autoplay loop instead.          */
  const vid         = document.getElementById('section-video');
  const progressBar = document.getElementById('video-progress-bar');
  const scrollHint  = document.getElementById('video-scroll-hint');
  const vidSection  = document.getElementById('video');

  if (vid && vidSection) {
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
                   || ('ontouchstart' in window && window.innerWidth < 1024);

    if (isMobile) {
      /* Mobile: autoplay/loop/muted/playsinline are already set as HTML attributes.
         Force play here too in case the browser deferred it. */
      vid.muted = true;
      const tryPlay = () => vid.play().catch(() => {});
      tryPlay();
      /* Retry once after user interacts, in case the browser initially blocked it */
      document.addEventListener('touchstart', tryPlay, { once: true });
      if (progressBar) progressBar.style.display = 'none';
      if (scrollHint)  scrollHint.style.display  = 'none';
    } else {
      /* Desktop: scroll-scrub — pause autoplay and take over with currentTime */
      vid.removeAttribute('autoplay');
      vid.removeAttribute('loop');
      vid.pause();
      function initScrub() {
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
      }

      /* If metadata already loaded (cached), init immediately */
      if (vid.readyState >= 1) {
        initScrub();
      } else {
        vid.addEventListener('loadedmetadata', initScrub);
        vid.load();
      }
    }

    vid.addEventListener('error', () => {
      console.warn('11R video could not load:', vid.src);
    });
  }

  /* ---- SHOWCASE 3D TILT ---- */
  const tiltEl = document.getElementById('showcase-tilt');
  if (tiltEl) {
    const section = tiltEl.closest('.showcase-section');
    let rafId = null;
    let targetX = 0, targetY = 0, curX = 0, curY = 0;

    section.addEventListener('mousemove', (e) => {
      const rect = section.getBoundingClientRect();
      const dx = (e.clientX - rect.left - rect.width  / 2) / (rect.width  / 2);
      const dy = (e.clientY - rect.top  - rect.height / 2) / (rect.height / 2);
      targetX = dy * -7;
      targetY = dx *  9;
      if (!rafId) rafId = requestAnimationFrame(smoothTilt);
    }, { passive: true });

    section.addEventListener('mouseleave', () => {
      targetX = 0; targetY = 0;
    });

    function smoothTilt() {
      curX += (targetX - curX) * 0.1;
      curY += (targetY - curY) * 0.1;
      tiltEl.style.transform = `perspective(900px) rotateX(${curX}deg) rotateY(${curY}deg)`;
      if (Math.abs(targetX - curX) > 0.05 || Math.abs(targetY - curY) > 0.05) {
        rafId = requestAnimationFrame(smoothTilt);
      } else {
        rafId = null;
      }
    }
  }

})();

/* ================================================================
   CUSTOM ORDER BUILDER
   State-driven apparel mockup system with Fabric.js canvas
================================================================ */

/* ---- PRODUCT DATA ---- */
const PRODUCTS = [
  { id: 'basic-tee',   name: 'Basic T-Shirt',  basePrice: 8,  description: 'Everyday comfort for crews, events, and work orders.' },
  { id: 'premium-tee', name: 'Premium T-Shirt', basePrice: 12, description: 'Softer hand feel, better drape, stronger color vibrancy.' },
  { id: 'hoodie',      name: 'Hoodie',           basePrice: 28, description: 'Pullover hoodies with bold graphics built for real wear.' },
  { id: 'long-sleeve', name: 'Long Sleeve',      basePrice: 16, description: 'Work shirts and athletic cuts with full-sleeve print capability.' },
  { id: 'polo',        name: 'Polo',              basePrice: 22, description: 'Corporate uniforms and left-chest logos on clean polos.' },
];

const COLORS = [
  { name: 'Black',         hex: '#111111' },
  { name: 'White',         hex: '#f0f0ee', border: true },
  { name: 'Gray',          hex: '#7a7a7a' },
  { name: 'Navy',          hex: '#1a2c5b' },
  { name: 'Red',           hex: '#c0392b' },
  { name: 'Safety Green',  hex: '#00a651' },
  { name: 'Safety Orange', hex: '#ff5f00' },
];

const LOCATIONS = {
  'left-chest': { label: 'Left Chest', fee: 2, box: { left:148, top:184, width:90, height:80 }, center: { x:193, y:224 } },
  'full-front': { label: 'Full Front', fee: 3, box: { left:128, top:184, width:244, height:210 }, center: { x:250, y:289 } },
  'full-back':  { label: 'Full Back',  fee: 4, box: { left:118, top:182, width:264, height:218 }, center: { x:250, y:291 } },
  'sleeve':     { label: 'Sleeve',     fee: 2, box: { left: 57, top:128, width: 72, height: 54 }, center: { x: 93, y:155 } },
};

const SETUP_FEES  = { '1':35, '2':55, '3':75, '4':100 };
const INK_FEE_PER = { '1':0.50, '2':1.00, '3':1.75, '4':2.50 };
const QTY_DISCOUNTS = [
  { min:100, rate:0.15, label:'15% qty discount' },
  { min: 50, rate:0.10, label:'10% qty discount' },
  { min: 24, rate:0.05, label: '5% qty discount' },
  { min:  1, rate:0,    label:'' },
];

/* ---- STATE ---- */
const orderState = {
  product: null,
  shirtColor: '#111111', shirtColorName: 'Black',
  mockupSide: 'front', printLocation: 'left-chest',
  artworkFileName: null, artworkType: null,
  quantity: 24,
  sizes: { S:0, M:0, L:0, XL:0, '2XL':0, '3XL':0 },
  inkColors: 3,
  placement: { x:0, y:0, scaleX:1, scaleY:1, angle:0, width:0, height:0 },
  estimate: { perShirt:0, total:0, setup:0 },
  previewImage: null,
  name:'', email:'', phone:'', company:'', notes:'', deadline:'',
};

/* ---- CANVAS GLOBALS ---- */
const CW = 500, CH = 580;
let fCanvas = null, shirtShape = null, printZone = null, artLayer = null;
let builderInited = false;

const SHIRT_PATH = 'M 108 46 L 44 100 L 82 122 L 68 396 L 332 396 L 318 122 L 356 100 L 292 46 C 276 70 242 82 200 82 C 158 82 124 70 108 46 Z';

/* ---- BOOT ---- */
if (document.querySelector('.order-page')) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootBuilder);
  } else {
    bootBuilder();
  }
}

function bootBuilder() {
  renderProductCards();
  document.addEventListener('click', onProductSelect);
  document.getElementById('btb-back')?.addEventListener('click', () => {
    document.getElementById('builder-screen').hidden = true;
    document.getElementById('ps-screen').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ================================================================
   PRODUCT CARDS
================================================================ */
function renderProductCards() {
  const grid = document.getElementById('product-cards-grid');
  if (!grid) return;
  grid.innerHTML = PRODUCTS.map(p => {
    const svgBody = p.id === 'hoodie'
      ? `<path d="M 108 46 L 44 100 L 82 140 L 68 416 L 332 416 L 318 140 L 356 100 L 292 46 C 276 75 242 90 200 90 C 158 90 124 75 108 46 Z M 172 52 Q 200 76 228 52" fill="#222" stroke="#333" stroke-width="1"/>`
      : p.id === 'long-sleeve'
      ? `<path d="M 108 46 L 20 130 L 52 150 L 68 396 L 332 396 L 348 150 L 380 130 L 292 46 C 276 70 242 82 200 82 C 158 82 124 70 108 46 Z" fill="#222"/>`
      : p.id === 'polo'
      ? `<path d="M 108 46 L 44 100 L 82 122 L 68 396 L 332 396 L 318 122 L 356 100 L 292 46 C 280 60 262 68 240 71 L 225 54 L 200 68 L 175 54 L 160 71 C 138 68 120 60 108 46 Z" fill="#222"/>`
      : `<path d="M 108 46 L 44 100 L 82 122 L 68 396 L 332 396 L 318 122 L 356 100 L 292 46 C 276 70 242 82 200 82 C 158 82 124 70 108 46 Z" fill="#222"/>`;

    return `<div class="pcard" data-product-id="${p.id}">
      <div class="pcard-mock">
        <div class="pcard-shirt-preview">
          <svg class="pcard-svg" viewBox="0 0 400 440" xmlns="http://www.w3.org/2000/svg">${svgBody}</svg>
        </div>
        <div class="pcard-method-tag">Screen Printing</div>
      </div>
      <div class="pcard-info">
        <h3>${p.name}</h3>
        <p>${p.description}</p>
        <div class="pcard-footer">
          <span class="pcard-price">from $${p.basePrice.toFixed(2)}/shirt</span>
          <button class="pcard-btn" data-product-id="${p.id}">Select →</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function onProductSelect(e) {
  const btn = e.target.closest('[data-product-id]');
  if (!btn) return;
  const product = PRODUCTS.find(p => p.id === btn.dataset.productId);
  if (!product) return;
  orderState.product = product;

  document.getElementById('btb-product-name').textContent = product.name;
  document.getElementById('bpn-product-name').textContent = product.name;
  document.getElementById('bpn-product-price').textContent = `from $${product.basePrice.toFixed(2)}/shirt`;

  document.getElementById('ps-screen').hidden = true;
  document.getElementById('builder-screen').hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (!builderInited) {
    builderInited = true;
    // Wait one frame so Fabric.js canvas element is visible before init
    requestAnimationFrame(() => {
      initFabricCanvas();
      initColorPicker();
      initViewToggle();
      initLocationBtns();
      initUploadTool();
      initArtControls();
      initTextTool();
      initNameNumTool();
      initShapes();
      initOrderInputs();
      initMobilePanel();
      initBuilderActions();
      initFormSubmit();
      updateEstimate();
    });
  } else {
    updateEstimate();
  }
}

/* ================================================================
   FABRIC.JS CANVAS
================================================================ */
function initFabricCanvas() {
  fCanvas = new fabric.Canvas('c', {
    width: CW, height: CH,
    backgroundColor: '#181a18',
    selection: true,
    preserveObjectStacking: true,
  });

  drawShirt(orderState.shirtColor);
  updatePrintZone(orderState.printLocation);

  fCanvas.on('object:modified', (e) => { if (isArtObj(e.target)) saveArtPlacement(e.target); });
  fCanvas.on('object:moving',   (e) => { if (isArtObj(e.target)) saveArtPlacement(e.target); });

  responsiveCanvas();
  window.addEventListener('resize', responsiveCanvas);
}

function isArtObj(obj) { return obj && obj.name !== 'shirt' && obj.name !== 'printZone'; }

function drawShirt(hex) {
  if (shirtShape) { fCanvas.remove(shirtShape); shirtShape = null; }

  const isWhite = hex === '#f0f0ee';
  fCanvas.backgroundColor = isWhite ? '#d8d8d8' : '#181a18';

  const path = new fabric.Path(SHIRT_PATH, {
    name: 'shirt', fill: hex,
    stroke: isWhite ? '#bbb' : 'transparent', strokeWidth: isWhite ? 0.5 : 0,
    selectable: false, evented: false,
    left: 55, top: 71, scaleX: 1.25, scaleY: 1.25,
    originX: 'left', originY: 'top',
    shadow: new fabric.Shadow({ color:'rgba(0,0,0,0.3)', blur:32, offsetX:3, offsetY:10 }),
  });

  fCanvas.add(path);
  shirtShape = path;
  fCanvas.sendToBack(shirtShape);
  if (printZone) fCanvas.bringForward(printZone);
  if (artLayer)  fCanvas.bringToFront(artLayer);
  fCanvas.renderAll();
}

function updatePrintZone(loc) {
  if (printZone) { fCanvas.remove(printZone); printZone = null; }
  const cfg = LOCATIONS[loc];
  if (!cfg) return;

  printZone = new fabric.Rect({
    name: 'printZone',
    left: cfg.box.left, top: cfg.box.top,
    width: cfg.box.width, height: cfg.box.height,
    fill: 'transparent',
    stroke: 'rgba(32,255,123,0.45)', strokeWidth: 1.5,
    strokeDashArray: [5, 4],
    selectable: false, evented: false, rx: 2, ry: 2,
  });

  fCanvas.add(printZone);
  if (artLayer) fCanvas.bringToFront(artLayer);
  fCanvas.renderAll();
  orderState.printLocation = loc;
}

function saveArtPlacement(obj) {
  if (!obj) return;
  orderState.placement = { x:obj.left, y:obj.top, scaleX:obj.scaleX, scaleY:obj.scaleY, angle:obj.angle, width:obj.width, height:obj.height };
}

function responsiveCanvas() {
  const wrap = document.getElementById('canvas-outer-wrap');
  if (!wrap || !fCanvas) return;
  const maxW = Math.min(wrap.clientWidth || CW, CW);
  const scale = maxW / CW;
  const inner = wrap.querySelector('.canvas-container');
  if (inner) {
    inner.style.transform = `scale(${scale})`;
    inner.style.transformOrigin = 'top left';
    wrap.style.height = (CH * scale) + 'px';
  }
}

/* ================================================================
   COLOR PICKER
================================================================ */
function initColorPicker() {
  const container = document.getElementById('bpn-swatches');
  if (!container) return;

  container.innerHTML = COLORS.map((c, i) => `
    <button class="bpn-swatch${i===0?' active':''}"
      data-hex="${c.hex}" data-name="${c.name}"
      style="background:${c.hex};${c.border?'outline:1px solid #777;':''}"
      title="${c.name}"></button>
  `).join('');

  container.addEventListener('click', (e) => {
    const sw = e.target.closest('.bpn-swatch');
    if (!sw) return;
    container.querySelectorAll('.bpn-swatch').forEach(b => b.classList.remove('active'));
    sw.classList.add('active');
    orderState.shirtColor = sw.dataset.hex;
    orderState.shirtColorName = sw.dataset.name;
    drawShirt(sw.dataset.hex);
    document.getElementById('bpn-color-name').textContent = sw.dataset.name;
    updateEstimate();
  });
}

/* ================================================================
   VIEW TOGGLE
================================================================ */
function initViewToggle() {
  document.querySelectorAll('.bpn-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.bpn-view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      orderState.mockupSide = btn.dataset.side;
    });
  });
}

/* ================================================================
   LOCATION BUTTONS
================================================================ */
function initLocationBtns() {
  const grid = document.getElementById('bpn-loc-grid');
  if (!grid) return;
  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('.bpn-loc-btn');
    if (!btn) return;
    grid.querySelectorAll('.bpn-loc-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const loc = btn.dataset.loc;
    updatePrintZone(loc);
    if (artLayer) {
      const cfg = LOCATIONS[loc];
      artLayer.set({ left: cfg.center.x, top: cfg.center.y });
      artLayer.setCoords();
      fCanvas.renderAll();
      saveArtPlacement(artLayer);
    }
    updateEstimate();
  });
}

/* ================================================================
   ARTWORK UPLOAD
================================================================ */
function initUploadTool() {
  const zone      = document.getElementById('bpn-upload');
  const fileInput = document.getElementById('bpn-file');
  const defEl     = document.getElementById('bpu-default');
  const doneEl    = document.getElementById('bpu-done');
  const thumbEl   = document.getElementById('bpu-thumb');
  const nameEl    = document.getElementById('bpu-name');
  const removeBtn = document.getElementById('bpu-remove');
  const pdfNote   = document.getElementById('bpu-pdf-note');
  if (!zone || !fileInput) return;

  zone.addEventListener('click', (e) => {
    if (removeBtn && (e.target === removeBtn || removeBtn.contains(e.target))) return;
    fileInput.click();
  });
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault(); zone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });
  removeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearArtwork();
    fileInput.value = '';
    thumbEl.innerHTML = ''; nameEl.textContent = '';
    defEl.hidden = false; doneEl.hidden = true;
    if (pdfNote) pdfNote.hidden = true;
    orderState.artworkFileName = null; orderState.artworkType = null;
  });

  function handleFile(file) {
    const isPDF  = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImg  = ['image/png','image/jpeg','image/svg+xml'].includes(file.type);
    orderState.artworkFileName = file.name;
    orderState.artworkType = isPDF ? 'pdf' : file.type;
    nameEl.textContent = file.name;
    defEl.hidden = true; doneEl.hidden = false;
    if (pdfNote) pdfNote.hidden = !isPDF;

    if (isPDF) {
      thumbEl.innerHTML = `<div class="bpu-filetype">PDF</div>`;
      return;
    }
    if (!isImg) {
      thumbEl.innerHTML = `<div class="bpu-filetype">${file.name.split('.').pop().toUpperCase()}</div>`;
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      thumbEl.innerHTML = `<img src="${ev.target.result}" alt="Preview" />`;
      addImageToCanvas(ev.target.result);
    };
    reader.readAsDataURL(file);
  }
}

function addImageToCanvas(dataUrl) {
  clearArtwork();
  const loc = LOCATIONS[orderState.printLocation];
  fabric.Image.fromURL(dataUrl, (img) => {
    const maxW = loc.box.width * 0.88;
    const maxH = loc.box.height * 0.88;
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    img.set({
      name: 'artwork', left: loc.center.x, top: loc.center.y,
      scaleX: scale, scaleY: scale,
      originX: 'center', originY: 'center',
      cornerStyle: 'circle', cornerColor: '#20ff7b',
      cornerStrokeColor: '#20ff7b', borderColor: '#20ff7b',
      transparentCorners: false, cornerSize: 10,
    });
    fCanvas.add(img);
    fCanvas.setActiveObject(img);
    artLayer = img;
    saveArtPlacement(img);
    fCanvas.renderAll();
  });
}

function clearArtwork() {
  fCanvas.getObjects().filter(o => o.name === 'artwork').forEach(o => fCanvas.remove(o));
  if (artLayer && artLayer.name === 'artwork') artLayer = null;
  fCanvas.renderAll();
}

/* ================================================================
   ARTWORK CONTROLS
================================================================ */
function initArtControls() {
  const SCALE_STEP = 0.08, ROT_STEP = 15;
  const getObj = () => fCanvas.getActiveObject() || artLayer;

  const act = (id, fn) => document.getElementById(id)?.addEventListener('click', () => {
    const obj = getObj(); if (!obj || !isArtObj(obj)) return;
    fn(obj); obj.setCoords?.(); fCanvas.renderAll(); saveArtPlacement(obj);
  });

  const loc = () => LOCATIONS[orderState.printLocation];

  act('btn-center', (o) => { const l = loc(); o.set({ left: l.center.x, top: l.center.y, originX:'center', originY:'center' }); });
  act('btn-bigger', (o) => o.set({ scaleX: o.scaleX + SCALE_STEP, scaleY: o.scaleY + SCALE_STEP }));
  act('btn-smaller', (o) => { const s = Math.max(0.04, o.scaleX - SCALE_STEP); o.set({ scaleX: s, scaleY: s }); });
  act('btn-rot-l', (o) => o.set({ angle: ((o.angle || 0) - ROT_STEP + 360) % 360 }));
  act('btn-rot-r', (o) => o.set({ angle: ((o.angle || 0) + ROT_STEP) % 360 }));
  act('btn-reset', (o) => {
    const l = loc();
    const maxW = l.box.width * 0.88, maxH = l.box.height * 0.88;
    const base = o.width ? Math.min(maxW / o.width, maxH / o.height, 1) : 1;
    o.set({ left: l.center.x, top: l.center.y, scaleX: base, scaleY: base, angle: 0, originX:'center', originY:'center' });
  });

  document.getElementById('btn-del-art')?.addEventListener('click', () => {
    const obj = fCanvas.getActiveObject() || artLayer;
    if (obj && isArtObj(obj)) { fCanvas.remove(obj); if (obj === artLayer) artLayer = null; fCanvas.renderAll(); }
  });
}

/* ================================================================
   TEXT TOOL
================================================================ */
function initTextTool() {
  document.getElementById('btn-add-text')?.addEventListener('click', () => {
    const val   = (document.getElementById('bpn-text-inp')?.value?.trim()) || 'Your Text';
    const size  = parseInt(document.getElementById('bpn-font-size')?.value || '32');
    const color = document.getElementById('bpn-text-color')?.value || '#ffffff';
    const bold  = document.getElementById('bpn-bold')?.checked;
    const l     = LOCATIONS[orderState.printLocation];

    const t = new fabric.IText(val, {
      name:'artwork', left: l.center.x, top: l.center.y,
      originX:'center', originY:'center',
      fontSize: size, fill: color,
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontWeight: bold ? 'bold' : 'normal',
      cornerStyle:'circle', cornerColor:'#20ff7b',
      cornerStrokeColor:'#20ff7b', borderColor:'#20ff7b',
      transparentCorners: false, cornerSize: 10,
    });
    fCanvas.add(t); fCanvas.setActiveObject(t); artLayer = t; fCanvas.renderAll();
  });
}

/* ================================================================
   NAME / NUMBER TOOL
================================================================ */
function initNameNumTool() {
  document.getElementById('btn-add-nn')?.addEventListener('click', () => {
    const name   = document.getElementById('bpn-nn-name')?.value?.trim() || '';
    const number = document.getElementById('bpn-nn-num')?.value?.trim() || '';
    if (!name && !number) return;
    const combined = [name, number ? `#${number}` : ''].filter(Boolean).join(' ');
    const l = LOCATIONS[orderState.printLocation];
    const t = new fabric.IText(combined, {
      name:'artwork', left: l.center.x, top: l.center.y + 40,
      originX:'center', originY:'center',
      fontSize: 28, fill: '#ffffff',
      fontFamily: 'Arial Black, Helvetica, sans-serif', fontWeight: 'bold',
      cornerStyle:'circle', cornerColor:'#20ff7b',
      cornerStrokeColor:'#20ff7b', borderColor:'#20ff7b',
      transparentCorners: false, cornerSize: 10,
    });
    fCanvas.add(t); fCanvas.setActiveObject(t); fCanvas.renderAll();
  });
}

/* ================================================================
   SHAPES
================================================================ */
function initShapes() {
  document.querySelectorAll('.bpn-shape').forEach(btn => {
    btn.addEventListener('click', () => {
      const shape = btn.dataset.shape;
      const l = LOCATIONS[orderState.printLocation];
      const baseOpts = {
        name:'artwork', left: l.center.x, top: l.center.y,
        originX:'center', originY:'center',
        cornerStyle:'circle', cornerColor:'#20ff7b',
        cornerStrokeColor:'#20ff7b', borderColor:'#20ff7b',
        transparentCorners: false, cornerSize: 10,
      };
      let obj;
      if (shape === 'star')   obj = new fabric.IText('★', { ...baseOpts, fontSize:64, fill:'#20ff7b', fontFamily:'Arial' });
      if (shape === 'circle') obj = new fabric.Circle({ ...baseOpts, radius:36, fill:'transparent', stroke:'#20ff7b', strokeWidth:3 });
      if (shape === 'badge')  obj = new fabric.IText('◈', { ...baseOpts, fontSize:64, fill:'#20ff7b', fontFamily:'Arial' });
      if (shape === '11r')    obj = new fabric.IText('11R', { ...baseOpts, fontSize:52, fill:'#20ff7b', fontFamily:'Arial Black, Helvetica', fontWeight:'bold' });
      if (obj) { fCanvas.add(obj); fCanvas.setActiveObject(obj); fCanvas.renderAll(); }
    });
  });
}

/* ================================================================
   ORDER INPUTS
================================================================ */
function initOrderInputs() {
  document.querySelectorAll('.sz-qty').forEach(inp => {
    inp.addEventListener('input', () => {
      orderState.sizes[inp.dataset.size] = parseInt(inp.value) || 0;
      const total = Object.values(orderState.sizes).reduce((a,b)=>a+b,0);
      if (total > 0) {
        const qi = document.getElementById('inp-quantity');
        if (qi) qi.value = total;
        orderState.quantity = total;
        const note = document.getElementById('qty-auto-note');
        if (note) note.textContent = `Auto: ${total} shirts total`;
      }
      updateEstimate();
    });
  });

  const qtyEl = document.getElementById('inp-quantity');
  qtyEl?.addEventListener('input', () => { orderState.quantity = Math.max(1, parseInt(qtyEl.value)||1); updateEstimate(); });

  document.getElementById('inp-ink-colors')?.addEventListener('change', (e) => { orderState.inkColors = parseInt(e.target.value)||3; updateEstimate(); });
  document.getElementById('inp-deadline')?.addEventListener('change', (e) => { orderState.deadline = e.target.value; });
  document.getElementById('inp-notes')?.addEventListener('input', (e) => { orderState.notes = e.target.value; });
  ['name','email','phone','company'].forEach(f => {
    document.getElementById(`inp-${f}`)?.addEventListener('input', (e) => { orderState[f] = e.target.value; });
  });
}

/* ================================================================
   ESTIMATE
================================================================ */
function calculateEstimate() {
  if (!orderState.product) return { garment:0, print:0, discount:0, setup:0, total:0, perShirt:0, discLabel:'' };
  const qty      = Math.max(1, orderState.quantity);
  const locFee   = LOCATIONS[orderState.printLocation]?.fee || 3;
  const inkFee   = INK_FEE_PER[String(orderState.inkColors)] || 1.75;
  const setupFee = SETUP_FEES[String(orderState.inkColors)] || 75;
  const garment  = orderState.product.basePrice * qty;
  const print    = (locFee + inkFee) * qty;
  const raw      = garment + print;
  const disc     = QTY_DISCOUNTS.find(d => qty >= d.min) || QTY_DISCOUNTS[QTY_DISCOUNTS.length-1];
  const discAmt  = raw * disc.rate;
  const subtotal = raw - discAmt;
  const total    = subtotal + setupFee;
  return { garment, print, discount:discAmt, setup:setupFee, total, perShirt: total/qty, discLabel: disc.label };
}

function updateEstimate() {
  const est = calculateEstimate();
  orderState.estimate = est;
  const fmt = (n) => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const loc = LOCATIONS[orderState.printLocation]?.label || '—';
  const ik  = String(orderState.inkColors);

  const rows = document.getElementById('est-rows');
  if (rows && orderState.product) {
    rows.innerHTML = `
      <div class="est-row"><span>${orderState.product.name} × ${orderState.quantity}</span><span>${fmt(est.garment)}</span></div>
      <div class="est-row"><span>Print — ${loc}</span><span>${fmt(est.print)}</span></div>
      ${est.discount > 0 ? `<div class="est-row est-disc"><span>${est.discLabel}</span><span>−${fmt(est.discount)}</span></div>` : ''}
      <div class="est-row"><span>Setup (${ik} color${orderState.inkColors>1?'s':''})</span><span>${fmt(est.setup)}</span></div>
    `;
  }
  const te = document.getElementById('est-total');
  const pe = document.getElementById('est-per');
  if (te) te.textContent = fmt(est.total);
  if (pe) pe.textContent = fmt(est.perShirt);
}

/* ================================================================
   MOBILE PANEL SWITCHER
================================================================ */
function initMobilePanel() {
  const panels = { left: 'bld-left', canvas: 'bld-center', right: 'bld-right', quote: 'bld-right' };

  function switchPanel(key) {
    if (window.innerWidth > 900) return;
    ['bld-left','bld-center','bld-right'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('mobile-hidden');
    });
    const target = document.getElementById(panels[key] || 'bld-left');
    if (target) target.classList.remove('mobile-hidden');
    if (key === 'quote') {
      document.getElementById('quote-section')?.scrollIntoView({ behavior:'smooth' });
    }
    responsiveCanvas();
  }

  document.querySelectorAll('.bmt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.bmt-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.bst').forEach((b,i) => {
        if (b.dataset.bpanel === btn.dataset.bpanel) b.classList.add('active');
        else b.classList.remove('active');
      });
      switchPanel(btn.dataset.bpanel);
    });
  });

  document.querySelectorAll('.bst').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.bst').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.bmt-btn').forEach(b => {
        if (b.dataset.bpanel === btn.dataset.bpanel) b.classList.add('active');
        else b.classList.remove('active');
      });
      switchPanel(btn.dataset.bpanel);
    });
  });

  // On resize: restore desktop layout
  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) {
      ['bld-left','bld-center','bld-right'].forEach(id => {
        document.getElementById(id)?.classList.remove('mobile-hidden');
      });
    }
  });
}

/* ================================================================
   BUILDER TOP-BAR ACTIONS
================================================================ */
function initBuilderActions() {
  document.getElementById('btb-export')?.addEventListener('click', exportPreview);
  document.getElementById('btb-quote')?.addEventListener('click', () => {
    document.getElementById('quote-section')?.scrollIntoView({ behavior:'smooth' });
    if (window.innerWidth <= 900) {
      document.querySelectorAll('.bmt-btn').forEach(b => b.classList.toggle('active', b.dataset.bpanel === 'quote'));
      document.querySelectorAll('.bst').forEach(b => b.classList.toggle('active', b.dataset.bpanel === 'quote'));
      ['bld-left','bld-center'].forEach(id => document.getElementById(id)?.classList.add('mobile-hidden'));
      document.getElementById('bld-right')?.classList.remove('mobile-hidden');
    }
  });
}

function exportPreview() {
  if (!fCanvas) return null;
  const dataUrl = fCanvas.toDataURL({ format:'png', multiplier:2 });
  orderState.previewImage = dataUrl;
  const a = document.createElement('a');
  a.href = dataUrl; a.download = '11r-print-mockup.png'; a.click();
  return dataUrl;
}

/* ================================================================
   FORM SUBMIT
================================================================ */
function initFormSubmit() {
  document.getElementById('bpn-submit')?.addEventListener('click', submitQuote);
}

async function submitQuote() {
  const name  = document.getElementById('inp-name')?.value?.trim();
  const email = document.getElementById('inp-email')?.value?.trim();
  const phone = document.getElementById('inp-phone')?.value?.trim();
  if (!name)           { alert('Please enter your name.'); return; }
  if (!email && !phone){ alert('Please enter an email or phone number.'); return; }
  if (!orderState.product){ alert('Please select a product first.'); return; }

  const est = calculateEstimate();
  const fmt = (n) => '$' + n.toFixed(2);
  const loc = LOCATIONS[orderState.printLocation]?.label || '—';

  const quoteObj = {
    customer:  { name, email:email||'', phone:phone||'', company: document.getElementById('inp-company')?.value?.trim()||'' },
    order: {
      product: orderState.product.name,
      shirtColor: orderState.shirtColorName,
      printLocation: loc,
      inkColors: orderState.inkColors,
      quantity: orderState.quantity,
      sizes: orderState.sizes,
      deadline: document.getElementById('inp-deadline')?.value||'',
      notes: document.getElementById('inp-notes')?.value?.trim()||'',
      artworkFileName: orderState.artworkFileName||'None',
      artworkType: orderState.artworkType||'None',
      placement: orderState.placement,
    },
    estimate: { total:fmt(est.total), perShirt:fmt(est.perShirt), setup:fmt(est.setup) },
    submittedAt: new Date().toISOString(),
  };

  console.log('11R Print Quote Request:', quoteObj);

  const fd = new FormData();
  fd.append('name', name);
  fd.append('email', email||'');
  fd.append('phone', phone||'');
  fd.append('company', quoteObj.customer.company);
  fd.append('product', quoteObj.order.product);
  fd.append('shirt_color', quoteObj.order.shirtColor);
  fd.append('print_location', quoteObj.order.printLocation);
  fd.append('ink_colors', quoteObj.order.inkColors);
  fd.append('quantity', quoteObj.order.quantity);
  fd.append('sizes', JSON.stringify(quoteObj.order.sizes));
  fd.append('deadline', quoteObj.order.deadline);
  fd.append('notes', quoteObj.order.notes);
  fd.append('artwork_filename', quoteObj.order.artworkFileName);
  fd.append('estimated_total', quoteObj.estimate.total);
  fd.append('estimated_per_shirt', quoteObj.estimate.perShirt);
  fd.append('_subject', `New Custom Order — 11R Print — ${name}`);

  const submitBtn = document.getElementById('bpn-submit');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending...'; }

  try {
    const resp = await fetch('https://formspree.io/f/xykabbqe', {
      method: 'POST', body: fd, headers: { Accept: 'application/json' },
    });
    if (resp.ok) showSuccess();
    else { alert('There was a problem sending your request. Please try again or email us directly.'); }
  } catch {
    showSuccess(); // Show success — data is logged to console
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Send Quote Request →'; }
  }
}

function showSuccess() {
  document.getElementById('quote-section').hidden = true;
  document.getElementById('bpn-success').hidden = false;
  document.getElementById('bpn-success').scrollIntoView({ behavior:'smooth' });
}

/* ---- LEGACY STUBS (keep so old HTML refs don't throw) ---- */
function initUpload() {}
function initMockup() {}
function initPricing() {}
function initFormSync() {}
function initScrollSteps() {}
function initScrollReveal() {
  // keep existing .reveal scroll reveal
  const els = document.querySelectorAll('.reveal');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  els.forEach(el => obs.observe(el));
}

/* ---- UNUSED FROM OLD PAGE — keep ---- */
function initOrderPage() {
  initUpload(); initMockup(); initPricing(); initFormSync(); initScrollSteps(); initScrollReveal();
}

