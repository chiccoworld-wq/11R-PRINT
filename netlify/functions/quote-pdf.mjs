import { generate } from '@pdfme/generator';
import { text, image, table, line, rectangle } from '@pdfme/schemas';
import { BLANK_PDF } from '@pdfme/common';

// Module-level cache — reused across warm Lambda invocations
let _font = null;
let _logo = null;

async function getFont() {
  if (_font) return _font;
  const r = await fetch(
    'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans@5/files/noto-sans-latin-400-normal.woff2'
  );
  if (!r.ok) throw new Error('Font fetch failed');
  _font = new Uint8Array(await r.arrayBuffer());
  return _font;
}

async function getLogo() {
  if (_logo) return _logo;
  try {
    const r = await fetch('https://11rprint.com/images/11R%20VECTOR%20FINAL%20SVG.png');
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    _logo = `data:image/png;base64,${Buffer.from(buf).toString('base64')}`;
  } catch (_) {
    _logo = null;
  }
  return _logo;
}

function fmt(n) {
  const num = parseFloat(n) || 0;
  return '$' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtDate(d) {
  return new Date(d || Date.now()).toLocaleDateString('en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export const handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: corsHeaders, body: 'Bad JSON' }; }

  const {
    customer_name = '', customer_email = '', customer_phone = '',
    customer_company = '', product = '', shirt_color = '',
    print_location = '', ink_colors = 3, quantity = 0,
    sizes = {}, deadline = '', notes = '', estimate = {},
  } = body;

  const quoteNum = String(Date.now()).slice(-6);
  const quoteDate = fmtDate();

  // Pricing (raw numbers stored in estimate, or fall back to parsing strings)
  const garment  = parseFloat(estimate.garment)  || 0;
  const print    = parseFloat(estimate.print)     || 0;
  const discount = parseFloat(estimate.discount)  || 0;
  const setup    = parseFloat(estimate.setup)     || 0;
  const total    = parseFloat(estimate.total)     || (garment + print + setup - discount);
  const discLabel = estimate.discLabel || '';

  const subtotal = garment + print - discount;

  // Build line items for table (2D array)
  const qtyStr = parseFloat(quantity).toFixed(2);
  const garmentRate = quantity > 0 ? garment / quantity : 0;
  const printRate   = quantity > 0 ? print   / quantity : 0;

  const rows = [
    ['1', `Garment — ${product}\n${shirt_color}`, qtyStr, fmt(garmentRate), fmt(garment)],
    ['2', `Screen Print — ${print_location}\n${ink_colors} ink color${ink_colors !== 1 ? 's' : ''}`, qtyStr, fmt(printRate), fmt(print)],
    ['3', `Setup Fee\nScreen setup · ${ink_colors} color${ink_colors !== 1 ? 's' : ''}`, '1.00', fmt(setup), fmt(setup)],
  ];
  if (discount > 0) {
    rows.push(['4', `Volume Discount\n${discLabel}`, '1', `-${fmt(discount)}`, `-${fmt(discount)}`]);
  }

  const deadlineStr = deadline || '—';
  const metaValues  = `${quoteDate}\nEstimate\n${deadlineStr}\nQUO-${quoteNum}\n0`;

  try {
    const [fontData, logoData] = await Promise.all([getFont(), getLogo()]);

    const font = { NotoSans: { data: fontData, fallback: true } };

    // ── TEMPLATE ──────────────────────────────────────────────────────────
    // A4: 210 × 297 mm
    const template = {
      basePdf: BLANK_PDF,
      schemas: [[
        // ── LOGO (top-left) ──────────────────────────────────────────────
        ...(logoData ? [{
          name: 'logo', type: 'image',
          position: { x: 15, y: 11 }, width: 60, height: 60,
        }] : []),

        // ── QUOTE TITLE (top-right) ──────────────────────────────────────
        {
          name: 'title', type: 'text',
          position: { x: 100, y: 13 }, width: 95, height: 22,
          fontSize: 30, fontColor: '#111111', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 4,
          fontName: 'NotoSans',
        },
        {
          name: 'quote_num', type: 'text',
          position: { x: 100, y: 37 }, width: 95, height: 8,
          fontSize: 11, fontColor: '#555555', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },
        {
          name: 'est_total_label', type: 'text',
          content: 'Estimated Total',
          position: { x: 100, y: 47 }, width: 95, height: 7,
          fontSize: 9, fontColor: '#888888', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },
        {
          name: 'est_total_header', type: 'text',
          position: { x: 100, y: 55 }, width: 95, height: 16,
          fontSize: 22, fontColor: '#111111', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },

        // ── COMPANY INFO ─────────────────────────────────────────────────
        {
          name: 'co_name', type: 'text', content: '11R Print',
          position: { x: 15, y: 80 }, width: 80, height: 8,
          fontSize: 11, fontColor: '#111111', backgroundColor: '',
          alignment: 'left', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },
        {
          name: 'co_info', type: 'text',
          content: 'Florida\nU.S.A\norders@11rprint.com',
          position: { x: 15, y: 89 }, width: 80, height: 22,
          fontSize: 10, fontColor: '#555555', backgroundColor: '',
          alignment: 'left', verticalAlignment: 'top',
          lineHeight: 1.65, characterSpacing: 0, fontName: 'NotoSans',
        },

        // ── QUOTE META LABELS (right-aligned) ────────────────────────────
        {
          name: 'meta_labels', type: 'text',
          content: 'Quote Date :\nTerms :\nRequested By :\nQuote # :\nDEPOSIT DUE :',
          position: { x: 88, y: 112 }, width: 68, height: 44,
          fontSize: 10, fontColor: '#888888', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'top',
          lineHeight: 2, characterSpacing: 0, fontName: 'NotoSans',
        },
        {
          name: 'meta_values', type: 'text',
          position: { x: 158, y: 112 }, width: 37, height: 44,
          fontSize: 10, fontColor: '#111111', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'top',
          lineHeight: 2, characterSpacing: 0, fontName: 'NotoSans',
        },

        // ── CUSTOMER NAME ─────────────────────────────────────────────────
        {
          name: 'customer_name', type: 'text',
          position: { x: 15, y: 157 }, width: 130, height: 9,
          fontSize: 13, fontColor: '#111111', backgroundColor: '',
          alignment: 'left', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },

        // ── LINE ITEMS TABLE ──────────────────────────────────────────────
        {
          name: 'line_items', type: 'table',
          position: { x: 15, y: 169 }, width: 180, height: 62,
          showHead: true, repeatHead: false,
          head: ['#', 'Description', 'Qty', 'Rate', 'Amount'],
          headWidthPercentages: [6, 52, 14, 14, 14],
          tableStyles: { borderColor: '#e0e0e0', borderWidth: 0.3 },
          headStyles: {
            fontName: 'NotoSans',
            alignment: 'left', verticalAlignment: 'middle',
            fontSize: 9, lineHeight: 1.4, characterSpacing: 0.3,
            fontColor: '#ffffff', backgroundColor: '#1a1a1a',
            borderColor: '', borderWidth: { top: 0, right: 0, bottom: 0, left: 0 },
            padding: { top: 5, right: 6, bottom: 5, left: 6 },
          },
          bodyStyles: {
            fontName: 'NotoSans',
            alignment: 'left', verticalAlignment: 'top',
            fontSize: 10, lineHeight: 1.5, characterSpacing: 0,
            fontColor: '#333333', backgroundColor: '',
            alternateBackgroundColor: '',
            borderColor: '#e8e8e8',
            borderWidth: { top: 0, right: 0, bottom: 0.3, left: 0 },
            padding: { top: 8, right: 6, bottom: 8, left: 6 },
          },
          columnStyles: { alignment: { 2: 'right', 3: 'right', 4: 'right' } },
        },

        // ── TOTALS SEPARATOR ─────────────────────────────────────────────
        {
          name: 'totals_sep', type: 'line',
          position: { x: 110, y: 233 }, width: 85, height: 0,
          color: '#dddddd',
        },

        // ── SUB TOTAL ────────────────────────────────────────────────────
        {
          name: 'sub_total_label', type: 'text', content: 'Sub Total',
          position: { x: 110, y: 235 }, width: 55, height: 7,
          fontSize: 10, fontColor: '#555555', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },
        {
          name: 'sub_total', type: 'text',
          position: { x: 167, y: 235 }, width: 28, height: 7,
          fontSize: 10, fontColor: '#111111', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },

        // ── TOTAL ────────────────────────────────────────────────────────
        {
          name: 'total_label', type: 'text', content: 'Total',
          position: { x: 110, y: 244 }, width: 55, height: 8,
          fontSize: 11, fontColor: '#111111', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },
        {
          name: 'total', type: 'text',
          position: { x: 167, y: 244 }, width: 28, height: 8,
          fontSize: 11, fontColor: '#111111', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },

        // ── ESTIMATED TOTAL ROW (highlighted) ────────────────────────────
        {
          name: 'est_bg', type: 'rectangle',
          position: { x: 108, y: 253 }, width: 87, height: 11,
          color: '#f0f0f0', borderWidth: 0, borderColor: '',
        },
        {
          name: 'est_row_label', type: 'text', content: 'Estimated Total',
          position: { x: 108, y: 254 }, width: 55, height: 9,
          fontSize: 11, fontColor: '#111111', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },
        {
          name: 'est_row_total', type: 'text',
          position: { x: 165, y: 254 }, width: 30, height: 9,
          fontSize: 11, fontColor: '#111111', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },

        // ── FOOTER ───────────────────────────────────────────────────────
        {
          name: 'footer_line', type: 'line',
          position: { x: 15, y: 271 }, width: 180, height: 0,
          color: '#dddddd',
        },
        {
          name: 'footer_thanks', type: 'text', content: 'Thanks for your business.',
          position: { x: 15, y: 274 }, width: 180, height: 7,
          fontSize: 10, fontColor: '#333333', backgroundColor: '',
          alignment: 'left', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },
        {
          name: 'footer_disc', type: 'text',
          content: 'This is an estimate only. Final pricing confirmed after artwork review within 1 business day.',
          position: { x: 15, y: 283 }, width: 180, height: 7,
          fontSize: 8.5, fontColor: '#888888', backgroundColor: '',
          alignment: 'left', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },
      ]],
    };

    // ── INPUTS ────────────────────────────────────────────────────────────
    const inputs = [{
      ...(logoData ? { logo: logoData } : {}),
      title: 'QUOTE ESTIMATE',
      quote_num: `# QUO-${quoteNum}`,
      est_total_header: fmt(total),
      meta_values: metaValues,
      customer_name: customer_name || 'Customer',
      line_items: JSON.stringify(rows),
      sub_total: fmt(subtotal),
      total: fmt(total),
      est_row_total: fmt(total),
    }];

    const pdf = await generate({
      template,
      inputs,
      options: { font },
      plugins: { text, image, table, line, rectangle },
    });

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="11rprint-quote-${quoteNum}.pdf"`,
      },
      body: Buffer.from(pdf).toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error('quote-pdf error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'PDF generation failed', detail: err.message }),
    };
  }
};
